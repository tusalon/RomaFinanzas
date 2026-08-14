// Copia los datos financieros historicos que quedaron en el proyecto de
// RservasRoma hacia la base propia de FinanzasRoma.
//
// El esquema de las dos bases es identico columna por columna, asi que la
// unica traduccion real es el negocio: en RservasRoma el dueno de cada fila es
// negocios.id, y en FinanzasRoma es la fila local enlazada por
// external_negocio_id (ver supabase/standalone-04-federated-rservasroma.sql).
//
// No copia password_hash: la identidad sigue viviendo solo en RservasRoma.
//
// Uso (no escribe nada sin --apply):
//   $env:RSERVASROMA_URL='https://zorhclhvykikaachfrmp.supabase.co'
//   $env:RSERVASROMA_SERVICE_KEY='...'
//   $env:FINANZAS_URL='https://rwodzlwzrkshgsbhhbrw.supabase.co'
//   $env:FINANZAS_SERVICE_KEY='...'
//   node scripts/migrate-legacy-finanzas.js
//   node scripts/migrate-legacy-finanzas.js --apply

const fs = require('fs');
const path = require('path');
const { readLocalEnvironment } = require('./project-config');

const APPLY = process.argv.includes('--apply');
const PAGE = 1000;

// private-setup/ esta en .gitignore: es el sitio para dejar las claves de
// servicio sin que acaben en el repo ni en un chat.
const secrets = readLocalEnvironment('private-setup/migration.env');
const read = (name) => process.env[name] || secrets[name] || '';

const source = {
    url: read('RSERVASROMA_URL').replace(/\/$/, ''),
    key: read('RSERVASROMA_SERVICE_KEY')
};
const target = {
    url: read('FINANZAS_URL').replace(/\/$/, ''),
    key: read('FINANZAS_SERVICE_KEY')
};

// inventory_movements no existe en RservasRoma: es una tabla nueva y nace vacia.
const TABLES = [
    { name: 'roma_finanzas_config', conflict: 'negocio_id' },
    { name: 'roma_finanzas_services', conflict: 'negocio_id,id' },
    { name: 'roma_finanzas_materials', conflict: 'negocio_id,id' },
    { name: 'roma_finanzas_fichas_costo', conflict: 'negocio_id,id' },
    { name: 'roma_finanzas_ingresos', conflict: 'negocio_id,id' },
    { name: 'roma_finanzas_gastos', conflict: 'negocio_id,id' }
];

function headers(project, extra = {}) {
    return {
        apikey: project.key,
        Authorization: `Bearer ${project.key}`,
        'Content-Type': 'application/json',
        ...extra
    };
}

async function selectAll(project, table, query = '') {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
        const url = `${project.url}/rest/v1/${table}?select=*${query}`;
        const response = await fetch(url, {
            headers: headers(project, { Range: `${from}-${from + PAGE - 1}` })
        });
        if (!response.ok) {
            throw new Error(`GET ${table} -> ${response.status} ${await response.text()}`);
        }
        const page = await response.json();
        rows.push(...page);
        if (page.length < PAGE) return rows;
    }
}

async function upsert(project, table, rows, conflict) {
    if (!rows.length) return [];
    const inserted = [];
    for (let from = 0; from < rows.length; from += PAGE) {
        const chunk = rows.slice(from, from + PAGE);
        const response = await fetch(
            `${project.url}/rest/v1/${table}?on_conflict=${conflict}`,
            {
                method: 'POST',
                // ignore-duplicates: reejecutar la migracion no pisa lo que el
                // negocio ya haya editado en FinanzasRoma.
                // representation: devuelve SOLO lo insertado de verdad, que es
                // la lista para deshacer si algo sale duplicado.
                headers: headers(project, {
                    Prefer: 'resolution=ignore-duplicates,return=representation'
                }),
                body: JSON.stringify(chunk)
            }
        );
        if (!response.ok) {
            throw new Error(`POST ${table} -> ${response.status} ${await response.text()}`);
        }
        // Guardar solo las claves, nunca los importes.
        for (const row of await response.json()) {
            inserted.push(row.id === undefined
                ? { negocio_id: row.negocio_id }
                : { negocio_id: row.negocio_id, id: row.id });
        }
    }
    return inserted;
}

async function countOf(project, table) {
    const response = await fetch(`${project.url}/rest/v1/${table}?select=negocio_id`, {
        headers: headers(project, { Prefer: 'count=exact', Range: '0-0' })
    });
    if (!response.ok) {
        throw new Error(`COUNT ${table} -> ${response.status} ${await response.text()}`);
    }
    return Number((response.headers.get('content-range') || '/?').split('/')[1]) || 0;
}

