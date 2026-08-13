const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const appBundleFile = `assets/app-${appVersion}.js`;
const appStylesFile = `assets/app-${appVersion}.css`;
const serviceWorkerRegisterFile = `assets/register-sw-${appVersion}.js`;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

['index.html', 'manifest.json', 'sw.js', appBundleFile, appStylesFile, serviceWorkerRegisterFile].forEach((file) => {
    assert(fs.existsSync(path.join(dist, file)), `Falta ${file} en el build.`);
});

JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));

const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
assert(!indexHtml.includes('__ROMA_SUPABASE_'), 'El CSP conserva marcadores de Supabase sin reemplazar.');
assert(/connect-src[^;]+https:\/\//.test(indexHtml), 'El CSP no permite la conexión HTTPS configurada para Supabase.');
assert(/connect-src[^;]+wss:\/\//.test(indexHtml), 'El CSP no permite la conexión WebSocket configurada para Supabase.');
assert(indexHtml.includes(appBundleFile), 'El HTML no usa el JavaScript versionado.');
assert(indexHtml.includes(appStylesFile), 'El HTML no usa el CSS versionado.');

const serviceWorker = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
assert(!serviceWorker.includes('__ROMA_'), 'El service worker conserva marcadores sin reemplazar.');
assert(serviceWorker.includes('const ROMA_SUPABASE_ORIGIN ='), 'El service worker no excluye el origen de Supabase.');
const assetsMatch = serviceWorker.match(/const LOCAL_ASSETS = (\[[\s\S]*?\]);/);
assert(assetsMatch, 'No se encontró la lista de recursos offline.');
const offlineAssets = vm.runInNewContext(assetsMatch[1]);
offlineAssets.forEach((asset) => {
    if (asset === './') return;
    const relativePath = asset.replace(/^\.\//, '');
    assert(fs.existsSync(path.join(dist, relativePath)), `El recurso offline ${asset} no existe.`);
});

const appBundle = fs.readFileSync(path.join(dist, appBundleFile), 'utf8');
assert(!appBundle.includes('babel.min.js'), 'El build todavía depende de Babel en el navegador.');
assert(!appBundle.includes('bcrypt.compareSync'), 'El build todavía verifica contraseñas en el navegador.');
assert(appBundle.includes('standalone-auth'), 'El build no contiene el modo independiente de Supabase Auth.');
assert(appBundle.includes('federated-rservasroma'), 'El build no contiene el acceso compartido con RservasRoma.');
assert(appBundle.includes('rservasroma-login'), 'El build no contiene la llamada a la funcion de acceso compartido.');
assert(appBundle.includes('Entrar con RservasRoma'), 'El build no contiene el login por slug de RservasRoma.');
assert(appBundle.includes('rwodzlwzrkshgsbhhbrw.supabase.co'), 'El build no apunta al proyecto FinanzasRoma configurado.');
assert(fs.statSync(path.join(dist, appBundleFile)).size < 1_500_000, 'El bundle principal supera 1.5 MB.');

console.log(`Build verificado: ${offlineAssets.length} recursos offline y bundle de ${Math.round(Buffer.byteLength(appBundle) / 1024)} KB.`);
