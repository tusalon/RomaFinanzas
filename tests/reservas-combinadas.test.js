// Una reserva con varios servicios en una sola fila ("Base Rubber + Pedicura")
// tiene que llegar a Finanzas como UN COBRO POR SERVICIO, no como un cobro sin
// servicio.
//
// EL FALLO (24-09-2026)
// Liz Nails veia "Falta calcular el costo de 5 cobro(s)". Los 5 eran reservas
// combinadas: Finanzas buscaba un servicio llamado "Base Rubber + Pedicura",
// no existia, y guardaba el cobro sin servicio. Sin servicio no hay ficha de
// costo: costo cero y ganancia inflada. 563 reservas asi en 53 salones.
//
// Lo mas delicado no es repartir: es no contar el dinero dos veces al
// sustituir los cobros viejos, que ya estan guardados enteros.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(path.join(__dirname, '..', 'utils', 'supabase.js'), 'utf8');

function cargar() {
    const desde = fuente.indexOf('// UNA RESERVA PUEDE TRAER VARIOS SERVICIOS');
    const hasta = fuente.indexOf('function mapFinanceExpenseFromDb(');
    assert.ok(desde !== -1 && hasta > desde, 'no encontre el bloque de reservas en utils/supabase.js');
    const contexto = {
        toNumber: (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; },
        normalizeFinanceText: (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(),
        getTodayKey: () => '2026-09-24'
    };
    vm.runInNewContext(fuente.slice(desde, hasta), contexto);
    return contexto;
}

// Los servicios reales de Liz Nails implicados.
const SERVICIOS = [
    { id: 'srv_rubber', name: 'Base Rubber', price: 1000, currency: 'CUP' },
    { id: 'srv_pedi', name: 'Pedicura', price: 500, currency: 'CUP' },
    { id: 'srv_gel', name: 'Gel construcción', price: 1100, currency: 'CUP' }
];
const CONFIG = { mainCurrency: 'CUP' };
// Lo que sale de vm son listas de otro "reino": se compara por contenido.
const igual = (a, b, mensaje) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), mensaje);
const suma = (partes) => Math.round(partes.reduce((s, p) => s + p.amount, 0) * 100) / 100;

test('Walkidia: "Base Rubber + Pedicura" de 1600 sale en dos cobros con su servicio', () => {
    const { mapBookingToFinanceIncomes } = cargar();
    const partes = mapBookingToFinanceIncomes(
        { id: 77, fecha: '2026-09-01', cliente_nombre: 'Walkidia', servicio: 'Base Rubber + Pedicura', estado: 'Completado', monto_cobrado: 1600 },
        SERVICIOS, CONFIG
    );
    assert.equal(partes.length, 2);
    igual(partes.map((p) => p.serviceId), ['srv_rubber', 'srv_pedi'], 'ninguno sin servicio');
    igual(partes.map((p) => p.id), ['reserva_77', 'reserva_77__2']);
    // En proporcion al precio (1000:500), como reparte RservasRoma.
    igual(partes.map((p) => p.amount), [1066.67, 533.33]);
    assert.equal(suma(partes), 1600, 'el total no cambia ni un centavo');
    assert.ok(partes.every((p) => p.bookingId === '77' && p.source === 'reserva'));
});

test('una reserva de un solo servicio sale exactamente igual que antes', () => {
    const { mapBookingToFinanceIncomes } = cargar();
    const partes = mapBookingToFinanceIncomes(
        { id: 5, fecha: '2026-09-02', servicio: 'Pedicura', estado: 'Completado', monto_cobrado: 500 },
        SERVICIOS, CONFIG
    );
    assert.equal(partes.length, 1);
    assert.equal(partes[0].id, 'reserva_5');
    assert.equal(partes[0].serviceId, 'srv_pedi');
    assert.equal(partes[0].amount, 500);
    assert.equal(partes[0].note, 'Cita Completado');
});

test('un servicio que de verdad se llama "Manicura + Pedicura" no se parte', () => {
    const { mapBookingToFinanceIncomes } = cargar();
    const conCombo = [...SERVICIOS, { id: 'srv_combo', name: 'Manicura + Pedicura', price: 900, currency: 'CUP' }];
    const partes = mapBookingToFinanceIncomes({ id: 9, servicio: 'Manicura + Pedicura', monto_cobrado: 900 }, conCombo, CONFIG);
    assert.equal(partes.length, 1);
    assert.equal(partes[0].serviceId, 'srv_combo');
});

test('si un servicio ya no existe, se reparte a partes iguales y el total se respeta', () => {
    const { mapBookingToFinanceIncomes } = cargar();
    const partes = mapBookingToFinanceIncomes({ id: 3, servicio: 'Base Rubber + Servicio borrado', monto_cobrado: 1000 }, SERVICIOS, CONFIG);
    igual(partes.map((p) => p.serviceId), ['srv_rubber', '']);
    igual(partes.map((p) => p.amount), [500, 500]);
});

