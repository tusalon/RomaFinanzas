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
        throw new Error('Escribe tu usuario y contraseña.');
    }

    if (typeof bcrypt === 'undefined') {
        throw new Error('No se cargó el verificador de contraseña.');
    }

    const business = await fetchRomaBusinessByLogin(cleanUsername);

    if (!business) {
        throw new Error('Usuario no encontrado.');
    }

    if (!business.password_hash) {
        throw new Error('Este negocio no tiene contraseña configurada.');
    }

    const passwordValid = bcrypt.compareSync(cleanPassword, business.password_hash);
    if (!passwordValid) {
        throw new Error('Contraseña incorrecta.');
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

    try {
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
    } catch (error) {
        if (session.business) {
            return {
                session,
                user: {
                    username: session.business.slug || session.slug || '',
                    email: session.business.email || '',
                    businessId: session.businessId
                },
                business: session.business
            };
        }

        throw error;
    }
}

async function logoutRomaFinanzas() {
    window.localStorage.removeItem(ROMA_SESSION_KEY);
}

function mapFinanceServiceFromDb(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category || 'General',
        price: toNumber(row.price),
        duration: toNumber(row.duration) || 60,
        currency: row.currency || 'CUP',
        active: row.active !== false,
        defaultMaterials: Array.isArray(row.default_materials) ? row.default_materials : []
    };
}

function mapBusinessServiceToFinance(row, config = {}) {
    const mainCurrency = config.mainCurrency || 'CUP';
    const sourceCurrency = 'CUP';
    const price = mainCurrency === sourceCurrency
        ? toNumber(row.precio)
        : convertToMainCurrency(row.precio, sourceCurrency, config);

    return {
        id: `servicio_${row.id}`,
        name: row.nombre || 'Servicio',
        category: row.categoria || 'General',
        price,
        duration: toNumber(row.duracion) || 60,
        currency: mainCurrency,
        active: row.activo !== false,
        defaultMaterials: []
    };
}

function mapFinanceMaterialFromDb(row) {
    return {
        id: row.id,
        name: row.name,
        cost: toNumber(row.cost),
        currency: row.currency || 'CUP',
        uses: toNumber(row.uses) || 1,
        costPerUse: toNumber(row.cost_per_use),
        unit: row.unit || 'uso',
        stock: toNumber(row.stock)
    };
}

function mapFinanceIncomeFromDb(row) {
    return {
        id: row.id,
        date: row.date,
        serviceId: row.service_id || '',
        client: row.client || '',
        amount: toNumber(row.amount),
        currency: row.currency || 'CUP',
        paymentMethod: row.payment_method || 'Efectivo',
        note: row.note || ''
    };
}

function normalizeFinanceText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function mapBookingToFinanceIncome(row, services = [], config = {}) {
    const serviceName = String(row.servicio || '').trim();
    const matchedService = (services || []).find((service) => normalizeFinanceText(service.name) === normalizeFinanceText(serviceName));
    const bookingAmount = toNumber(row.monto_cobrado) || toNumber(row.precio_final) || toNumber(row.precio_original);
    const currency = matchedService?.currency || config.mainCurrency || 'CUP';
    const amount = bookingAmount > 0
        ? convertToMainCurrency(bookingAmount, 'CUP', { ...config, mainCurrency: currency })
        : toNumber(matchedService?.price);

    return {
        id: `reserva_${row.id}`,
        date: row.fecha || getTodayKey(),
        serviceId: matchedService?.id || '',
        client: row.cliente_nombre || '',
        amount,
        currency,
        paymentMethod: row.monto_cobrado ? 'Cobro real' : 'Reserva completada',
        note: `Cita ${row.estado || ''}`.trim()
    };
}

function mapFinanceExpenseFromDb(row) {
    return {
        id: row.id,
        date: row.date,
        category: row.category || 'Otro',
        description: row.description || '',
        amount: toNumber(row.amount),
        currency: row.currency || 'CUP',
        type: row.type || 'cotidiano',
        usefulLifeMonths: toNumber(row.useful_life_months),
        depreciationNote: row.depreciation_note || ''
    };
}

