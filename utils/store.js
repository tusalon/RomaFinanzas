const FINANCE_STORAGE_KEY = 'roma_finanzas_state_v2';
const FINANCE_BUSINESS_STORAGE_PREFIX = 'roma_finanzas_state_v2_business_';

const FinanceContext = React.createContext(null);

function normalizeFinanceExpenseEntry(entry) {
    return {
        ...entry,
        type: normalizeExpenseType(entry?.type),
        rateToMain: toNumber(entry?.rateToMain),
        amountMain: toNumber(entry?.amountMain)
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
    state.inventoryMovements = state.inventoryMovements || [];
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
        name: business.nombre || business.name || fallbackBusiness.name || 'Mi negocio',
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
        inventoryMovements: [],
        pendingSync: []
    };
}

function mergePendingItem(pending, item) {
    const withoutOpposite = (pending || []).filter((queued) => {
        if (queued.id !== item.id) return true;
        if (item.type === 'deleteIncome' && queued.type === 'income') return false;
        if (item.type === 'deleteExpense' && queued.type === 'expense') return false;
        if (item.type === 'deleteMaterial' && queued.type === 'material') return false;
        if (item.type === 'deleteCostSheet' && queued.type === 'costSheet') return false;
        if (item.type === 'deleteService' && queued.type === 'service') return false;
        return true;
    });
    const exists = withoutOpposite.some((queued) => queued.type === item.type && queued.id === item.id);
    return exists ? withoutOpposite : [...withoutOpposite, { ...item, queuedAt: new Date().toISOString() }];
}

function preserveLocalUnsyncedCollection(freshRows, localRows, pendingItems, options = {}) {
    const {
        saveType,
        deleteType,
        normalize = (entry) => entry,
        localFilter = () => true,
        remoteFilter = () => true,
        preferPendingLocal = false
    } = options;
    const pendingSaves = new Set((pendingItems || [])
        .filter((item) => item.type === saveType)
        .map((item) => String(item.id)));
    const pendingDeletes = new Set((pendingItems || [])
        .filter((item) => item.type === deleteType)
        .map((item) => String(item.id)));
    const rowsById = new Map();

    (freshRows || [])
        .map(normalize)
        .filter((entry) => entry?.id && remoteFilter(entry) && !pendingDeletes.has(String(entry.id)))
        .forEach((entry) => rowsById.set(String(entry.id), entry));

    (localRows || [])
        .map(normalize)
        .filter((entry) => entry?.id && localFilter(entry) && !pendingDeletes.has(String(entry.id)))
        .forEach((entry) => {
            const key = String(entry.id);
            if (pendingSaves.has(key) || (preferPendingLocal && !rowsById.has(key))) {
                rowsById.set(key, entry);
            }
        });

    return Array.from(rowsById.values());
}

function preserveLocalUnsyncedState(freshState, localState) {
    const pendingItems = localState.pendingSync || [];
    const incomeEntries = preserveLocalUnsyncedCollection(
        freshState.incomeEntries || [],
        localState.incomeEntries || [],
        pendingItems,
        {
            saveType: 'income',
            deleteType: 'deleteIncome',
            localFilter: (entry) => String(entry.id || '').startsWith('inc_')
        }
    );
    const expenseEntries = preserveLocalUnsyncedCollection(
        freshState.expenseEntries || [],
        localState.expenseEntries || [],
        pendingItems,
        {
            saveType: 'expense',
            deleteType: 'deleteExpense',
            normalize: normalizeFinanceExpenseEntry
        }
    );
    const materials = preserveLocalUnsyncedCollection(
        freshState.materials || [],
        localState.materials || [],
        pendingItems,
        { saveType: 'material', deleteType: 'deleteMaterial' }
    );
    const services = preserveLocalUnsyncedCollection(
        freshState.services || [],
        localState.services || [],
        pendingItems,
        { saveType: 'service', deleteType: 'deleteService' }
    );
    const costSheets = preserveLocalUnsyncedCollection(
        freshState.costSheets || [],
        localState.costSheets || [],
        pendingItems,
        { saveType: 'costSheet', deleteType: 'deleteCostSheet' }
    );
    const inventoryMovements = preserveLocalUnsyncedCollection(
        freshState.inventoryMovements || [],
        localState.inventoryMovements || [],
        pendingItems,
        { saveType: 'inventoryMovement', deleteType: 'deleteInventoryMovement' }
    );
    const pendingSync = pendingItems.filter((item) => {
        if (item.type === 'deleteIncome') return !incomeEntries.some((entry) => String(entry.id) === String(item.id));
        if (item.type === 'deleteExpense') return !expenseEntries.some((entry) => String(entry.id) === String(item.id));
        if (item.type === 'deleteMaterial') return !materials.some((material) => String(material.id) === String(item.id));
        if (item.type === 'deleteService') return !services.some((service) => String(service.id) === String(item.id));
        if (item.type === 'deleteCostSheet') return !costSheets.some((sheet) => String(sheet.id) === String(item.id));
        if (item.type === 'deleteInventoryMovement') return !inventoryMovements.some((movement) => String(movement.id) === String(item.id));
        return true;
    });

    return {
        ...freshState,
        incomeEntries,
        expenseEntries,
        materials,
        services,
        costSheets,
        inventoryMovements,
        pendingSync
    };
}

