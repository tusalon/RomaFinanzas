// Recuperar los cobros que se registraron ANTES de que existiera la ficha de
// costo de su servicio (planificarRecalculoDeCobros).
//
// Lo que protege: esto reescribe cobros ya guardados. Si el plan se pasa de
// listo, le cambia a la duena numeros que estaban bien, o le borra un costo
// que ya tenia calculado. Y si se queda corto, no arregla nada y el boton
// miente diciendo "0 cobros".
//
// Medido en produccion el 13-09-2026: 762 cobros recuperables en 21 salones;
// al guardar UNA ficha la mediana es 4 cobros y el maximo 119.

const test = require('node:test');
const assert = require('node:assert/strict');

const { planificarRecalculoDeCobros } = require('../utils/finance.js');

// Doble del constructor real: aplica la ficha cuya vigencia ya empezo, que es
// exactamente la regla de getApplicableCostSheet.
function construirSnapshotFalso(entry, costSheets, config) {
    const ficha = (costSheets || [])
        .filter((s) => String(s.serviceId) === String(entry.serviceId))
        .filter((s) => String(s.effectiveFrom || '') <= String(entry.date || ''))
        .sort((a, b) => String(b.effectiveFrom || '').localeCompare(String(a.effectiveFrom || '')))[0] || null;

    const unitCostMain = ficha ? Number(ficha.totals.totalCostMain) : 0;
    const amountMain = Number(entry.amountMain || 0);
    return {
        ...entry,
        unitCostMain,
        profitMain: amountMain - unitCostMain,
        margin: amountMain > 0 ? ((amountMain - unitCostMain) / amountMain) * 100 : 0,
        costSheetId: ficha ? ficha.id : ''
    };
}

const FICHA = {
    id: 'sheet_builder',
    serviceId: 'servicio_1984',
    effectiveFrom: '2026-08-01',
    totals: { totalCostMain: 847 }
};

const estadoBase = {
    config: { mainCurrency: 'CUP' },
    costSheets: [FICHA],
    incomeEntries: [
        // Cobro posterior a la ficha, sin costo: ESTE hay que arreglarlo.
        { id: 'i1', serviceId: 'servicio_1984', date: '2026-08-15', amountMain: 1750, unitCostMain: 0, costSheetId: '' },
        // Anterior a la vigencia: NO se toca.
        { id: 'i2', serviceId: 'servicio_1984', date: '2026-07-20', amountMain: 1750, unitCostMain: 0, costSheetId: '' },
        // Ya tiene la ficha aplicada: no cambia nada, no se reescribe.
        { id: 'i3', serviceId: 'servicio_1984', date: '2026-08-20', amountMain: 1750, unitCostMain: 847, costSheetId: 'sheet_builder' },
        // De otro servicio: ni se mira.
        { id: 'i4', serviceId: 'servicio_otro', date: '2026-08-21', amountMain: 900, unitCostMain: 0, costSheetId: '' },
        // Sin servicio (cobro suelto a mano): no hay ficha posible.
        { id: 'i5', serviceId: '', date: '2026-08-22', amountMain: 500, unitCostMain: 0, costSheetId: '' }
    ]
};

test('solo propone los cobros que de verdad cambian', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        serviceId: 'servicio_1984',
        construirSnapshot: construirSnapshotFalso
    });

    assert.deepEqual(plan.map((e) => e.id), ['i1'], 'solo el cobro posterior a la ficha y sin costo');
    assert.equal(plan[0].unitCostMain, 847);
    assert.equal(plan[0].profitMain, 903, 'la ganancia pasa de 1750 a 903');
    assert.equal(plan[0].costSheetId, 'sheet_builder');
});

test('no reescribe un cobro que ya estaba bien', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        serviceId: 'servicio_1984',
        construirSnapshot: construirSnapshotFalso
    });
    assert.equal(plan.some((e) => e.id === 'i3'), false,
        'i3 ya tiene su ficha: reescribirlo gastaria una peticion para dejarlo igual');
});

test('respeta la fecha de vigencia de la ficha', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        serviceId: 'servicio_1984',
        construirSnapshot: construirSnapshotFalso
    });
    assert.equal(plan.some((e) => e.id === 'i2'), false,
        'un cobro de julio no puede llevar el costo de una ficha que empieza en agosto');
});

test('el filtro "desde" recorta todavia mas, sin ampliar nunca', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        serviceId: 'servicio_1984',
        desde: '2026-09-01',
        construirSnapshot: construirSnapshotFalso
    });
    assert.deepEqual(plan, [], 'si la duena elige desde septiembre, agosto no entra');
});

test('nunca quita un costo que ya estaba calculado', () => {
    // La ficha se borro: el recalculo dejaria i3 en costo 0. No se toca.
    const sinFicha = { ...estadoBase, costSheets: [] };
    const plan = planificarRecalculoDeCobros(sinFicha, {
        serviceId: 'servicio_1984',
        construirSnapshot: construirSnapshotFalso
    });
    assert.equal(plan.some((e) => e.id === 'i3'), false,
        'borrar una ficha no puede vaciar el costo de cobros que ya lo tenian');
});

test('sin serviceId recorre todos los servicios', () => {
    const conDos = {
        ...estadoBase,
        costSheets: [FICHA, { id: 'sheet_otro', serviceId: 'servicio_otro', effectiveFrom: '2026-08-01', totals: { totalCostMain: 100 } }]
    };
    const plan = planificarRecalculoDeCobros(conDos, { construirSnapshot: construirSnapshotFalso });
    assert.deepEqual(plan.map((e) => e.id).sort(), ['i1', 'i4']);
});

test('casos raros: no revienta y no inventa', () => {
    assert.deepEqual(planificarRecalculoDeCobros({}, { construirSnapshot: construirSnapshotFalso }), []);
    assert.deepEqual(planificarRecalculoDeCobros(null, { construirSnapshot: construirSnapshotFalso }), []);
    assert.deepEqual(planificarRecalculoDeCobros(estadoBase, {}), [],
        'sin constructor de snapshot no se inventa una formula propia');
    assert.deepEqual(
        planificarRecalculoDeCobros({ ...estadoBase, incomeEntries: [] }, { construirSnapshot: construirSnapshotFalso }),
        []
    );
});