function getRservasRomaMonthlyExpenseId(date = new Date()) {
    const monthKey = date.toISOString().slice(0, 7).replace('-', '_');
    return `gasto_rservasroma_${monthKey}`;
}

function buildRservasRomaMonthlyExpense(date = new Date()) {
    return {
        id: getRservasRomaMonthlyExpenseId(date),
        date: date.toISOString().slice(0, 10),
        category: 'RservasRoma',
        description: 'RservasRoma',
        amount: 1000,
        currency: 'CUP',
        type: 'fijo',
        usefulLifeMonths: 0,
        depreciationNote: ''
    };
}

async function ensureRservasRomaMonthlyExpense(business, expenseRows = []) {
    const defaultExpense = buildRservasRomaMonthlyExpense();
    const exists = (expenseRows || []).some((row) => String(row.id) === String(defaultExpense.id));

    if (exists) return expenseRows;

    try {
        await saveRomaFinanceExpense(business.id, defaultExpense);
    } catch (error) {
        console.warn('No se pudo crear el gasto fijo de RservasRoma en Supabase:', error);
    }

    return [
        {
            negocio_id: business.id,
            id: defaultExpense.id,
            date: defaultExpense.date,
            category: defaultExpense.category,
            description: defaultExpense.description,
            amount: defaultExpense.amount,
            currency: defaultExpense.currency,
            type: defaultExpense.type,
            useful_life_months: null
        },
        ...(expenseRows || [])
    ];
}

function mapFinanceSheetFromDb(row) {
    return {
        id: row.id,
        serviceId: row.service_id || '',
        serviceName: row.service_name || '',
        materialUsages: Array.isArray(row.material_usages) ? row.material_usages : [],
        extraExpenses: Array.isArray(row.extra_expenses) ? row.extra_expenses : [],
        salePrice: toNumber(row.sale_price),
        saleCurrency: row.sale_currency || 'CUP',
        totals: row.totals || {},
        createdAt: row.created_at
    };
}

function buildFinanceSeedState(business) {
    const seed = JSON.parse(JSON.stringify(INITIAL_DATA));
    seed.business = {
        ...seed.business,
        id: business.id,
        name: business.nombre || seed.business.name,
        email: business.email || '',
        logoUrl: business.logo_url || '',
        accessStatus: business.estado_finanzas || 'activo',
        financeAccess: business.acceso_finanzas !== false
    };
    seed.incomeEntries = [];
    seed.expenseEntries = [];
    seed.costSheets = [];
    return seed;
}

async function seedRomaFinanceDataIfNeeded(business, services, materials, config) {
    let seededServices = Array.isArray(services) ? services : [];
    let seededMaterials = Array.isArray(materials) ? materials : [];

    if (!Array.isArray(services) || services.length === 0) {
        const businessServicesResponse = await romaSupabase
            .from('servicios')
            .select('id,nombre,categoria,precio,duracion,activo')
            .eq('negocio_id', business.id)
            .eq('activo', true)
            .order('id', { ascending: true });

        if (businessServicesResponse.error) throw businessServicesResponse.error;

        seededServices = (businessServicesResponse.data || [])
            .map((row) => mapBusinessServiceToFinance(row, config))
            .map((service) => ({
                negocio_id: business.id,
                id: service.id,
                name: service.name,
                category: service.category,
                price: service.price,
                duration: service.duration,
                currency: service.currency,
                active: service.active !== false,
                default_materials: service.defaultMaterials || [],
                updated_at: new Date().toISOString()
            }));
    }

    if (!Array.isArray(materials) || materials.length === 0) {
        seededMaterials = [];
    }

    return { services: seededServices, materials: seededMaterials };
}

