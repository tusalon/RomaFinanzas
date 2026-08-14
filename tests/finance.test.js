const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getLocalDateKey,
    toNumber,
    getRateToMainCurrency,
    convertToMainCurrency,
    createMoneySnapshot,
    getHistoricalAmountMain,
    getHistoricalTipMain,
    getIncomeCollectedMain,
    validateFinanceConfig,
    getExpenseImpact,
    calculateCostSheet,
    normalizeFinanceText,
    isDateInMonth,
    auditFinanceState
} = require('../utils/finance.js');

const config = {
    mainCurrency: 'CUP',
    desiredMargin: 60,
    rates: { USD: 350, MLC: 340, EUR: 380 }
};

test('usa la fecha local de Cuba y no la fecha UTC', () => {
    const lateNightInCuba = new Date('2026-08-05T03:30:00.000Z');
    assert.equal(getLocalDateKey(lateNightInCuba), '2026-08-04');
});

test('acepta formatos numéricos comunes', () => {
    assert.equal(toNumber('1,500'), 1500);
    assert.equal(toNumber('0,25'), 0.25);
    assert.equal(toNumber('2.500,50'), 2500.5);
});

test('convierte entre todas las monedas usando CUP como puente', () => {
    assert.equal(convertToMainCurrency(10, 'USD', config), 3500);
    assert.equal(getRateToMainCurrency('EUR', { ...config, mainCurrency: 'USD' }), 380 / 350);
    assert.equal(convertToMainCurrency(380, 'CUP', { ...config, mainCurrency: 'EUR' }), 1);
});

test('bloquea una conversión si falta la tasa', () => {
    assert.throws(
        () => convertToMainCurrency(10, 'USD', { ...config, rates: { ...config.rates, USD: 0 } }),
        /Falta una tasa valida/
    );
});

test('conserva el valor histórico aunque cambie la tasa actual', () => {
    const snapshot = createMoneySnapshot(10, 'USD', config);
    const entry = { amount: 10, currency: 'USD', ...snapshot };
    const changedRates = { ...config, rates: { ...config.rates, USD: 500 } };
    assert.equal(getHistoricalAmountMain(entry, changedRates), 3500);
});

test('suma la propina al dinero ingresado sin mezclarla con el precio del servicio', () => {
    const entry = {
        amount: 2500,
        currency: 'CUP',
        rateToMain: 1,
        amountMain: 2500,
        tipAmount: 2,
        tipCurrency: 'USD',
        tipRateToMain: 350,
        tipAmountMain: 700,
        profitMain: 2425
    };
    const changedRates = { ...config, rates: { ...config.rates, USD: 500 } };

    assert.equal(getHistoricalAmountMain(entry, changedRates), 2500);
    assert.equal(getHistoricalTipMain(entry, changedRates), 700);
    assert.equal(getIncomeCollectedMain(entry, changedRates), 3200);
    assert.equal(entry.profitMain, 2425);
});

test('valida tasas y margen antes de guardar configuración', () => {
    assert.deepEqual(validateFinanceConfig(config), []);
    assert.ok(validateFinanceConfig({ ...config, desiredMargin: 100 }).length > 0);
    assert.ok(validateFinanceConfig({ ...config, rates: { ...config.rates, MLC: 0 } }).length > 0);
});

test('calcula costo, ganancia, margen y precio recomendado', () => {
    const service = { id: 'srv_1', price: 3000, currency: 'CUP' };
    const materials = [{ id: 'mat_1', cost: 1000, uses: 10, currency: 'CUP' }];
    const result = calculateCostSheet(
        service,
        [{ materialId: 'mat_1', quantity: 2 }],
        [{ amount: 100, currency: 'CUP' }],
        materials,
        config,
        { durationMinutes: 60, hourlyValue: 500, overheadCostMain: 200 }
    );

    assert.equal(result.materialCostMain, 200);
    assert.equal(result.totalCostMain, 1000);
    assert.equal(result.profitMain, 2000);
    assert.equal(Math.round(result.margin * 100) / 100, 66.67);
    assert.equal(result.recommendedPriceMain, 2500);
});

