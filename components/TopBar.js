function TopBar({ view, onBack, onLogout, authUser }) {
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

    return (
        <header className="fixed top-0 left-0 right-0 max-w-md mx-auto h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 flex items-center px-4 justify-between" data-name="top-bar" data-file="components/TopBar.js">
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
            
            <button
                type="button"
                onClick={onLogout}
                title={authUser?.email ? `Salir de ${authUser.email}` : 'Salir'}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 active:scale-95 transition-transform"
            >
                <div className="icon-log-out text-gray-500"></div>
            </button>
        </header>
    );
}
