const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

function setup() {
    const storage = new Map();
    const context = vm.createContext({
        console, crypto: webcrypto,
        localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        document: { body: null },
        dispatchEvent() {}
    });
    context.window = context;
    for (const file of ['shared-data.js', 'booking-engine.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
    }
    const state = context.GabyData.getState();
    const client = { id: 'client-test', name: 'Cliente Prueba', email: 'cliente@example.test' };
    state.clients = [client];
    const date = new Date();
    date.setDate(date.getDate() + 3);
    while (date.getDay() === 0) date.setDate(date.getDate() + 1);
    const key = context.GabyBooking.dateKey(date);
    const appointment = {
        code: 'GS-TEST', clientId: client.id, client: client.name, barber: 'gabriel',
        service: 'Classic Cut', services: ['Classic Cut'], duration: 40,
        dateTime: `${key}T10:00`, status: 'COMPLETADA'
    };
    state.appointments = [appointment];
    return { state, client, appointment, key, B: context.GabyBooking, Data: context.GabyData };
}

test('reseñas: exige decisión explícita, cita propia completada y una reseña por cita', () => {
    const { state, client, B } = setup();
    const input = { client, code: 'GS-TEST', rating: 1, text: 'No me gustó.' };
    assert.throws(() => B.addReview(state, input), /consent/);
    assert.throws(() => B.addReview(state, { ...input, client: { id: 'other' }, publish: true }), /appt/);
    state.appointments[0].status = 'APROBADA';
    assert.throws(() => B.addReview(state, { ...input, publish: true }), /appt/);
    state.appointments[0].status = 'COMPLETADA';
    const review = B.addReview(state, { ...input, publish: true });
    assert.equal(review.rating, 1);
    assert.equal(review.service, 'Classic Cut');
    assert.equal(review.serviceDate, state.appointments[0].dateTime.slice(0, 10));
    assert.equal(B.publicReviews(state).length, 1);
    assert.throws(() => B.addReview(state, { ...input, publish: true }), /dup/);
});

test('reseñas: privadas y ocultas quedan fuera; las anteriores ya aprobadas se siguen mostrando', () => {
    const { state, client, B } = setup();
    B.addReview(state, { client, code: 'GS-TEST', rating: 2, publish: false });
    state.reviews.push({ id: 'hidden', status: 'OCULTA', publishConsent: true, rating: 5, barberId: 'gabriel' });
    state.reviews.push({ id: 'legacy-pending', status: 'PENDIENTE', rating: 5, barber: 'gabriel' });
    assert.equal(B.publicReviews(state).length, 0);
    // Reseña del formulario anterior (sin cita ni permiso guardado) que la barbería ya había aprobado.
    state.reviews.push({ id: 'legacy', status: 'APROBADA', rating: '5', barber: 'gabriel', clientId: client.id, createdAt: '2026-05-01T12:00:00.000Z' });
    assert.equal(B.publicReviews(state).map(r => r.id).join(','), 'legacy');
    assert.equal(B.barberRating('gabriel', state).count, 1);
    assert.equal(B.reviewBarber(state.reviews.find(r => r.id === 'legacy'), state).alias, 'Gaby');
});

test('reseñas: valida estrellas enteras y longitud del comentario', () => {
    const { state, client, B } = setup();
    for (const rating of [0, 6, 3.5, NaN]) {
        assert.throws(() => B.addReview(state, { client, code: 'GS-TEST', rating, publish: true }), /rating/);
    }
    assert.throws(() => B.addReview(state, { client, code: 'GS-TEST', rating: 5, text: 'x'.repeat(601), publish: true }), /text/);
});

test('disponibilidad: respeta duración, almuerzo y bloqueos sin impedir citas contiguas', () => {
    const { state, appointment, key, B } = setup();
    appointment.status = 'APROBADA';
    state.timeBlocks = [{ id: 'block', barberId: 'gabriel', startDate: key, endDate: key, startTime: '15:00', endTime: '16:00' }];
    const slots = B.getSlots('gabriel', key, 40, { state, staff: true });
    assert.ok(!slots.includes('10:00'));
    assert.ok(!slots.includes('10:30'));
    assert.ok(slots.includes('10:40'));
    assert.ok(!slots.includes('12:00'));
    assert.ok(!slots.includes('14:30'));
    assert.ok(slots.includes('16:00'));
    state.timeBlocks[0].allDay = true;
    assert.equal(B.getSlots('gabriel', key, 40, { state, staff: true }).length, 0);
});

test('reprogramar conserva código e historial y rechaza solapamientos', () => {
    const { state, appointment, key, B } = setup();
    appointment.status = 'APROBADA';
    B.rescheduleAppointment(state, appointment.code, { date: key, time: '11:00', by: 'cliente', actor: 'Cliente' });
    assert.equal(state.appointments.length, 1);
    assert.equal(appointment.code, 'GS-TEST');
    assert.equal(appointment.history[0].action, 'Reprogramada');
    state.appointments.push({ ...appointment, code: 'GS-OTHER', dateTime: `${key}T10:00` });
    assert.throws(() => B.rescheduleAppointment(state, appointment.code, { date: key, time: '10:15', by: 'cliente' }), /slot/);
    assert.equal(appointment.dateTime, `${key}T11:00`);
});

test('cancelación registra responsable y motivo y libera disponibilidad', () => {
    const { state, appointment, key, B } = setup();
    appointment.status = 'APROBADA';
    B.cancelAppointment(state, appointment.code, { by: 'cliente', actor: 'Cliente', reason: 'Cambio de planes' });
    assert.equal(appointment.status, 'CANCELADA');
    assert.equal(appointment.canceledByClient, true);
    assert.equal(appointment.cancelReason, 'Cambio de planes');
    assert.ok(appointment.canceledAt);
    assert.ok(B.getSlots('gabriel', key, 40, { state, staff: true }).includes('10:00'));
});

test('un guardado rechazado no conserva una cita fantasma en el navegador', async () => {
    const { Data } = setup();
    Data.addCommitHook(() => Promise.reject(Object.assign(new Error('rechazo de prueba'), { userMessage: 'No disponible' })));
    const before = Data.getState().appointments.length;
    const saved = await Data.commit(state => state.appointments.push({ code: 'QA-REJECTED' }), { success: null });
    assert.equal(saved, false);
    assert.equal(Data.getState().appointments.length, before);
});

test('citas en línea: quedan pendientes, apartan el horario y al rechazarlas se libera', () => {
    const { state, client, key, B } = setup();
    const other = { id: 'client-2', name: 'Otro Cliente', email: 'otro@example.test' };
    state.clients.push(other);
    assert.equal(state.settings.booking.autoConfirm, false);
    const services = B.findServices(['Classic Cut'], state);
    const first = B.createAppointment(state, { client, barberId: 'gabriel', services, date: key, time: '14:00', source: 'online' });
    assert.equal(first.status, 'PENDIENTE');
    assert.ok(!B.getSlots('gabriel', key, 40, { state }).includes('14:00'), 'El horario pendiente queda apartado');
    assert.throws(() => B.createAppointment(state, { client: other, barberId: 'gabriel', services, date: key, time: '14:00', source: 'online' }), /booking/);
    B.setStatus(state, first.code, 'RECHAZADA', { actor: 'Gaby', reason: 'Fuera de horario' });
    assert.ok(B.getSlots('gabriel', key, 40, { state }).includes('14:00'), 'Al rechazarla el horario vuelve a estar libre');
    assert.match(state.notifications.find(n => n.clientId === client.id && n.type === 'rechazada').body, /Fuera de horario/);
});

test('migración: una barbería con confirmación automática pasa a aprobación del barbero una sola vez', () => {
    const storage = new Map([['gs_crm', JSON.stringify({ settings: { booking: { autoConfirm: true } } })]]);
    const context = vm.createContext({
        console, crypto: webcrypto,
        localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        document: { body: null }, dispatchEvent() {}
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'shared-data.js'), 'utf8'), context);
    assert.equal(context.GabyData.getState().settings.booking.autoConfirm, false);
    context.GabyData.updateState(s => { s.settings.booking.autoConfirm = true; });
    assert.equal(context.GabyData.getState().settings.booking.autoConfirm, true, 'Si el administrador lo vuelve a activar, se respeta');
});

