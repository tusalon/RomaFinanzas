function Menu({ onNavigate }) {
    const menuItems = [
        { id: 'services', icon: 'icon-scissors', label: 'Mis Servicios', desc: 'Gestiona tu catálogo de servicios y precios', color: 'text-purple-600', bg: 'bg-purple-100' },
        { id: 'materials', icon: 'icon-box', label: 'Materiales y Productos', desc: 'Controla costos y rendimientos', color: 'text-blue-600', bg: 'bg-blue-100' },
        { id: 'costSheet', icon: 'icon-calculator', label: 'Ficha de Costo', desc: 'Calcula rentabilidad exacta por servicio', color: 'text-[var(--primary)]', bg: 'bg-[var(--primary-light)]' },
        { id: 'config', icon: 'icon-settings', label: 'Configuración', desc: 'Monedas, tasas de cambio y preferencias', color: 'text-gray-600', bg: 'bg-gray-200' },
    ];

    return (
        <div className="p-4" data-name="menu" data-file="views/Menu.js">
            <h2 className="text-xl font-bold mb-4">Herramientas</h2>
            
            <div className="space-y-3">
                {menuItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className="w-full card p-4 flex items-center gap-4 text-left hover:border-[var(--primary)] transition-colors active:bg-gray-50"
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.bg}`}>
                            <div className={`${item.icon} text-2xl ${item.color}`}></div>
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{item.label}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <div className="icon-chevron-right text-gray-300"></div>
                    </button>
                ))}
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-gray-400 mb-2">Roma Finanzas v1.0.0</p>
                <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    Powered by <span className="font-bold text-gray-600">RservasRoma</span>
                </p>
            </div>
        </div>
    );
}