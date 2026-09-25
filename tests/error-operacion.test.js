// Desde blindaje-03 (24-09-2026) un error al guardar llega del servidor como
// respuesta normal: { ok: false, motivo: 'error_operacion', mensaje }. Antes
// abortaba la transaccion, el freno de llamadas se deshacia con ella, y un
// cliente en bucle llego a ~1.100 transacciones fallidas por segundo.
//
// Lo que protege esta prueba: que la app no confunda ese error con una sesion
// muerta. Si lo hiciera, echaria a la duena para nada ("tu sesion vencio").

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(path.join(__dirname, '..', 'utils', 'supabase.js'), 'utf8');
const desde = fuente.indexOf('const ROMA_MOTIVOS_SESION_MUERTA');
const hasta = fuente.indexOf('function marcarSesionFinanzasRechazada(');
const ctx = {};
vm.runInNewContext(fuente.slice(desde, hasta).replace('const ROMA_MOTIVOS_SESION_MUERTA', 'var ROMA_MOTIVOS_SESION_MUERTA'), ctx);

test('un error al guardar ensena el mensaje del servidor, no "tu sesion vencio"', () => {
    const respuesta = { ok: false, motivo: 'error_operacion', mensaje: 'Falta una tasa válida para la moneda del ingreso.' };
    const motivo = ctx.motivoDeRespuesta(respuesta);
    assert.equal(motivo, 'error_operacion');
    assert.equal(ctx.mensajeDeMotivo(motivo, respuesta), 'Falta una tasa válida para la moneda del ingreso.');
});

test('error_operacion NO cuenta como sesion muerta: no se cierra la sesion', () => {
    assert.equal(ctx.ROMA_MOTIVOS_SESION_MUERTA.includes('error_operacion'), false);
});

test('sin mensaje del servidor, un texto util igualmente', () => {
    assert.match(ctx.mensajeDeMotivo('error_operacion', { ok: false }), /No se pudo guardar/);
});

test('los motivos de siempre siguen igual', () => {
    assert.match(ctx.mensajeDeMotivo('sesion_vencida'), /sesión venció/);
    assert.match(ctx.mensajeDeMotivo('demasiadas_llamadas'), /demasiadas peticiones/);
});