test('"No sé cómo se llama el recorte": se puede reservar con foto de referencia y la reseña omite el servicio', () => {
    const { state, client, key, B } = setup();
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(200);
    const services = B.findServices([B.UNKNOWN_CUT, 'Classic Cut'].slice(0, 1), state);
    assert.equal(services.length, 1);
    assert.ok(B.barbersForServices(services, state).length > 0, 'Todos los barberos aceptan la opción');
    const appointment = B.createAppointment(state, { client, barberId: 'gabriel', services, date: key, time: '15:00', source: 'online', referencePhoto: photo });
    assert.equal(appointment.unknownCut, true);
    assert.equal(appointment.referencePhoto, photo);
    assert.equal(appointment.price, 'A consultar');
    const unsafe = B.createAppointment(state, { client, barberId: 'gabriel', services, date: key, time: '17:00', source: 'online', referencePhoto: 'javascript:alert(1)' });
    assert.equal(unsafe.referencePhoto, '');
    state.appointments.find(a => a.code === appointment.code).status = 'COMPLETADA';
    const review = B.addReview(state, { client, code: appointment.code, rating: 5, publish: true });
    assert.equal(B.reviewServiceLabel(review), '');
    assert.equal(B.reviewServiceLabel({ service: `${B.UNKNOWN_CUT} + Barba` }), 'Barba');
    assert.equal(B.reviewServiceLabel({ service: 'Classic Cut' }), 'Classic Cut');
});
