const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getProjectConfig } = require('./project-config');

const root = path.resolve(__dirname, '..');
const appVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const { backendMode, supabaseUrl, supabaseAnonKey, supabaseConfigured } = getProjectConfig();
const checks = [];

function addCheck(name, ok, detail) {
    checks.push({ name, ok: Boolean(ok), detail });
}

function commandVersion(command, args) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    return {
        ok: result.status === 0,
        output: `${result.stdout || ''}${result.stderr || ''}`.trim()
    };
}

function androidSdkPath() {
    const envPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (envPath) return envPath;
    const propertiesPath = path.join(root, 'android', 'local.properties');
    if (!fs.existsSync(propertiesPath)) return '';
    const match = fs.readFileSync(propertiesPath, 'utf8').match(/^sdk\.dir=(.+)$/m);
    return match ? match[1].replace(/\\\\/g, '\\') : '';
}

async function checkSupabaseContract() {
    if (!supabaseConfigured) {
        addCheck(
            'Conexión con FinanzasRoma',
            false,
            'Copia la URL y la clave pública exactas del proyecto nuevo en .env.local.'
        );
        return;
    }

    try {
        const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
        const headers = {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json'
        };
        if (backendMode === 'standalone-auth' || backendMode === 'federated-rservasroma') {
            const authSettings = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/settings`, {
                headers: { apikey: supabaseAnonKey }
            });
            addCheck(
                'Conexión con FinanzasRoma',
                authSettings.ok,
                authSettings.ok ? 'El proyecto nuevo responde correctamente.' : `HTTP ${authSettings.status}: revisa URL y clave pública.`
            );
            if (!authSettings.ok) return;

            let settings = {};
            try {
                settings = await authSettings.json();
            } catch (error) {
                settings = {};
            }
            if (typeof settings.disable_signup === 'boolean') {
                addCheck(
                    'Registro público cerrado',
                    settings.disable_signup,
                    settings.disable_signup ? 'Solo se puede entrar por invitación.' : 'Desactiva el registro público en Authentication.'
                );
            }

            const businessProbe = await fetch(`${restUrl}/negocios?select=id&limit=0`, { headers });
            let businessProbeCode = '';
            try {
                businessProbeCode = (await businessProbe.json())?.code || '';
            } catch (error) {
                businessProbeCode = '';
            }
            const schemaMissing = businessProbe.status === 404
                && ['PGRST204', 'PGRST205'].includes(businessProbeCode);
            addCheck(
                'Esquema independiente instalado',
                !schemaMissing,
                schemaMissing ? 'Ejecuta los tres pasos SQL en el proyecto nuevo.' : 'El contrato de base de datos responde.'
            );
            addCheck(
                'Tablas privadas para anon',
                !schemaMissing && !businessProbe.ok,
                schemaMissing
                    ? 'Primero instala el esquema.'
                    : (businessProbe.ok ? 'anon todavía puede consultar negocios.' : 'anon no puede leer negocios.')
            );
            if (backendMode === 'federated-rservasroma') {
                const functionProbe = await fetch(
                    `${supabaseUrl.replace(/\/$/, '')}/functions/v1/rservasroma-login`,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ slug: '', password: '' })
                    }
                );
                addCheck(
                    'Acceso compartido con RservasRoma',
                    functionProbe.status !== 404,
                    functionProbe.status === 404
                        ? 'Falta desplegar la funcion rservasroma-login en FinanzasRoma.'
                        : 'La funcion de acceso federado responde.'
                );
            }
            return;
        }

        const sharedContracts = [
            ['negocios', 'id,slug,acceso_finanzas,estado_finanzas'],
            ['servicios', 'id,negocio_id'],
            ['reservas', 'id,negocio_id,fecha,cliente_nombre,servicio,estado,monto_cobrado,precio_final,precio_original']
        ];
        const missingSharedContracts = [];
        for (const [table, columns] of sharedContracts) {
            const response = await fetch(`${restUrl}/${table}?select=${columns}&limit=0`, { headers });
            if (response.status === 401 || response.status === 403) {
                addCheck('Conexión autenticada con Supabase', false, `HTTP ${response.status}: revisa la URL y la clave anon.`);
                return;
            }
            if (!response.ok) missingSharedContracts.push(table);
        }
        if (missingSharedContracts.includes('negocios')) {
            addCheck('Contrato compartido con RservasRoma', false, 'Faltan columnas de acceso financiero en negocios.');
            return;
        }
        addCheck(
            'Contrato compartido con RservasRoma',
            missingSharedContracts.length === 0,
            missingSharedContracts.length ? `Revisar columnas de: ${missingSharedContracts.join(', ')}` : 'Negocios, servicios y reservas tienen las columnas esperadas.'
        );

        const rpcChecks = [
            ['login_roma_finanzas', { p_username: '', p_password: '' }],
            ['resume_roma_finanzas_session', { p_token: '' }],
            ['logout_roma_finanzas', { p_token: '' }],
            ['load_roma_finanzas', { p_token: '' }],
            ['apply_roma_finanzas_change', { p_token: '', p_operation: '', p_payload: {} }]
        ];
        const missingRpc = [];
        for (const [name, payload] of rpcChecks) {
            const response = await fetch(`${restUrl}/rpc/${name}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            let errorCode = '';
            try {
                errorCode = (await response.json())?.code || '';
            } catch (error) {
                errorCode = '';
            }
            if (response.status === 404 || errorCode === 'PGRST202') missingRpc.push(name);
        }
        addCheck(
            'RPC seguras de Roma Finanzas',
            missingRpc.length === 0,
            missingRpc.length ? `Faltan: ${missingRpc.join(', ')}` : 'Las cinco RPC están publicadas.'
        );
        const passwordProbe = await fetch(`${restUrl}/negocios?select=password_hash&limit=0`, { headers });
        addCheck(
            'Contraseña fuera del contrato público',
            !passwordProbe.ok,
            passwordProbe.ok ? 'password_hash todavía puede consultarse con la clave anon.' : 'password_hash no es visible para anon.'
        );
    } catch (error) {
        addCheck('Conexión de preflight con Supabase', false, error.message);
    }
}

