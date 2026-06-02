const ROMA_SUPABASE_URL = 'https://zorhclhvykikaachfrmp.supabase.co';
const ROMA_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmhjbGh2eWtpa2FhY2hmcm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDQzMzUsImV4cCI6MjA4NzcyMDMzNX0.reauF3UfNTFJFZ3Mnzf8ctYH1d5p7C3msi7AvYJUaos';

const romaSupabase = window.supabase.createClient(ROMA_SUPABASE_URL, ROMA_SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
    }
});

window.romaSupabase = romaSupabase;

const ROMA_FINANZAS_DENIED_STATES = ['sin_acceso', 'vencido', 'bloqueado'];

async function fetchRomaBusinessByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return null;

    const selectWithFinance = 'id,nombre,email,telefono,slug,plan,logo_url,acceso_finanzas,estado_finanzas,fecha_vencimiento_finanzas';
    const selectBasic = 'id,nombre,email,telefono,slug,plan,logo_url';

    let response = await romaSupabase
        .from('negocios')
        .select(selectWithFinance)
        .ilike('email', normalizedEmail)
        .limit(1)
        .maybeSingle();

    if (response.error && (response.error.code === 'PGRST204' || String(response.error.message || '').toLowerCase().includes('column'))) {
        response = await romaSupabase
            .from('negocios')
            .select(selectBasic)
            .ilike('email', normalizedEmail)
            .limit(1)
            .maybeSingle();
    }

    if (response.error) {
        throw response.error;
    }

    return response.data || null;
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

async function loginRomaFinanzas(email, password) {
    const { data, error } = await romaSupabase.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(),
        password
    });

    if (error) {
        throw new Error('Correo o contrasena incorrectos.');
    }

    const business = await fetchRomaBusinessByEmail(data.user.email);

    if (!business) {
        await romaSupabase.auth.signOut();
        throw new Error('Este correo no esta asociado a ningun negocio de RservasRoma.');
    }

    if (!canUseRomaFinanzas(business)) {
        await romaSupabase.auth.signOut();
        throw new Error('Este negocio aun no tiene acceso activo a Roma Finanzas.');
    }

    return {
        session: data.session,
        user: data.user,
        business
    };
}

async function getRomaAuthSession() {
    const { data, error } = await romaSupabase.auth.getSession();
    if (error || !data.session) {
        return { session: null, user: null, business: null };
    }

    const business = await fetchRomaBusinessByEmail(data.session.user.email);
    if (!business || !canUseRomaFinanzas(business)) {
        await romaSupabase.auth.signOut();
        return { session: null, user: null, business: null };
    }

    return {
        session: data.session,
        user: data.session.user,
        business
    };
}

async function logoutRomaFinanzas() {
    await romaSupabase.auth.signOut();
}
