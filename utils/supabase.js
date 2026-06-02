const ROMA_SUPABASE_URL = 'https://zorhclhvykikaachfrmp.supabase.co';
const ROMA_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmhjbGh2eWtpa2FhY2hmcm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDQzMzUsImV4cCI6MjA4NzcyMDMzNX0.reauF3UfNTFJFZ3Mnzf8ctYH1d5p7C3msi7AvYJUaos';
const ROMA_SESSION_KEY = 'roma_finanzas_auth_v1';
const ROMA_SESSION_HOURS = 12;

const romaSupabase = window.supabase.createClient(ROMA_SUPABASE_URL, ROMA_SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

window.romaSupabase = romaSupabase;

const ROMA_FINANZAS_DENIED_STATES = ['sin_acceso', 'vencido', 'bloqueado'];

function buildRomaBusinessSelect(includeFinanceFields = true) {
    const base = 'id,nombre,email,telefono,slug,plan,logo_url,password_hash';
    if (!includeFinanceFields) return base;
    return `${base},acceso_finanzas,estado_finanzas,fecha_vencimiento_finanzas`;
}

async function queryRomaBusinessByLogin(username, includeFinanceFields = true) {
    const normalized = String(username || '').trim().toLowerCase();
    if (!normalized) return null;

    let response = await romaSupabase
        .from('negocios')
        .select(buildRomaBusinessSelect(includeFinanceFields))
        .eq('slug', normalized)
        .limit(1);

    if (response.error) throw response.error;
    if (Array.isArray(response.data) && response.data.length > 0) return response.data[0];

    response = await romaSupabase
        .from('negocios')
        .select(buildRomaBusinessSelect(includeFinanceFields))
        .eq('usuario', normalized)
        .limit(1);

    if (response.error) {
        if (response.error.code === '42703' || String(response.error.message || '').toLowerCase().includes('usuario')) {
            return null;
        }
        throw response.error;
    }

    return Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : null;
}

async function fetchRomaBusinessById(id) {
    if (!id) return null;

    let response = await romaSupabase
        .from('negocios')
        .select(buildRomaBusinessSelect(true))
        .eq('id', id)
        .limit(1)
        .maybeSingle();

    if (response.error && (response.error.code === 'PGRST204' || String(response.error.message || '').toLowerCase().includes('column'))) {
        response = await romaSupabase
            .from('negocios')
            .select(buildRomaBusinessSelect(false))
            .eq('id', id)
            .limit(1)
            .maybeSingle();
    }

    if (response.error) throw response.error;
    return response.data || null;
}

async function fetchRomaBusinessByLogin(username) {
    try {
        return await queryRomaBusinessByLogin(username, true);
    } catch (error) {
        if (error.code === 'PGRST204' || String(error.message || '').toLowerCase().includes('column')) {
            return await queryRomaBusinessByLogin(username, false);
        }
        throw error;
    }
}

function canUseRomaFinanzas(business) {
    if (!business) return false;

    if (business.acceso_finanzas === false) return false;

    const estado = String(business.estado_finanzas || 'activo').toLowerCase();
    if (ROMA_FINANZAS_DENIED_STATES.includes(estado)) return false;

    if (business.fecha_vencimiento_finanzas) {
        const expiresAt = new Date(business.fecha_vencimiento_finanzas);
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt < new Date()) return false;
    }

    return true;
}

function sanitizeBusinessForSession(business) {
    if (!business) return null;
    const { password_hash, ...safeBusiness } = business;
    return safeBusiness;
}

function saveRomaSession(business) {
    const session = {
        businessId: business.id,
        slug: business.slug,
        business: sanitizeBusinessForSession(business),
        loginTime: Date.now()
    };
    window.localStorage.setItem(ROMA_SESSION_KEY, JSON.stringify(session));
    return session;
}

function readRomaSession() {
    try {
        const raw = window.localStorage.getItem(ROMA_SESSION_KEY);
        if (!raw) return null;

        const session = JSON.parse(raw);
        const maxAge = ROMA_SESSION_HOURS * 60 * 60 * 1000;
        if (!session.loginTime || Date.now() - Number(session.loginTime) > maxAge) {
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            return null;
        }

        return session;
    } catch (error) {
        window.localStorage.removeItem(ROMA_SESSION_KEY);
        return null;
    }
}

async function loginRomaFinanzas(username, password) {
    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();

    if (!cleanUsername || !cleanPassword) {
        throw new Error('Escribe tu usuario y contrasena.');
    }

    if (typeof bcrypt === 'undefined') {
        throw new Error('No se cargo el verificador de contrasena.');
    }

    const business = await fetchRomaBusinessByLogin(cleanUsername);

    if (!business) {
        throw new Error('Usuario no encontrado.');
    }

    if (!business.password_hash) {
        throw new Error('Este negocio no tiene contrasena configurada.');
    }

    const passwordValid = bcrypt.compareSync(cleanPassword, business.password_hash);
    if (!passwordValid) {
        throw new Error('Contrasena incorrecta.');
    }

    if (!canUseRomaFinanzas(business)) {
        throw new Error('Este negocio aun no tiene acceso activo a Roma Finanzas.');
    }

    const session = saveRomaSession(business);

    return {
        session,
        user: { username: cleanUsername, email: business.email || '', businessId: business.id },
        business: sanitizeBusinessForSession(business)
    };
}

async function getRomaAuthSession() {
    const session = readRomaSession();
    if (!session) {
        return { session: null, user: null, business: null };
    }

    const business = await fetchRomaBusinessById(session.businessId);
    if (!business || !canUseRomaFinanzas(business)) {
        window.localStorage.removeItem(ROMA_SESSION_KEY);
        return { session: null, user: null, business: null };
    }

    return {
        session,
        user: { username: business.slug || session.slug || '', email: business.email || '', businessId: business.id },
        business: sanitizeBusinessForSession(business)
    };
}

async function logoutRomaFinanzas() {
    window.localStorage.removeItem(ROMA_SESSION_KEY);
}