function planIncomeInventory(state, income) {
    const previousMovements = (state.inventoryMovements || []).filter((movement) => (
        String(movement.sourceIncomeId || '') === String(income.id)
    ));
    const materialsById = new Map((state.materials || []).map((material) => [String(material.id), { ...material }]));

    previousMovements.forEach((movement) => {
        const material = materialsById.get(String(movement.materialId));
        if (material) material.stock = Math.max(toNumber(material.stock) - toNumber(movement.quantity), 0);
    });

    const sheet = getApplicableCostSheet(income.serviceId, income.date, state.costSheets || []);
    const requestedUses = new Map();
    (sheet?.materialUsages || []).forEach((usage) => {
        const key = String(usage.materialId || '');
        if (!key) return;
        requestedUses.set(key, (requestedUses.get(key) || 0) + Math.max(toNumber(usage.quantity), 0));
    });

    const newMovements = [];
    requestedUses.forEach((usesUsed, materialId) => {
        const material = materialsById.get(materialId);
        if (!material || toNumber(material.stock) <= 0 || usesUsed <= 0) return;
        const packageQuantity = usesUsed / Math.max(toNumber(material.uses), 1);
        const quantityOut = Math.min(packageQuantity, toNumber(material.stock));
        if (quantityOut <= 0) return;

        material.stock = Math.max(toNumber(material.stock) - quantityOut, 0);
        newMovements.push({
            id: `inv_${income.id}_${material.id}`,
            materialId: material.id,
            date: income.date,
            movementType: 'consumo_servicio',
            quantity: -quantityOut,
            note: `Consumo calculado para ${income.client || 'un servicio'}`,
            sourceIncomeId: income.id
        });
    });

    const newIds = new Set(newMovements.map((movement) => String(movement.id)));
    return {
        materials: Array.from(materialsById.values()),
        newMovements,
        deletedMovements: previousMovements.filter((movement) => !newIds.has(String(movement.id))),
        inventoryMovements: [
            ...newMovements,
            ...(state.inventoryMovements || []).filter((movement) => String(movement.sourceIncomeId || '') !== String(income.id))
        ]
    };
}