async function syncRomaFinanceServicesFromBusiness(business, currentServices = [], config = {}) {
    const businessServicesResponse = await romaSupabase
        .from('servicios')
        .select('id,nombre,categoria,precio,duracion,activo')
        .eq('negocio_id', business.id)
        .eq('activo', true)
        .order('id', { ascending: true });

    if (businessServicesResponse.error) throw businessServicesResponse.error;

    const existingById = new Map((currentServices || []).map(service => [String(service.id), service]));
    const realServices = (businessServicesResponse.data || []).map((row) => mapBusinessServiceToFinance(row, config));
    const serviceRows = realServices.map((service) => {
        const existing = existingById.get(String(service.id));
        return {
            negocio_id: business.id,
            id: service.id,
            name: service.name,
            category: service.category,
            price: service.price,
            duration: service.duration,
            currency: service.currency,
            active: service.active !== false,
            default_materials: existing?.default_materials || existing?.defaultMaterials || [],
            updated_at: new Date().toISOString()
        };
    });

    if (serviceRows.length === 0) return [];
    return serviceRows;
}

async function loadRomaFinanceData(business) {
    if (!business?.id) throw new Error('No hay negocio activo para cargar finanzas.');

    const [configResponse, servicesResponse, materialsResponse, incomeResponse, expensesResponse, sheetsResponse] = await Promise.all([
        romaSupabase.from('roma_finanzas_config').select('*').eq('negocio_id', business.id).maybeSingle(),
        romaSupabase.from('roma_finanzas_services').select('*').eq('negocio_id', business.id).order('created_at', { ascending: true }),
        romaSupabase.from('roma_finanzas_materials').select('*').eq('negocio_id', business.id).order('created_at', { ascending: true }),
        romaSupabase.from('roma_finanzas_ingresos').select('*').eq('negocio_id', business.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
        romaSupabase.from('roma_finanzas_gastos').select('*').eq('negocio_id', business.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
        romaSupabase.from('roma_finanzas_fichas_costo').select('*').eq('negocio_id', business.id).order('created_at', { ascending: false })
    ]);

    const responses = [configResponse, servicesResponse, materialsResponse, incomeResponse, expensesResponse, sheetsResponse];
    const tableError = responses.find((response) => response.error);
    if (tableError) throw tableError.error;

    const seed = buildFinanceSeedState(business);
    const config = configResponse.data ? {
        mainCurrency: configResponse.data.main_currency || 'CUP',
        desiredMargin: toNumber(configResponse.data.desired_margin) || 60,
        rates: {
            ...seed.config.rates,
            ...(configResponse.data.rates || {})
        }
    } : seed.config;

    const seeded = await seedRomaFinanceDataIfNeeded(
        business,
        servicesResponse.data,
        materialsResponse.data,
        config
    );

    const syncedServiceRows = await syncRomaFinanceServicesFromBusiness(
        business,
        seeded.services || servicesResponse.data || [],
        config
    );

    const financeServices = (syncedServiceRows || []).length > 0
        ? syncedServiceRows.map(mapFinanceServiceFromDb)
        : seed.services;
    const bookingIncomeResponse = await romaSupabase
        .from('reservas')
        .select('id,fecha,cliente_nombre,servicio,estado,monto_cobrado,precio_final,precio_original')
        .eq('negocio_id', business.id)
        .eq('estado', 'Completado')
        .order('fecha', { ascending: false })
        .limit(500);

    if (bookingIncomeResponse.error) throw bookingIncomeResponse.error;

    const bookingIncomeEntries = (bookingIncomeResponse.data || [])
        .map((booking) => mapBookingToFinanceIncome(booking, financeServices, config))
        .filter((entry) => entry.amount > 0);
    const manualIncomeEntries = (incomeResponse.data || []).map(mapFinanceIncomeFromDb);
    const incomeById = new Map();
    [...bookingIncomeEntries, ...manualIncomeEntries].forEach((entry) => {
        incomeById.set(String(entry.id), entry);
    });

    const expensesWithRservasRoma = await ensureRservasRomaMonthlyExpense(business, expensesResponse.data || []);

    return {
        ...seed,
        config,
        services: financeServices,
        materials: (seeded.materials || materialsResponse.data || []).length > 0
            ? (seeded.materials || materialsResponse.data || []).map(mapFinanceMaterialFromDb)
            : seed.materials,
        incomeEntries: Array.from(incomeById.values()),
        expenseEntries: expensesWithRservasRoma.map(mapFinanceExpenseFromDb),
        costSheets: (sheetsResponse.data || []).map(mapFinanceSheetFromDb)
    };
}

async function saveRomaFinanceConfig(negocioId, config) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const { error } = await romaSupabase.from('roma_finanzas_config').upsert({
        negocio_id: negocioId,
        main_currency: config.mainCurrency || 'CUP',
        desired_margin: toNumber(config.desiredMargin) || 60,
        rates: config.rates || {},
        updated_at: new Date().toISOString()
    }, { onConflict: 'negocio_id' });
    if (error) throw error;
}

async function saveRomaFinanceIncome(negocioId, entry) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const { error } = await romaSupabase.from('roma_finanzas_ingresos').upsert({
        negocio_id: negocioId,
        id: entry.id,
        date: entry.date || getTodayKey(),
        service_id: entry.serviceId || null,
        client: entry.client || null,
        amount: toNumber(entry.amount),
        currency: entry.currency || 'CUP',
        payment_method: entry.paymentMethod || null,
        note: entry.note || null
    }, { onConflict: 'negocio_id,id' });
    if (error) throw error;
}

