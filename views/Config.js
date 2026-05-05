function Config({ onBack }) {
    return (
        <div className="p-4 pb-10" data-name="config" data-file="views/Config.js">
            
            <div className="card p-5 mb-6">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                        <div className="icon-coins text-gray-600"></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Moneda Principal</h3>
                        <p className="text-xs text-gray-500">Para reportes y cálculos totales</p>
                    </div>
                </div>
                
                <select className="input-field font-semibold">
                    <option value="CUP">CUP (Peso Cubano)</option>
                    <option value="USD">USD (Dólar)</option>
                </select>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Tasas de Cambio Actuales</h3>
            <div className="card p-0 overflow-hidden mb-8">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 w-12">1 USD</span>
                        <div className="icon-arrow-right text-gray-400 text-sm"></div>
                    </div>
                    <div className="flex items-center gap-2 w-32">
                        <input type="number" defaultValue="350" className="input-field !py-2 !px-3 text-right font-bold" />
                        <span className="text-sm text-gray-500 font-medium">CUP</span>
                    </div>
                </div>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 w-12">1 MLC</span>
                        <div className="icon-arrow-right text-gray-400 text-sm"></div>
                    </div>
                    <div className="flex items-center gap-2 w-32">
                        <input type="number" defaultValue="340" className="input-field !py-2 !px-3 text-right font-bold bg-white" />
                        <span className="text-sm text-gray-500 font-medium">CUP</span>
                    </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 w-12">1 EUR</span>
                        <div className="icon-arrow-right text-gray-400 text-sm"></div>
                    </div>
                    <div className="flex items-center gap-2 w-32">
                        <input type="number" defaultValue="360" className="input-field !py-2 !px-3 text-right font-bold" />
                        <span className="text-sm text-gray-500 font-medium">CUP</span>
                    </div>
                </div>
            </div>

            <div className="card p-5 border-dashed border-2 border-gray-200 bg-transparent">
                <h3 className="font-bold text-gray-900 mb-1">Margen Deseado</h3>
                <p className="text-xs text-gray-500 mb-4">La app te avisará si la ficha de costo baja de este margen.</p>
                <div className="flex items-center gap-3">
                    <input type="range" min="10" max="100" defaultValue="60" className="flex-1 accent-[var(--primary)]" />
                    <span className="font-bold text-lg text-[var(--primary)]">60%</span>
                </div>
            </div>

            <button className="btn-primary mt-6">Guardar Cambios</button>

        </div>
    );
}