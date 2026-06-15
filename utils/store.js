const FINANCE_STORAGE_KEY = 'roma_finanzas_state_v2';
const FINANCE_BUSINESS_STORAGE_PREFIX = 'roma_finanzas_state_v2_business_';

const FinanceContext = React.createContext(null);

function normalizeFinanceExpenseEntry(entry) {
    const isRservasRomaExpense = String(entry?.id || '').startsWith('gasto_rservasroma_')
        || String(entry?.category || '').toLowerCase() === 'rservasroma'
        || String(entry?.description || '').toLowerCase() === 'rservasroma';

    if (!isRservasRomaExpense) return entry;

    return {
        ...entry,
        category: 'RservasRoma',
        description: 'RservasRoma',
        amount: 1000,
        currency: 'CUP',
        type: 'fijo',
        usefulLifeMonths: 0
    };
}

function createInitialFinanceState() {
    const state = JSON.parse(JSON.stringify(INITIAL_DATA));
    const today = getTodayKey();

    state.incomeEntries = (state.incomeEntries || []).map((entry) => ({
        ...entry,
        date: entry.date || today
    }));

    state.expenseEntries = (state.expenseEntries || []).map((entry) => normalizeFinanceExpenseEntry({
        ...entry,
        date: entry.date || today
    }));

    state.costSheets = state.costSheets || [];
    state.pendingSync = state.pendingSync || [];
    state.lastSyncAt = state.lastSyncAt || '';
    state.syncStatus = state.syncStatus || 'idle';
    state.syncError = state.syncError || '';
    state.isOnline = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

    return state;
}

function loadFinanceState() {
    try {
        const saved = window.localStorage.getItem(FINANCE_STORAGE_KEY)
            || window.localStorage.getItem('roma_finanzas_state_v1');
        if (!saved) return createInitialFinanceState();

        const parsed = JSON.parse(saved);
        return {
            ...createInitialFinanceState(),
            ...parsed,
            expenseEntries: (parsed.expenseEntries || []).map(normalizeFinanceExpenseEntry),
            pendingSync: parsed.pendingSync || [],
            lastSyncAt: parsed.lastSyncAt || '',
            syncStatus: parsed.syncStatus || ((parsed.pendingSync || []).length ? 'pending' : 'idle'),
            syncError: parsed.syncError || '',
            isOnline: navigator.onLine !== false
        };
    } catch (error) {
        console.warn('No se pudo cargar el estado local:', error);
        return createInitialFinanceState();
    }
}

function getBusinessStorageKey(businessId) {
    return `${FINANCE_BUSINESS_STORAGE_PREFIX}${businessId}`;
}

function hydrateFinanceState(savedState) {
    const parsed = savedState || {};
    return {
        ...createInitialFinanceState(),
        ...parsed,
        expenseEntries: (parsed.expenseEntries || []).map(normalizeFinanceExpenseEntry),
        pendingSync: parsed.pendingSync || [],
        lastSyncAt: parsed.lastSyncAt || '',
        syncStatus: parsed.syncStatus || ((parsed.pendingSync || []).length ? 'pending' : 'idle'),
        syncError: parsed.syncError || '',
        isOnline: navigator.onLine !== false
    };
}

function getBusinessInfoForState(business, fallbackBusiness = {}) {
    return {
        ...fallbackBusiness,
        id: business.id,
        name: business.nombre || business.name || fallbackBusiness.name || 'Roma Beauty Studio',
        email: business.email || fallbackBusiness.email || '',
        logoUrl: business.logo_url || business.logoUrl || fallbackBusiness.logoUrl || '',
        accessStatus: business.estado_finanzas || business.accessStatus || fallbackBusiness.accessStatus || 'activo',
        financeAccess: business.acceso_finanzas !== false && business.financeAccess !== false
    };
}

function loadBusinessFinanceState(business) {
    const cleanState = hydrateFinanceState({});
    if (!business?.id) return cleanState;

    try {
        const specificSaved = window.localStorage.getItem(getBusinessStorageKey(business.id));
        if (specificSaved) {
            const parsed = JSON.parse(specificSaved);
            return {
                ...hydrateFinanceState(parsed),
                business: getBusinessInfoForState(business, parsed.business)
            };
        }

        const legacySaved = window.localStorage.getItem(FINANCE_STORAGE_KEY)
            || window.localStorage.getItem('roma_finanzas_state_v1');
        if (legacySaved) {
            const parsed = JSON.parse(legacySaved);
            if (String(parsed.business?.id || '') === String(business.id)) {
                return {
                    ...hydrateFinanceState(parsed),
                    business: getBusinessInfoForState(business, parsed.business)
                };
            }
        }
    } catch (error) {
        console.warn('No se pudo cargar el estado local del negocio:', error);
    }

    return {
        ...cleanState,
        business: getBusinessInfoForState(business, cleanState.business),
        services: [],
        materials: [],
        incomeEntries: [],
        expenseEntries: [],
        costSheets: [],
        pendingSync: []
    };
}

