const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { buildCobrosHistory, buildCobrosCsv, getCobroOrigin } = require('../utils/finance.js');

const config = { mainCurrency: 'CUP', desiredMargin: 60, rates: { USD: 350, MLC: 340, EUR: 380 } };
const services = [{ id: 's1', name: 'Manicura' }, { id: 's2', name: 'Pedicura' }];

const cobro = (id, date, extra = {}) => ({
    id, date, serviceId: 's1', client: 'Laura', amount: 1000, currency: 'CUP',
    amountMain: 1000, rateToMain: 1, tipAmount: 0, paymentMethod: 'Efectivo', source: 'manual', costSheetId: 'f1',
    ...extra
});

const entries = [
    cobro('inc_1', '2026-09-10'),
    cobro('reserva_7', '2026-10-02', { source: 'reserva', client: 'Ana', serviceId: 's2', amount: 20, currency: 'USD', amountMain: 7000, rateToMain: 350, costSheetId: '' }),
    cobro('inc_2', '2026-10-15', { client: 'María', tipAmount: 200, tipAmountMain: 200, tipRateToMain: 1, tipCurrency: 'CUP', note: 'Descuento amigas' }),
    cobro('reserva_8', '2026-10-15', { source: 'reserva', client: 'Pepa', serviceId: 'borrado' })
];

test('lista todos los cobros, los mas nuevos primero, mezclando agenda y manuales', () => {
    const { rows, totals } = buildCobrosHistory(entries, services, config);
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((r) => r.date), ['2026-10-15', '2026-10-15', '2026-10-02', '2026-09-10']);
    assert.equal(totals.count, 4);
});

test('distingue lo que llega de la agenda de lo anotado a mano', () => {
    assert.equal(getCobroOrigin({ source: 'reserva' }), 'agenda');
    assert.equal(getCobroOrigin({ source: 'manual' }), 'manual');
    assert.equal(getCobroOrigin({}), 'manual', 'sin origen cuenta como anotado a mano');
    assert.equal(getCobroOrigin(null), 'manual');

    const agenda = buildCobrosHistory(entries, services, config, { origin: 'agenda' }).rows;
    assert.deepEqual(agenda.map((r) => r.id).sort(), ['reserva_7', 'reserva_8']);
    const manual = buildCobrosHistory(entries, services, config, { origin: 'manual' }).rows;
    assert.deepEqual(manual.map((r) => r.id).sort(), ['inc_1', 'inc_2']);
});

test('filtra por mes y ofrece los meses que de verdad tienen cobros', () => {
    const resultado = buildCobrosHistory(entries, services, config, { month: '2026-10' });
    assert.deepEqual(resultado.months, ['2026-10', '2026-09'], 'los meses salen de todos los cobros, no del filtro');
    assert.equal(resultado.rows.length, 3);
    assert.equal(buildCobrosHistory(entries, services, config, { month: '2026-09' }).rows.length, 1);
    assert.equal(buildCobrosHistory(entries, services, config, { month: '2026-08' }).rows.length, 0);
});

test('busca por clienta, servicio, forma de pago o nota, sin importar acentos ni mayusculas', () => {
    const buscar = (query) => buildCobrosHistory(entries, services, config, { query }).rows.map((r) => r.id);
    assert.deepEqual(buscar('maria'), ['inc_2']);
    assert.deepEqual(buscar('PEDICURA'), ['reserva_7']);
    assert.deepEqual(buscar('amigas'), ['inc_2']);
    assert.deepEqual(buscar('   '), buscar(''), 'espacios no filtran');
    assert.deepEqual(buscar('nadie'), []);
});

test('suma en la moneda principal con el cambio guardado de cada cobro y separa propinas', () => {
    const { totals } = buildCobrosHistory(entries, services, config, { month: '2026-10' });
    // 7000 (20 USD a 350) + 1000 + 1000 de servicios; 200 de propina
    assert.equal(totals.serviceMain, 9000);
    assert.equal(totals.tipMain, 200);
    assert.equal(totals.totalMain, 9200);
});

test('un servicio borrado y un cobro sin ficha de costo se marcan en vez de esconderse', () => {
    const { rows } = buildCobrosHistory(entries, services, config);
    assert.equal(rows.find((r) => r.id === 'reserva_8').serviceName, 'Sin servicio');
    assert.equal(rows.find((r) => r.id === 'reserva_7').missingCost, true);
    assert.equal(rows.find((r) => r.id === 'inc_1').missingCost, false);
});

test('sin cobros o con datos raros no se rompe', () => {
    assert.deepEqual(buildCobrosHistory(undefined, undefined, config).rows, []);
    assert.deepEqual(buildCobrosHistory([], [], config).months, []);
    const raro = buildCobrosHistory([null, {}, { id: 'x', date: 'no-es-fecha', amount: 'abc' }], services, config);
    assert.equal(raro.rows.length, 1, 'solo cuenta lo que tiene id');
    assert.deepEqual(raro.months, [], 'una fecha mala no inventa un mes');
    assert.equal(raro.rows[0].amount, 0);
});

test('el CSV trae una linea por cobro, con acentos para Excel y comillas escapadas', () => {
    const { rows } = buildCobrosHistory([cobro('inc_9', '2026-10-20', { client: 'Ana "la jefa"', note: 'ok, gracias' })], services, config);
    const csv = buildCobrosCsv(rows, 'CUP');
    const lineas = csv.replace('﻿', '').split('\r\n');
    assert.equal(csv.charCodeAt(0), 0xFEFF, 'BOM para Excel');
    assert.equal(lineas.length, 2, 'cabecera y un cobro');
    assert.ok(lineas[0].includes('"Total en CUP"'));
    assert.ok(lineas[1].includes('"Ana ""la jefa"""'), 'comillas dobles escapadas');
    assert.ok(lineas[1].includes('"ok, gracias"'), 'una coma dentro del texto no parte la columna');
    assert.ok(lineas[1].includes('"Anotado a mano"'));
});

test('la pantalla esta conectada: bundle, ruta, titulo y enlaces', () => {
    const root = path.resolve(__dirname, '..');
    const leer = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(leer('scripts/build-web.js').includes("'views/History.js'"), 'va en el bundle');
    assert.ok(leer('app.js').includes("case 'history': return <CobrosHistory"), 'tiene ruta');
    assert.ok(leer('components/TopBar.js').includes("history: 'Historial de cobros'"), 'tiene titulo');
    assert.ok(leer('components/TopBar.js').includes("'reports', 'history', 'config'"), 'es una subpantalla con boton de volver');
    assert.ok(leer('views/Menu.js').includes("onNavigate('history')"), 'enlace desde el menu');
    assert.ok(leer('views/Income.js').includes("onNavigate('history')"), 'enlace desde Anotar cobro');
});
