(function () {
    // =========================================================================
    // Reserva paso a paso: 1) Servicio 2) Barbero 3) Fecha y hora 4) Revisar 5) Confirmacion.
    // Se usa en index.html (#reserva), booking.html y en "Reprogramar" de Mi cuenta.
    // Los precios son informativos: el pago es presencial en la barberia.
    // =========================================================================
    const B = () => window.GabyBooking;
    const Data = () => window.GabyData;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const isVip = service => service && (service.category === 'VIP' || /VIP/i.test(service.name));
    const PR_TOWNS = ['Adjuntas', 'Aguada', 'Aguadilla', 'Aguas Buenas', 'Aibonito', 'Añasco', 'Arecibo', 'Arroyo', 'Barceloneta', 'Barranquitas', 'Bayamón', 'Cabo Rojo', 'Caguas', 'Camuy', 'Canóvanas', 'Carolina', 'Cataño', 'Cayey', 'Ceiba', 'Ciales', 'Cidra', 'Coamo', 'Comerío', 'Corozal', 'Culebra', 'Dorado', 'Fajardo', 'Florida', 'Guánica', 'Guayama', 'Guayanilla', 'Guaynabo', 'Gurabo', 'Hatillo', 'Hormigueros', 'Humacao', 'Isabela', 'Jayuya', 'Juana Díaz', 'Juncos', 'Lajas', 'Lares', 'Las Marías', 'Las Piedras', 'Loíza', 'Luquillo', 'Manatí', 'Maricao', 'Maunabo', 'Mayagüez', 'Moca', 'Morovis', 'Naguabo', 'Naranjito', 'Orocovis', 'Patillas', 'Peñuelas', 'Ponce', 'Quebradillas', 'Rincón', 'Río Grande', 'Sabana Grande', 'Salinas', 'San Germán', 'San Juan', 'San Lorenzo', 'San Sebastián', 'Santa Isabel', 'Toa Alta', 'Toa Baja', 'Trujillo Alto', 'Utuado', 'Vega Alta', 'Vega Baja', 'Vieques', 'Villalba', 'Yabucoa', 'Yauco'];

    function injectStyles() {
        if (document.getElementById('booking-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'booking-widget-styles';
        style.textContent = `
            .bw { --bw-gold: #d4af37; --bw-soft: #f3d68a; --bw-line: rgba(255,255,255,.1); --bw-card: rgba(255,255,255,.03); --bw-muted: #a59f90; --bw-text: inherit;
                display: grid; gap: 1.1rem; font-family: 'Inter', system-ui, sans-serif; text-align: left; color: var(--bw-text); }
            body.light-mode .bw { --bw-line: rgba(0,0,0,.1); --bw-card: #fff; --bw-muted: #5c5c5c; --bw-soft: #7a5c12; }
            .bw-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
            .bw-step { display: grid; gap: .35rem; font-size: .72rem; color: var(--bw-muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
            .bw-step::before { content: ''; height: 4px; border-radius: 99px; background: var(--bw-line); }
            .bw-step.done::before, .bw-step.current::before { background: var(--bw-gold); }
            .bw-step.current { color: var(--bw-soft); }
            .bw h3.bw-title { font-family: 'Cinzel', serif; font-size: 1.3rem; margin: 0; }
            .bw-sub { color: var(--bw-muted); font-size: .88rem; line-height: 1.6; margin: 0; }
            .bw-cat { font-size: .78rem; text-transform: uppercase; letter-spacing: .12em; color: var(--bw-soft); margin: .6rem 0 .1rem; font-weight: 700; }
            .bw-list { display: grid; gap: .55rem; }
            .bw-option { display: grid; grid-template-columns: auto 1fr auto; gap: .8rem; align-items: center; padding: .85rem 1rem; border-radius: 14px; border: 1px solid var(--bw-line); background: var(--bw-card); cursor: pointer; text-align: left; color: inherit; font: inherit; width: 100%; }
            .bw-option:hover { border-color: rgba(212,175,55,.5); }
            .bw-option.selected, .bw-option:has(input:checked) { border-color: var(--bw-gold); background: rgba(212,175,55,.1); }
            .bw-option input { width: 18px; height: 18px; accent-color: var(--bw-gold); margin: 0; }
            .bw-option strong { display: block; font-size: .95rem; }
            .bw-option small { display: block; color: var(--bw-muted); font-size: .78rem; margin-top: .15rem; }
            .bw-price { font-weight: 800; color: var(--bw-gold); white-space: nowrap; text-align: right; }
            .bw-price small { font-weight: 500; }
            .bw-tag { display: inline-block; margin-left: .4rem; font-size: .68rem; padding: .1rem .45rem; border-radius: 99px; background: rgba(212,175,55,.18); color: var(--bw-soft); font-weight: 700; vertical-align: middle; }
            .bw-barbers { display: grid; gap: .6rem; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
            .bw-barber { display: grid; grid-template-columns: 56px 1fr; gap: .8rem; align-items: center; }
            .bw-avatar { width: 56px; height: 56px; border-radius: 50%; background-size: cover; background-position: center top; border: 2px solid rgba(212,175,55,.5); }
            .bw-next { color: #3fb950; font-size: .78rem; font-weight: 700; margin-top: .2rem; display: block; }
            .bw-next.none { color: var(--bw-muted); font-weight: 500; }
            .bw-dates { display: flex; gap: .5rem; overflow-x: auto; padding: .2rem .1rem .6rem; scroll-snap-type: x mandatory; }
            .bw-date { flex: 0 0 auto; width: 74px; display: grid; gap: .1rem; justify-items: center; padding: .65rem .3rem; border-radius: 14px; border: 1px solid var(--bw-line); background: var(--bw-card); color: inherit; cursor: pointer; font: inherit; scroll-snap-align: start; }
            .bw-date span { font-size: .7rem; text-transform: uppercase; color: var(--bw-muted); }
            .bw-date strong { font-size: 1.25rem; }
            .bw-date small { font-size: .66rem; color: #3fb950; }
            .bw-date:disabled { opacity: .35; cursor: not-allowed; }
            .bw-date:disabled small { color: var(--bw-muted); }
            .bw-date.selected { border-color: var(--bw-gold); background: rgba(212,175,55,.14); }
            .bw-period { font-size: .78rem; color: var(--bw-muted); margin: .4rem 0 .3rem; font-weight: 700; }
            .bw-times { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: .45rem; }
            .bw-time { padding: .65rem .3rem; border-radius: 12px; border: 1px solid var(--bw-line); background: var(--bw-card); color: inherit; cursor: pointer; font: inherit; font-weight: 700; font-size: .88rem; }
            .bw-time:hover { border-color: var(--bw-gold); }
            .bw-time.selected { background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); color: #111; border-color: transparent; }
            .bw-empty { border: 1px dashed rgba(212,175,55,.5); border-radius: 16px; padding: 1.2rem; display: grid; gap: .7rem; justify-items: start; background: rgba(212,175,55,.05); }
            .bw-summary { border: 1px solid var(--bw-line); border-radius: 16px; overflow: hidden; }
            .bw-summary div { display: grid; grid-template-columns: 130px 1fr; gap: .8rem; padding: .7rem 1rem; border-top: 1px solid var(--bw-line); font-size: .9rem; }
            .bw-summary div:first-child { border-top: 0; }
            .bw-summary dt { color: var(--bw-muted); }
            .bw-summary dd { margin: 0; font-weight: 600; }
            .bw-pay { display: flex; gap: .6rem; align-items: center; padding: .75rem 1rem; border-radius: 14px; background: rgba(63,185,80,.1); border: 1px solid rgba(63,185,80,.3); font-size: .86rem; }
            .bw-pay i { color: #3fb950; }
            .bw-field { display: grid; gap: .35rem; font-size: .85rem; font-weight: 600; }
            .bw-field input, .bw-field select, .bw-field textarea { width: 100%; border-radius: 12px; border: 1px solid var(--bw-line); background: var(--bw-card); color: inherit; padding: .75rem .9rem; font: inherit; font-weight: 400; }
            body:not(.light-mode) .bw-field select option { background: #161616; color: #f5f1e8; }
            .bw-field textarea { min-height: 70px; resize: vertical; }
            .bw-grid { display: grid; gap: .8rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
            .bw-check { display: flex; gap: .6rem; align-items: flex-start; font-size: .85rem; line-height: 1.5; cursor: pointer; }
            .bw-check input { margin-top: .2rem; width: 17px; height: 17px; accent-color: var(--bw-gold); flex-shrink: 0; }
            .bw-actions { display: flex; gap: .6rem; flex-wrap: wrap; justify-content: space-between; align-items: center; }
            .bw-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 999px; padding: .85rem 1.4rem; font: inherit; font-weight: 800; font-size: .88rem; cursor: pointer; border: 1px solid rgba(212,175,55,.45); background: transparent; color: inherit; text-decoration: none; }
            .bw-btn.primary { background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); color: #111; border-color: transparent; }
            .bw-btn:disabled { opacity: .5; cursor: not-allowed; }
            .bw-btn:focus-visible, .bw-option:focus-visible, .bw-date:focus-visible, .bw-time:focus-visible { outline: 2px solid var(--bw-gold); outline-offset: 2px; }
            .bw-done { text-align: center; display: grid; gap: .9rem; justify-items: center; }
            .bw-done .bw-check-icon { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 1.8rem; color: #111; background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); }
            .bw-done .bw-summary { width: 100%; text-align: left; }
            .bw-cal { position: relative; }
            .bw-cal-menu { position: absolute; bottom: calc(100% + .4rem); left: 50%; transform: translateX(-50%); display: grid; min-width: 210px; background: #151515; border: 1px solid rgba(212,175,55,.4); border-radius: 14px; overflow: hidden; z-index: 5; }
            body.light-mode .bw-cal-menu { background: #fff; }
            .bw-cal-menu a, .bw-cal-menu button { padding: .75rem 1rem; text-align: left; background: none; border: 0; color: inherit; font: inherit; font-size: .88rem; cursor: pointer; text-decoration: none; }
            .bw-cal-menu a:hover, .bw-cal-menu button:hover { background: rgba(212,175,55,.12); }
            .bw-alert { padding: .8rem 1rem; border-radius: 12px; border: 1px solid rgba(241,190,93,.5); background: rgba(241,190,93,.08); font-size: .86rem; line-height: 1.55; }
            .bw-unknown { border-style: dashed; border-color: rgba(212,175,55,.55); }
            .bw-unknown .bw-q { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: rgba(212,175,55,.16); color: var(--bw-gold); font-size: 1rem; }
            .bw-photo { border: 1px dashed var(--bw-line); border-radius: 16px; padding: 1rem; display: grid; gap: .7rem; background: var(--bw-card); }
            .bw-photo-drop { display: flex; gap: .8rem; align-items: center; flex-wrap: wrap; }
            .bw-photo input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
            .bw-photo-preview { position: relative; width: 120px; height: 120px; border-radius: 14px; overflow: hidden; border: 1px solid var(--bw-line); }
            .bw-photo-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .bw-photo-preview button { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border-radius: 50%; border: 0; background: rgba(0,0,0,.7); color: #fff; cursor: pointer; }
            @media (max-width: 560px) { .bw-summary div { grid-template-columns: 1fr; gap: .15rem; } .bw-actions .bw-btn { flex: 1 1 auto; } }
        `;
        document.head.appendChild(style);
    }

    // Reduce la foto de referencia (max. 900 px, JPEG) para que no ocupe mucho espacio.
    function compressPhoto(file) {
        return new Promise((resolve, reject) => {
            if (file.type && !/^image\//.test(file.type)) return reject(Object.assign(new Error('type'), { userMessage: 'El archivo debe ser una imagen.' }));
            if (file.size > 15 * 1024 * 1024) return reject(Object.assign(new Error('size'), { userMessage: 'La foto es muy grande (máximo 15 MB).' }));
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const max = 900;
                const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                let data = canvas.toDataURL('image/jpeg', 0.72);
                if (data.length > 380000) data = canvas.toDataURL('image/jpeg', 0.5);
                resolve(data);
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
            img.src = url;
        });
    }

    function currentClient() {
        const state = Data().getState();
        return state.clients.find(client => client.id === state.session.currentClientId) || null;
    }

    // ---------------------------------------------------------------------
    function mount(root, options) {
        injectStyles();
        const opts = options || {};
        const reschedule = opts.mode === 'reschedule';
        const state = Data().getState();
        const original = reschedule ? state.appointments.find(item => item.code === opts.code) : null;
        const client = currentClient();
        const favorites = (client && client.favorites) || {};
        const params = new URLSearchParams(window.location.search);

        const view = {
            step: reschedule ? 3 : 1,
            services: reschedule ? B().appointmentServiceNames(original) : [],
            barberId: reschedule ? original.barber : null,
            date: null,
            time: null,
            waitlist: false,
            notes: '',
            referencePhoto: '',
            result: null
        };

        // Precarga: ?service=...&barber=... ("Reservar nuevamente", "Reservar con ...") o favoritos.
        if (!reschedule) {
            const pre = (opts.service || params.get('service') || '').split(' + ').filter(Boolean);
            const services = state.services.filter(s => s.active);
            pre.forEach(name => { if (B().isUnknownCut(name) || services.some(s => s.name === name)) view.services.push(name); });
            const preBarber = opts.barber || params.get('barber');
            if (preBarber && state.barbers.some(b => b.id === preBarber && b.active !== false)) view.barberId = preBarber;
            if (view.services.length) view.step = view.barberId ? 3 : 2;
        }

        root.classList.add('bw');

        function selectedServices() {
            return B().findServices(view.services);
        }

        function duration() {
            return B().totalMinutes(selectedServices());
        }

        function stepsBar() {
            const labels = reschedule ? ['Fecha y hora', 'Revisar', 'Listo'] : ['Servicio', 'Barbero', 'Fecha y hora', 'Revisar'];
            const map = reschedule ? { 3: 0, 4: 1, 5: 2 } : { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
            const current = map[view.step];
            return `<div class="bw-steps" aria-hidden="true">${labels.map((label, i) => `<span class="bw-step ${i < current ? 'done' : ''} ${i === current ? 'current' : ''}">${label}</span>`).join('')}</div>`;
        }

        // ---------------- Paso 1: servicios
        function renderServices() {
            const db = Data().getState();
            const services = db.services.filter(s => s.active);
            const categories = [...new Set([...(db.settings.serviceCategories || []), ...services.map(s => s.category || 'Otros')])];
            const groups = categories.map(category => ({ category, items: services.filter(s => (s.category || 'Otros') === category) })).filter(g => g.items.length);
            const selected = selectedServices();
            const unknown = B().unknownCutService(db);
            root.innerHTML = `
                ${stepsBar()}
                <h3 class="bw-title">¿Qué te vas a hacer?</h3>
                <p class="bw-sub">Puedes escoger uno o varios servicios. Los precios son informativos.</p>
                <div class="bw-list">
                    <label class="bw-option bw-unknown">
                        <input type="checkbox" data-service="${escapeHtml(unknown.name)}" ${view.services.includes(unknown.name) ? 'checked' : ''}>
                        <span><strong>${escapeHtml(unknown.name)}</strong><small>Tu barbero te ayuda a escogerlo. Antes de confirmar puedes subir una foto de referencia (opcional).</small></span>
                        <span class="bw-q" aria-hidden="true"><i class="fas fa-question"></i></span>
                    </label>
                </div>
                ${groups.map(group => `
                    <div class="bw-cat">${escapeHtml(group.category)}</div>
                    <div class="bw-list">
                        ${group.items.map(service => `
                            <label class="bw-option">
                                <input type="checkbox" data-service="${escapeHtml(service.name)}" ${view.services.includes(service.name) ? 'checked' : ''}>
                                <span><strong>${escapeHtml(service.name)}${favorites.service === service.name ? '<span class="bw-tag">Favorito</span>' : ''}</strong><small>${B().formatDuration(B().serviceMinutes(service))}${service.duration ? ` · ${escapeHtml(service.duration)}` : ''}</small></span>
                                <span class="bw-price">${escapeHtml(service.price)}</span>
                            </label>
                        `).join('')}
                    </div>
                `).join('')}
                <div class="bw-pay"><i class="fas fa-store" aria-hidden="true"></i><span><strong>Pago presencial en la barbería.</strong> Esta página no cobra ni guarda datos de pago.</span></div>
                <div class="bw-actions">
                    <span class="bw-sub">${selected.length ? `${selected.length} servicio${selected.length === 1 ? '' : 's'} · ${B().formatDuration(duration())} · ${escapeHtml(B().priceLabel(selected))}` : 'Escoge al menos un servicio.'}</span>
                    <button class="bw-btn primary" type="button" data-next ${selected.length ? '' : 'disabled'}>Continuar <i class="fas fa-arrow-right"></i></button>
                </div>
            `;
            root.querySelectorAll('[data-service]').forEach(input => input.addEventListener('change', () => {
                const name = input.dataset.service;
                view.services = input.checked ? [...view.services, name] : view.services.filter(s => s !== name);
                view.date = null;
                view.time = null;
                renderServices();
            }));
            root.querySelector('[data-next]').addEventListener('click', () => go(2));
        }

        // ---------------- Paso 2: barbero
        function renderBarbers() {
            const services = selectedServices();
            const barbers = B().barbersForServices(services).sort((a, b) => (b.id === favorites.barberId) - (a.id === favorites.barberId));
            root.innerHTML = `
                ${stepsBar()}
                <h3 class="bw-title">Escoge tu barbero</h3>
                <p class="bw-sub">${escapeHtml(services.map(s => s.name).join(' + '))} · ${B().formatDuration(duration())}</p>
                ${barbers.length ? `<div class="bw-barbers">${barbers.map(barber => {
                    const next = B().nextAvailable(barber.id, duration());
                    const rating = B().barberRating(barber.id);
                    return `
                        <button type="button" class="bw-option bw-barber ${view.barberId === barber.id ? 'selected' : ''}" data-barber="${barber.id}">
                            <span class="bw-avatar" style="background-image:url('${escapeHtml(barber.avatar || '')}')"></span>
                            <span>
                                <strong>${escapeHtml(barber.alias || barber.name)}${favorites.barberId === barber.id || (client && client.preferredBarber === barber.id) ? '<span class="bw-tag">Favorito</span>' : ''}</strong>
                                <small>${escapeHtml(barber.name)}${rating.count ? ` · ⭐ ${rating.avg.toFixed(1)} (${rating.count})` : ''}</small>
                                <span class="bw-next ${next ? '' : 'none'}">${next ? `Próximo espacio: ${B().relativeDay(next.date)} ${B().formatTime(next.time)}` : 'Sin espacios próximos'}</span>
                            </span>
                        </button>`;
                }).join('')}</div>` : '<div class="bw-alert">Ningún barbero ofrece todos los servicios escogidos juntos. Prueba con menos servicios.</div>'}
                <div class="bw-actions">
                    <button class="bw-btn" type="button" data-back><i class="fas fa-arrow-left"></i> Atrás</button>
                </div>
            `;
            root.querySelectorAll('[data-barber]').forEach(button => button.addEventListener('click', () => {
                view.barberId = button.dataset.barber;
                view.date = null;
                view.time = null;
                go(3);
            }));
            root.querySelector('[data-back]').addEventListener('click', () => go(1));
        }

        // ---------------- Paso 3: fecha y hora
        function renderDateTime() {
            const db = Data().getState();
            const barber = db.barbers.find(b => b.id === view.barberId);
            const days = B().availableDates(view.barberId, duration(), db, original && original.code);
            if (!view.date) view.date = (days.find(d => d.count) || days[0]).key;
            const slots = B().getSlots(view.barberId, view.date, duration(), { excludeCode: original && original.code });
            const groups = [
                ['Mañana', slots.filter(t => B().toMin(t) < 720)],
                ['Tarde', slots.filter(t => B().toMin(t) >= 720 && B().toMin(t) < 1020)],
                ['Noche', slots.filter(t => B().toMin(t) >= 1020)]
            ].filter(g => g[1].length);
            root.innerHTML = `
                ${stepsBar()}
                <h3 class="bw-title">${reschedule ? 'Escoge la nueva fecha y hora' : '¿Cuándo te viene bien?'}</h3>
                <p class="bw-sub">${escapeHtml(barber ? barber.alias || barber.name : '')} · ${escapeHtml(selectedServices().map(s => s.name).join(' + '))} · ${B().formatDuration(duration())}</p>
                <div class="bw-dates" role="listbox" aria-label="Fechas">
                    ${days.map(day => {
                        const date = B().parseKey(day.key);
                        return `<button type="button" class="bw-date ${view.date === day.key ? 'selected' : ''}" data-date="${day.key}" ${day.count ? '' : 'disabled'} aria-label="${B().formatDate(day.key)}${day.count ? `, ${day.count} horarios` : ', sin horarios'}">
                            <span>${date.toLocaleDateString('es-PR', { weekday: 'short' })}</span><strong>${date.getDate()}</strong><small>${day.count ? `${day.count} libres` : 'Lleno'}</small></button>`;
                    }).join('')}
                </div>
                <div>
                    <div class="bw-period" style="font-size:.95rem; text-transform:capitalize;">${B().formatDate(view.date)}</div>
                    ${groups.length ? groups.map(([label, times]) => `
                        <div class="bw-period">${label}</div>
                        <div class="bw-times">${times.map(t => `<button type="button" class="bw-time ${view.time === t ? 'selected' : ''}" data-time="${t}">${B().formatTime(t)}</button>`).join('')}</div>
                    `).join('') : `
                        <div class="bw-empty">
                            <strong>No hay espacios disponibles.</strong>
                            <span class="bw-sub">Únete a la lista de espera y te avisaremos si se libera un espacio. No se reserva automáticamente: tú confirmas.</span>
                            ${reschedule ? '' : '<button class="bw-btn" type="button" data-waitlist><i class="fas fa-list-ol"></i> Unirme a lista de espera</button>'}
                        </div>`}
                    ${view.waitlist ? renderWaitlistForm() : ''}
                </div>
                <div class="bw-actions">
                    <button class="bw-btn" type="button" data-back><i class="fas fa-arrow-left"></i> Atrás</button>
                    <button class="bw-btn primary" type="button" data-next ${view.time ? '' : 'disabled'}>Revisar <i class="fas fa-arrow-right"></i></button>
                </div>
            `;
            root.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => {
                view.date = button.dataset.date;
                view.time = null;
                view.waitlist = false;
                renderDateTime();
            }));
            root.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => {
                view.time = button.dataset.time;
                renderDateTime();
                root.querySelector('[data-next]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }));
            root.querySelector('[data-waitlist]')?.addEventListener('click', () => { view.waitlist = true; renderDateTime(); });
            root.querySelector('[data-join]')?.addEventListener('click', joinWaitlist);
            root.querySelector('[data-back]').addEventListener('click', () => (reschedule ? opts.onCancel && opts.onCancel() : go(2)));
            root.querySelector('[data-next]').addEventListener('click', () => go(4));
            root.querySelector('.bw-date.selected')?.scrollIntoView({ block: 'nearest', inline: 'center' });
        }

        function renderWaitlistForm() {
            const db = Data().getState();
            return `
                <div class="bw-empty" style="margin-top:.8rem;">
                    <strong>Lista de espera</strong>
                    <div class="bw-grid" style="width:100%;">
                        <label class="bw-field">Fecha preferida<input type="date" id="bw-wait-date" value="${view.date}"></label>
                        <label class="bw-field">Barbero<select id="bw-wait-barber"><option value="any">Cualquier barbero</option>${db.barbers.filter(b => b.active !== false).map(b => `<option value="${b.id}" ${b.id === view.barberId ? 'selected' : ''}>${escapeHtml(b.alias || b.name)}</option>`).join('')}</select></label>
                        <label class="bw-field">Horario preferido<select id="bw-wait-pref">${Object.entries(B().PREFS).map(([key, pref]) => `<option value="${key}">${pref.label}</option>`).join('')}</select></label>
                    </div>
                    <span class="bw-sub">Servicio: ${escapeHtml(view.services.join(' + '))}</span>
                    <button class="bw-btn primary" type="button" data-join><i class="fas fa-bell"></i> Avisarme si se libera</button>
                </div>
            `;
        }

        async function joinWaitlist() {
            const me = currentClient();
            if (!me) return requireLogin();
            const ok = await Data().commit(state => {
                B().joinWaitlist(state, { client: state.clients.find(c => c.id === me.id), barberId: document.getElementById('bw-wait-barber').value, serviceNames: view.services, date: document.getElementById('bw-wait-date').value, timePref: document.getElementById('bw-wait-pref').value });
            }, { success: 'Te uniste a la lista de espera. Te avisaremos si se libera un espacio.', error: 'No se pudo unir a la lista de espera.' });
            if (ok) { view.waitlist = false; renderDateTime(); }
        }

        // ---------------- Paso 4: revisar
        function summaryRows(appointment) {
            const services = selectedServices();
            const db = Data().getState();
            const barber = db.barbers.find(b => b.id === (appointment ? appointment.barber : view.barberId));
            const date = appointment ? String(appointment.dateTime).slice(0, 10) : view.date;
            const time = appointment ? String(appointment.dateTime).slice(11, 16) : view.time;
            return `
                <dl class="bw-summary">
                    <div><dt>Servicio${services.length > 1 ? 's' : ''}</dt><dd>${escapeHtml(services.map(s => s.name).join(' + '))}</dd></div>
                    <div><dt>Barbero</dt><dd>${escapeHtml(barber ? barber.name + (barber.alias ? ` (${barber.alias})` : '') : '')}</dd></div>
                    <div><dt>Fecha</dt><dd style="text-transform:capitalize;">${B().formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
                    <div><dt>Hora</dt><dd>${B().formatTime(time)}</dd></div>
                    <div><dt>Duración</dt><dd>${B().formatDuration(duration())}</dd></div>
                    <div><dt>Precio</dt><dd>${escapeHtml(B().priceLabel(services))} · pago presencial</dd></div>
                    ${(appointment ? appointment.referencePhoto : view.referencePhoto) ? '<div><dt>Foto de referencia</dt><dd>Adjunta</dd></div>' : ''}
                    ${appointment ? `<div><dt>Código</dt><dd>${escapeHtml(appointment.code)}</dd></div>` : ''}
                </dl>
            `;
        }

        function renderReview() {
            const services = selectedServices();
            const vip = services.some(isVip) && !reschedule;
            const me = currentClient();
            const rules = Data().getState().settings.booking;
            root.innerHTML = `
                ${stepsBar()}
                <h3 class="bw-title">Revisa tu cita</h3>
                ${summaryRows()}
                <div class="bw-pay"><i class="fas fa-store" aria-hidden="true"></i><span><strong>Pago presencial en la barbería.</strong> No se cobra nada en esta página.</span></div>
                ${vip ? `
                    <div class="bw-empty" style="justify-items:stretch;">
                        <strong>📍 Detalles del servicio VIP a domicilio</strong>
                        <div class="bw-grid">
                            <label class="bw-field">Pueblo *<select id="bw-vip-town" required><option value="">Selecciona tu pueblo</option>${PR_TOWNS.map(t => `<option>${t}</option>`).join('')}</select></label>
                            <label class="bw-field">Cantidad de personas<input id="bw-vip-guests" type="number" min="1" value="1"></label>
                        </div>
                        <label class="bw-field">Dirección y descripción del lugar *<textarea id="bw-vip-address" required placeholder="Dirección, urbanización, casa/apto, puntos de referencia..."></textarea></label>
                    </div>` : ''}
                ${reschedule ? '' : `
                    <label class="bw-field">Nota para el barbero (opcional)<textarea id="bw-notes" maxlength="300" placeholder="Ej. prefiero low fade, barba #2...">${escapeHtml(view.notes)}</textarea></label>
                    <div class="bw-photo">
                        <strong style="font-size:.9rem;">Foto de referencia (opcional)</strong>
                        <span class="bw-sub">Sube una foto del recorte que quieres. Solo la ven tu barbero y la barbería.</span>
                        <div class="bw-photo-drop">
                            ${view.referencePhoto ? `<span class="bw-photo-preview"><img src="${view.referencePhoto}" alt="Foto de referencia"><button type="button" data-photo-remove aria-label="Quitar foto"><i class="fas fa-times"></i></button></span>` : ''}
                            <label class="bw-btn" style="position:relative;"><i class="fas fa-camera"></i> ${view.referencePhoto ? 'Cambiar foto' : 'Subir foto'}<input type="file" id="bw-photo" accept="image/*"></label>
                        </div>
                    </div>`}
                <div class="booking-summary">${window.GabyLegal ? window.GabyLegal.bookingSummaryHtml(services) : ''}</div>
                ${!me ? `<div class="bw-alert"><strong>Inicia sesión para confirmar.</strong> Necesitas una cuenta para reservar y poder ver, cambiar o cancelar tu cita.</div>` : ''}
                ${me && B().activeBlock(me.id) ? `<div class="bw-alert">${B().BLOCKED_MESSAGE}</div>` : ''}
                <label class="bw-check"><input type="checkbox" id="bw-agree"><span>He revisado la fecha, hora, servicio, precio y política de cancelación aplicable a esta reservación. *</span></label>
                <p class="bw-sub">Cambios y cancelaciones en línea hasta ${rules.onlineChangeMinHours} hora(s) antes desde Mi cuenta.</p>
                <div class="bw-actions">
                    <button class="bw-btn" type="button" data-back><i class="fas fa-arrow-left"></i> Atrás</button>
                    ${me ? `<button class="bw-btn primary" type="button" data-confirm><i class="fas fa-check"></i> ${reschedule ? 'Confirmar cambio' : 'Confirmar cita'}</button>` : '<button class="bw-btn primary" type="button" data-login><i class="fas fa-right-to-bracket"></i> Iniciar sesión para confirmar</button>'}
                </div>
            `;
            root.querySelector('[data-back]').addEventListener('click', () => go(3));
            root.querySelector('#bw-notes')?.addEventListener('input', event => { view.notes = event.target.value; });
            root.querySelector('#bw-photo')?.addEventListener('change', async event => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                try {
                    view.referencePhoto = await compressPhoto(file);
                    const agreed = root.querySelector('#bw-agree')?.checked;
                    renderReview();
                    if (agreed) root.querySelector('#bw-agree').checked = true;
                } catch (error) {
                    Data().toast(error.userMessage || 'No se pudo leer la foto. Prueba con otra imagen (JPG o PNG).', 'error');
                }
            });
            root.querySelector('[data-photo-remove]')?.addEventListener('click', () => { view.referencePhoto = ''; renderReview(); });
            root.querySelector('[data-login]')?.addEventListener('click', requireLogin);
            root.querySelector('[data-confirm]')?.addEventListener('click', confirm);
        }

        function requireLogin() {
            Data().toast('Inicia sesión o crea tu cuenta para confirmar. Tu selección se mantiene.', 'warning');
            if (typeof opts.onLoginRequired === 'function') opts.onLoginRequired();
            else window.location.href = `profile.html?next=${encodeURIComponent(`booking.html?barber=${view.barberId || ''}&service=${view.services.join(' + ')}`)}`;
        }

        async function confirm() {
            if (!root.querySelector('#bw-agree').checked) {
                Data().toast('Marca la casilla de confirmación para continuar.', 'warning');
                return;
            }
            const vipTown = root.querySelector('#bw-vip-town');
            const vipAddress = root.querySelector('#bw-vip-address');
            if (vipTown && (!vipTown.value || !vipAddress.value.trim())) {
                Data().toast('Completa el pueblo y la dirección del servicio VIP.', 'warning');
                return;
            }
            const me = currentClient();
            if (!me) return requireLogin();
            const button = root.querySelector('[data-confirm]');
            button.disabled = true;
            button.textContent = 'Confirmando...';
            let created = null;
            const ok = await Data().commit(state => {
                const services = B().findServices(view.services, state);
                if (reschedule) {
                    created = B().rescheduleAppointment(state, original.code, { date: view.date, time: view.time, by: 'cliente', actor: me.name });
                } else {
                    const record = state.clients.find(c => c.id === me.id);
                    created = B().createAppointment(state, {
                        client: record, barberId: view.barberId, services, date: view.date, time: view.time, source: 'online',
                        notes: root.querySelector('#bw-notes')?.value.trim() || '',
                        referencePhoto: view.referencePhoto || '',
                        vipDetails: vipTown ? { town: vipTown.value, address: vipAddress.value.trim(), guests: root.querySelector('#bw-vip-guests').value } : null
                    });
                    record.preferredBarber = view.barberId;
                }
                created = { ...created };
            }, { success: null, error: reschedule ? 'No se pudo reprogramar la cita.' : 'No se pudo confirmar la cita.' });
            if (!ok) {
                button.disabled = false;
                button.innerHTML = `<i class="fas fa-check"></i> ${reschedule ? 'Confirmar cambio' : 'Confirmar cita'}`;
                // El horario pudo ocuparse: se refrescan los espacios.
                view.time = null;
                go(3);
                return;
            }
            view.result = created;
            Data().toast(reschedule ? 'Tu cita fue reprogramada.' : created.status === 'APROBADA' ? '¡Tu cita fue confirmada!' : 'Recibimos tu solicitud de cita.', 'success');
            go(5);
            if (typeof opts.onDone === 'function') opts.onDone(created);
        }

        // ---------------- Paso 5: confirmacion
        function renderDone() {
            const appointment = view.result;
            const confirmed = appointment.status === 'APROBADA';
            root.innerHTML = `
                <div class="bw-done">
                    <span class="bw-check-icon"><i class="fas fa-check"></i></span>
                    <h3 class="bw-title">${reschedule ? '¡Tu cita fue reprogramada!' : confirmed ? '¡Tu cita fue confirmada!' : '¡Recibimos tu solicitud!'}</h3>
                    ${confirmed ? '' : '<p class="bw-sub">Tu barbero la confirmará pronto. Te avisaremos en Mi cuenta.</p>'}
                    ${summaryRows(appointment)}
                    <div class="bw-pay" style="width:100%;"><i class="fas fa-store"></i><span><strong>Pago:</strong> presencial en la barbería.</span></div>
                    <div class="bw-actions" style="justify-content:center;">
                        <a class="bw-btn primary" href="profile.html#citas"><i class="fas fa-calendar-check"></i> Ver mi cita</a>
                        <span class="bw-cal">
                            <button class="bw-btn" type="button" data-cal aria-expanded="false"><i class="fas fa-calendar-plus"></i> Añadir al calendario</button>
                            <span class="bw-cal-menu" hidden>
                                <a href="${B().googleCalendarUrl(appointment)}" target="_blank" rel="noopener"><i class="fab fa-google"></i> Google Calendar</a>
                                <button type="button" data-ics><i class="fab fa-apple"></i> Apple Calendar</button>
                                <button type="button" data-ics><i class="fas fa-file-arrow-down"></i> Archivo .ics</button>
                            </span>
                        </span>
                        <a class="bw-btn" href="index.html"><i class="fas fa-house"></i> Volver al inicio</a>
                    </div>
                    ${reschedule ? '' : '<button class="bw-btn" type="button" data-again style="border:0;">Reservar otra cita</button>'}
                </div>
            `;
            const menu = root.querySelector('.bw-cal-menu');
            root.querySelector('[data-cal]').addEventListener('click', event => {
                menu.hidden = !menu.hidden;
                event.currentTarget.setAttribute('aria-expanded', String(!menu.hidden));
            });
            root.querySelectorAll('[data-ics]').forEach(button => button.addEventListener('click', () => { B().downloadIcs(appointment); menu.hidden = true; }));
            root.querySelector('[data-again]')?.addEventListener('click', () => {
                Object.assign(view, { step: 1, services: [], barberId: null, date: null, time: null, result: null, notes: '', referencePhoto: '' });
                go(1);
            });
        }

        function go(step, initial) {
            if (step === 2 && !view.services.length) step = 1;
            if (step >= 3 && !view.barberId) step = view.services.length ? 2 : 1;
            if (step === 4 && !view.time) step = 3;
            view.step = step;
            ({ 1: renderServices, 2: renderBarbers, 3: renderDateTime, 4: renderReview, 5: renderDone })[step]();
            if (!initial && opts.scrollOnStep !== false) {
                const top = root.getBoundingClientRect().top;
                if (top < 0 || top > window.innerHeight * 0.6) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        go(view.step, true);
        return {
            selectService(name) {
                if (!view.services.includes(name)) view.services.push(name);
                view.time = null;
                go(view.barberId ? 3 : 2);
            },
            refresh() { if (view.step !== 5) go(view.step); },
            get step() { return view.step; }
        };
    }

    window.GabyBookingWidget = { mount };
})();
