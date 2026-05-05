function Dashboard() {
    return (
        <div className="p-4 space-y-6" data-name="dashboard" data-file="views/Dashboard.js">
            
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">Hoy, 5 Mayo</h2>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <div className="icon-circle-check text-sm"></div>
                    Negocio Abierto
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="card bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white p-5 border-none">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <div className="icon-arrow-down text-xl text-white"></div>
                        </div>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-1">Ingresos de hoy</p>
                    <h3 className="text-2xl font-bold">12,500 <span className="text-sm font-normal">CUP</span></h3>
                </div>

                <div className="card p-5">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                            <div className="icon-arrow-up text-xl text-red-500"></div>
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium mb-1">Gastos de hoy</p>
                    <h3 className="text-2xl font-bold text-gray-900">3,200 <span className="text-sm font-normal">CUP</span></h3>
                </div>
            </div>

            <div className="card bg-gray-900 text-white p-5">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Ganancia Estimada</p>
                        <h3 className="text-3xl font-bold text-white">9,300 <span className="text-base font-normal text-gray-400">CUP</span></h3>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-[var(--primary)] flex items-center justify-center bg-gray-800">
                        <div className="icon-chart-pie text-xl text-[var(--primary)]"></div>
                    </div>
                </div>
                
                <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm text-gray-300">Margen Promedio</span>
                    <span className="text-sm font-bold text-green-400 flex items-center gap-1">
                        <div className="icon-arrow-up text-xs"></div> 74.4%
                    </span>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold mb-3">Actividad Reciente</h3>
                <div className="space-y-3">
                    <div className="card p-3 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                            <div className="icon-scissors text-green-600"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">Balayage</p>
                            <p className="text-xs text-gray-500">10:30 AM • María</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold text-green-600">+ $50</p>
                            <p className="text-xs text-gray-500">USD</p>
                        </div>
                    </div>
                    <div className="card p-3 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                            <div className="icon-coffee text-red-600"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">Café para clientes</p>
                            <p className="text-xs text-gray-500">09:15 AM</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold text-red-600">- 500</p>
                            <p className="text-xs text-gray-500">CUP</p>
                        </div>
                    </div>
                </div>
            </div>
            
        </div>
    );
}