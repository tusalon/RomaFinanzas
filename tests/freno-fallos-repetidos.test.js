// Freno ante fallos repetidos, sean del tipo que sean.
//
// El agujero que motivo esto: el cortafuegos anterior solo se armaba cuando el
// servidor respondia 28000. Pero con el pool de conexiones saturado el servidor
// ya no responde 28000 -- responde 504 o nada -- y el cortafuegos, a proposito,
// no se armaba ante fallos de red. Resultado, el 18/08/2026:
//
//   pool lleno -> los clientes reciben timeout, no 28000
//              -> el cortafuegos no se arma -> reintentan -> pool lleno
//
// El sistema no podia salir del bucle por si mismo. Estas pruebas fijan las dos
// correcciones: frenar ante CUALQUIER fallo repetido, y que el freno sobreviva
// a una recarga de pagina (antes era una variable en memoria: cerrar y abrir la
// app rearmaba el bucle).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fuente = fs.readFileSync(path.join(__dirname, '..', 'utils', 'supabase.js'), 'utf8');

// Se recorta el trozo que interesa para no arrastrar todo el modulo.
// El almacen se puede compartir entre cargas: asi se simula recargar la pagina.
function cargar({ respuesta, almacen = new Map(), conSesion = true } = {}) {
    const desde = fuente.indexOf('function saveRomaSession(');
    const hasta = fuente.indexOf('async function saveRomaFinanceIncomeWithTip(');
    assert.ok(desde !== -1 && hasta > desde, 'no encontre el bloque de sesion en utils/supabase.js');

    const llamadas = [];
    const contexto = {
        console: { warn() {}, log() {}, error() {} },
        navigator: { onLine: true },
        Date,
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
                return Promise.resolve(
                    typeof respuesta === 'function' ? respuesta(llamadas.length) : respuesta
                );
            }
        }
    };
    vm.createContext(contexto);
    vm.runInContext(fuente.slice(desde, hasta), contexto);
    if (conSesion) contexto.saveRomaSession({ id: 'n1', slug: 's' }, 'x'.repeat(40), '');
    return { ctx: contexto, llamadas, almacen };
}

const FALLO_DE_RED = { data: null, error: { code: '08006', message: 'connection failure' } };

test('tres fallos de red seguidos frenan la cuarta llamada', async () => {
    const { ctx, llamadas } = cargar({ respuesta: FALLO_DE_RED });

    for (const id of [1, 2, 3]) {
        await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id }));
    }
    assert.equal(llamadas.length, 3, 'los tres primeros intentos si salen: un corte de red se reintenta');

    // A partir de aqui el freno esta puesto y no debe viajar nada mas.
    for (const id of [4, 5, 6, 7, 8]) {
        const r = await ctx.applyRomaFinanceChange('save_income', { id });
        assert.equal(r, null, 'con el freno puesto devuelve null sin llamar');
    }
    assert.equal(llamadas.length, 3, 'el freno corto: siguen siendo TRES llamadas');
});

test('el freno sobrevive a recargar la pagina', async () => {
    const almacen = new Map();
    const primera = cargar({ respuesta: FALLO_DE_RED, almacen });

    for (const id of [1, 2, 3]) {
        await assert.rejects(() => primera.ctx.applyRomaFinanceChange('save_income', { id }));
    }
    assert.equal(primera.llamadas.length, 3);

    // Recarga: contexto nuevo, mismo localStorage. Antes esto rearmaba el bucle
    // porque el cortafuegos vivia en una variable en memoria.
    const segunda = cargar({ respuesta: FALLO_DE_RED, almacen, conSesion: false });
    assert.equal(segunda.ctx.getRomaSessionToken(), '', 'tras recargar el freno sigue puesto');

    const r = await segunda.ctx.applyRomaFinanceChange('save_income', { id: 9 });
    assert.equal(r, null);
    assert.equal(segunda.llamadas.length, 0, 'la pagina recargada no manda ni una llamada');
});

test('un 200 con ok:false se trata como sesion muerta, no como exito', async () => {
    const { ctx, llamadas } = cargar({
        respuesta: { data: { ok: false, motivo: 'sesion_vencida' }, error: null }
    });

    // Sin excepcion del servidor no hay transaccion abortada, pero el cliente
    // NO puede dar por guardado lo que no se guardo.
    await assert.rejects(
        () => ctx.applyRomaFinanceChange('save_income', { id: 1 }),
        /sesión venció/i
    );
    assert.equal(ctx.getRomaSessionToken(), '', 'la sesion queda descartada');

    await ctx.applyRomaFinanceChange('save_income', { id: 2 });
    assert.equal(llamadas.length, 1, 'no se vuelve a llamar');
});

test('demasiadas_llamadas frena pero no mata la sesion', async () => {
    const { ctx } = cargar({
        respuesta: { data: { ok: false, motivo: 'demasiadas_llamadas' }, error: null }
    });

    // Dos avisos del servidor: aun no llega al tercero, la sesion sigue viva.
    for (const id of [1, 2]) {
        await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id }));
    }
    assert.notEqual(ctx.getRomaSessionToken(), '', 'pasarse de llamadas no invalida la sesion');
});

test('una llamada buena limpia el contador de fallos', async () => {
    let fallar = true;
    const { ctx, llamadas } = cargar({
        respuesta: () => (fallar ? FALLO_DE_RED : { data: { ok: true, id: 'x' }, error: null })
    });

    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 1 }));
    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 2 }));

    fallar = false;
    await ctx.applyRomaFinanceChange('save_income', { id: 3 });

    // Si el exito no limpiara, el siguiente fallo seria el tercero y frenaria.
    fallar = true;
    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 4 }));
    assert.equal(llamadas.length, 4, 'tras una llamada buena se vuelve a empezar a contar');
});

test('entrar de nuevo borra el freno', async () => {
    const { ctx, llamadas } = cargar({ respuesta: FALLO_DE_RED });

    for (const id of [1, 2, 3]) {
        await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id }));
    }
    assert.equal(ctx.getRomaSessionToken(), '', 'el freno esta puesto');

    ctx.saveRomaSession({ id: 'n1', slug: 's' }, 'y'.repeat(40), '');
    assert.notEqual(ctx.getRomaSessionToken(), '', 'entrar de nuevo devuelve el token');

    await assert.rejects(() => ctx.applyRomaFinanceChange('save_income', { id: 4 }));
    assert.equal(llamadas.length, 4, 'la sesion nueva puede volver a intentarlo');
});
