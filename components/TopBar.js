function TopBar({ view, onBack, onLogout, authUser, syncStatus, pendingCount, lastSyncAt, isOnline, onSync }) {
    const titles = {
        dashboard: 'Tu negocio hoy',
        income: 'Anotar un cobro',
        expenses: 'Anotar un gasto',
        menu: '¿Qué quieres hacer?',
        services: 'Servicios y precios',
        materials: 'Productos que usas',
        costSheet: 'Calcula cuánto te queda',
        reports: 'Cómo va tu negocio',
        config: 'Monedas y meta'
    };

    const isSubView = ['services', 'materials', 'costSheet', 'reports', 'config'].includes(view);
    const syncing = syncStatus === 'syncing';
    const hasPending = Number(pendingCount) > 0;
    const syncTitle = hasPending
        ? `${pendingCount} cambio(s) pendiente(s) por sincronizar`
        : lastSyncAt
            ? `Última sincronización: ${new Date(lastSyncAt).toLocaleString('es-CU')}`
            : 'Sincronizar datos';

    return (
        <header className="app-topbar" style={{ top: 'env(safe-area-inset-top)' }} data-name="top-bar" data-file="components/TopBar.js">
            <div className="flex items-center gap-3 min-w-0">
                {isSubView && (
                    <button type="button" aria-label="Volver al menú" onClick={onBack} className="topbar-action">
                        <div className="icon-arrow-left text-xl text-[var(--text-main)]"></div>
                    </button>
                )}
                {!isSubView && (
                    <div className="topbar-logo">
                        <img src="icons/icon-192x192.png" alt="Roma Finanzas" className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="topbar-eyebrow">Roma Finanzas</p>
                    <h1 className="topbar-title">{titles[view] || 'Roma Finanzas'}</h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onSync}
                    disabled={syncing}
                    title={syncTitle}
                    aria-label={syncTitle}
                    className={`topbar-action relative ${
                        hasPending ? 'topbar-action--pending' :
                        isOnline === false ? 'topbar-action--offline' :
                        'topbar-action--online'
                    }`}
                >
                    <div className={`${syncing ? 'icon-loader-circle animate-spin' : 'icon-refresh-cw'} text-sm`}></div>
                    {hasPending && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-orange-700 text-white text-[10px] leading-4 text-center">
                            {pendingCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={onLogout}
                    title={authUser?.email ? `Salir de ${authUser.email}` : 'Salir'}
                    aria-label={authUser?.email ? `Salir de ${authUser.email}` : 'Salir'}
                    className="topbar-action topbar-action--logout"
                >
                    <div className="icon-log-out text-gray-500"></div>
                </button>
            </div>
        </header>
    );
}
