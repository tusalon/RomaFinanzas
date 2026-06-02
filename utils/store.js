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

    React.useEffect(() => {
        try {
            window.localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('No se pudo guardar el estado local:', error);
        }
    }, [state]);

    const actions = React.useMemo(() => ({
        addIncome(entry) {
            const savedEntry = {
                ...entry,
                id: makeId('inc'),
                date: entry.date || getTodayKey()
            };

            setState((current) => ({
                ...current,
                incomeEntries: [savedEntry, ...(current.incomeEntries || [])]
            }));

            return savedEntry;
        },
        addExpense(entry) {
            const savedEntry = {
                ...entry,
                id: makeId('exp'),
                date: entry.date || getTodayKey()
            };

            setState((current) => ({
                ...current,
                expenseEntries: [savedEntry, ...(current.expenseEntries || [])]
            }));

            return savedEntry;
        },
        updateConfig(config) {
            setState((current) => ({
                ...current,
                config: {
                    ...current.config,
                    ...config,
                    rates: {
                        ...current.config.rates,
                        ...(config.rates || {})
                    }
                }
            }));
        },
        setBusiness(business) {
            if (!business) return;

            setState((current) => ({
                ...current,
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
        },
        saveCostSheet(sheet) {
            const savedSheet = {
                ...sheet,
                id: makeId('sheet'),
                createdAt: new Date().toISOString()
            };

            setState((current) => ({
                ...current,
                costSheets: [savedSheet, ...(current.costSheets || [])]
            }));

            return savedSheet;
        }
    }), []);

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
