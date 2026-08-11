const fs = require('fs');
const path = require('path');

const UNCONFIGURED_SUPABASE_URL = 'https://project-not-configured.supabase.co';
const UNCONFIGURED_SUPABASE_KEY = 'public-anon-key-not-configured';

function readLocalEnvironment() {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) return {};

    return fs.readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .reduce((values, line) => {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith('#')) return values;
            const separator = cleanLine.indexOf('=');
            if (separator < 1) return values;
            const key = cleanLine.slice(0, separator).trim();
            let value = cleanLine.slice(separator + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"'))
                || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            values[key] = value;
            return values;
        }, {});
}

function getProjectConfig() {
    const localEnvironment = readLocalEnvironment();
    const supabaseUrl = process.env.ROMA_SUPABASE_URL
        || localEnvironment.ROMA_SUPABASE_URL
        || UNCONFIGURED_SUPABASE_URL;
    const supabaseAnonKey = process.env.ROMA_SUPABASE_ANON_KEY
        || localEnvironment.ROMA_SUPABASE_ANON_KEY
        || UNCONFIGURED_SUPABASE_KEY;
    const supabaseConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)
        && !/not-configured|tu-proyecto|referencia-exacta/i.test(supabaseUrl)
        && supabaseAnonKey.length > 20
        && !/not-configured|tu-clave|clave-publica/i.test(supabaseAnonKey);

    return {
        backendMode: process.env.ROMA_BACKEND_MODE
            || localEnvironment.ROMA_BACKEND_MODE
            || 'standalone-auth',
        supabaseUrl,
        supabaseAnonKey,
        supabaseConfigured
    };
}

module.exports = { getProjectConfig };