async function run() {
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    addCheck('Node.js', nodeMajor >= 20, `v${process.versions.node}`);

    const java = commandVersion('java', ['-version']);
    const javaVersion = java.output.match(/version "(\d+)/)?.[1] || '';
    addCheck('Java para Android', java.ok && Number(javaVersion) >= 17, java.output.split(/\r?\n/)[0] || 'No disponible');

    const sdkPath = androidSdkPath();
    addCheck('Android SDK', sdkPath && fs.existsSync(sdkPath), sdkPath || 'No configurado');
    addCheck(
        'Build web',
        fs.existsSync(path.join(root, 'dist', 'assets', `app-${appVersion}.js`)),
        'Ejecuta npm run check si falta.'
    );
    const migrationFiles = backendMode === 'federated-rservasroma'
        ? [
            'standalone-01-bootstrap.sql',
            'roma-finanzas-access.sql',
            'standalone-02-auth-bridge.sql',
            'standalone-03-income-tips.sql',
            'standalone-04-federated-rservasroma.sql',
            'rservasroma-federated-auth-provider.sql'
        ]
        : (backendMode === 'standalone-auth'
            ? ['standalone-01-bootstrap.sql', 'roma-finanzas-access.sql', 'standalone-02-auth-bridge.sql']
            : ['roma-finanzas-access.sql']);
    addCheck(
        'Migración segura',
        migrationFiles.every((file) => fs.existsSync(path.join(root, 'supabase', file))),
        backendMode === 'standalone-auth' ? 'Los tres pasos independientes están preparados.' : 'Archivo local preparado.'
    );

    await checkSupabaseContract();

    console.log('\nPreflight del piloto Roma Finanzas\n');
    checks.forEach((check) => {
        console.log(`${check.ok ? 'OK   ' : 'FALTA'} ${check.name}: ${check.detail}`);
    });

    const failed = checks.filter((check) => !check.ok);
    console.log(`\nResultado: ${checks.length - failed.length}/${checks.length} controles listos.`);
    if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
