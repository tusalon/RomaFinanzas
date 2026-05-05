function Materials({ onBack }) {
    return (
        <div className="p-4" data-name="materials" data-file="views/Materials.js">
            <button className="btn-secondary mb-6 border-dashed border-2 text-blue-600 border-blue-200 bg-blue-50/50">
                <div className="icon-plus"></div>
                Registrar Nuevo Material
            </button>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Inventario Básico</h3>
            
            <div className="space-y-3">
                {INITIAL_DATA.materials.map(mat => (
                    <div key={mat.id} className="card p-4">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-900">{mat.name}</h4>
                            <div className="bg-gray-100 rounded-lg px-2 py-1 text-right">
                                <p className="text-[10px] text-gray-500 uppercase">Costo Total</p>
                                <p className="font-bold text-sm">{mat.cost} {mat.currency}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm mt-3 pt-3 border-t border-gray-100">
                            <div className="flex-1">
                                <p className="text-gray-500 text-xs mb-0.5">Rendimiento</p>
                                <p className="font-semibold text-gray-700">{mat.uses} usos</p>
                            </div>
                            <div className="flex-1 text-right">
                                <p className="text-gray-500 text-xs mb-0.5">Costo por uso</p>
                                <p className="font-bold text-[var(--primary)]">{mat.costPerUse} {mat.currency}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}