// Recuperar los cobros que se hicieron ANTES de calcular la ficha de costo
// (planificarRecalculoDeCobros).
//
// Lo que protege: esto reescribe cobros ya guardados. Si el plan se pasa de
// listo, le cambia a la duena numeros que estaban bien o le borra un costo que
// ya tenia. Si se queda corto, no arregla nada y el boton ni aparece.
//
// LA PRIMERA VERSION DE ESTE TEST ESTABA AMANADA
// Ponia la ficha con vigencia 2026-08-01, ANTERIOR a los cobros. Con eso todo
// pasaba en verde y la funcion no servia para nada: probada en LAG Barberia el
// 13-09-2026 (tres cobros del 8, 9 y 10 + ficha guardada el 13) no propuso ni
// uno. En la vida real la ficha SIEMPRE nace despues de los cobros que hay que
// recuperar, asi que ese es el escenario por defecto de estas pruebas.

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

// La ficha se guarda HOY, despues de los cobros. Como en la vida real.
const FICHA = {
    id: 'sheet_corte',
    serviceId: 'servicio_corte',
    effectiveFrom: '2026-09-13',
    totals: { totalCostMain: 600 }
};

const estadoBase = {
    config: { mainCurrency: 'CUP' },
    costSheets: [FICHA],
    incomeEntries: [
        { id: 'i1', serviceId: 'servicio_corte', date: '2026-09-08', amountMain: 1500, unitCostMain: 0, costSheetId: '' },
        { id: 'i2', serviceId: 'servicio_corte', date: '2026-09-09', amountMain: 1500, unitCostMain: 0, costSheetId: '' },
        { id: 'i3', serviceId: 'servicio_corte', date: '2026-09-10', amountMain: 1500, unitCostMain: 0, costSheetId: '' },
        { id: 'i4', serviceId: 'servicio_otro', date: '2026-09-09', amountMain: 900, unitCostMain: 0, costSheetId: '' },
        { id: 'i5', serviceId: '', date: '2026-09-09', amountMain: 500, unitCostMain: 0, costSheetId: '' }
    ]
};

test('EL CASO REAL: la ficha es de hoy y los cobros de antes', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        sheet: FICHA,
        construirSnapshot: construirSnapshotFalso
    });

    assert.deepEqual(plan.map((e) => e.id), ['i1', 'i2', 'i3'],
        'los tres cobros anteriores a la ficha son justo los que hay que recuperar');
    assert.equal(plan[0].unitCostMain, 600);
    assert.equal(plan[0].profitMain, 900, 'la ganancia baja de 1500 a 900');
    assert.equal(plan[0].costSheetId, 'sheet_corte');
});

test('no toca los cobros de otro servicio ni los que no tienen servicio', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        sheet: FICHA,
        construirSnapshot: construirSnapshotFalso
    });
    assert.equal(plan.some((e) => e.id === 'i4' || e.id === 'i5'), false);
});

test('la duena puede recortar desde que fecha aplicar', () => {
    const plan = planificarRecalculoDeCobros(estadoBase, {
        sheet: FICHA,
        desde: '2026-09-10',
        construirSnapshot: construirSnapshotFalso
    });
    assert.deepEqual(plan.map((e) => e.id), ['i3'], 'solo del 10 en adelante');
});

test('no reescribe un cobro que ya estaba bien', () => {
    const yaCalculado = {
        ...estadoBase,
        incomeEntries: [
            { id: 'ok', serviceId: 'servicio_corte', date: '2026-09-08', amountMain: 1500, unitCostMain: 600, costSheetId: 'sheet_corte' }
        ]
    };
    const plan = planificarRecalculoDeCobros(yaCalculado, {
        sheet: FICHA,
        construirSnapshot: construirSnapshotFalso
    });
    assert.deepEqual(plan, [], 'reescribirlo gastaria una peticion para dejarlo igual y subirle la version');
});

test('nunca quita un costo que ya estaba calculado', () => {
    // La ficha se borro: el recalculo dejaria el cobro en costo 0. No se toca.
    const sinFicha = {
        ...estadoBase,
        costSheets: [],
        incomeEntries: [
            { id: 'ok', serviceId: 'servicio_corte', date: '2026-09-08', amountMain: 1500, unitCostMain: 600, costSheetId: 'sheet_corte' }
        ]
    };
    const plan = planificarRecalculoDeCobros(sinFicha, {
        sheet: FICHA,
        construirSnapshot: construirSnapshotFalso
    });
    assert.deepEqual(plan, [], 'borrar una ficha no puede vaciar cobros que ya tenian costo');
});

test('la vigencia solo se retrasa para la ficha objetivo, no para las demas', () => {
    const otraFicha = {
        id: 'sheet_otro',
        serviceId: 'servicio_otro',
        effectiveFrom: '2026-09-13',
        totals: { totalCostMain: 100 }
    };
    const conDos = { ...estadoBase, costSheets: [FICHA, otraFicha] };
    const plan = planificarRecalculoDeCobros(conDos, {
        sheet: FICHA,
        construirSnapshot: construirSnapshotFalso
    });
    assert.equal(plan.some((e) => e.id === 'i4'), false,
        'i4 es de otro servicio: su ficha sigue empezando hoy y no se le aplica');
});

test('casos raros: no revienta y no inventa', () => {
    assert.deepEqual(planificarRecalculoDeCobros({}, { sheet: FICHA, construirSnapshot: construirSnapshotFalso }), []);
    assert.deepEqual(planificarRecalculoDeCobros(null, { sheet: FICHA, construirSnapshot: construirSnapshotFalso }), []);
    assert.deepEqual(planificarRecalculoDeCobros(estadoBase, { sheet: FICHA }), [],
        'sin constructor de snapshot no se inventa una formula propia');
    assert.deepEqual(
        planificarRecalculoDeCobros({ ...estadoBase, incomeEntries: [] }, { sheet: FICHA, construirSnapshot: construirSnapshotFalso }),
        []
    );
});
