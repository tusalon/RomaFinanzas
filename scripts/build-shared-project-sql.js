// Genera el SQL para meter Roma Finanzas DENTRO del proyecto de RservasRoma,
// en vez de en una base aparte.
//
// Es roma-finanzas-access.sql + las propinas, quitando un unico bloque: el que
// revoca el select sobre public.negocios. Ese revoke cierra password_hash al
// navegador, pero hoy romperia dos cosas vivas de RservasRoma:
//   - utils/config-negocio-master.js  -> pide negocios?select=*
//   - admin-login.html                -> lee password_hash y compara con bcrypt
// Cerrar eso es un corte aparte, con el login del panel ya migrado a la RPC.
//
// Lo que si se revoca aqui es el acceso directo de anon a las tablas
// roma_finanzas_*, que hoy dejan leer los ingresos de todos los negocios.
// La app no lo nota: con sesion RPC todo pasa por las funciones.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'supabase');
const target = path.join(directory, 'shared-project-install.generated.sql');

const INICIO = '-- La tabla es compartida con RservasRoma';
const FIN = '$$;';

function sinRevokeDeNegocios(sql) {
    const desde = sql.indexOf(INICIO);
    if (desde === -1) throw new Error(`No encontre el bloque de negocios ("${INICIO}").`);
    if (sql.indexOf(INICIO, desde + 1) !== -1) throw new Error('El bloque de negocios aparece mas de una vez.');

    const fin = sql.indexOf(FIN, desde);
    if (fin === -1) throw new Error('No encontre el final del bloque de negocios.');

    const quitado = sql.slice(desde, fin + FIN.length);
    if (!quitado.includes('revoke select on table public.negocios')) {
        throw new Error('El bloque localizado no es el revoke de negocios; abortando por seguridad.');
    }

    return sql.slice(0, desde)
        + '-- OMITIDO A PROPOSITO: revoke select sobre public.negocios.\n'
        + '-- Romperia config-negocio-master.js (select=*) y admin-login.html\n'
        + '-- (lee password_hash). Se cierra en un corte posterior.\n'
        + sql.slice(fin + FIN.length);
}

const acceso = sinRevokeDeNegocios(
    fs.readFileSync(path.join(directory, 'roma-finanzas-access.sql'), 'utf8').trim()
);
const propinas = fs.readFileSync(path.join(directory, 'standalone-03-income-tips.sql'), 'utf8').trim();

const contents = [
    '-- GENERADO AUTOMATICAMENTE. Ejecutar solo en el proyecto de RservasRoma.',
    '-- Deja Roma Finanzas funcionando dentro de la misma base, con login por RPC.',
    '-- No revoca el acceso a public.negocios: eso va en un corte posterior.',
    '',
    '-- ===== INICIO roma-finanzas-access.sql (sin el revoke de negocios) =====',
    acceso,
    '-- ===== FIN roma-finanzas-access.sql =====',
    '',
    '-- ===== INICIO standalone-03-income-tips.sql =====',
    propinas,
    '-- ===== FIN standalone-03-income-tips.sql =====',
    '',
    '-- ===== CORRECCION PARA EL PROYECTO COMPARTIDO =====',
    '-- standalone-03 concede save_roma_finanzas_income solo a authenticated,',
    '-- porque nacio para el login por correo de Supabase Auth. Aqui el',
    '-- navegador entra con la clave publica (rol anon), asi que sin esto',
    '-- guardar un ingreso con propina falla con permission denied.',
    '-- Las otras cinco RPC ya vienen con anon desde roma-finanzas-access.sql.',
    'grant execute on function public.save_roma_finanzas_income(text, jsonb) to anon;'
].join('\n');

fs.writeFileSync(target, `${contents}\n`, 'utf8');
console.log(`SQL del proyecto compartido generado en ${target}`);
