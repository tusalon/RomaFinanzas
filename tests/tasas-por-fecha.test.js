// Tasas por fechas: el dolar no vale lo mismo todo el mes en Cuba.
//
// Pedido el 24-09-2026: "USD entre el 3 y el 12 de septiembre a 690, y del 12
// al 15 a 718". Un cobro guardado congela la tasa del dia en que se apunto,
// asi que poner la tasa de hoy no arreglaba los dias pasados.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getRateToMainCurrency,
    createMoneySnapshot,
    getHistoricalAmountMain,
    validarTasasPorFecha,
    validateFinanceConfig,
    recalcularDineroDeCobro,
    planificarTasasPorFecha
} = require('../utils/finance.js');

const TRAMOS = [
    { moneda: 'USD', desde: '2026-09-03', hasta: '2026-09-12', tasa: 690 },
    { moneda: 'USD', desde: '2026-09-12', hasta: '2026-09-15', tasa: 718 }
];
const config = (historial = TRAMOS) => ({
    mainCurrency: 'CUP',
    desiredMargin: 60,
    rates: { USD: 720, MLC: 300, EUR: 750, historial }
});

test('cada dia usa la tasa de su tramo; fuera de los tramos, la de hoy', () => {
    const c = config();
    assert.equal(getRateToMainCurrency('USD', c, '2026-09-05'), 690);
    assert.equal(getRateToMainCurrency('USD', c, '2026-09-14'), 718);
    assert.equal(getRateToMainCurrency('USD', c, '2026-09-20'), 720, 'despues del 15: la de hoy');
    assert.equal(getRateToMainCurrency('USD', c, '2026-09-01'), 720, 'antes del 3: la de hoy');
});

test('el dia 12 esta en los dos tramos: manda el que empieza mas tarde (718)', () => {
    assert.equal(getRateToMainCurrency('USD', config(), '2026-09-12'), 718);
});

test('sin fecha todo funciona exactamente como antes', () => {
    assert.equal(getRateToMainCurrency('USD', config()), 720);
    assert.equal(getRateToMainCurrency('USD', config([])), 720);
});

test('el tramo de USD no toca otras monedas', () => {
    assert.equal(getRateToMainCurrency('EUR', config(), '2026-09-05'), 750);
});

test('un cobro nuevo de 20 USD del dia 5 se guarda a 690', () => {
    const s = createMoneySnapshot(20, 'USD', config(), '2026-09-05');
    assert.equal(s.amountMain, 13800);
});

test('si la moneda principal es USD, un cobro en CUP tambien usa la tasa del tramo', () => {
    const c = { ...config(), mainCurrency: 'USD' };
    assert.equal(Math.round(getRateToMainCurrency('CUP', c, '2026-09-05') * 690 * 1000) / 1000, 1);
});

test('cobros viejos sin tasa guardada se convierten con la de su fecha', () => {
    const viejo = { date: '2026-09-05', amount: 10, currency: 'USD', rateToMain: 0, amountMain: 0 };
    assert.equal(getHistoricalAmountMain(viejo, config()), 6900);
});

test('recalcular un cobro guardado cambia el dinero pero NO el costo del servicio', () => {
    const guardado = {
        date: '2026-09-05', amount: 20, currency: 'USD', rateToMain: 720, amountMain: 14400,
        tipAmount: 2, tipCurrency: 'USD', tipRateToMain: 720, tipAmountMain: 1440,
        unitCostMain: 3000, profitMain: 11400
    };
    const r = recalcularDineroDeCobro(guardado, config());
    assert.equal(r.amountMain, 13800);
    assert.equal(r.tipAmountMain, 1380);
    assert.equal(r.unitCostMain, 3000, 'el material usado no depende del dolar de ese dia');
    assert.equal(r.profitMain, 10800);
});

test('el plan solo toca lo que esta en las fechas, en otra moneda, y cambia de verdad', () => {
    const state = {
        incomeEntries: [
            { id: 'a', date: '2026-09-05', amount: 20, currency: 'USD', amountMain: 14400, rateToMain: 720 },
            { id: 'b', date: '2026-09-05', amount: 1000, currency: 'CUP', amountMain: 1000, rateToMain: 1 },
            { id: 'c', date: '2026-09-20', amount: 20, currency: 'USD', amountMain: 14400, rateToMain: 720 },
            { id: 'd', date: '2026-09-06', amount: 10, currency: 'USD', amountMain: 6900, rateToMain: 690 }
        ],
        expenseEntries: [
            { id: 'g1', date: '2026-09-13', amount: 5, currency: 'USD', amountMain: 3600, rateToMain: 720 },
            { id: 'g2', date: '2026-09-13', amount: 500, currency: 'CUP', amountMain: 500, rateToMain: 1 }
        ]
    };
    const { cobros, gastos } = planificarTasasPorFecha(state, config());
    assert.deepEqual(cobros.map((e) => e.id), ['a'], 'CUP, fuera de fechas y ya correcto: no se tocan');
    assert.deepEqual(gastos.map((e) => e.id), ['g1']);
    assert.equal(gastos[0].amountMain, 3590);
});

test('si se QUITA un tramo equivocado, esos cobros vuelven a la tasa de hoy', () => {
    const conError = [{ moneda: 'USD', desde: '2026-09-12', hasta: '2026-09-15', tasa: 18 }];
    const state = { incomeEntries: [{ id: 'x', date: '2026-09-14', amount: 20, currency: 'USD', amountMain: 360, rateToMain: 18 }] };
    const { cobros } = planificarTasasPorFecha(state, config([]), conError);
    assert.equal(cobros.length, 1);
    assert.equal(cobros[0].amountMain, 14400);
});

test('tramos mal puestos no se guardan', () => {
    assert.equal(validarTasasPorFecha(TRAMOS).length, 0);
    assert.ok(validarTasasPorFecha([{ moneda: 'USD', desde: '2026-09-15', hasta: '2026-09-03', tasa: 690 }]).length);
    assert.ok(validarTasasPorFecha([{ moneda: 'USD', desde: '2026-09-03', hasta: '', tasa: 690 }]).length);
    assert.ok(validarTasasPorFecha([{ moneda: 'USD', desde: '2026-09-03', hasta: '2026-09-12', tasa: 0 }]).length);
    assert.ok(validarTasasPorFecha([{ moneda: 'CUP', desde: '2026-09-03', hasta: '2026-09-12', tasa: 1 }]).length);
    assert.ok(validateFinanceConfig(config([{ moneda: 'USD', desde: 'x', hasta: 'y', tasa: 5 }])).length);
    assert.equal(validateFinanceConfig(config()).length, 0);
});