test('reparte una herramienta durante su vida útil', () => {
    const entry = {
        date: '2026-01-01',
        amount: 12000,
        amountMain: 12000,
        rateToMain: 1,
        currency: 'CUP',
        type: 'herramienta',
        usefulLifeMonths: 12
    };
    const impact = getExpenseImpact(entry, config, 'month', new Date('2026-06-15T12:00:00'));
    assert.equal(impact, 1000);
});

test('normalizeFinanceText ignora acentos, mayusculas y espacios de sobra', () => {
    assert.equal(normalizeFinanceText('  RservasRoma  '), normalizeFinanceText('rservasroma'));
    assert.equal(normalizeFinanceText('Gastó Fijo'), 'gasto fijo');
});

test('isDateInMonth compara solo año y mes, no el dia', () => {
    const reference = new Date('2026-08-14T12:00:00');
    assert.equal(isDateInMonth('2026-08-01', reference), true);
    assert.equal(isDateInMonth('2026-08-31', reference), true);
    assert.equal(isDateInMonth('2026-07-31', reference), false);
    assert.equal(isDateInMonth('', reference), false);
    assert.equal(isDateInMonth(null, reference), false);
});

test('auditFinanceState no reporta nada cuando todo esta en orden', () => {
    const reference = new Date('2026-08-14T12:00:00');
    const state = {
        services: [{ id: 's1', name: 'Manicure', active: true, price: 500 }],
        materials: [{ id: 'm1', name: 'Esmalte', cost: 100, costPerUse: 0, uses: 20 }],
        costSheets: [{ id: 'c1', serviceId: 's1' }],
        incomeEntries: [{ id: 'i1', date: '2026-08-10', costSheetId: 'c1' }],
        expenseEntries: [{ id: 'e1', date: '2026-08-05', category: 'RservasRoma', type: 'fijo' }]
    };
    assert.deepEqual(auditFinanceState(state, reference), []);
});

test('auditFinanceState detecta el gasto de RservasRoma faltante este mes', () => {
    const reference = new Date('2026-08-14T12:00:00');
    const state = {
        services: [],
        materials: [],
        costSheets: [],
        incomeEntries: [],
        expenseEntries: [{ id: 'e1', date: '2026-07-05', category: 'RservasRoma', type: 'fijo' }]
    };
    const issues = auditFinanceState(state, reference);
    assert.ok(issues.some((issue) => issue.id === 'missing_rservasroma_expense'));
});

test('auditFinanceState detecta materiales, herramientas y servicios mal cargados', () => {
    const reference = new Date('2026-08-14T12:00:00');
    const state = {
        services: [
            { id: 's1', name: 'Pedicure', active: true, price: 0 },
            { id: 's2', name: 'Manicure', active: true, price: 500 }
        ],
        materials: [{ id: 'm1', name: 'Acetona', cost: 0, costPerUse: 0, uses: 10 }],
        costSheets: [],
        incomeEntries: [],
        expenseEntries: [
            { id: 'e1', date: '2026-08-05', category: 'RservasRoma', type: 'fijo' },
            { id: 'e2', date: '2026-08-01', description: 'Secadora', type: 'herramienta', usefulLifeMonths: 0 }
        ]
    };
    const issues = auditFinanceState(state, reference);
    const ids = issues.map((issue) => issue.id);

    assert.ok(!ids.includes('missing_rservasroma_expense'));
    assert.ok(ids.includes('materials_zero_cost'));
    assert.ok(ids.includes('tools_missing_life'));
    assert.ok(ids.includes('services_zero_price'));
    assert.ok(ids.includes('services_without_cost_sheet'));
});

test('auditFinanceState no repite servicios que ya tienen ficha de costo', () => {
    const reference = new Date('2026-08-14T12:00:00');
    const state = {
        services: [{ id: 's1', name: 'Manicure', active: true, price: 500 }],
        materials: [],
        costSheets: [{ id: 'c1', serviceId: 's1' }],
        incomeEntries: [],
        expenseEntries: [{ id: 'e1', date: '2026-08-05', category: 'RservasRoma', type: 'fijo' }]
    };
    const issues = auditFinanceState(state, reference);
    assert.ok(!issues.some((issue) => issue.id === 'services_without_cost_sheet'));
});
