const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const esbuild = require('esbuild');
const { getProjectConfig } = require('./project-config');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const assetsOutput = path.join(output, 'assets');
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const appBundleFile = `app-${appVersion}.js`;
const appStylesFile = `app-${appVersion}.css`;
const serviceWorkerRegisterFile = `register-sw-${appVersion}.js`;
const { backendMode, supabaseUrl, supabaseAnonKey, supabaseConfigured } = getProjectConfig();
const supabaseOrigin = new URL(supabaseUrl).origin;
const supabaseWebSocketOrigin = supabaseOrigin.replace(/^http/, 'ws');

const sourceOrder = [
    'utils/finance.js',
    'utils/mockData.js',
    'utils/offlineDb.js',
    'utils/supabase.js',
    'utils/store.js',
    'components/BottomNav.js',
    'components/TopBar.js',
    'views/Login.js',
    'views/Dashboard.js',
    'views/Income.js',
    'views/Expenses.js',
    'views/Menu.js',
    'views/Services.js',
    'views/Materials.js',
    'views/CostSheet.js',
    'views/Reports.js',
    'views/Config.js',
    'app.js'
];

function copyDirectory(source, target) {
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(source, target, { recursive: true, force: true });
}

async function build() {
    fs.rmSync(output, { recursive: true, force: true });
    fs.mkdirSync(assetsOutput, { recursive: true });

    const source = [
        "import * as React from 'react';",
        "import * as ReactDOM from 'react-dom/client';",
        "import { createClient } from '@supabase/supabase-js';",
        `window.ROMA_CONFIG = ${JSON.stringify({ backendMode, supabaseUrl, supabaseAnonKey, supabaseConfigured })};`,
        "window.supabase = { createClient };",
        `window.ROMA_APP_VERSION = ${JSON.stringify(appVersion)};`,
        ...sourceOrder.map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'))
    ].join('\n\n');

    await esbuild.build({
        stdin: {
            contents: source,
            loader: 'jsx',
            resolveDir: root,
            sourcefile: 'roma-finanzas.jsx'
        },
        outfile: path.join(assetsOutput, appBundleFile),
        bundle: true,
        format: 'iife',
        platform: 'browser',
        target: ['es2020'],
        minify: true,
        sourcemap: false,
        legalComments: 'none',
        define: {
            'process.env.NODE_ENV': '"production"'
        }
    });

    const tailwindExecutable = path.join(root, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
    const cssResult = spawnSync(process.execPath, [
        tailwindExecutable,
        '-i', path.join(root, 'styles', 'input.css'),
        '-o', path.join(assetsOutput, appStylesFile),
        '--minify'
    ], { cwd: root, stdio: 'inherit' });

    if (cssResult.status !== 0) {
        throw new Error('Tailwind no pudo generar el CSS de producción.');
    }

    const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
        .replace('__ROMA_SUPABASE_HTTPS__', supabaseOrigin)
        .replace('__ROMA_SUPABASE_WSS__', supabaseWebSocketOrigin)
        .replace('assets/app.css', `assets/${appStylesFile}`)
        .replace('assets/register-sw.js', `assets/${serviceWorkerRegisterFile}`)
        .replace('assets/app.js', `assets/${appBundleFile}`);
    fs.writeFileSync(path.join(output, 'index.html'), indexHtml);
    fs.copyFileSync(path.join(root, 'manifest.json'), path.join(output, 'manifest.json'));
    const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8')
        .replace('__ROMA_APP_VERSION__', appVersion)
        .replace('__ROMA_SUPABASE_ORIGIN__', supabaseOrigin)
        .replace('./assets/app.js', `./assets/${appBundleFile}`)
        .replace('./assets/app.css', `./assets/${appStylesFile}`)
        .replace('./assets/register-sw.js', `./assets/${serviceWorkerRegisterFile}`);
    fs.writeFileSync(path.join(output, 'sw.js'), serviceWorker);
    fs.copyFileSync(path.join(root, 'pwa', 'register-sw.js'), path.join(assetsOutput, serviceWorkerRegisterFile));
    copyDirectory(path.join(root, 'icons'), path.join(output, 'icons'));
    fs.mkdirSync(path.join(output, 'vendor'), { recursive: true });
    ['lucide.css', 'lucide.woff2', 'lucide.ttf', 'inter-latin.woff2'].forEach((file) => {
        fs.copyFileSync(path.join(root, 'vendor', file), path.join(output, 'vendor', file));
    });

    console.log(`Roma Finanzas web preparada en ${output}`);
}

build().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