async function run() {
    for (const [label, project] of [['RservasRoma', source], ['FinanzasRoma', target]]) {
        if (!project.url || !project.key) {
            throw new Error(`Faltan URL y clave de servicio de ${label}.`);
        }
    }

    console.log(APPLY ? '== APLICANDO ==' : '== SIMULACION (sin --apply no escribe) ==');

    // 0. Probar la clave del destino antes de leer nada, y decir que hay ya
    //    ahi: si estas tablas no estan vacias, la copia se suma a lo existente.
    let yaHabia = 0;
    for (const { name } of TABLES) {
        const n = await countOf(target, name);
        yaHabia += n;
        if (n) console.log(`destino ya tiene ${name.padEnd(30)} ${n}`);
    }
    console.log(yaHabia
        ? `OJO el destino no esta vacio (${yaHabia} filas). La copia respeta lo que ya existe.`
        : 'destino vacio en las 6 tablas financieras.');

    // 1. Que negocios tienen realmente datos financieros en RservasRoma.
    const owners = new Set();
    const sourceRows = {};
    for (const { name } of TABLES) {
        const rows = await selectAll(source, name);
        sourceRows[name] = rows;
        rows.forEach((row) => owners.add(row.negocio_id));
        console.log(`origen ${name.padEnd(30)} ${rows.length}`);
    }
    console.log(`negocios con datos: ${owners.size}`);

    if (!owners.size) return;

    // 2. Sus fichas en RservasRoma, sin tocar password_hash.
    const ids = [...owners].join(',');
    const businesses = await selectAll(
        source,
        'negocios',
        `&id=in.(${ids})&select=id,nombre,slug,telefono,email,especialidad`
            + ',color_primario,color_secundario,logo_url'
            + ',acceso_finanzas,estado_finanzas'
            + ',fecha_activacion_finanzas,fecha_vencimiento_finanzas'
    );

    const usable = businesses.filter((b) => b.slug && b.nombre);
    const skipped = businesses.filter((b) => !b.slug || !b.nombre);
    if (skipped.length) {
        console.log(`OJO ${skipped.length} negocios sin slug o sin nombre se omiten: ${skipped.map((b) => b.id).join(', ')}`);
    }

    // 3. Crear/enlazar la fila local. external_negocio_id es lo que busca
    //    primero el login federado, asi que el negocio conserva su historial.
    const localRows = usable.map((b) => ({
        nombre: b.nombre,
        slug: b.slug,
        telefono: b.telefono,
        email: b.email,
        especialidad: b.especialidad,
        color_primario: b.color_primario,
        color_secundario: b.color_secundario,
        logo_url: b.logo_url,
        external_negocio_id: b.id,
        integration_source: 'rservasroma',
        acceso_finanzas: b.acceso_finanzas ?? true,
        estado_finanzas: b.estado_finanzas || 'activo',
        fecha_activacion_finanzas: b.fecha_activacion_finanzas,
        fecha_vencimiento_finanzas: b.fecha_vencimiento_finanzas
    }));

    if (APPLY) await upsert(target, 'negocios', localRows, 'slug');
    console.log(`negocios enlazados: ${localRows.length}`);

    // 4. Mapa negocio de RservasRoma -> negocio local.
    const linked = APPLY
        ? await selectAll(target, 'negocios', `&external_negocio_id=in.(${ids})&select=id,external_negocio_id`)
        : [];
    const map = new Map(linked.map((row) => [row.external_negocio_id, row.id]));

    if (APPLY && map.size < localRows.length) {
        throw new Error(`Solo se enlazaron ${map.size} de ${localRows.length} negocios; se detiene antes de copiar filas huerfanas.`);
    }

    // 5. Copiar cada tabla con el negocio_id traducido.
    const insertadas = {};
    for (const { name, conflict } of TABLES) {
        const rows = sourceRows[name]
            .filter((row) => map.has(row.negocio_id) || !APPLY)
            .map((row) => ({ ...row, negocio_id: map.get(row.negocio_id) || row.negocio_id }));

        if (APPLY) {
            const nuevas = await upsert(target, name, rows, conflict);
            insertadas[name] = nuevas;
            const saltadas = rows.length - nuevas.length;
            console.log(`copiado ${name.padEnd(30)} nuevas=${String(nuevas.length).padEnd(5)}`
                + `${saltadas ? 'ya existian=' + saltadas : ''}`);
        } else {
            console.log(`copiaria ${name.padEnd(30)} ${rows.length}`);
        }
    }

    if (APPLY) {
        // Lista exacta de lo insertado, para poder deshacerlo con precision.
        // Solo claves, sin importes.
        const registro = path.resolve(__dirname, '..', 'private-setup', 'migration-applied.json');
        fs.writeFileSync(registro, JSON.stringify(insertadas, null, 2));
        console.log(`\nRegistro para deshacer: ${registro}`);
    }

    console.log(APPLY ? 'Listo.' : 'Simulacion terminada. Repite con --apply para escribir.');
}

run().catch((error) => {
    console.error(`FALLO: ${error.message}`);
    process.exitCode = 1;
});
