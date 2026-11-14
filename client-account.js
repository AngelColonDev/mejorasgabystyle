(function () {
    // =========================================================================
    // Mi cuenta (cliente): citas proximas / historial / canceladas, reprogramar, cancelar,
    // anadir al calendario, reservar nuevamente, resenas, notificaciones, lista de espera
    // y favoritos. Se monta en profile.html y en el portal del cliente del index.
    // =========================================================================
    const B = () => window.GabyBooking;
    const Data = () => window.GabyData;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const STATUS_CLASS = { PENDIENTE: 'pending', APROBADA: 'ok', COMPLETADA: 'done', CANCELADA: 'bad', NO_SHOW: 'bad', RECHAZADA: 'bad' };

    function injectStyles() {
        if (document.getElementById('client-account-styles')) return;
        const style = document.createElement('style');
        style.id = 'client-account-styles';
        style.textContent = `
            .ca { --ca-gold: #d4af37; --ca-line: rgba(255,255,255,.1); --ca-card: rgba(255,255,255,.035); --ca-muted: #a59f90; display: grid; gap: 1rem; font-family: 'Inter', system-ui, sans-serif; text-align: left; }
            body.light-mode .ca { --ca-line: rgba(0,0,0,.1); --ca-card: rgba(0,0,0,.025); --ca-muted: #5c5c5c; }
            .ca-reminder { display: flex; gap: .8rem; align-items: center; padding: .9rem 1rem; border-radius: 14px; background: rgba(212,175,55,.12); border: 1px solid rgba(212,175,55,.45); font-weight: 600; }
            .ca-reminder i { color: var(--ca-gold); font-size: 1.2rem; }
            .ca-tabs { display: flex; gap: .4rem; overflow-x: auto; padding-bottom: .2rem; }
            .ca-tab { flex: 0 0 auto; border: 1px solid var(--ca-line); background: transparent; color: inherit; border-radius: 999px; padding: .55rem .95rem; font: inherit; font-size: .82rem; font-weight: 700; cursor: pointer; }
            .ca-tab.active { background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); color: #111; border-color: transparent; }
            .ca-tab .ca-badge { display: inline-block; min-width: 1.3em; margin-left: .3rem; padding: 0 .35rem; border-radius: 99px; background: #e5484d; color: #fff; font-size: .72rem; }
            .ca-list { display: grid; gap: .7rem; }
            .ca-item { border: 1px solid var(--ca-line); background: var(--ca-card); border-radius: 16px; padding: 1rem; display: grid; gap: .6rem; }
            .ca-item-head { display: flex; justify-content: space-between; gap: .8rem; align-items: flex-start; flex-wrap: wrap; }
            .ca-item-head strong { font-size: 1rem; }
            .ca-when { font-weight: 700; color: var(--ca-gold); text-transform: capitalize; }
            .ca-meta { color: var(--ca-muted); font-size: .84rem; line-height: 1.55; }
            .ca-chip { display: inline-flex; padding: .25rem .65rem; border-radius: 99px; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
            .ca-chip.ok { background: rgba(63,185,80,.16); color: #3fb950; }
            .ca-chip.pending { background: rgba(241,190,93,.18); color: #d9a33f; }
            .ca-chip.done { background: rgba(88,166,255,.16); color: #58a6ff; }
            .ca-chip.bad { background: rgba(229,72,77,.16); color: #ff6b6b; }
            .ca-actions { display: flex; gap: .45rem; flex-wrap: wrap; }
            .ca-btn { display: inline-flex; align-items: center; gap: .4rem; border-radius: 999px; padding: .5rem .85rem; font: inherit; font-size: .78rem; font-weight: 700; border: 1px solid rgba(212,175,55,.45); background: transparent; color: inherit; cursor: pointer; text-decoration: none; }
            .ca-btn.primary { background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); color: #111; border-color: transparent; }
            .ca-btn.danger { border-color: rgba(229,72,77,.6); color: #ff6b6b; }
            .ca-btn:focus-visible, .ca-tab:focus-visible { outline: 2px solid var(--ca-gold); outline-offset: 2px; }
            .ca-empty { color: var(--ca-muted); font-size: .9rem; padding: .6rem 0; }
            .ca-notif { border-left: 3px solid transparent; }
            .ca-notif.unread { border-left-color: var(--ca-gold); background: rgba(212,175,55,.07); }
            .ca-section-title { font-size: .78rem; text-transform: uppercase; letter-spacing: .12em; color: var(--ca-gold); font-weight: 800; margin-top: .4rem; }
            .ca-fav { display: grid; gap: .7rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); align-items: end; }
            .ca-field { display: grid; gap: .35rem; font-size: .84rem; font-weight: 600; }
            .ca-field select, .ca-field textarea { width: 100%; border-radius: 12px; border: 1px solid var(--ca-line); background: var(--ca-card); color: inherit; padding: .7rem .85rem; font: inherit; font-weight: 400; }
            body:not(.light-mode) .ca-field select option { background: #161616; color: #f5f1e8; }
            .ca-modal { position: fixed; inset: 0; z-index: 6500; background: rgba(0,0,0,.72); display: flex; align-items: flex-start; justify-content: center; padding: 1rem; overflow-y: auto; }
            .ca-modal-card { width: min(640px, 100%); margin: auto 0; background: #121212; color: #f5f1e8; border: 1px solid rgba(212,175,55,.35); border-radius: 22px; padding: 1.4rem; display: grid; gap: 1rem; position: relative; }
            body.light-mode .ca-modal-card { background: #fff; color: #111; }
            .ca-modal-card h3 { margin: 0; font-family: 'Cinzel', serif; color: #d4af37; font-size: 1.2rem; }
            .ca-close { position: absolute; top: .8rem; right: .8rem; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(212,175,55,.35); background: transparent; color: inherit; cursor: pointer; }
            .ca-stars { display: flex; gap: .35rem; }
            .ca-stars label { cursor: pointer; font-size: 1.9rem; color: #555; line-height: 1; }
            .ca-stars input { position: absolute; opacity: 0; width: 1px; height: 1px; }
            .ca-stars label.on { color: #d4af37; }
            .ca-stars input:focus-visible + span { outline: 2px solid #d4af37; border-radius: 4px; }
            .ca-consent { display: grid; gap: .5rem; padding: .9rem; border-radius: 14px; border: 1px solid rgba(212,175,55,.35); }
            .ca-consent legend { font-weight: 700; font-size: .9rem; padding: 0 .3rem; }
            .ca-consent label { display: flex; gap: .55rem; align-items: flex-start; font-size: .88rem; cursor: pointer; }
            .ca-consent input { margin-top: .2rem; accent-color: #d4af37; }
            .ca-req { color: #ff5f5f; font-weight: 800; }
        `;
        document.head.appendChild(style);
    }

    function currentClient() {
        const state = Data().getState();
        return state.clients.find(client => client.id === state.session.currentClientId) || null;
    }

    function whenText(appointment) {
        const key = String(appointment.dateTime).slice(0, 10);
        return `${B().relativeDay(key) === 'Hoy' || B().relativeDay(key) === 'Mañana' ? `${B().relativeDay(key)}, ` : ''}${B().formatDate(key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${B().formatTime(String(appointment.dateTime).slice(11, 16))}`;
    }

    function modal(html) {
        const overlay = document.createElement('div');
        overlay.className = 'ca-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `<div class="ca-modal-card"><button class="ca-close" type="button" aria-label="Cerrar"><i class="fas fa-times"></i></button>${html}</div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.ca-close').addEventListener('click', close);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
        return { overlay, card: overlay.querySelector('.ca-modal-card'), close };
    }

    // ---------------------------------------------------------------------
    function mount(root, options) {
        injectStyles();
        const opts = options || {};
        let tab = opts.tab || (window.location.hash === '#notificaciones' ? 'notifications' : 'upcoming');
        let busy = false;
        root.classList.add('ca');

        // Recordatorios: se generan una sola vez por cita (24 h antes por defecto).
        // Terminar el montaje antes de emitir cambios: el inicio también escucha
        // gabydatachange y, de lo contrario, vuelve a montar el portal recursivamente.
        queueMicrotask(() => {
            const me = currentClient();
            if (me && B().upcomingReminders(me.id).some(appointment => !appointment.reminderSentAt)) {
                Data().updateState(state => { B().generateReminders(state, me.id); });
            }
        });

        function render() {
            if (busy) return;
            const client = currentClient();
            if (!client) {
                root.innerHTML = '<div class="ca-empty">Inicia sesión para ver tus citas.</div>';
                return;
            }
            const state = Data().getState();
            const stats = B().clientStats(client.id, state);
            const history = stats.history.filter(item => ['COMPLETADA', 'NO_SHOW', 'RECHAZADA'].includes(item.status) || (B().ACTIVE.includes(item.status) && B().parseLocal(item.dateTime) < new Date()));
            const cancelled = stats.history.filter(item => item.status === 'CANCELADA');
            const notifications = state.notifications.filter(n => n.audience !== 'staff' && n.clientId === client.id);
            const unread = notifications.filter(n => !n.readAt).length;
            const reviewable = B().reviewableAppointments(client.id, state);
            const waits = state.waitlist.filter(entry => entry.clientId === client.id && entry.status !== 'CERRADA');
            const reminders = B().upcomingReminders(client.id, state);

            root.innerHTML = `
                ${reminders.map(item => `<div class="ca-reminder" role="status"><i class="fas fa-bell"></i><span>${escapeHtml(B().reminderText(item))}</span></div>`).join('')}
                ${reviewable.length ? `<div class="ca-reminder"><i class="fas fa-star"></i><span>Tienes ${reviewable.length} cita${reviewable.length === 1 ? '' : 's'} completada${reviewable.length === 1 ? '' : 's'} sin reseña. <button class="ca-btn" type="button" data-tab-go="history">Dejar reseña</button></span></div>` : ''}
                <div class="ca-tabs" role="tablist">
                    ${[['upcoming', `Próximas (${stats.upcoming.length})`], ['history', 'Historial'], ['cancelled', 'Canceladas'], ['notifications', 'Notificaciones', unread], ['more', 'Favoritos y espera']]
                        .map(([id, label, badge]) => `<button class="ca-tab ${tab === id ? 'active' : ''}" role="tab" aria-selected="${tab === id}" data-tab="${id}">${label}${badge ? `<span class="ca-badge">${badge}</span>` : ''}</button>`).join('')}
                </div>
                <div class="ca-list">${({ upcoming: () => renderUpcoming(stats.upcoming), history: () => renderHistory(history, state), cancelled: () => renderCancelled(cancelled), notifications: () => renderNotifications(notifications), more: () => renderMore(client, waits, state) })[tab]()}</div>
            `;
            root.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.tab; render(); if (tab === 'notifications') markRead(); }));
            root.querySelectorAll('[data-tab-go]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.tabGo; render(); }));
            bindActions();
        }

        function appointmentCard(item, actions) {
            return `
                <article class="ca-item">
                    <div class="ca-item-head">
                        <div><div class="ca-when">${escapeHtml(whenText(item))}</div><strong>${escapeHtml(item.service)}</strong></div>
                        <span class="ca-chip ${STATUS_CLASS[item.status] || ''}">${escapeHtml(B().statusLabel(item.status))}</span>
                    </div>
                    <div class="ca-meta">${escapeHtml(item.barberName || B().barberLabel(Data().getState(), item.barber))} · ${B().formatDuration(B().appointmentDuration(item))} · ${escapeHtml(item.price || '')} (pago presencial) · Código ${escapeHtml(item.code)}</div>
                    ${actions ? `<div class="ca-actions">${actions}</div>` : ''}
                </article>
            `;
        }

        function renderUpcoming(list) {
            if (!list.length) return `<div class="ca-empty">No tienes citas próximas. <a class="ca-btn primary" href="booking.html">Reservar cita</a></div>`;
            return list.map(item => {
                const check = B().clientCanChange(item);
                return appointmentCard(item, `
                    <a class="ca-btn" href="${B().googleCalendarUrl(item)}" target="_blank" rel="noopener"><i class="fab fa-google"></i> Google Calendar</a>
                    <button class="ca-btn" type="button" data-ics="${item.code}"><i class="fas fa-calendar-plus"></i> Apple / .ics</button>
                    ${check.ok ? `<button class="ca-btn" type="button" data-reschedule="${item.code}"><i class="fas fa-clock-rotate-left"></i> Reprogramar</button>
                    <button class="ca-btn danger" type="button" data-cancel="${item.code}"><i class="fas fa-xmark"></i> Cancelar</button>` : `<span class="ca-meta">${escapeHtml(check.reason)}</span>`}
                `);
            }).join('');
        }

        function renderHistory(list, state) {
            if (!list.length) return '<div class="ca-empty">Todavía no tienes citas en tu historial.</div>';
            return list.map(item => {
                const review = state.reviews.find(r => r.appointmentCode === item.code);
                const again = `booking.html?barber=${encodeURIComponent(item.barber)}&service=${encodeURIComponent(B().appointmentServiceNames(item).join(' + '))}`;
                return appointmentCard(item, `
                    <a class="ca-btn primary" href="${again}"><i class="fas fa-rotate-right"></i> Reservar nuevamente</a>
                    ${item.status === 'COMPLETADA' ? (review ? `<span class="ca-meta">Tu reseña: ${'★'.repeat(review.rating)}${review.publishConsent ? '' : ' (no publicada)'}</span>` : `<button class="ca-btn" type="button" data-review="${item.code}"><i class="fas fa-star"></i> Dejar reseña</button>`) : ''}
                `);
            }).join('');
        }

        function renderCancelled(list) {
            if (!list.length) return '<div class="ca-empty">No tienes citas canceladas.</div>';
            return list.map(item => appointmentCard(item, `<span class="ca-meta">Cancelada por ${escapeHtml(item.canceledBy || (item.canceledByClient ? 'cliente' : 'la barbería'))}${item.canceledAt ? ` el ${new Date(item.canceledAt).toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}${item.cancelReason ? ` · Motivo: ${escapeHtml(item.cancelReason)}` : ''}</span>
                <a class="ca-btn" href="booking.html?barber=${encodeURIComponent(item.barber)}&service=${encodeURIComponent(B().appointmentServiceNames(item).join(' + '))}"><i class="fas fa-rotate-right"></i> Reservar nuevamente</a>`)).join('');
        }

        function renderNotifications(list) {
            if (!list.length) return '<div class="ca-empty">No tienes notificaciones.</div>';
            return list.slice(0, 50).map(n => `
                <article class="ca-item ca-notif ${n.readAt ? '' : 'unread'}">
                    <div class="ca-item-head"><strong>${escapeHtml(n.title)}</strong><span class="ca-meta">${new Date(n.createdAt).toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
                    <div class="ca-meta">${escapeHtml(n.body)}</div>
                    ${n.type === 'espera' ? '<div class="ca-actions"><a class="ca-btn primary" href="booking.html">Reservar ahora</a></div>' : ''}
                </article>
            `).join('');
        }

        function renderMore(client, waits, state) {
            const favorites = client.favorites || {};
            const services = state.services.filter(s => s.active);
            return `
                <div class="ca-section-title">Favoritos</div>
                <p class="ca-meta">Al reservar te sugerimos primero estas opciones.</p>
                <div class="ca-fav">
                    <label class="ca-field">Barbero favorito<select id="ca-fav-barber"><option value="">Sin preferencia</option>${state.barbers.filter(b => b.active !== false).map(b => `<option value="${b.id}" ${(favorites.barberId || client.preferredBarber) === b.id ? 'selected' : ''}>${escapeHtml(b.alias || b.name)}</option>`).join('')}</select></label>
                    <label class="ca-field">Servicio favorito<select id="ca-fav-service"><option value="">Sin preferencia</option>${services.map(s => `<option ${favorites.service === s.name ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></label>
                    <button class="ca-btn primary" type="button" data-save-fav><i class="fas fa-heart"></i> Guardar favoritos</button>
                </div>
                <div class="ca-section-title">Lista de espera</div>
                ${waits.length ? waits.map(entry => `
                    <article class="ca-item">
                        <div class="ca-item-head"><strong>${escapeHtml(entry.services.join(' + '))}</strong><span class="ca-chip ${entry.status === 'NOTIFICADA' ? 'ok' : 'pending'}">${entry.status === 'NOTIFICADA' ? 'Espacio disponible' : 'Esperando'}</span></div>
                        <div class="ca-meta" style="text-transform:capitalize;">${B().formatDate(entry.date)} · ${entry.barberId === 'any' ? 'Cualquier barbero' : escapeHtml(B().barberLabel(state, entry.barberId))} · ${B().PREFS[entry.timePref].label}</div>
                        <div class="ca-actions">
                            ${entry.status === 'NOTIFICADA' ? `<a class="ca-btn primary" href="booking.html?barber=${entry.offeredBarberId || ''}&service=${encodeURIComponent(entry.services.join(' + '))}">Reservar ahora</a>` : ''}
                            <button class="ca-btn danger" type="button" data-leave="${entry.id}">Salir de la lista</button>
                        </div>
                    </article>`).join('') : '<div class="ca-empty">No estás en ninguna lista de espera. Si no hay espacios al reservar, verás la opción de unirte.</div>'}
            `;
        }

        function markRead() {
            const client = currentClient();
            if (!client) return;
            const unread = Data().getState().notifications.some(n => n.clientId === client.id && n.audience !== 'staff' && !n.readAt);
            if (!unread) return;
            window.setTimeout(() => Data().updateState(state => {
                state.notifications.forEach(n => { if (n.clientId === client.id && n.audience !== 'staff' && !n.readAt) n.readAt = new Date().toISOString(); });
            }), 1500);
        }

        function bindActions() {
            root.querySelectorAll('[data-ics]').forEach(button => button.addEventListener('click', () => {
                B().downloadIcs(Data().getState().appointments.find(a => a.code === button.dataset.ics));
            }));
            root.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => openCancel(button.dataset.cancel)));
            root.querySelectorAll('[data-reschedule]').forEach(button => button.addEventListener('click', () => openReschedule(button.dataset.reschedule)));
            root.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => openReview(button.dataset.review)));
            root.querySelectorAll('[data-leave]').forEach(button => button.addEventListener('click', async () => {
                await Data().commit(state => {
                    const entry = state.waitlist.find(item => item.id === button.dataset.leave);
                    if (entry) entry.status = 'CERRADA';
                }, { success: 'Saliste de la lista de espera.', error: 'No se pudo actualizar la lista de espera.' });
            }));
            root.querySelector('[data-save-fav]')?.addEventListener('click', async () => {
                const client = currentClient();
                await Data().commit(state => {
                    const target = state.clients.find(c => c.id === client.id);
                    target.favorites = { barberId: root.querySelector('#ca-fav-barber').value, service: root.querySelector('#ca-fav-service').value };
                    if (target.favorites.barberId) target.preferredBarber = target.favorites.barberId;
                }, { success: 'Favoritos guardados.', error: 'No se pudieron guardar tus favoritos.' });
            });
        }

        function openCancel(code) {
            const state = Data().getState();
            const appointment = state.appointments.find(a => a.code === code);
            const rules = state.settings.booking;
            const late = B().hoursUntil(appointment) < Number(rules.cancelPolicyHours);
            const { card, close } = modal(`
                <h3>Cancelar cita</h3>
                <p class="ca-meta"><strong>${escapeHtml(appointment.service)}</strong><br><span style="text-transform:capitalize;">${escapeHtml(whenText(appointment))}</span></p>
                <div class="ca-reminder" style="font-weight:500;"><i class="fas fa-circle-info"></i><span>Puedes cancelar sin cargo hasta ${rules.cancelPolicyHours} horas antes.${late ? ` <strong>Esta cancelación es tardía: puede aplicar un cargo de ${escapeHtml(rules.lateCancelFee)} que se paga en la barbería.</strong>` : ''} <a href="policies.html" target="_blank">Ver política</a></span></div>
                <label class="ca-field">Motivo (opcional)<textarea id="ca-cancel-reason" maxlength="200" placeholder="Ej. surgió un compromiso"></textarea></label>
                <div class="ca-actions"><button class="ca-btn danger" type="button" data-confirm-cancel><i class="fas fa-xmark"></i> Sí, cancelar cita</button><button class="ca-btn" type="button" data-keep>No, mantenerla</button></div>
            `);
            card.querySelector('[data-keep]').addEventListener('click', close);
            card.querySelector('[data-confirm-cancel]').addEventListener('click', async () => {
                const client = currentClient();
                const ok = await Data().commit(s => {
                    B().cancelAppointment(s, code, { by: 'cliente', actor: client.name, reason: card.querySelector('#ca-cancel-reason').value.trim() });
                }, { success: 'Tu cita fue cancelada. Tu barbero recibió el aviso.', error: 'No se pudo cancelar la cita.' });
                if (ok) close();
            });
        }

        function openReschedule(code) {
            busy = true;
            const { card, close } = modal('<h3>Reprogramar cita</h3><div id="ca-reschedule"></div>');
            const done = () => { busy = false; close(); render(); };
            card.querySelector('.ca-close').addEventListener('click', () => { busy = false; render(); });
            window.GabyBookingWidget.mount(card.querySelector('#ca-reschedule'), {
                mode: 'reschedule', code, scrollOnStep: false,
                onCancel: done,
                onDone: () => {
                    // El widget muestra la confirmacion; al cerrar se refresca la lista.
                    card.querySelector('.ca-close').addEventListener('click', done, { once: true });
                }
            });
        }

        function openReview(code) {
            const state = Data().getState();
            const appointment = state.appointments.find(a => a.code === code);
            const { card, close } = modal(`
                <h3>Dejar reseña</h3>
                <p class="ca-meta"><strong>${escapeHtml(appointment.service)}</strong> con ${escapeHtml(appointment.barberName || '')}<br><span style="text-transform:capitalize;">${escapeHtml(B().formatDate(String(appointment.dateTime).slice(0, 10), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</span></p>
                <form id="ca-review-form" novalidate>
                    <fieldset class="ca-consent" style="border:0; padding:0;">
                        <legend>Tu puntuación <span class="ca-req">*</span></legend>
                        <div class="ca-stars" role="radiogroup" aria-label="Puntuación">
                            ${[1, 2, 3, 4, 5].map(n => `<label data-star="${n}"><input type="radio" name="rating" value="${n}" ${n === 5 ? 'checked' : ''} aria-label="${n} estrella${n === 1 ? '' : 's'}"><span>★</span></label>`).join('')}
                        </div>
                    </fieldset>
                    <label class="ca-field">Tu comentario<textarea id="ca-review-text" maxlength="600" placeholder="Cuéntanos cómo te fue."></textarea></label>
                    <fieldset class="ca-consent">
                        <legend>¿Permites que tu reseña se publique en la página? <span class="ca-req">*</span></legend>
                        <label><input type="radio" name="publish" value="yes" required> <span>Sí, permito que se publique con mi foto de perfil, mi nombre, el barbero, el servicio y la fecha.</span></label>
                        <label><input type="radio" name="publish" value="no" required> <span>No, solo quiero que la vea la barbería.</span></label>
                    </fieldset>
                    <p class="ca-meta">Normas: sin amenazas, datos personales de otras personas, spam ni contenido ilegal. No eliminamos reseñas por ser negativas. <a href="avisos.html#resenas" target="_blank">Ver normas</a></p>
                    <div class="ca-actions"><button class="ca-btn primary" type="submit"><i class="fas fa-paper-plane"></i> Enviar reseña</button></div>
                </form>
            `);
            const paint = () => {
                const value = Number(card.querySelector('input[name=rating]:checked').value);
                card.querySelectorAll('[data-star]').forEach(label => label.classList.toggle('on', Number(label.dataset.star) <= value));
            };
            card.querySelectorAll('input[name=rating]').forEach(input => input.addEventListener('change', paint));
            paint();
            card.querySelector('#ca-review-form').addEventListener('submit', async event => {
                event.preventDefault();
                const publish = card.querySelector('input[name=publish]:checked');
                if (!publish) {
                    Data().toast('Indica si permites que tu reseña se publique en la página.', 'warning');
                    card.querySelector('input[name=publish]').focus();
                    return;
                }
                const client = currentClient();
                const ok = await Data().commit(s => {
                    B().addReview(s, {
                        client: s.clients.find(c => c.id === client.id), code,
                        rating: card.querySelector('input[name=rating]:checked').value,
                        text: card.querySelector('#ca-review-text').value,
                        publish: publish.value === 'yes'
                    });
                }, { success: publish.value === 'yes' ? '¡Gracias! Tu reseña ya está publicada.' : '¡Gracias! Tu reseña se compartió solo con la barbería.', error: 'No se pudo enviar tu reseña.' });
                if (ok) close();
            });
        }

        render();
        window.addEventListener('gabydatachange', render);
        window.addEventListener('storage', event => { if (event.key === Data().STORAGE_KEY) render(); });
        if (tab === 'notifications') markRead();
        return { render, setTab: id => { tab = id; render(); } };
    }

    window.GabyAccount = { mount };
})();
