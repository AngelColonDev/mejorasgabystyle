(function () {
    // Header (menu completo en computadora) y footer comunes a todas las páginas publicas.
    // - Header: se inserta arriba en cada página, salvo en el index (que tiene el suyo: <body data-site-header="off">).
    //   En celular (<= 968px) se oculta y se usa la barra de navegación inferior de cada página.
    //   En computadora se oculta la barra superior simple de la página (marcada con data-mobile-topbar).
    // - Footer: se dibuja dentro de <footer data-site-footer></footer>.
    const LOGO = 'https://res.cloudinary.com/dtw3qx4qq/image/upload/v1783972135/b3a13ac1-cac2-4367-9c0d-5946397d4ff9-removebg-preview_xhkncw.png';
    const DEV_LOGO = 'https://res.cloudinary.com/dtw3qx4qq/image/upload/v1781464069/favicon-32x32_flnhtq.png';

    const navLinks = [
        { href: 'index.html', label: 'Inicio', match: ['', 'index.html'] },
        { href: 'services.html', label: 'Servicios', match: ['services.html'] },
        { href: 'booking.html', label: 'Reservar', match: ['booking.html'] },
        { href: 'barbers.html', label: 'Barberos', match: ['barbers.html', 'barber.html'] },
        { href: 'news.html', label: 'Noticias', match: ['news.html'] },
        { href: 'profile.html', label: 'Mi cuenta', match: ['profile.html', 'settings.html', 'settings-app.html', 'security.html'] },
        { href: 'support.html#contacto', label: 'Contacto', match: ['support.html'] }
    ];

    const legalLinks = [
        { href: 'terminos.html', label: 'Términos y Condiciones' },
        { href: 'privacidad.html', label: 'Política de Privacidad' },
        { href: 'cookies.html', label: 'Política de Cookies' },
        { href: 'policies.html', label: 'Política de Reservaciones' },
        { href: 'avisos.html', label: 'Avisos legales' }
    ];

    function currentPage() {
        return window.location.pathname.split('/').pop() || '';
    }

    function injectStyles() {
        if (document.getElementById('site-chrome-styles')) return;
        const style = document.createElement('style');
        style.id = 'site-chrome-styles';
        style.textContent = `
            .site-header { position: sticky; top: 0; z-index: 900; display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding: 1.1rem 3rem; background: rgba(10,10,10,.82); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,.06); font-family: 'Inter', system-ui, sans-serif; }
            body.light-mode .site-header { background: rgba(255,255,255,.85); border-bottom-color: rgba(0,0,0,.06); }
            .site-header-logo { font-family: 'Cinzel', serif; font-weight: 800; font-size: 1.25rem; letter-spacing: 3px; color: #d4af37; text-decoration: none; white-space: nowrap; }
            .site-header-links { display: flex; align-items: center; gap: 1.8rem; list-style: none; margin: 0; padding: 0; }
            .site-header-links a { color: #fff; font-size: .78rem; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: none; padding: .35rem 0; border-bottom: 2px solid transparent; transition: color .2s, border-color .2s; }
            body.light-mode .site-header-links a { color: #111; }
            .site-header-links a:hover { color: #d4af37; }
            .site-header-links a.active { color: #d4af37; border-bottom-color: #d4af37; }
            .site-header-actions { display: flex; align-items: center; gap: .75rem; }
            .site-header-icon { width: 38px; height: 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(212,175,55,.35); color: #d4af37; text-decoration: none; }
            .site-header-icon:hover { background: #d4af37; color: #111; }
            .site-header-cta { display: inline-flex; align-items: center; gap: .5rem; padding: .7rem 1.4rem; border-radius: 999px; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: none; color: #111; background: linear-gradient(135deg, #f6dfa0 0%, #d4af37 62%, #87640f 100%); }
            .site-header-cta:hover { filter: brightness(1.06); color: #111; }
            .site-header a:focus-visible { outline: 2px solid #d4af37; outline-offset: 3px; }
            @media (max-width: 1100px) { .site-header { padding: 1rem 1.5rem; } .site-header-links { gap: 1.1rem; } }
            @media (max-width: 968px) { .site-header { display: none; } }
            @media (min-width: 969px) { [data-mobile-topbar] { display: none !important; } }

            .site-footer { background: linear-gradient(180deg, #0a0a0a 0%, #050505 100%); padding: 4rem 2rem 2rem; border-top: 1px solid rgba(212,175,55,.12); color: #b6b6b6; font-family: 'Inter', system-ui, sans-serif; margin-top: 3rem; }
            body.light-mode .site-footer { background: #fff; border-top-color: rgba(0,0,0,.06); color: #555; }
            .site-footer-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1.4fr 1fr 1.2fr 1fr; gap: 2.5rem; align-items: start; }
            .site-footer-brand img { width: 88px; height: auto; margin-bottom: 1rem; filter: drop-shadow(0 0 18px rgba(212,175,55,.28)); }
            .site-footer-brand h3 { font-family: 'Cinzel', serif; font-size: 1.2rem; color: #f5f1e8; margin: 0 0 .75rem; }
            body.light-mode .site-footer-brand h3 { color: #111; }
            .site-footer p { margin: 0; line-height: 1.8; font-size: .9rem; }
            .site-footer h4 { font-family: 'Cinzel', serif; color: #d4af37; margin: 0 0 1rem; font-size: 1rem; }
            .site-footer-col { display: grid; gap: .35rem; justify-items: start; }
            .site-footer-col a, .site-footer-col button { color: inherit; text-decoration: none; font: inherit; font-size: .9rem; line-height: 1.6; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
            .site-footer-col a:hover, .site-footer-col button:hover { color: #f3d68a; text-decoration: underline; }
            body.light-mode .site-footer-col a:hover, body.light-mode .site-footer-col button:hover { color: #7a5c12; }
            .site-footer-credit { display: inline-flex; align-items: center; gap: .6rem; color: #f3d68a !important; font-weight: 600; }
            body.light-mode .site-footer-credit { color: #7a5c12 !important; }
            .site-footer-credit img { width: 28px; height: 28px; border-radius: 8px; }
            .site-footer-payments { max-width: 1200px; margin: 2.5rem auto 0; padding-top: 1.5rem; border-top: 1px solid rgba(212,175,55,.12); display: flex; align-items: center; justify-content: center; gap: 1.3rem; flex-wrap: wrap; font-size: .85rem; }
            .site-footer-payments i { font-size: 1.8rem; }
            .site-footer-payments .fa-cc-visa { color: #2566AF; }
            .site-footer-payments .fa-cc-mastercard { color: #EB5424; }
            .site-footer-payments .fa-apple-pay { color: #e8e8e8; }
            body.light-mode .site-footer-payments .fa-apple-pay { color: #1d1d1f; }
            .site-footer-payments .fa-paypal { color: #3B8FE0; }
            .site-footer-payments .ath-badge { font-weight: 700; padding: .3rem .7rem; border: 1px solid rgba(76,196,99,.4); border-radius: 8px; color: #4CC463; font-size: .78rem; }
            .site-footer-copy { text-align: center; font-size: .8rem; margin-top: 1.25rem; }
            @media (max-width: 968px) { .site-footer-inner { grid-template-columns: 1fr 1fr; } .site-footer-brand { grid-column: 1 / -1; } }
            @media (max-width: 560px) { .site-footer { padding: 3rem 1.25rem 1.5rem; } .site-footer-inner { grid-template-columns: 1fr; gap: 2rem; } }
        `;
        document.head.appendChild(style);
    }

    function renderHeader() {
        if (document.body.dataset.siteHeader === 'off' || document.querySelector('.site-header')) return;
        const page = currentPage();
        const header = document.createElement('header');
        header.className = 'site-header';
        header.innerHTML = `
            <a class="site-header-logo" href="index.html">GOAT STYLE SALON</a>
            <nav aria-label="Menú principal">
                <ul class="site-header-links">
                    ${navLinks.map(link => `<li><a href="${link.href}" class="${link.match.includes(page) ? 'active' : ''}" ${link.match.includes(page) ? 'aria-current="page"' : ''}>${link.label}</a></li>`).join('')}
                </ul>
            </nav>
            <div class="site-header-actions">
                <a class="site-header-icon" href="settings.html" title="Configuración" aria-label="Configuración"><i class="fas fa-gear"></i></a>
                <a class="site-header-cta" href="booking.html"><i class="fas fa-calendar-check"></i>Reservar cita</a>
            </div>
        `;
        document.body.insertBefore(header, document.body.firstChild);
    }

    function renderFooters() {
        const year = (window.GabyLegal && window.GabyLegal.value('year')) || String(new Date().getFullYear());
        const name = (window.GabyLegal && window.GabyLegal.value('tradeName')) || 'Gaby Style Barber Studio';
        document.querySelectorAll('[data-site-footer]').forEach(footer => {
            footer.className = 'site-footer';
            footer.innerHTML = `
                <div class="site-footer-inner">
                    <div class="site-footer-brand">
                        <img src="${LOGO}" alt="Logo ${name}">
                        <h3>${name.toUpperCase()}</h3>
                        <p>Cortes, color, tratamientos y una experiencia VIP diseñada para que cada visita se sienta especial.</p>
                    </div>
                    <div class="site-footer-col">
                        <h4>Contacto</h4>
                        <a href="tel:+17872181068">787-218-1068</a>
                        <p>Barranquitas, Puerto Rico</p>
                        <a href="news.html">Noticias de la barbería</a>
                        <a href="support.html#contacto">Contacto y soporte</a>
                    </div>
                    <div class="site-footer-col">
                        <h4>Legal</h4>
                        ${legalLinks.map(link => `<a href="${link.href}">${link.label}</a>`).join('')}
                        <button type="button" data-cookie-prefs>Preferencias de cookies</button>
                    </div>
                    <div class="site-footer-col">
                        <h4>Desarrollo</h4>
                        <a class="site-footer-credit" href="https://angeltechsolutions.dev/" target="_blank" rel="noreferrer"><img src="${DEV_LOGO}" alt="">Angel Tech Solutions</a>
                    </div>
                </div>
                <div class="site-footer-payments">
                    <span>Aceptamos:</span>
                    <i class="fab fa-cc-visa" title="Visa"></i>
                    <i class="fab fa-cc-mastercard" title="Mastercard"></i>
                    <i class="fab fa-apple-pay" title="Apple Pay"></i>
                    <i class="fab fa-paypal" title="PayPal"></i>
                    <span class="ath-badge">ATH Móvil</span>
                </div>
                <p class="site-footer-copy">&copy; ${year} ${name}. Todos los derechos reservados.</p>
            `;
        });
    }

    function init() {
        injectStyles();
        renderHeader();
        renderFooters();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