test('tres servicios: el redondeo nunca pierde ni inventa un centavo', () => {
    const { mapBookingToFinanceIncomes } = cargar();
    const partes = mapBookingToFinanceIncomes({ id: 4, servicio: 'Base Rubber + Pedicura + Gel construcción', monto_cobrado: 1000 }, SERVICIOS, CONFIG);
    assert.equal(partes.length, 3);
    assert.equal(suma(partes), 1000);
});

// ---------------- Sustituir los cobros viejos sin contar dos veces ----------------

const RESERVA = { id: 77, fecha: '2026-09-01', cliente_nombre: 'Walkidia', servicio: 'Base Rubber + Pedicura', estado: 'Completado', monto_cobrado: 1600 };
const VIEJO = { id: 'reserva_77', bookingId: '77', serviceId: '', amount: 1600, tipAmount: 0, note: 'Cita Completado', source: 'reserva', version: 4 };

function visibles(guardados, nuevas) {
    const porId = new Map();
    [...guardados, ...nuevas].forEach((e) => porId.set(String(e.id), e));
    return [...porId.values()];
}

test('el cobro viejo entero (Liz Nails) se sustituye por sus partes, sin duplicar', () => {
    const { mapBookingToFinanceIncomes, reconciliarCobrosDeReservas } = cargar();
    const partes = mapBookingToFinanceIncomes(RESERVA, SERVICIOS, CONFIG);
    const nuevas = reconciliarCobrosDeReservas(partes, [VIEJO]);

    assert.equal(nuevas.length, 2, 'se guardan las dos partes');
    assert.equal(nuevas[0].id, 'reserva_77', 'la primera pisa al viejo: mismo id');
    assert.equal(nuevas[0].version, 4, 'con su version, para que el servidor rechace si alguien lo cambio');

    const enPantalla = visibles([VIEJO], nuevas);
    assert.equal(enPantalla.length, 2, 'dos cobros, no tres');
    assert.equal(suma(enPantalla), 1600, 'el dinero del mes no cambia');
    assert.ok(enPantalla.every((e) => e.serviceId), 'y ya ninguno esta sin servicio');
});

test('si el viejo cambio de importe despues, tampoco se cuenta dos veces', () => {
    const { mapBookingToFinanceIncomes, reconciliarCobrosDeReservas } = cargar();
    const partes = mapBookingToFinanceIncomes(RESERVA, SERVICIOS, CONFIG);
    const viejoConOtroImporte = { ...VIEJO, amount: 1500 };
    const enPantalla = visibles([viejoConOtroImporte], reconciliarCobrosDeReservas(partes, [viejoConOtroImporte]));
    assert.equal(enPantalla.length, 2);
    assert.equal(suma(enPantalla), 1600, 'manda la reserva, una sola vez');
});

test('si la duena ya le puso servicio o propina al viejo, se respeta y no se reparte', () => {
    const { mapBookingToFinanceIncomes, reconciliarCobrosDeReservas } = cargar();
    const partes = mapBookingToFinanceIncomes(RESERVA, SERVICIOS, CONFIG);
    for (const tocado of [{ ...VIEJO, serviceId: 'srv_rubber' }, { ...VIEJO, tipAmount: 200 }]) {
        const nuevas = reconciliarCobrosDeReservas(partes, [tocado]);
        assert.equal(nuevas.length, 0, 'no se guarda nada');
        igual(visibles([tocado], nuevas), [tocado], 'queda el suyo, tal cual');
    }
});

test('una vez repartido, volver a entrar no guarda nada ni duplica', () => {
    const { mapBookingToFinanceIncomes, reconciliarCobrosDeReservas } = cargar();
    const partes = mapBookingToFinanceIncomes(RESERVA, SERVICIOS, CONFIG);
    const guardadas = partes.map((p, i) => ({ ...p, version: i + 1 }));
    const nuevas = reconciliarCobrosDeReservas(partes, guardadas);
    assert.equal(nuevas.length, 0);
    assert.equal(suma(visibles(guardadas, nuevas)), 1600);
});

test('si un guardado se corto a medias, se completa la parte que falta', () => {
    const { mapBookingToFinanceIncomes, reconciliarCobrosDeReservas } = cargar();
    const partes = mapBookingToFinanceIncomes(RESERVA, SERVICIOS, CONFIG);
    // La primera ya pisó al viejo, la segunda no llegó.
    const nuevas = reconciliarCobrosDeReservas(partes, [{ ...partes[0], version: 5 }]);
    igual(nuevas.map((e) => e.id), ['reserva_77__2']);
    assert.equal(suma(visibles([{ ...partes[0], version: 5 }], nuevas)), 1600);
});

test('reservas de un servicio ya guardadas: manda lo guardado, como siempre', () => {
    const { mapBookingToFinanceIncomes, reconciliarCobrosDeReservas } = cargar();
    const partes = mapBookingToFinanceIncomes({ id: 5, servicio: 'Pedicura', monto_cobrado: 500 }, SERVICIOS, CONFIG);
    const guardado = { ...partes[0], tipAmount: 100, version: 2 };
    assert.equal(reconciliarCobrosDeReservas(partes, [guardado]).length, 0);
});
