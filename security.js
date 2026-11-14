(function () {
    // =========================================================================
    // GabySecurity: inicio de sesion seguro para clientes y personal.
    // - Contrasenas guardadas con hash PBKDF2-SHA256 (600,000 iteraciones + sal aleatoria),
    //   nunca en texto plano. Las cuentas viejas con contrasena en texto se migran al iniciar sesion.
    // - 3 intentos fallidos => la cuenta se bloquea y aparece en el panel privado de Angel,
    //   que decide si la desbloquea (y entonces se exige cambiar la contrasena) o la deja bloqueada.
    // - Espera progresiva entre intentos fallidos en el mismo navegador.
    // - Con Supabase (GabyCloud.enabled): Auth guarda las contrasenas con bcrypt y el conteo de
    //   intentos/bloqueos vive en la base de datos (funciones login_guard / register_failed_login).
    // =========================================================================
    const LOCK_AFTER = 3;
    const ITERATIONS = 600000;
    const STAFF_SESSION_KEY = 'gs_staff_session';
    const STAFF_SESSION_HOURS = 8;
    const SHOP_PHONE = '787-218-1068';

    // Cuentas del personal. Las contrasenas iniciales solo existen como hash y se exige cambiarlas
    // en el primer inicio de sesion (las anteriores estaban escritas en el codigo y no son seguras).
    const STAFF_ACCOUNTS = [
        { email: 'gaby@goatstylesalon.com', barberId: 'gabriel', isAdmin: true, portal: 'staff/gaby/index.html',
            seed: { algo: 'PBKDF2-SHA256', iterations: 600000, salt: 'keK2mQa1Vs8viHaqYPT9fA==', hash: 'PyID1mnj4hF4Jb5RfY6lM7PGe+zCzpSGTrMXFhKSLvY=' } },
        { email: 'darialex@goatstylesalon.com', barberId: 'darialex', isAdmin: false, portal: 'staff/darialex/index.html',
            seed: { algo: 'PBKDF2-SHA256', iterations: 600000, salt: 'upRco8aygXCNVjfT2Rok7A==', hash: 'zc879+guns6GH0bl3kCkuSorFN4rNyYQUd/ky542pAc=' } },
        { email: 'wilo@goatstylesalon.com', barberId: 'wilo', isAdmin: false, portal: 'staff/wilo/index.html',
            seed: { algo: 'PBKDF2-SHA256', iterations: 600000, salt: 'DqtUm5fxTJfSkhVehoNksA==', hash: 'GyJFp0Cwd02KscuUj0EUiThTw3ZyiFSB9oT8QQBSab4=' } }
    ];

    const cloud = () => Boolean(window.GabyCloud && window.GabyCloud.enabled);
    const normalizeEmail = email => String(email || '').trim().toLowerCase();
    const db = () => window.GabyData.getState();

    // ---------------------------------------------------------------------
    // Hash de contrasenas (WebCrypto)
    // ---------------------------------------------------------------------
    const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
    const fromBase64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));

    async function derive(password, salt, iterations) {
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    }

    async function hashPassword(password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const hash = await derive(password, salt, ITERATIONS);
        return { algo: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toBase64(salt), hash: toBase64(hash) };
    }

    async function verifyPassword(password, record) {
        if (!record || !record.hash) return false;
        const actual = new Uint8Array(await derive(password, fromBase64(record.salt), record.iterations || ITERATIONS));
        const expected = fromBase64(record.hash);
        if (actual.length !== expected.length) return false;
        let diff = 0;
        for (let i = 0; i < actual.length; i += 1) diff |= actual[i] ^ expected[i]; // comparacion de tiempo constante
        return diff === 0;
    }

    // ---------------------------------------------------------------------
    // Cuentas
    // ---------------------------------------------------------------------
    function staffAccount(email) {
        return STAFF_ACCOUNTS.find(account => account.email === normalizeEmail(email)) || null;
    }

    function staffAuth(state, email) {
        const account = staffAccount(email);
        if (!account) return null;
        const saved = (state.security.staffAuth || {})[account.email];
        return saved || { passwordHash: account.seed, mustChangePassword: true };
    }

    function findAccount(email, type) {
        const state = db();
        const mail = normalizeEmail(email);
        if (type === 'staff') {
            const account = staffAccount(mail);
            if (!account) return null;
            const barber = state.barbers.find(item => item.id === account.barberId) || {};
            return { type: 'staff', email: mail, id: account.barberId, name: barber.name || account.barberId, phone: barber.phone || '', account, auth: staffAuth(state, mail) };
        }
        const client = state.clients.find(item => normalizeEmail(item.email) === mail);
        return client ? { type: 'client', email: mail, id: client.id, name: client.name, phone: client.phone || '', client } : null;
    }

    function activeLock(state, email) {
        return (state.security.locks || []).find(lock => lock.email === normalizeEmail(email) && lock.status !== 'DESBLOQUEADA') || null;
    }

    function isLocked(email) {
        return Boolean(activeLock(db(), email));
    }

    // Espera progresiva en este navegador: 0s, 2s, 4s, 8s... despues de cada fallo.
    function waitSeconds(email) {
        try {
            const raw = JSON.parse(sessionStorage.getItem('gs_login_throttle') || '{}')[normalizeEmail(email)];
            if (!raw) return 0;
            const delay = Math.min(30, 2 ** Math.max(0, raw.count - 1)) * 1000;
            const remaining = raw.at + delay - Date.now();
            return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
        } catch (error) {
            return 0;
        }
    }

    function noteThrottle(email, success) {
        try {
            const all = JSON.parse(sessionStorage.getItem('gs_login_throttle') || '{}');
            const key = normalizeEmail(email);
            if (success) delete all[key];
            else all[key] = { count: ((all[key] && all[key].count) || 0) + 1, at: Date.now() };
            sessionStorage.setItem('gs_login_throttle', JSON.stringify(all));
        } catch (error) { /* almacenamiento bloqueado */ }
    }

    // Registra un intento fallido. Al tercero, si la cuenta existe, se crea el bloqueo.
    function registerFailure(email, type, account) {
        const mail = normalizeEmail(email);
        let count = 0;
        let lockedNow = false;
        window.GabyData.updateState(state => {
            const attempts = state.security.attempts;
            const entry = attempts[mail] || { count: 0, type };
            entry.count += 1;
            entry.lastAt = new Date().toISOString();
            entry.type = type;
            attempts[mail] = entry;
            count = entry.count;
            if (count >= LOCK_AFTER && account && !activeLock(state, mail)) {
                lockedNow = true;
                state.security.locks.unshift({
                    id: window.GabyData.makeId('lock'),
                    email: mail,
                    accountType: type,
                    accountId: account.id,
                    attempts: count,
                    lockedAt: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    status: 'BLOQUEADA'
                });
            }
        });
        return { count, lockedNow };
    }

    function clearFailures(email) {
        const mail = normalizeEmail(email);
        window.GabyData.updateState(state => { delete state.security.attempts[mail]; });
    }

    // ---------------------------------------------------------------------
    // Inicio de sesion
    // ---------------------------------------------------------------------
    const MESSAGES = {
        locked: `Por seguridad, esta cuenta está bloqueada después de ${LOCK_AFTER} intentos fallidos. Comunícate con la barbería al ${SHOP_PHONE} para verificar tu identidad y desbloquearla.`,
        invalid: left => `Correo o contraseña incorrectos.${left > 0 ? ` Te queda${left === 1 ? '' : 'n'} ${left} intento${left === 1 ? '' : 's'} antes de que la cuenta se bloquee por seguridad.` : ''}`,
        wait: seconds => `Por seguridad, espera ${seconds} segundo${seconds === 1 ? '' : 's'} antes de intentar de nuevo.`
    };

    async function login({ email, password, type }) {
        const mail = normalizeEmail(email);
        const kind = type === 'staff' ? 'staff' : 'client';
        const wait = waitSeconds(mail);
        if (wait) return { ok: false, reason: 'wait', message: MESSAGES.wait(wait) };
        if (cloud()) return cloudLogin(mail, password, kind);

        if (isLocked(mail)) return { ok: false, reason: 'locked', message: MESSAGES.locked };
        const account = findAccount(mail, kind);
        let ok = false;
        if (account && kind === 'staff') {
            ok = await verifyPassword(password, account.auth.passwordHash);
        } else if (account) {
            const client = account.client;
            if (client.passwordHash) ok = await verifyPassword(password, client.passwordHash);
            else if (typeof client.password === 'string') ok = client.password === password; // cuenta vieja: se migra abajo
        }

        if (!ok) {
            noteThrottle(mail, false);
            const { count } = registerFailure(mail, kind, account);
            // Tambien se "bloquea" un correo inexistente para no revelar que cuentas existen.
            if (count >= LOCK_AFTER) return { ok: false, reason: 'locked', message: MESSAGES.locked };
            return { ok: false, reason: 'invalid', message: MESSAGES.invalid(LOCK_AFTER - count), attemptsLeft: LOCK_AFTER - count };
        }

        noteThrottle(mail, true);
        clearFailures(mail);
        if (kind === 'client' && !account.client.passwordHash) {
            const passwordHash = await hashPassword(password);
            window.GabyData.updateState(state => {
                const target = state.clients.find(item => item.id === account.id);
                if (!target) return;
                target.passwordHash = passwordHash;
                delete target.password;
            });
        }
        const mustChangePassword = kind === 'staff' ? Boolean(account.auth.mustChangePassword) : Boolean(account.client.mustChangePassword);
        if (kind === 'staff') startStaffSession(account.account);
        return { ok: true, account, mustChangePassword, portal: kind === 'staff' ? account.account.portal : null };
    }

    async function cloudLogin(mail, password, kind) {
        const client = await window.GabyCloud.getClient();
        const guard = await client.rpc('login_guard', { p_email: mail });
        if (guard.data && guard.data.locked) return { ok: false, reason: 'locked', message: MESSAGES.locked };
        try {
            const result = kind === 'staff' ? await window.GabyCloud.staffSignIn(mail, password) : await window.GabyCloud.signIn(mail, password);
            noteThrottle(mail, true);
            await client.rpc('clear_login_attempts');
            const must = await client.rpc('must_change_password');
            return { ok: true, mustChangePassword: must.data === true, portal: result.portal || null };
        } catch (error) {
            if (!/incorrectos/i.test(error.userMessage || '')) return { ok: false, reason: 'error', message: error.userMessage || 'No se pudo iniciar sesión.' };
            noteThrottle(mail, false);
            const { data } = await client.rpc('register_failed_login', { p_email: mail, p_user_agent: navigator.userAgent, p_account_type: kind });
            if (data && data.locked) return { ok: false, reason: 'locked', message: MESSAGES.locked };
            const left = data ? data.attempts_left : LOCK_AFTER - 1;
            return { ok: false, reason: 'invalid', message: MESSAGES.invalid(left), attemptsLeft: left };
        }
    }

    // ---------------------------------------------------------------------
    // Crear / cambiar contrasena (las reglas se validan aqui otra vez, no solo en el formulario)
    // ---------------------------------------------------------------------
    function policyErrors(password, context) {
        if (!window.GabyPassword) return [];
        return window.GabyPassword.evaluate(password, context).errors;
    }

    async function createClientPasswordHash(password, context) {
        const errors = policyErrors(password, context);
        if (errors.length) throw Object.assign(new Error('policy'), { userMessage: errors[0] });
        return hashPassword(password);
    }

    async function setPassword({ type, email, newPassword, context }) {
        const mail = normalizeEmail(email);
        const account = findAccount(mail, type);
        const errors = policyErrors(newPassword, { name: account && account.name, email: mail, ...(context || {}) });
        if (errors.length) throw Object.assign(new Error('policy'), { userMessage: errors[0] });

        if (cloud()) {
            await window.GabyCloud.updatePassword(newPassword);
            const client = await window.GabyCloud.getClient();
            await client.rpc('clear_must_change_password');
            return;
        }
        if (!account) throw Object.assign(new Error('account'), { userMessage: 'No encontramos la cuenta.' });
        const passwordHash = await hashPassword(newPassword);
        const ok = await window.GabyData.commit(state => {
            if (type === 'staff') {
                state.security.staffAuth[mail] = { passwordHash, mustChangePassword: false, updatedAt: new Date().toISOString() };
            } else {
                const target = state.clients.find(item => item.id === account.id);
                if (!target) throw Object.assign(new Error('account'), { userMessage: 'No encontramos la cuenta.' });
                target.passwordHash = passwordHash;
                delete target.password;
                target.mustChangePassword = false;
                target.passwordUpdatedAt = new Date().toISOString();
            }
        }, { success: null, error: 'No se pudo guardar la nueva contraseña.' });
        if (!ok) throw Object.assign(new Error('save'), { userMessage: 'No se pudo guardar la nueva contraseña.' });
    }

    async function changePassword({ type, email, currentPassword, newPassword }) {
        if (currentPassword === newPassword) {
            throw Object.assign(new Error('same'), { userMessage: 'La nueva contraseña debe ser diferente a tu contraseña actual.' });
        }
        const mail = normalizeEmail(email);
        if (cloud()) {
            const client = await window.GabyCloud.getClient();
            const { error } = await client.auth.signInWithPassword({ email: mail, password: currentPassword });
            if (error) throw Object.assign(new Error('current'), { userMessage: 'Tu contraseña actual no es correcta.' });
        } else {
            const account = findAccount(mail, type);
            let ok = false;
            if (account && type === 'staff') ok = await verifyPassword(currentPassword, account.auth.passwordHash);
            else if (account && account.client.passwordHash) ok = await verifyPassword(currentPassword, account.client.passwordHash);
            else if (account) ok = account.client.password === currentPassword;
            if (!ok) throw Object.assign(new Error('current'), { userMessage: 'Tu contraseña actual no es correcta.' });
        }
        await setPassword({ type, email: mail, newPassword, context: { current: currentPassword } });
    }

    // ---------------------------------------------------------------------
    // Bloqueos (los usa el panel privado de Angel)
    // ---------------------------------------------------------------------
    async function resolveLock(lockId, status) {
        // Con Supabase el bloqueo vive en la base de datos (funcion resolve_account_lock).
        if (cloud()) {
            try {
                const client = await window.GabyCloud.getClient();
                const { error } = await client.rpc('resolve_account_lock', { p_lock_id: lockId, p_unlock: status === 'DESBLOQUEADA' });
                if (error) throw error;
                await window.GabyCloud.pull();
                window.GabyData.toast(status === 'DESBLOQUEADA' ? 'Cuenta desbloqueada. Se le pedirá cambiar la contraseña al iniciar sesión.' : 'La cuenta se mantiene bloqueada.', 'success');
                return true;
            } catch (error) {
                window.GabyData.toast('No se pudo actualizar el bloqueo.', 'error');
                return false;
            }
        }
        let lock = null;
        return window.GabyData.commit(state => {
            lock = state.security.locks.find(item => item.id === lockId);
            if (!lock) throw Object.assign(new Error('lock'), { userMessage: 'No se encontró el bloqueo.' });
            lock.status = status;
            lock.resolvedAt = new Date().toISOString();
            lock.resolvedBy = 'Angel';
            if (status === 'DESBLOQUEADA') {
                delete state.security.attempts[lock.email];
                // Al desbloquear se exige crear una contrasena nueva en el proximo inicio de sesion.
                if (lock.accountType === 'staff') {
                    const current = staffAuth(state, lock.email);
                    state.security.staffAuth[lock.email] = { ...current, mustChangePassword: true };
                } else {
                    const client = state.clients.find(item => item.id === lock.accountId || normalizeEmail(item.email) === lock.email);
                    if (client) client.mustChangePassword = true;
                }
            }
        }, {
            success: status === 'DESBLOQUEADA' ? 'Cuenta desbloqueada. Se le pedirá cambiar la contraseña al iniciar sesión.' : 'La cuenta se mantiene bloqueada.',
            error: 'No se pudo actualizar el bloqueo.'
        });
    }

    // ---------------------------------------------------------------------
    // Sesion del personal (paneles de barberos)
    // ---------------------------------------------------------------------
    function startStaffSession(account) {
        try {
            localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({ email: account.email, barberId: account.barberId, isAdmin: account.isAdmin, exp: Date.now() + STAFF_SESSION_HOURS * 3600 * 1000 }));
        } catch (error) { /* almacenamiento bloqueado */ }
    }

    function getStaffSession() {
        try {
            const session = JSON.parse(localStorage.getItem(STAFF_SESSION_KEY) || 'null');
            if (!session || session.exp < Date.now()) return null;
            if (isLocked(session.email)) return null;
            return session;
        } catch (error) {
            return null;
        }
    }

    function endStaffSession() {
        try { localStorage.removeItem(STAFF_SESSION_KEY); } catch (error) { /* nada */ }
    }

    // ---------------------------------------------------------------------
    // Ventana para crear la contrasena nueva (obligatoria tras desbloqueo o primer acceso del personal)
    // ---------------------------------------------------------------------
    function injectModalStyles() {
        if (document.getElementById('gaby-security-styles')) return;
        const style = document.createElement('style');
        style.id = 'gaby-security-styles';
        style.textContent = `
            .sec-modal { position: fixed; inset: 0; z-index: 7000; background: rgba(0,0,0,.72); display: flex; align-items: center; justify-content: center; padding: 1rem; font-family: 'Inter', system-ui, sans-serif; }
            .sec-card { width: min(520px, 100%); max-height: 92vh; overflow: auto; background: #121212; color: #f5f1e8; border: 1px solid rgba(212,175,55,.35); border-radius: 22px; padding: 1.5rem; display: grid; gap: 1rem; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
            body.light-mode .sec-card { background: #fff; color: #111; }
            .sec-card h2 { margin: 0; font-size: 1.25rem; font-family: 'Cinzel', serif; color: #d4af37; }
            .sec-card p { margin: 0; font-size: .9rem; line-height: 1.55; opacity: .85; }
            .sec-card form { display: grid; gap: .9rem; }
            .sec-card label { display: grid; gap: .4rem; font-size: .85rem; font-weight: 600; }
            .sec-card input { width: 100%; border-radius: 12px; border: 1px solid rgba(212,175,55,.3); background: rgba(255,255,255,.04); color: inherit; padding: .85rem 1rem; font: inherit; }
            body.light-mode .sec-card input { background: #fff; border-color: rgba(0,0,0,.15); }
            .sec-card input:focus { outline: none; border-color: #d4af37; box-shadow: 0 0 0 3px rgba(212,175,55,.18); }
            .sec-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
            .sec-btn { border: 0; border-radius: 999px; padding: .85rem 1.3rem; font: inherit; font-weight: 800; cursor: pointer; background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); color: #111; }
            .sec-btn.ghost { background: transparent; color: inherit; border: 1px solid rgba(212,175,55,.4); }
            .sec-btn:disabled { opacity: .6; cursor: wait; }
            .sec-error { color: #ff6b6b; font-size: .85rem; min-height: 1em; }
        `;
        document.head.appendChild(style);
    }

    // options: { type, email, name, title, message, requireCurrent, allowCancel }
    function promptPasswordChange(options) {
        injectModalStyles();
        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'sec-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.innerHTML = `
                <div class="sec-card">
                    <h2>${options.title || 'Crea una contraseña nueva'}</h2>
                    <p>${options.message || 'Por seguridad, debes crear una contraseña nueva antes de continuar.'}</p>
                    <form novalidate data-no-required-legend>
                        <input type="email" autocomplete="username" value="${String(options.email || '').replace(/"/g, '&quot;')}" hidden>
                        ${options.requireCurrent ? '<label>Contraseña actual<input type="password" name="current" required></label>' : ''}
                        <label>Nueva contraseña<input type="password" name="password" required></label>
                        <label>Confirmar nueva contraseña<input type="password" name="confirm" required></label>
                        <div class="sec-error" role="alert"></div>
                        <div class="sec-actions">
                            <button class="sec-btn" type="submit">Guardar contraseña</button>
                            ${options.allowCancel ? '<button class="sec-btn ghost" type="button" data-cancel>Cancelar</button>' : ''}
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
            const form = modal.querySelector('form');
            const current = form.querySelector('[name=current]');
            const input = form.querySelector('[name=password]');
            const confirm = form.querySelector('[name=confirm]');
            const errorBox = form.querySelector('.sec-error');
            const policy = window.GabyPassword.attach({ input, confirm, current, getContext: () => ({ name: options.name, email: options.email }) });
            (current || input).focus();
            const close = result => { modal.remove(); resolve(result); };
            form.querySelector('[data-cancel]')?.addEventListener('click', () => close(false));
            form.addEventListener('submit', async event => {
                event.preventDefault();
                const errors = policy.errors();
                if (current && !current.value) errors.unshift('Escribe tu contraseña actual.');
                if (errors.length) {
                    errorBox.textContent = errors[0];
                    return;
                }
                const button = form.querySelector('[type=submit]');
                button.disabled = true;
                button.textContent = 'Guardando...';
                try {
                    if (current) await changePassword({ type: options.type, email: options.email, currentPassword: current.value, newPassword: input.value });
                    else await setPassword({ type: options.type, email: options.email, newPassword: input.value });
                    if (window.GabyToast) window.GabyToast.show('Tu contraseña se actualizó correctamente.', 'success');
                    close(true);
                } catch (error) {
                    errorBox.textContent = error.userMessage || 'No se pudo guardar la contraseña.';
                    button.disabled = false;
                    button.textContent = 'Guardar contraseña';
                }
            });
        });
    }

    window.GabySecurity = {
        LOCK_AFTER,
        STAFF_ACCOUNTS,
        hashPassword,
        verifyPassword,
        createClientPasswordHash,
        login,
        setPassword,
        changePassword,
        isLocked,
        findAccount,
        unlock: lockId => resolveLock(lockId, 'DESBLOQUEADA'),
        keepLocked: lockId => resolveLock(lockId, 'MANTENER_BLOQUEADA'),
        startStaffSession,
        getStaffSession,
        endStaffSession,
        promptPasswordChange,
        messages: MESSAGES
    };
})();
