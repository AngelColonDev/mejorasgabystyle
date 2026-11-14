const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
let server, browser, origin;
const browserErrors = [];
before(async () => {
    server = http.createServer((req, res) => {
        const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (error, content) => {
            if (error) { res.writeHead(404).end(); return; }
            const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
            res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8');
            res.end(content);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
});
after(async () => {
    await browser?.close();
    await new Promise(resolve => server?.close(resolve));
    assert.deepEqual(browserErrors, [], 'No debe haber errores JavaScript en las páginas probadas');
});

async function pageWithData(staff = null, viewport = { width: 1440, height: 1000 }) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await context.addInitScript(({ staff }) => {
        if (localStorage.getItem('qa-seeded')) return;
        const client = { id: 'qa-client', name: 'Carlos Prueba', email: 'qa@example.test', phone: '7875551234', birthDate: '1990-01-01', preferredBarber: 'gabriel', photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
        const other = { ...client, id: 'qa-other', email: 'other@example.test', preferredBarber: 'wilo' };
        localStorage.setItem('gs_crm', JSON.stringify({ clients: [client, other], session: { currentClientId: client.id }, appointments: [
            { code: 'QA-COMPLETED', clientId: client.id, client: client.name, barber: 'gabriel', barberName: 'Gaby', service: 'Classic Cut', dateTime: '2026-01-10T10:00', status: 'COMPLETADA', duration: 40, price: '$35' },
            { code: 'QA-OTHER', clientId: other.id, client: other.name, barber: 'wilo', service: 'Premium Fade', dateTime: '2026-01-11T10:00', status: 'COMPLETADA', duration: 40, price: '$40' }
        ], reviews: [] }));
        if (staff) localStorage.setItem('gs_staff_session', JSON.stringify({ ...staff, exp: Date.now() + 3600000 }));
        localStorage.setItem('qa-seeded', 'true');
    }, { staff });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => browserErrors.push(error.stack || error.message));
    return { page, context };
}

test('móvil: reseña exige permiso, guarda la opción privada y sobrevive a recargar', async () => {
    const { page, context } = await pageWithData(null, { width: 390, height: 844 });
    try {
        await page.goto(`${origin}/profile.html`);
        await page.locator('[data-tab="history"]').click();
        await page.locator('[data-review="QA-COMPLETED"]').click();
        assert.match(await page.locator('.ca-modal-card').innerText(), /Classic Cut/);
        await page.locator('#ca-review-form button[type=submit]').click({ force: true });
        assert.equal(await page.evaluate(() => GabyData.getState().reviews.length), 0);
        await page.locator('input[name=publish][value=no]').check({ force: true });
        await page.locator('#ca-review-text').fill('Comentario privado de prueba');
        await page.locator('#ca-review-form button[type=submit]').click({ force: true });
        await page.waitForFunction(() => GabyData.getState().reviews.length === 1);
        await page.reload();
        const review = await page.evaluate(() => GabyData.getState().reviews[0]);
        assert.equal(review.publishConsent, false);
        assert.equal(review.serviceDate, '2026-01-10');
        await page.goto(`${origin}/barber.html?id=gabriel`);
        assert.ok(!(await page.locator('body').innerText()).includes('Comentario privado de prueba'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await context.close(); }
});

test('reseña pública conserva foto real y muestra fecha de envío, barbero y servicio en inicio y perfil', async () => {
    const { page, context } = await pageWithData();
    try {
        await page.goto(`${origin}/profile.html`);
        await page.evaluate(() => GabyData.updateState(state => GabyBooking.addReview(state, {
            client: state.clients[0], code: 'QA-COMPLETED', rating: 1, text: '<img src=x onerror="window.qaXss=true">', publish: true
        })));
        // Un visitante no necesita acceso al perfil privado del autor para ver su foto autorizada.
        await page.evaluate(() => GabyData.updateState(state => { state.clients = []; state.session.currentClientId = null; }));
        await page.goto(`${origin}/barber.html?id=gabriel`);
        const reviews = page.locator('section[aria-label="Reseñas de clientes"]');
        const sentDate = await page.evaluate(() => new Date().toLocaleDateString('es-PR', { day: 'numeric', month: 'long', year: 'numeric' }));
        assert.match(await reviews.innerText(), /Servicio: Classic Cut/);
        assert.ok((await reviews.innerText()).includes(`Fecha: ${sentDate}`), 'La fecha es el día en que se envió la reseña');
        assert.match(await reviews.innerText(), /Barbero: Gaby/);
        assert.equal(await reviews.locator('img[alt="Foto de Carlos Prueba"]').count(), 1);
        assert.match(await reviews.locator('img').getAttribute('src'), /^data:image\/png;base64,/);
        assert.equal(await reviews.locator('.bio-text img').count(), 0);
        assert.equal(await page.evaluate(() => Boolean(window.qaXss)), false);
        await page.goto(`${origin}/index.html`);
        const card = page.locator('#track-1 .review-card').first();
        await card.waitFor();
        assert.match(await card.innerText(), /Servicio:\s*Classic Cut/);
        assert.match(await card.innerText(), /Barbero:\s*Gaby/);
        assert.ok((await card.innerText()).replace(/\s+/g, ' ').includes(`Fecha: ${sentDate}`));
        assert.match(await card.locator('img[alt="Foto de Carlos Prueba"]').getAttribute('src'), /^data:image\/png;base64,/);
        assert.equal(await card.locator('.review-text img').count(), 0);
        await page.getByRole('button', { name: 'Rechazar no esenciales', exact: true }).click();
        // Comprobar lo que realmente se ve, no solo que los datos estén en el DOM.
        await page.addStyleTag({ content: '#testimonios .marquee-track { animation: none !important; }' });
        await page.locator('#testimonios').scrollIntoViewIfNeeded();
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            await page.setViewportSize(viewport);
            await page.locator('#testimonios').scrollIntoViewIfNeeded();
            const visible = await card.evaluate(element => {
                const bounds = element.getBoundingClientRect();
                return ['.vip-review-photo', '.vip-review-name', '.vip-review-details'].every(selector => {
                    const item = element.querySelector(selector);
                    const rect = item.getBoundingClientRect();
                    const style = getComputedStyle(item);
                    return rect.width > 0 && rect.height > 0 && rect.top >= bounds.top && rect.bottom <= bounds.bottom && style.visibility === 'visible' && style.display !== 'none';
                });
            });
            assert.equal(visible, true);
            const output = path.join(__dirname, 'artifacts');
            fs.mkdirSync(output, { recursive: true });
            await page.locator('#testimonios').screenshot({ path: path.join(output, `vip-${viewport.width}.png`) });
        }
    } finally { await context.close(); }
});

test('Clientes VIP recupera datos de citas anteriores y conserva un avatar visible sin foto', async () => {
    const { page, context } = await pageWithData();
    try {
        await page.goto(`${origin}/index.html`);
        await page.evaluate(() => GabyData.updateState(state => {
            state.clients[0].photo = '';
            state.reviews = [{ id: 'qa-legacy', clientId: 'qa-client', clientName: 'Carlos Prueba', appointmentCode: 'QA-COMPLETED', rating: 5, status: 'APROBADA', publishConsent: true, text: 'Muy buen recorte.' }];
        }));
        const card = page.locator('#track-1 .review-card').first();
        assert.match(await card.innerText(), /Servicio:\s*Classic Cut/);
        assert.match(await card.innerText(), /Barbero:\s*Gaby/);
        assert.match(await card.innerText(), /Fecha:\s*.*2026/);
        await page.waitForFunction(() => document.querySelector('#track-1 .vip-review-photo')?.naturalWidth > 0);
        assert.match(await card.locator('img').getAttribute('src'), /review-avatar\.svg$/);
    } finally { await context.close(); }
});

test('CRM: sin sesión no se puede buscar fichas', async () => {
    const { page, context } = await pageWithData();
    try {
        await page.goto(`${origin}/crm/dist/index.html`);
        await page.getByRole('heading', { name: 'Acceso del personal' }).waitFor();
        assert.equal(await page.getByPlaceholder('0000').count(), 0);
    } finally { await context.close(); }
});

test('CRM: separa clientes con el mismo nombre y abre una cita real con cliente precargado', async () => {
    const { page, context } = await pageWithData({ email: 'gaby@goatstylesalon.com', barberId: 'gabriel', isAdmin: true });
    try {
        await page.goto(`${origin}/crm/dist/index.html?phone=1234&name=Carlos%20Prueba`);
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await page.getByRole('button', { name: '2 Citas', exact: true }).click();
        assert.match(await page.locator('.crm-workspace-content').innerText(), /Classic Cut/);
        assert.ok(!(await page.locator('.crm-workspace-content').innerText()).includes('Premium Fade'));
        assert.equal(await page.getByRole('button', { name: 'Registrar Pago', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Nueva Cita', exact: true }).click();
        await page.locator('#ap-new-client').waitFor();
        assert.equal(await page.locator('#ap-new-client').inputValue(), 'qa-client');
        assert.ok(await page.locator('#ap-new-form').isVisible());
    } finally { await context.close(); }
});

async function seedPendingAppointment(page) {
    return page.evaluate(() => {
        let code = null;
        GabyData.updateState(state => {
            const next = GabyBooking.nextAvailable('gabriel', 40, state);
            const appointment = GabyBooking.createAppointment(state, { client: state.clients[0], barberId: 'gabriel', services: GabyBooking.findServices(['Classic Cut'], state), date: next.date, time: next.time, source: 'online', referencePhoto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' });
            code = appointment.code;
        });
        return code;
    });
}

test('panel admin: menú agrupado, cerrar sesión al final en rojo y el menú no se mueve al escoger una opción', async () => {
    const { page, context } = await pageWithData({ email: 'gaby@goatstylesalon.com', barberId: 'gabriel', isAdmin: true }, { width: 1440, height: 640 });
    try {
        await page.goto(`${origin}/staff/gaby/index.html`);
        await page.locator('.admin-shell').waitFor();
        const code = await seedPendingAppointment(page);
        assert.equal(await page.evaluate(c => GabyData.getState().appointments.find(a => a.code === c).status, code), 'PENDIENTE');
        await page.locator('.admin-shell').waitFor();
        const topbar = await page.locator('.topbar').innerText();
        assert.ok(!/Cambiar contraseña|Cerrar sesión/i.test(topbar), 'La barra de arriba ya no tiene cambiar contraseña ni cerrar sesión');
        assert.deepEqual((await page.locator('.nav-group-label').allInnerTexts()).map(t => t.toUpperCase()), ['AGENDA', 'CLIENTES', 'BARBERÍA', 'NEGOCIO', 'CUENTA']);
        const logout = page.locator('.sidebar .nav-footer > :last-child');
        assert.match(await logout.innerText(), /Cerrar sesión/);
        assert.match(await logout.evaluate(el => getComputedStyle(el).color), /rgb\(255, 138, 138\)/);
        // El menú conserva su posición al escoger una opción (no se redibuja ni vuelve arriba).
        await page.evaluate(() => { const s = document.querySelector('.sidebar'); s.scrollTop = s.scrollHeight; s.dataset.qa = 'mismo'; });
        const before = await page.evaluate(() => document.querySelector('.sidebar').scrollTop);
        assert.ok(before > 0);
        await page.locator('.nav-btn[data-section="settings"]').click();
        const after = await page.evaluate(() => ({ nav: document.querySelector('.sidebar').scrollTop, same: document.querySelector('.sidebar').dataset.qa }));
        assert.equal(after.same, 'mismo');
        assert.equal(after.nav, before);
        const settings = page.locator('#admin-section-content');
        assert.equal(await settings.getByRole('button', { name: 'Cambiar contraseña' }).count(), 1);
        assert.equal(await settings.getByRole('button', { name: 'Cerrar sesión' }).count(), 1);
        // Citas: Aprobar y Rechazar a la vista; el resto en los tres puntos.
        assert.equal(await page.locator('.nav-btn[data-section="appointments"] .ap-nav-badge').innerText(), '1');
        await page.locator('.nav-btn[data-section="appointments"]').click();
        const request = page.locator('.ap-request').first();
        await request.waitFor();
        assert.equal(await request.getByRole('button', { name: 'Aprobar' }).count(), 1);
        assert.equal(await request.getByRole('button', { name: 'Rechazar' }).count(), 1);
        assert.equal(await request.locator('img.ap-request-photo').count(), 1);
        await request.locator('[data-more]').click();
        const menu = page.locator('.ap-more-menu');
        assert.match(await menu.innerText(), /Ver detalles[\s\S]*Marcar completada[\s\S]*Marcar no-show[\s\S]*Editar \/ reprogramar[\s\S]*Cancelar cita/);
        await page.keyboard.press('Escape');
        assert.equal(await menu.count(), 0);
        await request.getByRole('button', { name: 'Aprobar' }).click();
        await page.waitForFunction(c => GabyData.getState().appointments.find(a => a.code === c).status === 'APROBADA', code);
        await page.waitForFunction(() => !document.querySelector('.ap-request'));
    } finally { await context.close(); }
});

test('panel en el celular: el menú se abre con el botón y se cierra al escoger una sección', async () => {
    const { page, context } = await pageWithData({ email: 'wilo@goatstylesalon.com', barberId: 'wilo', isAdmin: false }, { width: 390, height: 844 });
    try {
        await page.goto(`${origin}/staff/wilo/index.html`);
        await page.locator('.admin-shell').waitFor();
        const offscreen = await page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right <= 0);
        assert.equal(offscreen, true, 'El menú empieza cerrado');
        assert.equal(await page.locator('.nav-btn[data-section="providers"]').count(), 0, 'Proveedores es solo del administrador');
        await page.locator('[data-nav-open]').click();
        await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().left >= 0);
        await page.locator('.nav-btn[data-section="calendar"]').click();
        await page.waitForFunction(() => !document.body.classList.contains('nav-open'));
        assert.equal(await page.locator('.mobile-bar-title').innerText(), 'Calendario');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await context.close(); }
});

test('reserva: opción "No sé cómo se llama el recorte" con foto de referencia queda pendiente de aprobación', async () => {
    const { page, context } = await pageWithData(null, { width: 390, height: 844 });
    try {
        await page.goto(`${origin}/booking.html`);
        const banner = page.getByRole('button', { name: 'Rechazar no esenciales', exact: true });
        if (await banner.count()) await banner.click();
        await page.locator('.bw-unknown input').check({ force: true });
        await page.locator('.bw [data-next]').click();
        await page.locator('[data-barber="gabriel"]').click();
        await page.locator('.bw-time').first().click();
        await page.locator('.bw [data-next]').click();
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
        await page.locator('#bw-photo').setInputFiles({ name: 'referencia.png', mimeType: 'image/png', buffer: png });
        await page.locator('.bw-photo-preview img').waitFor();
        await page.locator('#bw-agree').check({ force: true });
        await page.locator('[data-confirm]').click();
        await page.waitForFunction(() => GabyData.getState().appointments.some(a => a.unknownCut));
        const appointment = await page.evaluate(() => GabyData.getState().appointments.find(a => a.unknownCut));
        assert.equal(appointment.status, 'PENDIENTE');
        assert.equal(appointment.service, 'No sé cómo se llama el recorte');
        assert.match(appointment.referencePhoto, /^data:image\/jpeg;base64,/);
        assert.match(await page.locator('.bw-done').innerText(), /Recibimos tu solicitud/);
    } finally { await context.close(); }
});

test('panel del barbero en el celular: cada sección abre con un solo toque y nada es más ancho que la pantalla', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    await context.addInitScript(() => {
        if (localStorage.getItem('qa-seeded')) return;
        const client = { id: 'qa-long', name: 'Carlos Prueba Con Un Nombre Bastante Largo', email: 'carlos.prueba.largo@example.test', phone: '7875551234', preferredBarber: 'wilo' };
        localStorage.setItem('gs_crm', JSON.stringify({ clients: [client], session: {}, appointments: [
            { code: 'QA-W1', clientId: client.id, client: client.name, barber: 'wilo', barberName: 'Wilo', service: 'Classic Cut', services: ['Classic Cut'], dateTime: '2026-01-10T10:00', status: 'COMPLETADA', duration: 40 }
        ], reviews: [] }));
        localStorage.setItem('gs_staff_session', JSON.stringify({ email: 'wilo@goatstylesalon.com', barberId: 'wilo', isAdmin: false, exp: Date.now() + 3600000 }));
        localStorage.setItem('qa-seeded', 'true');
    });
    const page = await context.newPage();
    page.on('pageerror', error => browserErrors.push(error.stack || error.message));
    try {
        await page.goto(`${origin}/staff/wilo/index.html`);
        await page.locator('.admin-shell').waitFor();
        const ids = await page.evaluate(() => [...document.querySelectorAll('.nav-btn[data-section]')].map(b => b.dataset.section));
        for (const id of ids) {
            await page.locator('[data-nav-open]').tap();
            await page.waitForFunction(() => document.body.classList.contains('nav-open'));
            await page.locator(`.nav-btn[data-section="${id}"]`).tap();
            await page.waitForFunction(section => !document.body.classList.contains('nav-open') && document.querySelector('.nav-btn.active')?.dataset.section === section, id);
            const size = await page.evaluate(() => ({ vw: innerWidth, doc: document.documentElement.scrollWidth }));
            assert.deepEqual([id, size.vw, size.doc <= 390], [id, 390, true], `La sección ${id} cabe en la pantalla`);
        }
        await page.locator('[data-nav-open]').tap();
        await page.locator('.nav-btn[data-section="clients"]').tap();
        await page.locator('[data-pick]').first().tap();
        await page.getByText('Notas internas').waitFor();
    } finally { await context.close(); }
});

test('inicio: "Cliente" lleva a la página normal de Mi cuenta y las reseñas anteriores aprobadas se ven con foto y barbero', async () => {
    const { page, context } = await pageWithData();
    try {
        await page.goto(`${origin}/index.html`);
        assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('a')].filter(a => /^(Cliente|Portal)/.test(a.textContent.trim())).map(a => a.getAttribute('href'))), ['profile.html', 'profile.html']);
        await page.evaluate(() => GabyData.updateState(state => {
            state.reviews = [{ id: 'qa-old', clientId: 'qa-client', clientName: 'Carlos Prueba', barber: 'gabriel', rating: '5', text: 'Reseña de antes', createdAt: '2026-05-01T12:00:00.000Z', status: 'APROBADA' }];
        }));
        await page.reload();
        const card = page.locator('#track-1 .review-card').first();
        await card.waitFor();
        const text = (await card.innerText()).replace(/\s+/g, ' ');
        assert.match(text, /Reseña de antes/);
        assert.match(text, /Barbero: Gaby/);
        assert.match(text, /Fecha: 1 de mayo de 2026/);
        assert.match(await card.locator('img.vip-review-photo').getAttribute('src'), /^data:image\/png;base64,/);
        await page.goto(`${origin}/barber.html?id=gabriel`);
        assert.match(await page.locator('section[aria-label="Reseñas de clientes"]').innerText(), /Reseña de antes[\s\S]*Barbero: Gaby/);
    } finally { await context.close(); }
});
