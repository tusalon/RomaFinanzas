const ROMA_SUPABASE_URL = window.ROMA_CONFIG?.supabaseUrl || '';
const ROMA_SUPABASE_ANON_KEY = window.ROMA_CONFIG?.supabaseAnonKey || '';
const ROMA_BACKEND_MODE = window.ROMA_CONFIG?.backendMode || 'standalone-auth';
const ROMA_SUPABASE_CONFIGURED = window.ROMA_CONFIG?.supabaseConfigured !== false;
const ROMA_USES_SUPABASE_AUTH = ROMA_BACKEND_MODE === 'standalone-auth';
const ROMA_USES_RSERVASROMA_IDENTITY = ROMA_BACKEND_MODE === 'federated-rservasroma';
const ROMA_USES_SERVER_INCOME_RPC = ROMA_USES_SUPABASE_AUTH || ROMA_USES_RSERVASROMA_IDENTITY;
const ROMA_PROJECT_REF = (() => {
    try {
        return new URL(ROMA_SUPABASE_URL).hostname.split('.')[0] || 'sin-proyecto';
    } catch (error) {
        return 'sin-proyecto';
    }
})();
const ROMA_LEGACY_SESSION_KEY = 'roma_finanzas_auth_v1';
const ROMA_SESSION_KEY = `roma_finanzas_auth_v2_${ROMA_PROJECT_REF}_${ROMA_BACKEND_MODE}`;
const ROMA_SESSION_HOURS = 12;

const romaSupabase = window.supabase.createClient(ROMA_SUPABASE_URL, ROMA_SUPABASE_ANON_KEY, {
    auth: {
        persistSession: ROMA_USES_SUPABASE_AUTH,
        autoRefreshToken: ROMA_USES_SUPABASE_AUTH,
        detectSessionInUrl: false
    }
});

const ROMA_FINANZAS_DENIED_STATES = ['sin_acceso', 'vencido', 'bloqueado'];

async function loginRomaFinanzasWithRpc(username, password) {
    const { data, error } = await romaSupabase.rpc('login_roma_finanzas', {
        p_username: username,
        p_password: password
    });

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.business) return null;

    const business = sanitizeBusinessForSession(result.business);
    const token = result.token || '';
    const expiresAt = result.expires_at || '';

    return {
        session: saveRomaSession(business, token, expiresAt),
        user: { username, email: business.email || '', businessId: business.id },
        business
    };
}

async function loginRomaFinanzasWithRservasRoma(slug, password) {
    if (!ROMA_SUPABASE_CONFIGURED) {
        throw new Error('Falta conectar el proyecto FinanzasRoma en .env.local.');
    }

    const endpoint = `${ROMA_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/rservasroma-login`;
    let response;

    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                apikey: ROMA_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${ROMA_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ slug, password })
        });
    } catch (error) {
        throw new Error('No pudimos conectar con RservasRoma. Revisa tu internet e intentalo otra vez.');
    }

    let result = {};
    try {
        result = await response.json();
    } catch (error) {
        result = {};
    }

    if (!response.ok) {
        throw new Error(result.error || 'Slug o contrasena incorrectos.');
    }
    if (!result?.business || !result?.token) {
        throw new Error('RservasRoma valido el acceso, pero no se pudo abrir Roma Finanzas.');
    }

    const business = sanitizeBusinessForSession(result.business);
    return {
        session: saveRomaSession(business, result.token, result.expires_at || ''),
        user: {
            username: business.slug || slug,
            email: business.email || '',
            businessId: business.id
        },
        business
    };
}

async function startRomaFinanzasAuthSession(authUser) {
    const { data, error } = await romaSupabase.rpc('start_roma_finanzas_auth_session');
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.business || !result?.token) {
        throw new Error('Tu usuario no está vinculado a un negocio de Roma Finanzas.');
    }

    const business = sanitizeBusinessForSession(result.business);
    return {
        session: saveRomaSession(business, result.token, result.expires_at || ''),
        user: {
            username: authUser?.email || business.slug || '',
            email: authUser?.email || business.email || '',
            businessId: business.id
        },
        business
    };
}

function friendlySupabaseAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (message.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.';
    if (message.includes('user not found')) return 'No existe una cuenta con ese correo.';
    if (message.includes('failed to fetch') || message.includes('network')) {
        return 'No pudimos conectar con Roma Finanzas. Revisa tu internet e inténtalo otra vez.';
    }
    return error?.message || 'No se pudo entrar.';
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

function saveRomaSession(business, token = '', expiresAt = '') {
    const session = {
        backendMode: ROMA_BACKEND_MODE,
        projectRef: ROMA_PROJECT_REF,
        businessId: business.id,
        slug: business.slug,
        business: sanitizeBusinessForSession(business),
        token,
        expiresAt,
        loginTime: Date.now()
    };
    window.localStorage.removeItem(ROMA_LEGACY_SESSION_KEY);
    window.localStorage.setItem(ROMA_SESSION_KEY, JSON.stringify(session));
    // Sesion nueva: se rearma el cortafuegos y se borra el freno de espera.
    sesionFinanzasRechazada = false;
    limpiarFreno();
    return session;
}

function readRomaSession() {
    try {
        window.localStorage.removeItem(ROMA_LEGACY_SESSION_KEY);
        const raw = window.localStorage.getItem(ROMA_SESSION_KEY);
        if (!raw) return null;

        const session = JSON.parse(raw);
        if (session.backendMode !== ROMA_BACKEND_MODE || session.projectRef !== ROMA_PROJECT_REF) {
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            return null;
        }
        const maxAge = ROMA_SESSION_HOURS * 60 * 60 * 1000;
        const tokenExpired = session.expiresAt
            && new Date(session.expiresAt).getTime() <= Date.now();
        if (!session.loginTime || Date.now() - Number(session.loginTime) > maxAge || tokenExpired) {
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            return null;
        }

        return session;
    } catch (error) {
        window.localStorage.removeItem(ROMA_SESSION_KEY);
        return null;
    }
}

async function loadRservasRomaBusinessData(token) {
    const endpoint = `${ROMA_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/rservasroma-login`;
    let response;

    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                apikey: ROMA_SUPABASE_ANON_KEY,
                Authorization: `Bearer ${ROMA_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'load-business-data', token })
        });
    } catch (error) {
        throw new Error('No pudimos conectar con los datos de RservasRoma.');
    }

    let result = {};
    try {
        result = await response.json();
    } catch (error) {
        result = {};
    }

    if (!response.ok) {
        throw new Error(result.error || 'No pudimos cargar los datos de RservasRoma.');
    }

    return {
        catalogServices: result.catalog_services || [],
        completedBookings: result.completed_bookings || []
    };
}

function normalizeRservasRomaSlug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s*-\s*/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

async function loginRomaFinanzas(username, password) {
    const cleanUsername = ROMA_USES_RSERVASROMA_IDENTITY
        ? normalizeRservasRomaSlug(username)
        : String(username || '').trim().toLowerCase();
    const cleanPassword = ROMA_USES_RSERVASROMA_IDENTITY
        ? String(password || '').trim()
        : String(password || '');

    if (!cleanUsername || !cleanPassword) {
        throw new Error(ROMA_USES_SUPABASE_AUTH
            ? 'Escribe tu correo y contraseña.'
            : 'Escribe tu usuario y contraseña.');
    }

    if (ROMA_USES_RSERVASROMA_IDENTITY) {
        return loginRomaFinanzasWithRservasRoma(cleanUsername, cleanPassword);
    }

    if (ROMA_USES_SUPABASE_AUTH) {
        if (!ROMA_SUPABASE_CONFIGURED) {
            throw new Error('Falta conectar el proyecto nuevo de Supabase en .env.local.');
        }

        const { data, error } = await romaSupabase.auth.signInWithPassword({
            email: cleanUsername,
            password: cleanPassword
        });
        if (error) throw new Error(friendlySupabaseAuthError(error));

        try {
            return await startRomaFinanzasAuthSession(data.user);
        } catch (sessionError) {
            await romaSupabase.auth.signOut({ scope: 'local' });
            throw new Error(friendlySupabaseAuthError(sessionError));
        }
    }

    try {
        const rpcResult = await loginRomaFinanzasWithRpc(cleanUsername, cleanPassword);
        if (rpcResult) return rpcResult;
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const isMissingRpc = error?.code === '42883'
            || error?.code === 'PGRST202'
            || message.includes('function')
            || message.includes('schema cache');

        if (!isMissingRpc) throw error;
        throw new Error('Roma Finanzas necesita aplicar la migración segura de Supabase antes de iniciar sesión.');
    }
}

async function getRomaAuthSession() {
    let session = readRomaSession();

    if (ROMA_USES_SUPABASE_AUTH) {
        if (!ROMA_SUPABASE_CONFIGURED) {
            return { session: null, user: null, business: null };
        }

        const { data, error } = await romaSupabase.auth.getSession();
        if (error) throw error;
        const authSession = data?.session || null;

        if (!authSession) {
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            return { session: null, user: null, business: null };
        }

        try {
            let business = null;
            if (session?.token) {
                const resume = await romaSupabase.rpc('resume_roma_finanzas_session', {
                    p_token: session.token
                });
                if (resume.error) throw resume.error;
                const result = Array.isArray(resume.data) ? resume.data[0] : resume.data;
                business = result?.business || null;
            }

            if (!business) {
                return startRomaFinanzasAuthSession(authSession.user);
            }

            session = saveRomaSession(business, session.token, session.expiresAt || '');
            return {
                session,
                user: {
                    username: authSession.user?.email || business.slug || '',
                    email: authSession.user?.email || business.email || '',
                    businessId: business.id
                },
                business: sanitizeBusinessForSession(business)
            };
        } catch (sessionError) {
            if (navigator.onLine === false && session?.business) {
                return {
                    session,
                    user: {
                        username: authSession.user?.email || session.business.slug || '',
                        email: authSession.user?.email || session.business.email || '',
                        businessId: session.businessId
                    },
                    business: session.business
                };
            }
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            throw sessionError;
        }
    }

    if (!session) {
        return { session: null, user: null, business: null };
    }

    try {
        let business = null;

        if (session.token) {
            const { data, error } = await romaSupabase.rpc('resume_roma_finanzas_session', {
                p_token: session.token
            });
            if (error) throw error;
            const result = Array.isArray(data) ? data[0] : data;
            business = result?.business || null;
        } else if (navigator.onLine === false && session.business) {
            business = session.business;
        } else {
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            return { session: null, user: null, business: null };
        }
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
        const message = String(error?.message || '').toLowerCase();
        const accessWasRejected = error?.code === '28000'
            || message.includes('sesion vencio')
            || message.includes('sesión venció')
            || message.includes('no tiene acceso activo')
            || message.includes('sesion invalida')
            || message.includes('sesión inválida');

        if (accessWasRejected) {
            window.localStorage.removeItem(ROMA_SESSION_KEY);
            return { session: null, user: null, business: null };
        }

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
    const session = readRomaSession();
    if (session?.token && navigator.onLine !== false) {
        try {
            await romaSupabase.rpc('logout_roma_finanzas', { p_token: session.token });
        } catch (error) {
            console.warn('No se pudo cerrar la sesión remota:', error);
        }
    }
    window.localStorage.removeItem(ROMA_SESSION_KEY);
    if (ROMA_USES_SUPABASE_AUTH) {
        try {
            await romaSupabase.auth.signOut();
        } catch (error) {
            console.warn('No se pudo cerrar la sesión de Supabase:', error);
        }
    }
}

// Cortafuegos de sesion rechazada.
//
// El token de Finanzas dura 12 h. Cuando vence, session_business_id() lanza una
// excepcion y la transaccion se aborta sin tocar ninguna tabla. Repetir la
// llamada no lo arregla: el servidor la va a rechazar igual. Clientes ya
// desplegados (sobre todo APK, que no se actualizan solas) se quedaron
// reintentando sin fin: el 17/08/2026 se midieron 107 millones de
// transacciones abortadas, 2.556 por cada una que funcionaba, y tumbaron la
// base entera.
//
// En cuanto el servidor dice que la sesion no vale, se corta aqui: se borra la
// sesion y no se vuelve a llamar en lo que dura la pagina. Como todas las
// funciones con token salen por getRomaSessionToken() y ya devuelven sin
// llamar cuando no hay token, esto detiene CUALQUIER bucle, este donde este.
let sesionFinanzasRechazada = false;

// El freno vive en localStorage y NO en memoria: la version anterior se
// reiniciaba en cada carga de pagina, asi que cerrar y abrir la app rearmaba el
// bucle. Ahora sobrevive a recargas, cierres y reinicios del telefono.
const ROMA_FRENO_KEY = `${ROMA_SESSION_KEY}_freno`;

// Esperas tras 3 fallos seguidos. Un corte de internet se sigue reintentando
// -- eso si tiene arreglo solo -- pero nunca a mil llamadas por segundo.
const ROMA_FRENO_ESPERAS_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
const ROMA_FRENO_FALLOS_ANTES_DE_ESPERAR = 3;

function leerFreno() {
    try {
        return JSON.parse(window.localStorage.getItem(ROMA_FRENO_KEY) || '{}') || {};
    } catch (error) {
        return {};
    }
}

function guardarFreno(freno) {
    try {
        window.localStorage.setItem(ROMA_FRENO_KEY, JSON.stringify(freno));
    } catch (error) {
        console.warn('No se pudo guardar el freno de llamadas:', error);
    }
}

function limpiarFreno() {
    try {
        window.localStorage.removeItem(ROMA_FRENO_KEY);
    } catch (error) {
        console.warn('No se pudo limpiar el freno de llamadas:', error);
    }
}

function esSesionRechazada(error) {
    const mensaje = String(error?.message || '').toLowerCase();
    return error?.code === '28000'
        || mensaje.includes('sesion vencio')
        || mensaje.includes('sesión venció')
        || mensaje.includes('sesion invalida')
        || mensaje.includes('sesión inválida')
        || mensaje.includes('no tiene acceso activo');
}

// El servidor dejo de lanzar excepciones para las sesiones muertas: ahora
// responde 200 con {ok:false, motivo:...} para no abortar transacciones (ver
// supabase/blindaje-01-servidor.sql). Hay que leerlo como sesion rechazada,
// no como exito, o el cliente daria por guardado algo que no se guardo.
const ROMA_MOTIVOS_SESION_MUERTA = ['sesion_invalida', 'sesion_vencida', 'sin_acceso'];

// Lo que ve la duena. "Sesion invalida" no le dice nada; "vuelve a entrar" si.
function mensajeDeMotivo(motivo) {
    if (motivo === 'sin_acceso') return 'Tu negocio no tiene Roma Finanzas activo. Escríbenos para activarlo.';
    if (motivo === 'demasiadas_llamadas') return 'La app está haciendo demasiadas peticiones. Espera un minuto y vuelve a intentarlo.';
    return 'Tu sesión venció. Entra de nuevo.';
}

function motivoDeRespuesta(data) {
    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila || typeof fila !== 'object') return '';
    if (fila.ok !== false) return '';
    return String(fila.motivo || 'desconocido');
}

function marcarSesionFinanzasRechazada() {
    sesionFinanzasRechazada = true;
    guardarFreno({ muerta: true, desde: Date.now() });
    try {
        window.localStorage.removeItem(ROMA_SESSION_KEY);
    } catch (error) {
        console.warn('No se pudo borrar la sesión rechazada:', error);
    }
}

// Cualquier fallo repetido frena, no solo el 28000. Ese fue el agujero de la
// version anterior: con el pool saturado el servidor responde 504 o nada, el
// cortafuegos no se armaba, los clientes reintentaban y el sistema no podia
// salir del bucle por si mismo.
function registrarFalloFinanzas(error) {
    if (esSesionRechazada(error)) {
        marcarSesionFinanzasRechazada();
        return;
    }

    const freno = leerFreno();
    const fallos = (Number(freno.fallos) || 0) + 1;
    if (fallos < ROMA_FRENO_FALLOS_ANTES_DE_ESPERAR) {
        guardarFreno({ ...freno, fallos });
        return;
    }

    const paso = Math.min(
        fallos - ROMA_FRENO_FALLOS_ANTES_DE_ESPERAR,
        ROMA_FRENO_ESPERAS_MS.length - 1
    );
    guardarFreno({ ...freno, fallos, hasta: Date.now() + ROMA_FRENO_ESPERAS_MS[paso] });
}

function registrarExitoFinanzas() {
    const freno = leerFreno();
    if (freno.fallos || freno.hasta) limpiarFreno();
}

// Devuelve '' mientras el freno esta puesto. Como TODAS las funciones con token
// salen por aqui y ya devuelven sin llamar cuando no hay token, esto detiene
// cualquier bucle, este donde este.
function getRomaSessionToken() {
    if (sesionFinanzasRechazada) return '';

    const freno = leerFreno();
    if (freno.muerta) return '';
    if (freno.hasta && Date.now() < Number(freno.hasta)) return '';

    return readRomaSession()?.token || '';
}

async function applyRomaFinanceChange(operation, payload) {
    const token = getRomaSessionToken();
    if (!token) return null;

    // El nombre lleva _v2 a proposito. El 17/08/2026 clientes ya desplegados
    // se quedaron llamando a apply_roma_finanzas_change en bucle con un token
    // muerto: 1.429 transacciones abortadas por segundo tumbaron la base de
    // RservasRoma entera y la API empezo a devolver 504. Al renombrar la
    // funcion, esas versiones viejas reciben un 404 que PostgREST responde de
    // su cache en memoria, sin abrir transaccion: pueden seguir insistiendo
    // sin costarle nada al servidor. NO recrear el nombre viejo.
    const { data, error } = await romaSupabase.rpc('apply_roma_finanzas_change_v3', {
        p_token: token,
        p_operation: operation,
        p_payload: payload || {}
    });
    if (error) {
        registrarFalloFinanzas(error);
        throw error;
    }

    const motivo = motivoDeRespuesta(data);
    if (motivo) {
        if (ROMA_MOTIVOS_SESION_MUERTA.includes(motivo)) marcarSesionFinanzasRechazada();
        else registrarFalloFinanzas({ message: motivo });
        throw new Error(mensajeDeMotivo(motivo));
    }

    registrarExitoFinanzas();
    return Array.isArray(data) ? data[0] : data;
}

async function saveRomaFinanceIncomeWithTip(payload) {
    const token = getRomaSessionToken();
    if (!token) return null;

    if (!ROMA_USES_SERVER_INCOME_RPC) {
        return applyRomaFinanceChange('save_income', payload);
    }

    const { data, error } = await romaSupabase.rpc('save_roma_finanzas_income', {
        p_token: token,
        p_payload: payload || {}
    });
    if (error) {
        registrarFalloFinanzas(error);
        throw error;
    }

    const motivo = motivoDeRespuesta(data);
    if (motivo) {
        if (ROMA_MOTIVOS_SESION_MUERTA.includes(motivo)) marcarSesionFinanzasRechazada();
        else registrarFalloFinanzas({ message: motivo });
        throw new Error(mensajeDeMotivo(motivo));
    }

    registrarExitoFinanzas();
    return Array.isArray(data) ? data[0] : data;
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
        defaultMaterials: Array.isArray(row.default_materials) ? row.default_materials : [],
        source: row.source || 'manual',
        sourceServiceId: row.source_service_id || '',
        version: toNumber(row.version) || 1,
        updatedAt: row.updated_at || ''
    };
}

function mapBusinessServiceToFinance(row, config = {}) {
    const mainCurrency = config.mainCurrency || 'CUP';

    return {
        id: `servicio_${row.id}`,
        name: row.nombre || 'Servicio',
        category: row.categoria || 'General',
        price: toNumber(row.precio),
        duration: toNumber(row.duracion) || 60,
        currency: SUPPORTED_CURRENCIES.includes(row.precio_moneda) ? row.precio_moneda : mainCurrency,
        active: row.activo !== false,
        defaultMaterials: [],
        source: 'rservasroma',
        sourceServiceId: String(row.id)
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
        stock: toNumber(row.stock),
        purchaseRateToMain: row.purchase_rate_to_main == null ? null : toNumber(row.purchase_rate_to_main),
        purchaseCostMain: row.purchase_cost_main == null ? null : toNumber(row.purchase_cost_main),
        lowStockThreshold: row.low_stock_threshold == null ? null : toNumber(row.low_stock_threshold),
        version: toNumber(row.version) || 1,
        updatedAt: row.updated_at || ''
    };
}

function mapFinanceIncomeFromDb(row) {
    const hasMoneySnapshot = toNumber(row.amount_main) > 0 || toNumber(row.amount) === 0;
    return {
        id: row.id,
        date: row.date,
        serviceId: row.service_id || '',
        client: row.client || '',
        amount: toNumber(row.amount),
        currency: row.currency || 'CUP',
        rateToMain: hasMoneySnapshot ? (toNumber(row.rate_to_main) || 1) : 0,
        amountMain: toNumber(row.amount_main),
        tipAmount: toNumber(row.tip_amount),
        tipCurrency: row.tip_currency || row.currency || 'CUP',
        tipRateToMain: toNumber(row.tip_rate_to_main),
        tipAmountMain: toNumber(row.tip_amount_main),
        unitCostMain: toNumber(row.unit_cost_main),
        profitMain: toNumber(row.profit_main),
        margin: toNumber(row.margin),
        costSheetId: row.cost_sheet_id || '',
        paymentMethod: row.payment_method || 'Efectivo',
        note: row.note || '',
        source: row.source || 'manual',
        bookingId: row.booking_id || '',
        version: toNumber(row.version) || 1,
        updatedAt: row.updated_at || ''
    };
}

// normalizeFinanceText ahora vive en utils/finance.js (utilidad pura, sin
// dependencias de Supabase) para que tests/audit puedan requerirla en Node.

function mapBookingToFinanceIncome(row, services = [], config = {}) {
    const serviceName = String(row.servicio || '').trim();
    const matchedService = (services || []).find((service) => normalizeFinanceText(service.name) === normalizeFinanceText(serviceName));
    const bookingAmount = toNumber(row.monto_cobrado) || toNumber(row.precio_final) || toNumber(row.precio_original);
    const currency = matchedService?.currency || config.mainCurrency || 'CUP';
    const amount = bookingAmount > 0 ? bookingAmount : toNumber(matchedService?.price);

    return {
        id: `reserva_${row.id}`,
        date: row.fecha || getTodayKey(),
        serviceId: matchedService?.id || '',
        client: row.cliente_nombre || '',
        amount,
        currency,
        rateToMain: 0,
        amountMain: 0,
        tipAmount: 0,
        tipCurrency: currency,
        tipRateToMain: 0,
        tipAmountMain: 0,
        unitCostMain: 0,
        profitMain: 0,
        margin: 0,
        paymentMethod: row.monto_cobrado ? 'Cobro real' : 'Reserva completada',
        note: `Cita ${row.estado || ''}`.trim(),
        source: 'reserva',
        bookingId: String(row.id)
    };
}

function mapFinanceExpenseFromDb(row) {
    const normalizedAmount = toNumber(row.amount);
    const hasMoneySnapshot = toNumber(row.amount_main) > 0 || normalizedAmount === 0;

    return {
        id: row.id,
        date: row.date,
        category: row.category || 'Otro',
        description: row.description || '',
        amount: normalizedAmount,
        currency: row.currency || 'CUP',
        rateToMain: hasMoneySnapshot ? (toNumber(row.rate_to_main) || 1) : 0,
        amountMain: toNumber(row.amount_main),
        type: row.type || 'cotidiano',
        usefulLifeMonths: toNumber(row.useful_life_months),
        depreciationNote: row.depreciation_note || '',
        recurringKey: row.recurring_key || '',
        version: toNumber(row.version) || 1,
        updatedAt: row.updated_at || ''
    };
}

function mapFinanceSheetFromDb(row) {
    return {
        id: row.id,
        serviceId: row.service_id || '',
        serviceName: row.service_name || '',
        materialUsages: Array.isArray(row.material_usages) ? row.material_usages : [],
        extraExpenses: Array.isArray(row.extra_expenses) ? row.extra_expenses : [],
        fixedCostUsages: Array.isArray(row.fixed_cost_usages) ? row.fixed_cost_usages : [],
        salePrice: toNumber(row.sale_price),
        saleCurrency: row.sale_currency || 'CUP',
        rateToMain: row.rate_to_main == null ? null : toNumber(row.rate_to_main),
        totals: row.totals || {},
        effectiveFrom: row.effective_from || (row.created_at || '').slice(0, 10),
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        version: toNumber(row.version) || 1
    };
}

function mapInventoryMovementFromDb(row) {
    return {
        id: row.id,
        materialId: row.material_id,
        date: row.date,
        movementType: row.movement_type,
        quantity: toNumber(row.quantity),
        note: row.note || '',
        sourceIncomeId: row.source_income_id || '',
        version: toNumber(row.version) || 1,
        updatedAt: row.updated_at || ''
    };
}

function getApplicableCostSheet(serviceId, date, costSheets = []) {
    const dateKey = date || getTodayKey();
    return (costSheets || [])
        .filter((sheet) => String(sheet.serviceId) === String(serviceId))
        .filter((sheet) => (sheet.effectiveFrom || (sheet.createdAt || '').slice(0, 10) || dateKey) <= dateKey)
        .sort((a, b) => String(b.effectiveFrom || b.createdAt || '').localeCompare(String(a.effectiveFrom || a.createdAt || '')))[0] || null;
}

function buildIncomeFinancialSnapshot(entry, costSheets, config) {
    const money = createMoneySnapshot(entry.amount, entry.currency, config);
    const tipMoney = createMoneySnapshot(
        Math.max(toNumber(entry.tipAmount), 0),
        entry.tipCurrency || entry.currency,
        config
    );
    const sheet = getApplicableCostSheet(entry.serviceId, entry.date, costSheets);
    const unitCostMain = sheet ? toNumber(sheet.totals?.totalCostMain) : 0;
    const profitMain = money.amountMain - unitCostMain;
    const margin = money.amountMain > 0 ? (profitMain / money.amountMain) * 100 : 0;

    return {
        ...entry,
        rateToMain: money.rateToMain,
        amountMain: money.amountMain,
        tipAmount: tipMoney.amount,
        tipCurrency: tipMoney.currency,
        tipRateToMain: tipMoney.rateToMain,
        tipAmountMain: tipMoney.amountMain,
        unitCostMain,
        profitMain,
        margin,
        costSheetId: sheet?.id || ''
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

async function syncRomaFinanceServicesFromBusiness(business, currentServices = [], config = {}, catalogRows = null) {
    const businessServicesResponse = Array.isArray(catalogRows)
        ? { data: catalogRows, error: null }
        : await romaSupabase
            .from('servicios')
            .select('id,nombre,categoria,precio,duracion,activo')
            .eq('negocio_id', business.id)
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
            price: existing ? toNumber(existing.price) : service.price,
            duration: service.duration,
            currency: existing?.currency || service.currency,
            active: service.active !== false,
            default_materials: existing?.default_materials || existing?.defaultMaterials || [],
            source: 'rservasroma',
            source_service_id: service.sourceServiceId || String(service.id).replace(/^servicio_/, ''),
            updated_at: new Date().toISOString()
        };
    });

    const importedIds = new Set(serviceRows.map((service) => String(service.id)));
    const ownFinanceRows = (currentServices || [])
        .filter((service) => service?.id && !importedIds.has(String(service.id)) && (service.source || 'manual') !== 'rservasroma')
        .map((service) => ({
            negocio_id: business.id,
            id: service.id,
            name: service.name || 'Servicio',
            category: service.category || 'General',
            price: toNumber(service.price),
            duration: Math.max(toNumber(service.duration), 1),
            currency: service.currency || config.mainCurrency || 'CUP',
            active: service.active !== false,
            default_materials: service.default_materials || service.defaultMaterials || [],
            source: service.source || 'manual',
            source_service_id: service.source_service_id || service.sourceServiceId || null,
            updated_at: service.updated_at || new Date().toISOString()
        }));

    return [...serviceRows, ...ownFinanceRows];
}

async function loadRomaFinanceData(business) {
    if (!business?.id) throw new Error('No hay negocio activo para cargar finanzas.');

    const token = getRomaSessionToken();
    let catalogServices = null;
    let completedBookings = null;
    let inventoryRows = [];
    let configResponse;
    let servicesResponse;
    let materialsResponse;
    let incomeResponse;
    let expensesResponse;
    let sheetsResponse;

    if (token) {
        const { data, error } = await romaSupabase.rpc('load_roma_finanzas', { p_token: token });
        if (error) {
            registrarFalloFinanzas(error);
            throw error;
        }
        const motivoCarga = motivoDeRespuesta(data);
        if (motivoCarga) {
            if (ROMA_MOTIVOS_SESION_MUERTA.includes(motivoCarga)) marcarSesionFinanzasRechazada();
            else registrarFalloFinanzas({ message: motivoCarga });
            throw new Error(mensajeDeMotivo(motivoCarga));
        }
        registrarExitoFinanzas();
        const bundle = Array.isArray(data) ? data[0] : (data || {});
        configResponse = { data: Object.keys(bundle.config || {}).length ? bundle.config : null, error: null };
        servicesResponse = { data: bundle.services || [], error: null };
        materialsResponse = { data: bundle.materials || [], error: null };
        incomeResponse = { data: bundle.income_entries || [], error: null };
        expensesResponse = { data: bundle.expense_entries || [], error: null };
        sheetsResponse = { data: bundle.cost_sheets || [], error: null };
        inventoryRows = bundle.inventory_movements || [];
        catalogServices = bundle.catalog_services || [];
        completedBookings = bundle.completed_bookings || [];

        if (ROMA_USES_RSERVASROMA_IDENTITY) {
            const sourceData = await loadRservasRomaBusinessData(token);
            catalogServices = sourceData.catalogServices;
            completedBookings = sourceData.completedBookings;
        }
    } else {
        [configResponse, servicesResponse, materialsResponse, incomeResponse, expensesResponse, sheetsResponse] = await Promise.all([
            romaSupabase.from('roma_finanzas_config').select('*').eq('negocio_id', business.id).maybeSingle(),
            romaSupabase.from('roma_finanzas_services').select('*').eq('negocio_id', business.id).order('created_at', { ascending: true }),
            romaSupabase.from('roma_finanzas_materials').select('*').eq('negocio_id', business.id).order('created_at', { ascending: true }),
            romaSupabase.from('roma_finanzas_ingresos').select('*').eq('negocio_id', business.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
            romaSupabase.from('roma_finanzas_gastos').select('*').eq('negocio_id', business.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
            romaSupabase.from('roma_finanzas_fichas_costo').select('*').eq('negocio_id', business.id).order('created_at', { ascending: false })
        ]);
    }

    const responses = [configResponse, servicesResponse, materialsResponse, incomeResponse, expensesResponse, sheetsResponse];
    const tableError = responses.find((response) => response.error);
    if (tableError) throw tableError.error;

    const seed = buildFinanceSeedState(business);
    const config = configResponse.data ? {
        mainCurrency: configResponse.data.main_currency || 'CUP',
        desiredMargin: toNumber(configResponse.data.desired_margin) || 60,
        ratesUpdatedAt: configResponse.data.rates_updated_at || '',
        version: toNumber(configResponse.data.version) || 1,
        rates: {
            ...seed.config.rates,
            ...(configResponse.data.rates || {})
        }
    } : seed.config;

    const syncedServiceRows = await syncRomaFinanceServicesFromBusiness(
        business,
        servicesResponse.data || [],
        config,
        catalogServices
    );

    const financeServices = (syncedServiceRows || []).map(mapFinanceServiceFromDb);
    const mappedCostSheets = (sheetsResponse.data || []).map(mapFinanceSheetFromDb);
    const bookingIncomeResponse = Array.isArray(completedBookings)
        ? { data: completedBookings, error: null }
        : await romaSupabase
            .from('reservas')
            .select('id,fecha,cliente_nombre,servicio,estado,monto_cobrado,precio_final,precio_original')
            .eq('negocio_id', business.id)
            .eq('estado', 'Completado')
            .order('fecha', { ascending: false })
            .limit(2000);

    if (bookingIncomeResponse.error) throw bookingIncomeResponse.error;

    const bookingIncomeEntries = (bookingIncomeResponse.data || [])
        .map((booking) => mapBookingToFinanceIncome(booking, financeServices, config))
        .filter((entry) => entry.amount > 0)
        .map((entry) => {
            try {
                return buildIncomeFinancialSnapshot(entry, mappedCostSheets, config);
            } catch (error) {
                return entry;
            }
        });
    const manualIncomeEntries = (incomeResponse.data || []).map(mapFinanceIncomeFromDb);
    const persistedBookingIds = new Set(manualIncomeEntries.map((entry) => String(entry.bookingId || '')).filter(Boolean));
    const newBookingEntries = bookingIncomeEntries.filter((entry) => !persistedBookingIds.has(String(entry.bookingId || '')));

    if (token && navigator.onLine !== false && validateFinanceConfig(config).length === 0) {
        // No se espera aqui: guardar cada cita es un viaje de red aparte, y un
        // salon con muchas citas nuevas puede tener decenas pendientes. Estas
        // citas ya se ven en pantalla (entran mezcladas en incomeById mas
        // abajo desde bookingIncomeEntries); esto solo las deja guardadas en
        // el servidor en segundo plano, sin bloquear el login.
        (async () => {
            for (const entry of newBookingEntries.slice(0, 200)) {
                try {
                    await saveRomaFinanceIncome(business.id, entry);
                } catch (error) {
                    console.warn('No se pudo guardar la fotografía financiera de una cita:', error);
                    break;
                }
            }
        })();
    }

    const incomeById = new Map();
    [...bookingIncomeEntries, ...manualIncomeEntries].forEach((entry) => {
        incomeById.set(String(entry.id), entry);
    });

    return {
        ...seed,
        config,
        services: financeServices,
        materials: (materialsResponse.data || []).length > 0
            ? (materialsResponse.data || []).map(mapFinanceMaterialFromDb)
            : seed.materials,
        incomeEntries: Array.from(incomeById.values()),
        expenseEntries: (expensesResponse.data || []).map(mapFinanceExpenseFromDb),
        costSheets: mappedCostSheets,
        inventoryMovements: inventoryRows.map(mapInventoryMovementFromDb)
    };
}

async function saveRomaFinanceConfig(negocioId, config) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('save_config', {
            main_currency: config.mainCurrency || 'CUP',
            desired_margin: toNumber(config.desiredMargin) || 60,
            rates: config.rates || {},
            rates_updated_at: config.ratesUpdatedAt || new Date().toISOString(),
            expected_version: config.version || null
        });
    }
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
    if (getRomaSessionToken()) {
        return saveRomaFinanceIncomeWithTip({
            id: entry.id,
            date: entry.date || getTodayKey(),
            service_id: entry.serviceId || null,
            client: entry.client || null,
            amount: toNumber(entry.amount),
            currency: entry.currency || 'CUP',
            rate_to_main: toNumber(entry.rateToMain) || 1,
            amount_main: toNumber(entry.amountMain),
            tip_amount: Math.max(toNumber(entry.tipAmount), 0),
            tip_currency: entry.tipCurrency || entry.currency || 'CUP',
            tip_rate_to_main: toNumber(entry.tipRateToMain),
            tip_amount_main: toNumber(entry.tipAmountMain),
            unit_cost_main: toNumber(entry.unitCostMain),
            profit_main: toNumber(entry.profitMain),
            margin: toNumber(entry.margin),
            cost_sheet_id: entry.costSheetId || null,
            payment_method: entry.paymentMethod || null,
            note: entry.note || null,
            source: entry.source || 'manual',
            booking_id: entry.bookingId || null,
            expected_version: entry.version || null
        });
    }
    const { error } = await romaSupabase.from('roma_finanzas_ingresos').upsert({
        negocio_id: negocioId,
        id: entry.id,
        date: entry.date || getTodayKey(),
        service_id: entry.serviceId || null,
        client: entry.client || null,
        amount: toNumber(entry.amount),
        currency: entry.currency || 'CUP',
        tip_amount: Math.max(toNumber(entry.tipAmount), 0),
        tip_currency: entry.tipCurrency || entry.currency || 'CUP',
        tip_rate_to_main: toNumber(entry.tipRateToMain) || 1,
        tip_amount_main: toNumber(entry.tipAmountMain),
        payment_method: entry.paymentMethod || null,
        note: entry.note || null
    }, { onConflict: 'negocio_id,id' });
    if (error) throw error;
}

async function deleteRomaFinanceIncome(negocioId, id) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('delete_income', { id });
    }
    const { error } = await romaSupabase
        .from('roma_finanzas_ingresos')
        .delete()
        .eq('negocio_id', negocioId)
        .eq('id', id);
    if (error) throw error;
}

function isMissingSchemaColumnError(error, columns = []) {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    const hint = String(error?.hint || '').toLowerCase();
    const combined = `${message} ${details} ${hint}`;
    return error?.code === 'PGRST204' && columns.some((column) => combined.includes(column.toLowerCase()));
}

async function saveRomaFinanceExpense(negocioId, entry) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('save_expense', {
            id: entry.id,
            date: entry.date || getTodayKey(),
            category: entry.category || null,
            description: entry.description || null,
            amount: toNumber(entry.amount),
            currency: entry.currency || 'CUP',
            rate_to_main: toNumber(entry.rateToMain) || 1,
            amount_main: toNumber(entry.amountMain),
            type: entry.type || 'cotidiano',
            useful_life_months: entry.type === 'herramienta' ? Math.max(toNumber(entry.usefulLifeMonths), 1) : null,
            depreciation_note: entry.depreciationNote || null,
            recurring_key: entry.recurringKey || null,
            expected_version: entry.version || null
        });
    }
    const baseExpenseRow = {
        negocio_id: negocioId,
        id: entry.id,
        date: entry.date || getTodayKey(),
        category: entry.category || null,
        description: entry.description || null,
        amount: toNumber(entry.amount),
        currency: entry.currency || 'CUP',
        type: entry.type || 'cotidiano'
    };
    const expenseRow = {
        ...baseExpenseRow,
        useful_life_months: entry.type === 'herramienta' ? Math.max(toNumber(entry.usefulLifeMonths), 1) : null
    };
    if (entry.depreciationNote) {
        expenseRow.depreciation_note = entry.depreciationNote;
    }

    const { error } = await romaSupabase
        .from('roma_finanzas_gastos')
        .upsert(expenseRow, { onConflict: 'negocio_id,id' });

    if (!error) return;

    if (isMissingSchemaColumnError(error, ['useful_life_months', 'depreciation_note'])) {
        const fallback = await romaSupabase
            .from('roma_finanzas_gastos')
            .upsert(baseExpenseRow, { onConflict: 'negocio_id,id' });
        if (fallback.error) throw fallback.error;
        return;
    }

    throw error;
}

async function deleteRomaFinanceExpense(negocioId, id) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('delete_expense', { id });
    }
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
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('save_material', {
            id: material.id,
            name: material.name || 'Material',
            cost,
            currency: material.currency || 'CUP',
            purchase_rate_to_main: material.purchaseRateToMain,
            purchase_cost_main: material.purchaseCostMain,
            uses,
            cost_per_use: cost / uses,
            unit: material.unit || 'uso',
            stock: toNumber(material.stock),
            low_stock_threshold: material.lowStockThreshold,
            expected_version: material.version || null
        });
    }
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

async function deleteRomaFinanceMaterial(negocioId, id) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('delete_material', { id });
    }
    const { error } = await romaSupabase
        .from('roma_finanzas_materials')
        .delete()
        .eq('negocio_id', negocioId)
        .eq('id', id);
    if (error) throw error;
}

async function saveRomaFinanceService(negocioId, service) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('save_service', {
            id: service.id,
            name: service.name || 'Servicio',
            category: service.category || 'General',
            price: toNumber(service.price),
            duration: Math.max(toNumber(service.duration), 1),
            currency: service.currency || 'CUP',
            active: service.active !== false,
            default_materials: service.defaultMaterials || [],
            source: service.source || 'manual',
            source_service_id: service.sourceServiceId || null,
            expected_version: service.version || null
        });
    }
    const { error } = await romaSupabase.from('roma_finanzas_services').upsert({
        negocio_id: negocioId,
        id: service.id,
        name: service.name || 'Servicio',
        category: service.category || 'General',
        price: toNumber(service.price),
        duration: Math.max(toNumber(service.duration), 1),
        currency: service.currency || 'CUP',
        active: service.active !== false,
        default_materials: service.defaultMaterials || [],
        updated_at: new Date().toISOString()
    }, { onConflict: 'negocio_id,id' });
    if (error) throw error;
}

async function deleteRomaFinanceService(negocioId, service) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    const serviceId = typeof service === 'string' ? service : service?.id;
    if (!serviceId) throw new Error('No hay servicio para eliminar.');

    if (getRomaSessionToken()) {
        if (String(serviceId).startsWith('servicio_')) {
            return applyRomaFinanceChange('save_service', {
                id: serviceId,
                name: service?.name || 'Servicio',
                category: service?.category || 'General',
                price: toNumber(service?.price),
                duration: Math.max(toNumber(service?.duration), 1),
                currency: service?.currency || 'CUP',
                active: false,
                default_materials: service?.defaultMaterials || [],
                source: 'rservasroma',
                source_service_id: service?.sourceServiceId || String(serviceId).replace(/^servicio_/, '')
            });
        }
        return applyRomaFinanceChange('delete_service', { id: serviceId });
    }

    if (String(serviceId).startsWith('servicio_')) {
        const { error } = await romaSupabase.from('roma_finanzas_services').upsert({
            negocio_id: negocioId,
            id: serviceId,
            name: service?.name || 'Servicio',
            category: service?.category || 'General',
            price: toNumber(service?.price),
            duration: Math.max(toNumber(service?.duration), 1),
            currency: service?.currency || 'CUP',
            active: false,
            default_materials: service?.defaultMaterials || [],
            updated_at: new Date().toISOString()
        }, { onConflict: 'negocio_id,id' });
        if (error) throw error;
        return;
    }

    const { error } = await romaSupabase
        .from('roma_finanzas_services')
        .delete()
        .eq('negocio_id', negocioId)
        .eq('id', serviceId);
    if (error) throw error;
}

async function saveRomaFinanceCostSheet(negocioId, sheet) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('save_cost_sheet', {
            id: sheet.id,
            service_id: sheet.serviceId || null,
            service_name: sheet.serviceName || null,
            material_usages: sheet.materialUsages || [],
            extra_expenses: sheet.extraExpenses || [],
            fixed_cost_usages: sheet.fixedCostUsages || sheet.totals?.fixedCostUsages || [],
            sale_price: toNumber(sheet.salePrice),
            sale_currency: sheet.saleCurrency || 'CUP',
            rate_to_main: sheet.rateToMain,
            totals: sheet.totals || {},
            effective_from: sheet.effectiveFrom || getTodayKey(),
            expected_version: sheet.version || null
        });
    }
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
    if (getRomaSessionToken()) {
        return applyRomaFinanceChange('delete_cost_sheet', { id });
    }
    const { error } = await romaSupabase
        .from('roma_finanzas_fichas_costo')
        .delete()
        .eq('negocio_id', negocioId)
        .eq('id', id);
    if (error) throw error;
}

async function saveRomaFinanceInventoryMovement(negocioId, movement) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (!getRomaSessionToken()) throw new Error('Actualiza la base de datos para usar movimientos de inventario.');
    return applyRomaFinanceChange('save_inventory_movement', {
        id: movement.id,
        material_id: movement.materialId,
        date: movement.date || getTodayKey(),
        movement_type: movement.movementType,
        quantity: toNumber(movement.quantity),
        note: movement.note || null,
        source_income_id: movement.sourceIncomeId || null,
        expected_version: movement.version || null
    });
}

async function deleteRomaFinanceInventoryMovement(negocioId, id) {
    if (!negocioId) throw new Error('No hay negocio activo.');
    if (!getRomaSessionToken()) throw new Error('Actualiza la base de datos para usar movimientos de inventario.');
    return applyRomaFinanceChange('delete_inventory_movement', { id });
}
