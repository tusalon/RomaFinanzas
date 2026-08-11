function Menu({ onNavigate }) {
    const { state } = useFinanceApp();
    const hasServices = (state.services || []).some((service) => service.active);
    const hasMaterials = (state.materials || []).length > 0;
    const hasCostSheets = (state.costSheets || []).length > 0;
    const completedSteps = [hasServices, hasMaterials, hasCostSheets].filter(Boolean).length;
    const setupItems = [
        { id: 'services', icon: 'icon-scissors', step: '1', label: 'Crea tus servicios', desc: 'Pon el nombre y cuánto cobras.', done: hasServices, color: 'text-purple-600', bg: 'bg-purple-100' },
        { id: 'materials', icon: 'icon-box', step: '2', label: 'Añade lo que usas', desc: 'Productos, precio y cuántas citas rinden.', done: hasMaterials, color: 'text-blue-600', bg: 'bg-blue-100' },
        { id: 'costSheet', icon: 'icon-calculator', step: '3', label: 'Calcula cuánto te queda', desc: 'Descubre la ganancia de cada servicio.', done: hasCostSheets, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary-light)]' }
    ];
    const nextStep = setupItems.find((item) => !item.done) || {
        id: 'income',
        label: 'Anota tu próximo cobro',
        desc: 'Ya estás lista para llevar el día a día.'
    };

    return (
        <div className="menu-screen p-4" data-name="menu" data-file="views/Menu.js">
            <div className="menu-hero mb-5">
                <div className="menu-hero__glow"></div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3">
                        <p className="menu-hero__eyebrow">Tu espacio de trabajo</p>
                        <span className="menu-hero__progress-label">{completedSteps}/3 listo</span>
                    </div>
                    <div className="menu-hero__progress"><span style={{ width: `${(completedSteps / 3) * 100}%` }}></span></div>
                    <p className="text-xs font-bold uppercase tracking-wide text-pink-200 mt-5">Siguiente paso</p>
                    <h2 className="text-2xl font-black mt-1 tracking-tight">{nextStep.label}</h2>
                    <p className="text-sm text-white/70 mt-1">{nextStep.desc}</p>
                </div>
                <button type="button" onClick={() => onNavigate(nextStep.id)} className="btn-primary mt-4">
                    Continuar
                    <div className="icon-arrow-right text-sm"></div>
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <button type="button" onClick={() => onNavigate('income')} className="quick-action quick-action--income">
                    <div className="quick-action__icon"><div className="icon-coins"></div></div>
                    <span className="block font-bold text-gray-900">Anotar cobro</span>
                    <span className="block text-xs text-gray-500 mt-1">Servicio y propina</span>
                </button>
                <button type="button" onClick={() => onNavigate('expenses')} className="quick-action quick-action--expense">
                    <div className="quick-action__icon"><div className="icon-receipt"></div></div>
                    <span className="block font-bold text-gray-900">Anotar gasto</span>
                    <span className="block text-xs text-gray-500 mt-1">Dinero que salió</span>
                </button>
            </div>

            <h2 className="text-lg font-bold mb-3">Prepara tus cálculos</h2>
            <div className="space-y-3">
                {setupItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className={`setup-step ${item.done ? 'is-done' : ''}`}
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.done ? 'bg-green-100' : item.bg}`}>
                            <div className={`${item.done ? 'icon-circle-check text-green-700' : item.icon + ' ' + item.color} text-2xl`}></div>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Paso {item.step}</p>
                            <h3 className="font-bold text-gray-900">{item.label}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <div className="icon-chevron-right text-gray-300"></div>
                    </button>
                ))}
            </div>

            <details className="simple-details mt-5">
                <summary>Ver otras opciones</summary>
                <div className="space-y-2 pt-3">
                    <button type="button" onClick={() => onNavigate('reports')} className="simple-link-button">
                        <div className="icon-chart-no-axes-combined text-green-700"></div>
                        <span><strong>Cómo va tu negocio</strong><small>Semana, mes y servicios</small></span>
                        <div className="icon-chevron-right text-gray-300 ml-auto"></div>
                    </button>
                    <button type="button" onClick={() => onNavigate('config')} className="simple-link-button">
                        <div className="icon-settings text-gray-600"></div>
                        <span><strong>Monedas y meta</strong><small>Tasas de cambio y ganancia</small></span>
                        <div className="icon-chevron-right text-gray-300 ml-auto"></div>
                    </button>
                </div>
            </details>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-400 mb-2">Roma Finanzas v{window.ROMA_APP_VERSION || '1.1.0'}</p>
                <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    Powered by <span className="font-bold text-gray-600">RservasRoma</span>
                </p>
            </div>
        </div>
    );
}
