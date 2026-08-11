const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sql = fs.readFileSync(path.join(root, 'supabase', 'roma-finanzas-access.sql'), 'utf8').toLowerCase();
const standaloneBootstrap = fs.readFileSync(path.join(root, 'supabase', 'standalone-01-bootstrap.sql'), 'utf8').toLowerCase();
const standaloneBridge = fs.readFileSync(path.join(root, 'supabase', 'standalone-02-auth-bridge.sql'), 'utf8').toLowerCase();
const tipsMigration = fs.readFileSync(path.join(root, 'supabase', 'standalone-03-income-tips.sql'), 'utf8').toLowerCase();

test('la migración no vuelve a abrir las tablas financieras', () => {
    assert.equal(sql.includes('disable row level security'), false);
    assert.equal(sql.includes('grant select, insert, update, delete'), false);
    assert.match(sql, /enable row level security/);
    assert.match(sql, /force row level security/);
    assert.match(sql, /revoke all on table public\.roma_finanzas_ingresos from public, anon, authenticated/);
    assert.match(sql, /revoke select on table public\.negocios from public, anon, authenticated/);
    assert.equal(/grant select \([\s\S]*password_hash/.test(sql), false);
});

test('el acceso financiero comienza cerrado', () => {
    assert.match(sql, /acceso_finanzas boolean default false/);
    assert.match(sql, /estado_finanzas text default 'sin_acceso'/);
    assert.equal(sql.includes('set acceso_finanzas = true'), false);
});

test('las operaciones obtienen el negocio desde una sesión validada', () => {
    assert.match(sql, /session_business_id\(p_token\)/);
    assert.match(sql, /v_business_id := roma_finanzas_private\.session_business_id\(p_token\)/);
    assert.match(sql, /apply_roma_finanzas_change/);
});

test('el servidor calcula tasas y costo del ingreso sin confiar en el navegador', () => {
    assert.equal(sql.includes("p_payload->>'rate_to_main'"), false);
    assert.equal(sql.includes("p_payload->>'unit_cost_main'"), false);
    assert.equal(sql.includes("p_payload->>'cost_sheet_id'"), false);
    assert.match(sql, /v_rate := v_currency_cup \/ v_main_currency_cup/);
    assert.match(sql, /from public\.roma_finanzas_fichas_costo f/);
});

test('el cliente no verifica hashes de contraseña', () => {
    const client = fs.readFileSync(path.join(root, 'utils', 'supabase.js'), 'utf8');
    assert.equal(client.includes('bcrypt.compareSync'), false);
    assert.equal(client.includes("baseFields.push('password_hash')"), false);
});

test('no queda un costo mensual de RservasRoma inventado en la lógica', () => {
    const files = ['utils/store.js', 'utils/supabase.js', 'views/CostSheet.js'];
    files.forEach((file) => {
        const content = fs.readFileSync(path.join(root, file), 'utf8');
        assert.equal(/rservasroma[\s\S]{0,120}1000|1000[\s\S]{0,120}rservasroma/i.test(content), false, file);
    });
});

test('el precheck de producción es estrictamente de solo lectura', () => {
    const precheck = fs.readFileSync(path.join(root, 'supabase', 'production-precheck.sql'), 'utf8')
        .replace(/--.*$/gm, '');
    assert.equal(/\b(insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/i.test(precheck), false);
    assert.match(precheck, /has_column_privilege/);
    assert.match(precheck, /to_regprocedure/);
});

test('el modo independiente usa Supabase Auth y ata el token a auth.uid()', () => {
    assert.match(standaloneBootstrap, /references auth\.users\(id\)/);
    assert.match(standaloneBridge, /v_user_id uuid := auth\.uid\(\)/);
    assert.match(standaloneBridge, /and user_id = v_user_id/);
    assert.match(standaloneBridge, /grant execute on function public\.start_roma_finanzas_auth_session\(\) to authenticated/);
    assert.match(standaloneBridge, /revoke all on function public\.start_roma_finanzas_auth_session\(\) from public, anon, authenticated/);
    assert.match(standaloneBridge, /extensions\.digest\(p_token, 'sha256'\)/);
    assert.match(standaloneBridge, /extensions\.gen_random_bytes\(32\)/);
});

test('el modo independiente elimina hashes y no abre tablas a anon', () => {
    assert.match(standaloneBridge, /drop function if exists public\.login_roma_finanzas\(text, text\)/);
    assert.match(standaloneBridge, /alter table public\.negocios drop column if exists password_hash/);
    assert.match(standaloneBridge, /revoke all on table public\.negocios from public, anon, authenticated/);
    assert.equal(standaloneBridge.includes('grant select on table'), false);
});

test('el build no conserva la URL productiva como valor predeterminado', () => {
    const config = fs.readFileSync(path.join(root, 'scripts', 'project-config.js'), 'utf8');
    assert.equal(config.includes('zorhclhvykikaachfrmp'), false);
    assert.match(config, /standalone-auth/);
    assert.match(config, /\.env\.local/);
});

test('pgcrypto se instala y se usa desde el esquema extensions de Supabase', () => {
    assert.match(sql, /create extension if not exists pgcrypto with schema extensions/);
    assert.equal(/(?<!\.)\bdigest\s*\(/.test(sql), false);
    assert.equal(/(?<!\.)\bcrypt\s*\(/.test(sql), false);
    assert.equal(/(?<!\.)\bgen_random_bytes\s*\(/.test(sql), false);
});

test('las propinas se convierten en el servidor y no alteran el precio del servicio', () => {
    assert.match(tipsMigration, /tip_amount_main numeric/);
    assert.match(tipsMigration, /v_tip_rate := v_tip_currency_cup \/ v_main_currency_cup/);
    assert.match(tipsMigration, /public\.apply_roma_finanzas_change\([\s\S]*'save_income'/);
    assert.equal(tipsMigration.includes("p_payload->>'tip_rate_to_main'"), false);
    assert.match(tipsMigration, /grant execute on function public\.save_roma_finanzas_income\(text, jsonb\)\s+to authenticated/);
});
