const FINANCE_STORAGE_KEY = 'roma_finanzas_state_v2';

const FinanceContext = React.createContext(null);

function createInitialFinanceState() {
    const state = JSON.parse(JSON.stringify(INITIAL_DATA));
    const today = getTodayKey();

    state.incomeEntries = (state.incomeEntries || []).map((entry) => ({
        ...entry,
        date: entry.date || today
    }));

    state.expenseEntries = (state.expenseEntries || []).map((entry) => ({
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

function mergePendingItem(pending, item) {
    const exists = pending.some((queued) => queued.type === item.type && queued.id === item.id);
    return exists ? pending : [...pending, { ...item, queuedAt: new Date().toISOString() }];
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
            window.localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(state));
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

            if (item.type === 'material') {
                const material = (stateRef.current.materials || []).find((row) => row.id === item.id);
                if (material) await saveRomaFinanceMaterial(negocioId, material);
            }

            if (item.type === 'costSheet') {
                const sheet = (stateRef.current.costSheets || []).find((row) => row.id === item.id);
                if (sheet) await saveRomaFinanceCostSheet(negocioId, sheet);
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

            setState((current) => ({
                ...current,
                loadingFinanceData: true,
                syncError: '',
                business: {
                    ...current.business,
                    id: business.id,
                    name: business.nombre || business.name || current.business.name,
                    email: business.email || current.business.email,
                    logoUrl: business.logo_url || business.logoUrl || current.business.logoUrl,
                    accessStatus: business.estado_finanzas || business.accessStatus || current.business.accessStatus || 'activo',
                    financeAccess: business.acceso_finanzas !== false && business.financeAccess !== false
                }
            }));

            try {
                await pushPendingChanges();
                const financeState = await loadRomaFinanceData(business);
                setState((current) => ({
                    ...current,
                    ...financeState,
                    pendingSync: [],
                    loadingFinanceData: false,
                    syncError: '',
                    syncStatus: 'synced',
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
            const savedSheet = {
                ...sheet,
                id: makeId('sheet'),
                createdAt: new Date().toISOString()
            };

            setState((current) => ({
                ...current,
                costSheets: [savedSheet, ...(current.costSheets || [])]
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

        async syncNow() {
            setState((current) => ({
                ...current,
                syncStatus: 'syncing',
                syncError: ''
            }));

            try {
                await pushPendingChanges();

                const business = stateRef.current.business;
                const freshState = business?.id ? await loadRomaFinanceData(business) : {};

                setState((current) => ({
                    ...current,
                    ...freshState,
                    pendingSync: [],
                    loadingFinanceData: false,
                    syncStatus: 'synced',
                    syncError: '',
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
