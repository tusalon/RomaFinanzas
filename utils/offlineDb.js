const ROMA_OFFLINE_DB = 'roma_finanzas_offline_v1';
const ROMA_OFFLINE_STORE = 'business_states';

function openRomaOfflineDb() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('IndexedDB no está disponible.'));
            return;
        }

        const request = window.indexedDB.open(ROMA_OFFLINE_DB, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ROMA_OFFLINE_STORE)) {
                db.createObjectStore(ROMA_OFFLINE_STORE, { keyPath: 'businessId' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('No se pudo abrir el respaldo offline.'));
    });
}

async function saveFinanceStateToIndexedDb(businessId, state) {
    if (!businessId) return;
    const db = await openRomaOfflineDb();
    try {
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(ROMA_OFFLINE_STORE, 'readwrite');
            transaction.objectStore(ROMA_OFFLINE_STORE).put({
                businessId: String(businessId),
                savedAt: new Date().toISOString(),
                state
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar el respaldo offline.'));
        });
    } finally {
        db.close();
    }
}

async function loadFinanceStateFromIndexedDb(businessId) {
    if (!businessId) return null;
    const db = await openRomaOfflineDb();
    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction(ROMA_OFFLINE_STORE, 'readonly');
            const request = transaction.objectStore(ROMA_OFFLINE_STORE).get(String(businessId));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('No se pudo leer el respaldo offline.'));
        });
    } finally {
        db.close();
    }
}
