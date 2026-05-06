function Services({ onBack }) {
    const { state } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);

    return (
        <div className="p-4" data-name="services" data-file="views/Services.js">
            <button className="btn-secondary mb-6 border-dashed border-2 text-[var(--primary)] border-[var(--primary-light)] bg-pink-50/50">
                <div className="icon-plus"></div>
                Crear Nuevo Servicio
            </button>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Catalogo Actual</h3>

            <div className="space-y-3">
                {activeServices.map((srv) => (
                    <div key={srv.id} className="card p-4 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-gray-900">{srv.name}</h4>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">{srv.category}</span>
                                <span><div className="icon-clock text-[10px] inline mr-1"></div>{srv.duration} min</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="font-bold text-lg">{formatMoney(srv.price, srv.currency)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
