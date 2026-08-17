// Cortafuegos de sesion rechazada: cuando el servidor dice que el token no
// vale, la app tiene que DEJAR de llamar.
//
// El fallo que motivo esto: el token de Finanzas dura 12 h. Al vencer,
// session_business_id() lanza una excepcion y la transaccion se aborta sin
// tocar tablas. Clientes ya desplegados se quedaron reintentando sin fin. El
// 17/08/2026 la base de RservasRoma tenia 107.431.939 transacciones abortadas
// -- el 89,9 % de todas -- y 2.556 fallos por cada llamada que funcionaba.
//
// Esta prueba ejecuta el codigo real de utils/supabase.js en un contexto
// falso y cuenta las llamadas de red: la clave es que la segunda no ocurra.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(path.join(__dirname, '..', 'utils', 'supabase.js'), 'utf8');

// Se recorta el trozo que interesa para no arrastrar todo el modulo.
function cargar(errorDelServidor) {
    const desde = fuente.indexOf('function saveRomaSession(');
    const hasta = fuente.indexOf('async function saveRomaFinanceIncomeWithTip(');
    assert.ok(desde !== -1 && hasta > desde, 'no encontre el bloque de sesion en utils/supabase.js');

    const llamadas = [];
    const almacen = new Map();
    const contexto = {
        console: { warn() {}, log() {}, error() {} },
        navigator: { onLine: true },
        window: {
            localStorage: {
                getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
                setItem: (k, v) => almacen.set(k, String(v)),
                removeItem: (k) => almacen.delete(k)
            }
        },
        ROMA_SESSION_KEY: 'roma_test',
        ROMA_LEGACY_SESSION_KEY: 'roma_legacy',
        ROMA_BACKEND_MODE: 'test',
        ROMA_PROJECT_REF: 'ref',
        ROMA_SESSION_HOURS: 12,
        ROMA_USES_SERVER_INCOME_RPC: false,
        sanitizeBusinessForSession: (b) => b,
        romaSupabase: {
            rpc(nombre, args) {
                llamadas.push({ nombre, operacion: args.p_operation });
                return Promise.resolve({ data: null, error: errorDelServidor });
            }
        }
    };
    vm.createContext(contexto);
    vm.runInContext(fuente.slice(desde, hasta), contexto);
    contexto.saveRomaSession({ id: 'n1', slug: 's' }, 'x'.repeat(40), '');
    return { ctx: contexto, llamadas };
}

test('tras un rechazo de sesion no se vuelve a llamar al servidor', async () => {
    const { ctx, llamadas } = cargar({ code: '28000', message: 'La sesion vencio. Entra de nuevo.' });

    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 1 }));
    assert.equal(llamadas.length, 1, 'la primera llamada si sale');

    // La cola de pendientes reintentaria estas cinco. Ninguna debe viajar.
    for (const id of [2, 3, 4, 5, 6]) {
        const r = await ctx.applyRomaFinanceChange('save_income', { id });
        assert.equal(r, null, 'sin sesion, devuelve null sin llamar');
    }
    assert.equal(llamadas.length, 1, 'el cortafuegos corto: sigue habiendo UNA sola llamada');
    assert.equal(ctx.getRomaSessionToken(), '', 'el token queda descartado');
});

test('un error normal NO corta el cortafuegos', async () => {
    const { ctx, llamadas } = cargar({ code: '08006', message: 'connection failure' });

    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 1 }));
    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 2 }));

    assert.equal(llamadas.length, 2, 'un corte de red es temporal: se puede reintentar');
    assert.notEqual(ctx.getRomaSessionToken(), '', 'la sesion sigue viva');
});

test('reconoce el rechazo por el mensaje, no solo por el codigo', () => {
    const { ctx } = cargar(null);
    for (const mensaje of [
        'La sesion vencio. Entra de nuevo.',
        'La sesión venció. Entra de nuevo.',
        'Sesion invalida.',
        'Tu negocio no tiene acceso activo a Roma Finanzas.'
    ]) {
        assert.ok(ctx.esSesionRechazada({ message: mensaje }), `deberia reconocer: ${mensaje}`);
    }
    assert.ok(!ctx.esSesionRechazada({ message: 'timeout' }), 'un timeout no es un rechazo de sesion');
});

test('entrar de nuevo rearma el cortafuegos', async () => {
    const { ctx, llamadas } = cargar({ code: '28000', message: 'Sesion invalida.' });

    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 1 }));
    assert.equal(ctx.getRomaSessionToken(), '');

    ctx.saveRomaSession({ id: 'n1', slug: 's' }, 'y'.repeat(40), '');
    assert.notEqual(ctx.getRomaSessionToken(), '', 'tras entrar de nuevo vuelve a haber token');

    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 2 }));
    assert.equal(llamadas.length, 2, 'la sesion nueva si puede intentarlo una vez');
});
