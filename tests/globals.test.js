const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Quita comentarios y el contenido de las cadenas, para no confundir
// 'PGRST202' o `${fecha}T00:00:00` con identificadores.
function soloCodigo(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

// Solo nuestras constantes: EN_MAYUSCULAS CON_GUION_BAJO, sueltas y no
// precedidas por punto (window.X viene de fuera). Exigir el guion bajo deja
// fuera el ruido que no es codigo: claves de objeto como `USD: 0` y palabras
// sueltas en el texto de JSX ("Normalmente sera CUP").
const USO = /(?<![.\w$])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
const DECLARACION = /\b(?:const|let|var|function|class)\s+([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;

test('el bundle no usa constantes que nadie declara', () => {
    const build = fs.readFileSync(path.join(root, 'scripts', 'build-web.js'), 'utf8');
    const archivos = [...build.matchAll(/'((?:utils|views|components)\/[a-zA-Z-]+\.js)'/g)].map((m) => m[1]);

    assert.ok(archivos.length > 5, 'no pude leer la lista de ficheros del bundle');

    const declarados = new Set();
    const usos = new Map();

    for (const rel of archivos) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) continue;
        const codigo = soloCodigo(fs.readFileSync(abs, 'utf8'));

        for (const m of codigo.matchAll(DECLARACION)) declarados.add(m[1]);
        for (const m of codigo.matchAll(USO)) {
            if (!usos.has(m[1])) usos.set(m[1], rel);
        }
    }

    const huerfanas = [...usos.entries()]
        .filter(([nombre]) => !declarados.has(nombre))
        .map(([nombre, rel]) => `${nombre} (${rel})`);

    // Asi se colo ROMA_CURRENCIES: no rompe al cargar, rompe al ejecutar la
    // funcion que la usa, y puede quedarse dormida hasta que un usuario entra.
    assert.deepEqual(huerfanas, [], `constantes usadas sin declarar: ${huerfanas.join(', ')}`);
});