function mergePendingItem(pending, item) {
    const withoutOpposite = (pending || []).filter((queued) => {
        if (queued.id !== item.id) return true;
        if (item.type === 'deleteExpense' && queued.type === 'expense') return false;
        if (item.type === 'deleteCostSheet' && queued.type === 'costSheet') return false;
        return true;
    });
    const exists = withoutOpposite.some((queued) => queued.type === item.type && queued.id === item.id);
    return exists ? withoutOpposite : [...withoutOpposite, { ...item, queuedAt: new Date().toISOString() }];
}

function preserveLocalUnsyncedExpenses(freshState, localState) {
    const remoteExpenses = freshState.expenseEntries || [];
    const localExpenses = (localState.expenseEntries || []).map(normalizeFinanceExpenseEntry);
    const remoteIds = new Set(remoteExpenses.map((entry) => String(entry.id)));
    const pendingDeletes = new Set((localState.pendingSync || [])
        .filter((item) => item.type === 'deleteExpense')
        .map((item) => String(item.id)));

    const localOnlyExpenses = localExpenses.filter((entry) => {
        if (!entry?.id) return false;
        if (remoteIds.has(String(entry.id))) return false;
        if (pendingDeletes.has(String(entry.id))) return false;
        return true;
    });

    if (localOnlyExpenses.length === 0) {
        return {
            ...freshState,
            pendingSync: []
        };
    }

    const pendingSync = localOnlyExpenses.reduce((pending, entry) => (
        mergePendingItem(pending, { type: 'expense', id: entry.id })
    ), []);

    return {
        ...freshState,
        expenseEntries: [...localOnlyExpenses, ...remoteExpenses],
        pendingSync
    };
}

async function pushLocalExpensesSnapshot(negocioId, expenses = []) {
    if (!negocioId) return;

    const uniqueExpenses = new Map();
    (expenses || [])
        .map(normalizeFinanceExpenseEntry)
        .filter((entry) => entry?.id)
        .forEach((entry) => uniqueExpenses.set(String(entry.id), entry));

    for (const expense of uniqueExpenses.values()) {
        await saveRomaFinanceExpense(negocioId, expense);
    }
}

