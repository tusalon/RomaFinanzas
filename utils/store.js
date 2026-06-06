const FINANCE_STORAGE_KEY = 'roma_finanzas_state_v1';

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

    return state;
}

function loadFinanceState() {
    try {
        const saved = window.localStorage.getItem(FINANCE_STORAGE_KEY);
        if (!saved) return createInitialFinanceState();

        return {
            ...createInitialFinanceState(),
            ...JSON.parse(saved)
        };
    } catch (error) {
        console.warn('No se pudo cargar el estado local:', error);
        return createInitialFinanceState();
    }
}

function FinanceProvider({ children }) {
    const [state, setState] = React.useState(loadFinanceState);
    const activeBusinessIdRef = React.useRef(null);

    React.useEffect(() => {
        try {
            window.localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('No se pudo guardar el estado local:', error);
        }
    }, [state]);

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
                    setState((current) => ({ ...current, syncError: '' }));
                } catch (error) {
                    console.error('No se pudo guardar el ingreso en Supabase:', error);
                    setState((current) => ({ ...current, syncError: 'No se pudo sincronizar el último ingreso.' }));
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
                    setState((current) => ({ ...current, syncError: '' }));
                } catch (error) {
                    console.error('No se pudo guardar el gasto en Supabase:', error);
                    setState((current) => ({ ...current, syncError: 'No se pudo sincronizar el último gasto.' }));
                }
            }

            return savedEntry;
        },
        async updateConfig(config) {
            const nextConfig = {
                ...state.config,
                ...config,
                rates: {
                    ...state.config.rates,
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
                    setState((current) => ({ ...current, syncError: '' }));
                } catch (error) {
                    console.error('No se pudo guardar la configuración en Supabase:', error);
                    setState((current) => ({ ...current, syncError: 'No se pudo sincronizar la configuración.' }));
                }
            }
        },
        async setBusiness(business) {
            if (!business) return;

            setState((current) => ({
                ...current,
                loadingFinanceData: true,
                syncError: '',
                business: {
                    ...current.business,
                    id: business.id,
                    name: business.nombre || current.business.name,
                    email: business.email || current.business.email,
                    logoUrl: business.logo_url || current.business.logoUrl,
                    accessStatus: business.estado_finanzas || current.business.accessStatus || 'activo',
                    financeAccess: business.acceso_finanzas !== false
                }
            }));

            activeBusinessIdRef.current = business.id;

            try {
                const financeState = await loadRomaFinanceData(business);
                setState((current) => ({
                    ...current,
                    ...financeState,
                    loadingFinanceData: false,
                    syncError: ''
                }));
            } catch (error) {
                console.error('No se pudieron cargar los datos financieros:', error);
                setState((current) => ({
                    ...current,
                    loadingFinanceData: false,
                    syncError: 'No se pudieron cargar los datos financieros de Supabase.'
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
                    setState((current) => ({ ...current, syncError: '' }));
                } catch (error) {
                    console.error('No se pudo guardar la ficha en Supabase:', error);
                    setState((current) => ({ ...current, syncError: 'No se pudo sincronizar la última ficha de costo.' }));
                }
            }

            return savedSheet;
        }
    }), [state.config]);

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