async function saveRomaFinanceExpense(negocioId, entry) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const { error } = await romaSupabase.from('roma_finanzas_gastos').upsert({
        negocio_id: negocioId,
        id: entry.id,
        date: entry.date || getTodayKey(),
        category: entry.category || null,
        description: entry.description || null,
        amount: toNumber(entry.amount),
        currency: entry.currency || 'CUP',
        type: entry.type || 'cotidiano',
        useful_life_months: entry.type === 'herramienta' ? Math.max(toNumber(entry.usefulLifeMonths), 1) : null
    }, { onConflict: 'negocio_id,id' });
    if (error) throw error;
}

async function deleteRomaFinanceExpense(negocioId, id) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const { error } = await romaSupabase
        .from('roma_finanzas_gastos')
        .delete()
        .eq('negocio_id', negocioId)
        .eq('id', id);
    if (error) throw error;
}

async function saveRomaFinanceMaterial(negocioId, material) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const uses = Math.max(toNumber(material.uses), 1);
    const cost = toNumber(material.cost);
    const { error } = await romaSupabase.from('roma_finanzas_materials').upsert({
        negocio_id: negocioId,
        id: material.id,
        name: material.name || 'Material',
        cost,
        currency: material.currency || 'CUP',
        uses,
        cost_per_use: cost / uses,
        unit: material.unit || 'uso',
        stock: toNumber(material.stock),
        updated_at: new Date().toISOString()
    }, { onConflict: 'negocio_id,id' });
    if (error) throw error;
}

async function saveRomaFinanceCostSheet(negocioId, sheet) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const { error } = await romaSupabase.from('roma_finanzas_fichas_costo').upsert({
        negocio_id: negocioId,
        id: sheet.id,
        service_id: sheet.serviceId || null,
        service_name: sheet.serviceName || null,
        material_usages: sheet.materialUsages || [],
        extra_expenses: sheet.extraExpenses || [],
        sale_price: toNumber(sheet.salePrice),
        sale_currency: sheet.saleCurrency || 'CUP',
        totals: sheet.totals || {},
        created_at: sheet.createdAt || new Date().toISOString()
    }, { onConflict: 'negocio_id,id' });
    if (error) throw error;
}

async function deleteRomaFinanceCostSheet(negocioId, id) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const { error } = await romaSupabase
        .from('roma_finanzas_fichas_costo')
        .delete()
        .eq('negocio_id', negocioId)
        .eq('id', id);
    if (error) throw error;
}
