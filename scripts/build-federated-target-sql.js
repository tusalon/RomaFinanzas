const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'supabase');
const target = path.join(directory, 'federated-finanzasroma-install.generated.sql');
const sources = [
    'standalone-03-income-tips.sql',
    'standalone-04-federated-rservasroma.sql'
];

const contents = [
    '-- GENERADO AUTOMATICAMENTE. Ejecutar solo en FinanzasRoma.',
    '-- Instala propinas y despues el acceso compartido con RservasRoma.',
    '',
    ...sources.flatMap((file) => [
        `-- ===== INICIO ${file} =====`,
        fs.readFileSync(path.join(directory, file), 'utf8').trim(),
        `-- ===== FIN ${file} =====`,
        ''
    ])
].join('\n');

fs.writeFileSync(target, `${contents}\n`, 'utf8');
console.log(`SQL federado generado en ${target}`);
