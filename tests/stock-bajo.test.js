// Aviso de "se te está acabando" sin que la dueña configure nada
// (materialesPorAcabarse).
//
// POR QUE EXISTE
// El campo "avisar cuando queden" lleva ahí desde siempre, pero medido en
// produccion el 14-09-2026 solo lo tienen 13 materiales de 586, en 2 salones
// de 43. Nadie entra a configurarlo producto por producto. Ahora se deduce del
// propio material.
//
// LO QUE PROTEGE
// Un aviso de stock que se equivoca es peor que ninguno: si grita de mas, la
// duena lo ignora en dos dias; si se calla con lo que ya tenia configurado, le
// rompemos algo que le funcionaba.

const test = require('node:test');
const assert = require('node:assert/strict');

const { materialesPorAcabarse, serviciosQueQuedan, SERVICIOS_PARA_AVISAR } =
    require('../utils/finance.js');

test('cuenta servicios, no envases', () => {
    // Medio pomo que rinde 30 = 15 servicios.
    assert.equal(serviciosQueQuedan({ stock: 0.5, uses: 30 }), 15);
    assert.equal(serviciosQueQuedan({ stock: 2, uses: 20 }), 40);
    assert.equal(serviciosQueQuedan({ stock: 0, uses: 20 }), 0);
    assert.equal(serviciosQueQuedan({ stock: 3 }), 3, 'sin "uses" se cuenta 1 por envase, no cero');
    assert.equal(serviciosQueQuedan(null), 0);
});

test('avisa solo de lo que de verdad se acaba', () => {
    const lista = materialesPorAcabarse([
        { id: 'a', name: 'Builder', stock: 0.2, uses: 20 },   // 4 servicios -> avisa
        { id: 'b', name: 'Acetona', stock: 5, uses: 40 },     // 200 servicios -> no
        { id: 'c', name: 'Top coat', stock: 0.5, uses: 30 }   // 15 servicios -> avisa
    ]);
    assert.deepEqual(lista.map((m) => m.name), ['Builder', 'Top coat'],
        'ordenado por el que se acaba antes');
    assert.equal(lista[0].serviciosQueQuedan, 4);
});

test('sin stock anotado NO se inventa un aviso', () => {
    // Quien no lleva inventario no puede recibir avisos falsos: es la mayoria
    // (411 de 586 materiales medidos no tienen stock).
    const lista = materialesPorAcabarse([
        { id: 'a', name: 'Sin stock', uses: 20 },
        { id: 'b', name: 'Stock cero', stock: 0, uses: 20 },
        { id: 'c', name: 'Stock vacio', stock: '', uses: 20 }
    ]);
    assert.deepEqual(lista, []);
});

test('el aviso que puso la dueña manda sobre el automatico', () => {
    // Su umbral esta en ENVASES. Tiene 2 pomos y pidio avisar con 3: para ella
    // ya es momento de reponer, aunque le queden 80 servicios.
    const conSuAviso = materialesPorAcabarse([
        { id: 'a', name: 'Gel', stock: 2, uses: 40, lowStockThreshold: 3 }
    ]);
    assert.equal(conSuAviso.length, 1, 'se respeta su criterio aunque queden 80 servicios');
    assert.equal(conSuAviso[0].avisoPropio, true);

    // Y al reves: si ella pidio avisar solo con 0 envases, no la molestamos
    // aunque le queden pocos servicios.
    const silenciado = materialesPorAcabarse([
        { id: 'b', name: 'Lima', stock: 0.1, uses: 10, lowStockThreshold: 0 }
    ]);
    assert.deepEqual(silenciado, [], 'no le cambiamos el significado a quien ya lo configuro');
});

test('un material borrado no avisa', () => {
    const lista = materialesPorAcabarse([
        { id: 'a', name: 'Viejo', stock: 0.1, uses: 10, deletedAt: '2026-09-01' }
    ]);
    assert.deepEqual(lista, []);
});

test('casos raros: no revienta', () => {
    assert.deepEqual(materialesPorAcabarse(null), []);
    assert.deepEqual(materialesPorAcabarse([]), []);
    assert.deepEqual(materialesPorAcabarse([null, undefined]), []);
});

test('el umbral es una sola constante', () => {
    assert.equal(typeof SERVICIOS_PARA_AVISAR, 'number');
    const justoDebajo = materialesPorAcabarse([
        { id: 'a', name: 'X', stock: 1, uses: SERVICIOS_PARA_AVISAR - 1 }
    ]);
    const justoEncima = materialesPorAcabarse([
        { id: 'b', name: 'Y', stock: 1, uses: SERVICIOS_PARA_AVISAR + 1 }
    ]);
    assert.equal(justoDebajo.length, 1);
    assert.equal(justoEncima.length, 0);
});