function applyServerVersion(record, result) {
    if (!record || !result) return record;
    if (toNumber(result.version) > 0) record.version = toNumber(result.version);
    if (result.updated_at) record.updatedAt = result.updated_at;
    return record;
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
                const savedAt = new Date().toISOString();
                window.localStorage.setItem(getBusinessStorageKey(state.business.id), JSON.stringify(state));
                window.localStorage.setItem(`${getBusinessStorageKey(state.business.id)}_updated_at`, savedAt);
                window.localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify({
                    business: state.business,
                    lastSyncAt: state.lastSyncAt,
                    syncStatus: state.syncStatus
                }));
                saveFinanceStateToIndexedDb(state.business.id, state).catch((error) => {
                    console.warn('No se pudo actualizar el respaldo IndexedDB:', error);
                });
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

            if (item.type === 'deleteIncome') {
                await deleteRomaFinanceIncome(negocioId, item.id);
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

            if (item.type === 'deleteMaterial') {
                await deleteRomaFinanceMaterial(negocioId, item.id);
            }

            if (item.type === 'service') {
                const service = (stateRef.current.services || []).find((row) => row.id === item.id);
                if (service) await saveRomaFinanceService(negocioId, service);
            }

            if (item.type === 'deleteService') {
                await deleteRomaFinanceService(negocioId, item.id);
            }

            if (item.type === 'costSheet') {
                const sheet = (stateRef.current.costSheets || []).find((row) => row.id === item.id);
                if (sheet) await saveRomaFinanceCostSheet(negocioId, sheet);
            }

            if (item.type === 'deleteCostSheet') {
                await deleteRomaFinanceCostSheet(negocioId, item.id);
            }

            if (item.type === 'inventoryMovement') {
                const movement = (stateRef.current.inventoryMovements || []).find((row) => row.id === item.id);
                if (movement) await saveRomaFinanceInventoryMovement(negocioId, movement);
            }

            if (item.type === 'deleteInventoryMovement') {
                await deleteRomaFinanceInventoryMovement(negocioId, item.id);
            }

            if (item.type === 'config') {
                await saveRomaFinanceConfig(negocioId, stateRef.current.config);
            }
        }
    }, []);

    const actions = React.useMemo(() => ({
        async addIncome(entry) {
            const existingEntry = (stateRef.current.incomeEntries || []).find((row) => String(row.id) === String(entry.id));
            const baseEntry = {
                ...(existingEntry || {}),
                ...entry,
                id: entry.id || makeId('inc'),
                date: entry.date || getTodayKey()
            };
            const savedEntry = buildIncomeFinancialSnapshot(
                baseEntry,
                stateRef.current.costSheets || [],
                stateRef.current.config
            );
            const inventoryPlan = planIncomeInventory(stateRef.current, savedEntry);

            setState((current) => ({
                ...current,
                incomeEntries: (current.incomeEntries || []).some((row) => String(row.id) === String(savedEntry.id))
                    ? (current.incomeEntries || []).map((row) => String(row.id) === String(savedEntry.id) ? savedEntry : row)
                    : [savedEntry, ...(current.incomeEntries || [])],
                materials: inventoryPlan.materials,
                inventoryMovements: inventoryPlan.inventoryMovements
            }));

            if (activeBusinessIdRef.current) {
                try {
                    const incomeResult = await saveRomaFinanceIncome(activeBusinessIdRef.current, savedEntry);
                    applyServerVersion(savedEntry, incomeResult);
                    for (const movement of inventoryPlan.deletedMovements) {
                        await deleteRomaFinanceInventoryMovement(activeBusinessIdRef.current, movement.id);
                    }
                    for (const material of inventoryPlan.materials) {
                        const original = (stateRef.current.materials || []).find((row) => String(row.id) === String(material.id));
                        if (original && toNumber(original.stock) !== toNumber(material.stock)) {
                            const materialResult = await saveRomaFinanceMaterial(activeBusinessIdRef.current, material);
                            applyServerVersion(material, materialResult);
                        }
                    }
                    for (const movement of inventoryPlan.newMovements) {
                        const movementResult = await saveRomaFinanceInventoryMovement(activeBusinessIdRef.current, movement);
                        applyServerVersion(movement, movementResult);
                    }
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el ingreso en Supabase:', error);
                    queueSync({ type: 'income', id: savedEntry.id }, 'Ingreso guardado offline. Sincroniza cuando tengas internet.');
                    inventoryPlan.newMovements.forEach((movement) => queueSync({ type: 'inventoryMovement', id: movement.id }));
                    inventoryPlan.deletedMovements.forEach((movement) => queueSync({ type: 'deleteInventoryMovement', id: movement.id }));
                    inventoryPlan.materials.forEach((material) => queueSync({ type: 'material', id: material.id }));
                }
            }

            return savedEntry;
        },

        async deleteIncome(id) {
            const linkedMovements = (stateRef.current.inventoryMovements || []).filter((movement) => String(movement.sourceIncomeId || '') === String(id));
            const restoredMaterials = (stateRef.current.materials || []).map((material) => {
                const returned = linkedMovements
                    .filter((movement) => String(movement.materialId) === String(material.id))
                    .reduce((sum, movement) => sum - toNumber(movement.quantity), 0);
                return returned > 0 ? { ...material, stock: toNumber(material.stock) + returned } : material;
            });
            setState((current) => ({
                ...current,
                incomeEntries: (current.incomeEntries || []).filter((entry) => String(entry.id) !== String(id)),
                materials: restoredMaterials,
                inventoryMovements: (current.inventoryMovements || []).filter((movement) => String(movement.sourceIncomeId || '') !== String(id)),
                pendingSync: (current.pendingSync || []).filter((item) => !(item.type === 'income' && String(item.id) === String(id)))
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await deleteRomaFinanceIncome(activeBusinessIdRef.current, id);
                    for (const movement of linkedMovements) {
                        await deleteRomaFinanceInventoryMovement(activeBusinessIdRef.current, movement.id);
                    }
                    for (const material of restoredMaterials) {
                        const original = (stateRef.current.materials || []).find((row) => String(row.id) === String(material.id));
                        if (original && toNumber(original.stock) !== toNumber(material.stock)) {
                            const materialResult = await saveRomaFinanceMaterial(activeBusinessIdRef.current, material);
                            applyServerVersion(material, materialResult);
                        }
                    }
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo eliminar el ingreso en Supabase:', error);
                    queueSync({ type: 'deleteIncome', id }, 'Ingreso eliminado offline. Sincroniza cuando tengas internet.');
                    linkedMovements.forEach((movement) => queueSync({ type: 'deleteInventoryMovement', id: movement.id }));
                    restoredMaterials.forEach((material) => queueSync({ type: 'material', id: material.id }));
                }
            }
        },

        async addExpense(entry) {
            const existingEntry = (stateRef.current.expenseEntries || []).find((row) => String(row.id) === String(entry.id));
            const money = createMoneySnapshot(entry.amount, entry.currency, stateRef.current.config);
            const savedEntry = {
                ...(existingEntry || {}),
                ...entry,
                id: entry.id || makeId('exp'),
                date: entry.date || getTodayKey(),
                rateToMain: money.rateToMain,
                amountMain: money.amountMain
            };

            setState((current) => ({
                ...current,
                expenseEntries: (current.expenseEntries || []).some((row) => String(row.id) === String(savedEntry.id))
                    ? (current.expenseEntries || []).map((row) => String(row.id) === String(savedEntry.id) ? savedEntry : row)
                    : [savedEntry, ...(current.expenseEntries || [])]
            }));

            if (activeBusinessIdRef.current) {
                try {
                    const expenseResult = await saveRomaFinanceExpense(activeBusinessIdRef.current, savedEntry);
                    applyServerVersion(savedEntry, expenseResult);
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
            const existingMaterial = (stateRef.current.materials || []).find((row) => String(row.id) === String(material.id));
            const purchaseMoney = createMoneySnapshot(material.cost, material.currency, stateRef.current.config);
            const savedMaterial = {
                ...(existingMaterial || {}),
                ...material,
                id: material.id || makeId('mat'),
                name: String(material.name || '').trim() || 'Material',
                cost: toNumber(material.cost),
                currency: material.currency || stateRef.current.config.mainCurrency || 'CUP',
                uses: Math.max(toNumber(material.uses), 1),
                costPerUse: getMaterialCostPerUse(material),
                unit: material.unit || 'uso',
                stock: toNumber(material.stock),
                purchaseRateToMain: purchaseMoney.rateToMain,
                purchaseCostMain: purchaseMoney.amountMain,
                lowStockThreshold: material.lowStockThreshold === '' || material.lowStockThreshold == null
                    ? null
                    : Math.max(toNumber(material.lowStockThreshold), 0)
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
                    const materialResult = await saveRomaFinanceMaterial(activeBusinessIdRef.current, savedMaterial);
                    applyServerVersion(savedMaterial, materialResult);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el material en Supabase:', error);
                    queueSync({ type: 'material', id: savedMaterial.id }, 'Material guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedMaterial;
        },

        async deleteMaterial(id) {
            setState((current) => ({
                ...current,
                materials: (current.materials || []).filter((material) => String(material.id) !== String(id)),
                pendingSync: (current.pendingSync || []).filter((item) => !(item.type === 'material' && String(item.id) === String(id)))
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await deleteRomaFinanceMaterial(activeBusinessIdRef.current, id);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo eliminar el material en Supabase:', error);
                    queueSync({ type: 'deleteMaterial', id }, 'Material eliminado offline. Sincroniza cuando tengas internet.');
                }
            }
        },

        async adjustMaterialStock(id, quantityDelta, note = '') {
            const material = (stateRef.current.materials || []).find((item) => String(item.id) === String(id));
            if (!material) throw new Error('No se encontró el material.');

            const delta = toNumber(quantityDelta);
            if (delta === 0) throw new Error('Escribe una cantidad diferente de cero.');

            const updatedMaterial = {
                ...material,
                stock: Math.max(toNumber(material.stock) + delta, 0)
            };
            const movement = {
                id: makeId('inv'),
                materialId: material.id,
                date: getTodayKey(),
                movementType: delta > 0 ? 'entrada' : 'salida',
                quantity: delta,
                note
            };

            setState((current) => ({
                ...current,
                materials: (current.materials || []).map((item) => String(item.id) === String(id) ? updatedMaterial : item),
                inventoryMovements: [movement, ...(current.inventoryMovements || [])]
            }));

            if (activeBusinessIdRef.current) {
                try {
                    const materialResult = await saveRomaFinanceMaterial(activeBusinessIdRef.current, updatedMaterial);
                    applyServerVersion(updatedMaterial, materialResult);
                    const movementResult = await saveRomaFinanceInventoryMovement(activeBusinessIdRef.current, movement);
                    applyServerVersion(movement, movementResult);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el movimiento de inventario:', error);
                    queueSync({ type: 'material', id: updatedMaterial.id }, 'Movimiento guardado offline. Sincroniza cuando tengas internet.');
                    queueSync({ type: 'inventoryMovement', id: movement.id }, 'Movimiento guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return movement;
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
                    const serviceResult = await saveRomaFinanceService(activeBusinessIdRef.current, savedService);
                    applyServerVersion(savedService, serviceResult);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo guardar el servicio en Supabase:', error);
                    queueSync({ type: 'service', id: savedService.id }, 'Servicio guardado offline. Sincroniza cuando tengas internet.');
                }
            }

            return savedService;
        },

        async deleteService(service) {
            const serviceId = typeof service === 'string' ? service : service?.id;
            if (!serviceId) return;

            setState((current) => ({
                ...current,
                services: (current.services || []).filter((item) => String(item.id) !== String(serviceId)),
                pendingSync: (current.pendingSync || []).filter((item) => !(item.type === 'service' && String(item.id) === String(serviceId)))
            }));

            if (activeBusinessIdRef.current) {
                try {
                    await deleteRomaFinanceService(activeBusinessIdRef.current, service);
                    setState((current) => ({ ...current, syncError: '', syncStatus: (current.pendingSync || []).length ? 'pending' : 'synced' }));
                } catch (error) {
                    console.error('No se pudo eliminar el servicio en Supabase:', error);
                    queueSync({ type: 'deleteService', id: serviceId }, 'Servicio eliminado offline. Sincroniza cuando tengas internet.');
                }
            }
        },

        async updateConfig(config) {
            const nextConfig = {
                ...stateRef.current.config,
                ...config,
                rates: {
                    ...stateRef.current.config.rates,
                    ...(config.rates || {})
                },
                ratesUpdatedAt: config.ratesUpdatedAt || new Date().toISOString()
            };

            const configErrors = validateFinanceConfig(nextConfig);
            if (configErrors.length > 0) {
                throw new Error(configErrors[0]);
            }

            setState((current) => ({
                ...current,
                config: nextConfig
            }));

            if (activeBusinessIdRef.current) {
                try {
                    const configResult = await saveRomaFinanceConfig(activeBusinessIdRef.current, nextConfig);
                    applyServerVersion(nextConfig, configResult);
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
            let localBusinessState = loadBusinessFinanceState(business);
            try {
                const indexedRecord = await loadFinanceStateFromIndexedDb(business.id);
                const localUpdatedAt = window.localStorage.getItem(`${getBusinessStorageKey(business.id)}_updated_at`) || '';
                if (indexedRecord?.state && String(indexedRecord.savedAt || '') >= String(localUpdatedAt)) {
                    localBusinessState = {
                        ...hydrateFinanceState(indexedRecord.state),
                        business: getBusinessInfoForState(business, indexedRecord.state.business)
                    };
                }
            } catch (error) {
                console.warn('No se pudo leer el respaldo IndexedDB:', error);
            }
            stateRef.current = localBusinessState;

            setState((current) => ({
                ...localBusinessState,
                loadingFinanceData: true,
                syncError: '',
                business: getBusinessInfoForState(business, localBusinessState.business)
            }));

            try {
                await pushPendingChanges();
                const financeState = await loadRomaFinanceData(business);
                const mergedFinanceState = preserveLocalUnsyncedState(financeState, {
                    ...localBusinessState,
                    pendingSync: []
                });
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
                ...(existingSheet || {}),
                ...sheet,
                id: sheet.id || makeId('sheet'),
                createdAt: sheet.createdAt || existingSheet?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                effectiveFrom: sheet.effectiveFrom || existingSheet?.effectiveFrom || getTodayKey(),
                rateToMain: getRateToMainCurrency(sheet.saleCurrency || stateRef.current.config.mainCurrency, stateRef.current.config)
            };

            setState((current) => ({
                ...current,
                costSheets: (current.costSheets || []).some((item) => String(item.id) === String(savedSheet.id))
                    ? (current.costSheets || []).map((item) => String(item.id) === String(savedSheet.id) ? savedSheet : item)
                    : [savedSheet, ...(current.costSheets || [])]
            }));

            if (activeBusinessIdRef.current) {
                try {
                    const sheetResult = await saveRomaFinanceCostSheet(activeBusinessIdRef.current, savedSheet);
                    applyServerVersion(savedSheet, sheetResult);
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
                const freshState = business?.id ? await loadRomaFinanceData(business) : {};
                const mergedFreshState = preserveLocalUnsyncedState(freshState, {
                    ...stateRef.current,
                    pendingSync: []
                });

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
