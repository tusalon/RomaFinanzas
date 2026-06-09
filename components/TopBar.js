function TopBar({ view, onBack, onLogout, authUser, syncStatus, pendingCount, lastSyncAt, isOnline, onSync }) {
    const titles = {
        dashboard: 'Resumen Diario',
        income: 'Registrar Ingreso',
        expenses: 'Registrar gasto',
        menu: 'Más Opciones',
        services: 'Mis Servicios',
        materials: 'Materiales',
        costSheet: 'Ficha de Costo',
        config: 'Configuración'
    };

    const isSubView = ['services', 'materials', 'costSheet', 'config'].includes(view);
    const syncing = syncStatus === 'syncing';
    const hasPending = Number(pendingCount) > 0;
    const syncTitle = hasPending
        ? `${pendingCount} cambio(s) pendiente(s) por sincronizar`
        : lastSyncAt
            ? `Última sincronización: ${new Date(lastSyncAt).toLocaleString('es-CU')}`
            : 'Sincronizar datos';

    return (
        <header className="fixed left-0 right-0 max-w-md mx-auto h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 flex items-center px-4 justify-between" style={{ top: 'env(safe-area-inset-top)' }} data-name="top-bar" data-file="components/TopBar.js">
            <div className="flex items-center gap-3">
                {isSubView && (
                    <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
                        <div className="icon-arrow-left text-xl text-[var(--text-main)]"></div>
                    </button>
                )}
                {!isSubView && (
                    <div className="w-9 h-9 rounded-full bg-white border border-pink-100 shadow-sm flex items-center justify-center overflow-hidden">
                        <img src="icons/icon-192x192.png" alt="Roma Finanzas" className="w-full h-full object-cover" />
                    </div>
                )}
                <h1 className="text-lg font-semibold text-[var(--text-main)]">{titles[view] || 'Roma Finanzas'}</h1>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onSync}
                    disabled={syncing}
                    title={syncTitle}
                    className={`relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border active:scale-95 transition-transform ${
                        hasPending ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        isOnline === false ? 'bg-gray-100 border-gray-200 text-gray-500' :
                        'bg-green-50 border-green-100 text-green-700'
                    }`}
                >
                    <div className={`${syncing ? 'icon-loader-circle animate-spin' : 'icon-refresh-cw'} text-sm`}></div>
                    {hasPending && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] leading-4 text-center">
                            {pendingCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={onLogout}
                    title={authUser?.email ? `Salir de ${authUser.email}` : 'Salir'}
                    className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 active:scale-95 transition-transform"
                >
                    <div className="icon-log-out text-gray-500"></div>
                </button>
            </div>
        </header>
    );
}