function FinanceProvider({ children }) {
    const [state, setState] = React.useState(loadFinanceState);
    const activeBusinessIdRef = React.useRef(null);
    const stateRef = React.useRef(state);

    React.useEffect(() => {
        stateRef.current = state;
    }, [state]);

    React.useEffect(() => {
        try {
            if (state.business?.id) {
                window.localStorage.setItem(getBusinessStorageKey(state.business.id), JSON.stringify(state));
                window.localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify({
                    business: state.business,
                    lastSyncAt: state.lastSyncAt,
                    syncStatus: state.syncStatus
                }));
            }
        } catch (error) {
            console.warn('No se pudo guardar el estado local:', error);
        }
    }, [state]);

    React.useEffect(() => {
        const updateOnlineStatus = () => {
            setState((current) => ({
                ...current,
                isOnline: navigator.onLine !== false
            }));
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    const queueSync = React.useCallback((item, message) => {
        setState((current) => ({
            ...current,
            pendingSync: mergePendingItem(current.pendingSync || [], item),
            syncStatus: 'pending',
            syncError: message || 'Cambio guardado offline. Sincroniza cuando tengas internet.',
            isOnline: navigator.onLine !== false
        }));
    }, []);

    const pushPendingChanges = React.useCallback(async () => {
        const negocioId = activeBusinessIdRef.current;
        if (!negocioId) throw new Error('No hay negocio activo para sincronizar.');
        if (navigator.onLine === false) throw new Error('No hay conexión a internet.');

        const pending = stateRef.current.pendingSync || [];

        for (const item of pending) {
            if (item.type === 'income') {
                const entry = (stateRef.current.incomeEntries || []).find((row) => row.id === item.id);
                if (entry) await saveRomaFinanceIncome(negocioId, entry);
            }

            if (item.type === 'expense') {
                const entry = (stateRef.current.expenseEntries || []).find((row) => row.id === item.id);
                if (entry) await saveRomaFinanceExpense(negocioId, entry);
            }

            if (item.type === 'deleteExpense') {
                await deleteRomaFinanceExpense(negocioId, item.id);
            }

            if (item.type === 'material') {
                const material = (stateRef.current.materials || []).find((row) => row.id === item.id);
                if (material) await saveRomaFinanceMaterial(negocioId, material);
            }

            if (item.type === 'service') {
                const service = (stateRef.current.services || []).find((row) => row.id === item.id);
                if (service) await saveRomaFinanceService(negocioId, service);
            }

            if (item.type === 'costSheet') {
                const sheet = (stateRef.current.costSheets || []).find((row) => row.id === item.id);
                if (sheet) await saveRomaFinanceCostSheet(negocioId, sheet);
            }

            if (item.type === 'deleteCostSheet') {
                await deleteRomaFinanceCostSheet(negocioId, item.id);
            }

            if (item.type === 'config') {
                await saveRomaFinanceConfig(negocioId, stateRef.current.config);
            }
        }
    }, []);

    const actions = React.useMemo(() => ({
        async addIncome(entry) {
            const savedEntry = {
                ...entry,
                id: makeId('inc'),
                date: entry.date || getTodayKey()
            };

            setState((current) => ({
                ...current,
                incomeEntries: [savedEntry, ...(current.incomeEntries || [])]
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await saveRomaFinanceIncome(activeBusinessIdRef.current, savedEntry);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el ingreso en Supabase:', error);
                    queueSync({ type: 'income', id: savedEntry.id }, 'Ingreso guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedEntry;
        },

        async addExpense(entry) {
            const savedEntry = {
                ...entry,
                id: makeId('exp'),
                date: entry.date || getTodayKey()
            };

            setState((current) => ({
                ...current,
                expenseEntries: [savedEntry, ...(current.expenseEntries || [])]
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await saveRomaFinanceExpense(activeBusinessIdRef.current, savedEntry);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el gasto en Supabase:', error);
                    queueSync({ type: 'expense', id: savedEntry.id }, 'Gasto guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedEntry;
        },

        async deleteExpense(id) {
            setState((current) => ({
                ...current,
                expenseEntries: (current.expenseEntries || []).filter((entry) => String(entry.id) !== String(id)),
                pendingSync: (current.pendingSync || []).filter((item) => !(item.type === 'expense' && String(item.id) === String(id)))
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await deleteRomaFinanceExpense(activeBusinessIdRef.current, id);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo eliminar el gasto en Supabase:', error);
                    queueSync({ type: 'deleteExpense', id }, 'Gasto eliminado offline. Sincroniza cuando tengas internet.');
                }
            }
        },

        async saveMaterial(material) {
            const savedMaterial = {
                ...material,
                id: material.id || makeId('mat'),
                name: String(material.name || '').trim() || 'Material',
                cost: toNumber(material.cost),
                currency: material.currency || stateRef.current.config.mainCurrency || 'CUP',
                uses: Math.max(toNumber(material.uses), 1),
                costPerUse: getMaterialCostPerUse(material),
                unit: material.unit || 'uso',
                stock: toNumber(material.stock)
            };

            setState((current) => {
                const materials = current.materials || [];
                const exists = materials.some((item) => String(item.id) === String(savedMaterial.id));
                return {
                    ...current,
                    materials: exists
                        ? materials.map((item) => String(item.id) === String(savedMaterial.id) ? savedMaterial : item)
                        : [savedMaterial, ...materials]
                };
            });

            if (activeBusinessIdRef.current) {
                try {
                    await saveRomaFinanceMaterial(activeBusinessIdRef.current, savedMaterial);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el material en Supabase:', error);
                    queueSync({ type: 'material', id: savedMaterial.id }, 'Material guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedMaterial;
        },

        async saveService(service) {
            const savedService = {
                ...service,
                id: service.id || makeId('srv'),
                name: String(service.name || '').trim() || 'Servicio',
                category: service.category || 'General',
                price: toNumber(service.price),
                duration: Math.max(toNumber(service.duration), 1),
                currency: service.currency || stateRef.current.config.mainCurrency || 'CUP',
                active: service.active !== false,
                defaultMaterials: service.defaultMaterials || []
            };

            setState((current) => {
                const services = current.services || [];
                const exists = services.some((item) => String(item.id) === String(savedService.id));
                return {
                    ...current,
                    services: exists
                        ? services.map((item) => String(item.id) === String(savedService.id) ? savedService : item)
                        : [savedService, ...services]
                };
            });

            if (activeBusinessIdRef.current) {
                try {
                    await saveRomaFinanceService(activeBusinessIdRef.current, savedService);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el servicio en Supabase:', error);
                    queueSync({ type: 'service', id: savedService.id }, 'Servicio guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedService;
        },

        async updateConfig(config) {
            const nextConfig = {
                ...stateRef.current.config,
                ...config,
                rates: {
                    ...stateRef.current.config.rates,
                    ...(config.rates || {})
                }
            };

            setState((current) => ({
                ...current,
                config: nextConfig
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await saveRomaFinanceConfig(activeBusinessIdRef.current, nextConfig);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar la configuración en Supabase:', error);
                    queueSync({ type: 'config', id: 'config' }, 'Configuración guardada offline. Sincroniza cuando tengas internet.');
                }
            }
        },

        async setBusiness(business) {
            if (!business) return;

            activeBusinessIdRef.current = business.id;
            const localBusinessState = loadBusinessFinanceState(business);
            stateRef.current = localBusinessState;

            setState((current) => ({
                ...localBusinessState,
                loadingFinanceData: true,
                syncError: '',
                business: getBusinessInfoForState(business, localBusinessState.business)
            }));

            try {
                await pushPendingChanges();
                await pushLocalExpensesSnapshot(business.id, localBusinessState.expenseEntries || []);
                const financeState = await loadRomaFinanceData(business);
                const mergedFinanceState = preserveLocalUnsyncedExpenses(financeState, localBusinessState);
                setState((current) => ({
                    ...current,
                    ...mergedFinanceState,
                    loadingFinanceData: false,
                    syncError: (mergedFinanceState.pendingSync || []).length
                        ? 'Se conservaron gastos locales pendientes. Toca sincronizar para subirlos a la nube.'
                        : '',
                    syncStatus: (mergedFinanceState.pendingSync || []).length ? 'pending' : 'synced',
                    isOnline: true,
                    lastSyncAt: new Date().toISOString()
                }));
            } catch (error) {
                console.error('No se pudieron cargar los datos financieros:', error);
                setState((current) => ({
                    ...current,
                    loadingFinanceData: false,
                    isOnline: navigator.onLine !== false,
                    syncStatus: (current.pendingSync || []).length > 0 ? 'pending' : 'offline',
                    syncError: 'Trabajando con datos guardados en este telefono. Sincroniza cuando tengas internet.'
                }));
            }
        },

        async saveCostSheet(sheet) {
            const existingSheet = (stateRef.current.costSheets || []).find((item) => String(item.id) === String(sheet.id));
            const savedSheet = {
                ...sheet,
                id: sheet.id || makeId('sheet'),
                createdAt: sheet.createdAt || existingSheet?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            setState((current) => ({
                ...current,
                costSheets: (current.costSheets || []).some((item) => String(item.id) === String(savedSheet.id))
                    ? (current.costSheets || []).map((item) => String(item.id) === String(savedSheet.id) ? savedSheet : item)
                    : [savedSheet, ...(current.costSheets || [])]
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await saveRomaFinanceCostSheet(activeBusinessIdRef.current, savedSheet);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar la ficha en Supabase:', error);
                    queueSync({ type: 'costSheet', id: savedSheet.id }, 'Ficha guardada offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedSheet;
        },

        async deleteCostSheet(id) {
            setState((current) => ({
                ...current,
                costSheets: (current.costSheets || []).filter((sheet) => String(sheet.id) !== String(id)),
                pendingSync: (current.pendingSync || []).filter((item) => !(item.type === 'costSheet' && String(item.id) === String(id)))
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await deleteRomaFinanceCostSheet(activeBusinessIdRef.current, id);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo eliminar la ficha en Supabase:', error);
                    queueSync({ type: 'deleteCostSheet', id }, 'Ficha eliminada offline. Sincroniza cuando tengas internet.');
                }
            }
        },

        async syncNow() {
            setState((current) => ({
                ...current,
                syncStatus: 'syncing',
                syncError: ''
            }));

            try {
                await pushPendingChanges();

                const business = stateRef.current.business;
                if (business?.id) {
                    await pushLocalExpensesSnapshot(business.id, stateRef.current.expenseEntries || []);
                }
                const freshState = business?.id ? await loadRomaFinanceData(business) : {};
                const mergedFreshState = preserveLocalUnsyncedExpenses(freshState, stateRef.current);

                setState((current) => ({
                    ...current,
                    ...mergedFreshState,
                    loadingFinanceData: false,
                    syncStatus: (mergedFreshState.pendingSync || []).length ? 'pending' : 'synced',
                    syncError: (mergedFreshState.pendingSync || []).length
                        ? 'Se conservaron gastos locales pendientes. Toca sincronizar otra vez para subirlos.'
                        : '',
                    isOnline: true,
                    lastSyncAt: new Date().toISOString()
                }));
            } catch (error) {
                console.error('No se pudo sincronizar:', error);
                setState((current) => ({
                    ...current,
                    syncStatus: (current.pendingSync || []).length > 0 ? 'pending' : 'offline',
                    isOnline: navigator.onLine !== false,
                    syncError: error.message || 'No se pudo sincronizar. Intenta otra vez cuando haya internet.'
                }));
            }
        }
    }), [queueSync, pushPendingChanges]);

    const value = React.useMemo(() => ({ state, actions }), [state, actions]);

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
}

function useFinanceApp() {
    const context = React.useContext(FinanceContext);
    if (!context) {
        throw new Error('useFinanceApp debe usarse dentro de FinanceProvider');
    }
    return context;
}
