const fs = require('fs');
const path = require('path');
const { getProjectConfig } = require('./project-config');

const root = path.resolve(__dirname, '..');
const { supabaseUrl, supabaseAnonKey, supabaseConfigured } = getProjectConfig();

async function run() {
    if (!supabaseConfigured) throw new Error('FinanzasRoma no esta configurado.');

    const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/functions/v1/rservasroma-login`,
        {
            method: 'POST',
            headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
                Origin: 'http://127.0.0.1:4173'
            },
            body: JSON.stringify({
                slug: '__prueba_invalida__',
                password: 'incorrecta'
            })
        }
    );

    let body = {};
    try {
        body = await response.json();
    } catch (error) {
        body = {};
    }

    const passed = response.status === 401
        && body.error === 'Slug o contrasena incorrectos.';

    console.log(
        `${passed ? 'OK' : 'FALTA'} funcion federada: HTTP ${response.status}; `
        + `${body.error || body.message || body.code || 'respuesta sin detalle'}`
    );

    if (!passed) process.exitCode = 1;

    const loadResponse = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/functions/v1/rservasroma-login`,
        {
            method: 'POST',
            headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
                Origin: 'http://127.0.0.1:4173'
            },
            body: JSON.stringify({
                action: 'load-business-data',
                token: 'incorrecto'
            })
        }
    );

    let loadBody = {};
    try {
        loadBody = await loadResponse.json();
    } catch (error) {
        loadBody = {};
    }

    const loadPassed = loadResponse.status === 401
        && String(loadBody.error || '').toLowerCase().includes('sesion');

    console.log(
        `${loadPassed ? 'OK' : 'FALTA'} puente de datos: HTTP ${loadResponse.status}; `
        + `${loadBody.error || loadBody.message || loadBody.code || 'respuesta sin detalle'}`
    );

    if (!loadPassed) process.exitCode = 1;
}

run().catch((error) => {
    console.error(`FALTA funcion federada: ${error.message}`);
    process.exitCode = 1;
});
