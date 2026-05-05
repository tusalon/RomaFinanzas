function BottomNav({ currentView, onNavigate }) {
    const navItems = [
        { id: 'dashboard', icon: 'icon-chart-pie', label: 'Resumen' },
        { id: 'income', icon: 'icon-square-plus', label: 'Ingresos' },
        { id: 'expenses', icon: 'icon-square-minus', label: 'Gastos' },
        { id: 'menu', icon: 'icon-menu', label: 'Menú' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 pb-safe z-40" data-name="bottom-nav" data-file="components/BottomNav.js">
            <div className="flex justify-around items-center h-16 px-2">
                {navItems.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-[var(--primary)]' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <div className={`${item.icon} text-2xl ${isActive ? 'animate-bounce' : ''}`} style={{ animationIterationCount: 1 }}></div>
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}