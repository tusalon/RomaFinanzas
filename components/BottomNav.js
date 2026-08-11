function BottomNav({ currentView, onNavigate }) {
    const navItems = [
        { id: 'dashboard', icon: 'icon-house', label: 'Inicio' },
        { id: 'income', icon: 'icon-square-plus', label: 'Cobrar' },
        { id: 'expenses', icon: 'icon-square-minus', label: 'Gasto' },
        { id: 'menu', icon: 'icon-menu', label: 'Más' }
    ];

    return (
        <nav aria-label="Navegación principal" className="app-bottom-nav pb-safe" data-name="bottom-nav" data-file="components/BottomNav.js">
            <div className="bottom-nav-inner">
                {navItems.map(item => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => onNavigate(item.id)}
                            className={`bottom-nav-item ${isActive ? 'is-active' : ''}`}
                        >
                            <span className="bottom-nav-icon"><span className={`${item.icon}`}></span></span>
                            <span className="bottom-nav-label">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
