const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const supabaseDirectory = path.join(root, 'supabase');
const target = path.join(supabaseDirectory, 'standalone-install.generated.sql');
const sources = [
    'standalone-01-bootstrap.sql',
    'roma-finanzas-access.sql',
    'standalone-02-auth-bridge.sql',
    'standalone-03-income-tips.sql',
    'standalone-04-federated-rservasroma.sql'
];

const contents = [
    '-- GENERADO AUTOMATICAMENTE. Ejecutar solo en el proyecto nuevo FinanzasRoma.',
    '-- Fuentes: ' + sources.join(' -> '),
    '',
    ...sources.flatMap((file) => [
        `-- ===== INICIO ${file} =====`,
        fs.readFileSync(path.join(supabaseDirectory, file), 'utf8').trim(),
        `-- ===== FIN ${file} =====`,
        ''
    ])
].join('\n');

fs.writeFileSync(target, `${contents}\n`, 'utf8');
console.log(`Instalador SQL generado en ${target}`);
