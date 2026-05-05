function CostSheet({ onBack }) {
    const [selectedService, setSelectedService] = React.useState('');
    
    return (
        <div className="p-4 pb-10" data-name="cost-sheet" data-file="views/CostSheet.js">
            <p className="text-sm text-gray-600 mb-6 px-1">Calcula el costo real de un servicio sumando los materiales utilizados y tu tiempo.</p>
            
            <div className="space-y-5">
                <div className="card p-4 bg-[var(--bg-color)] shadow-inner border-gray-200">
                    <label className="label">1. Seleccionar Servicio</label>
                    <select 
                        className="input-field bg-white" 
                        value={selectedService} 
                        onChange={e => setSelectedService(e.target.value)}
                    >
                        <option value="">Elegir servicio...</option>
                        <option value="1">Balayage ($50 USD)</option>
                        <option value="2">Uñas Acrílicas (2500 CUP)</option>
                    </select>
                </div>

                {selectedService && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="label !mb-0">2. Materiales a utilizar</label>
                            <button className="text-[var(--primary)] text-sm font-medium flex items-center gap-1">
                                <div className="icon-plus text-xs"></div> Añadir
                            </button>
                        </div>
                        
                        <div className="card p-0 overflow-hidden border border-gray-200 mb-6">
                            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <p className="font-medium text-sm">Polvo Decolorante</p>
                                    <p className="text-xs text-gray-500">1 uso aplicado</p>
                                </div>
                                <span className="font-semibold text-sm">$2.00 USD</span>
                            </div>
                            <div className="p-3 flex justify-between items-center bg-gray-50">
                                <div>
                                    <p className="font-medium text-sm">Tinte Rubio</p>
                                    <p className="text-xs text-gray-500">0.5 uso aplicado</p>
                                </div>
                                <span className="font-semibold text-sm">$4.50 USD</span>
                            </div>
                        </div>

                        <div className="card bg-gray-900 text-white p-5 border-none mb-6 shadow-lg">
                            <h3 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Resultado (Estimado en CUP)</h3>
                            
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-300">Precio Cobrado</span>
                                    <span>17,500 CUP</span>
                                </div>
                                <div className="flex justify-between text-sm text-red-400">
                                    <span>Costo Materiales</span>
                                    <span>- 2,275 CUP</span>
                                </div>
                            </div>
                            
                            <div className="border-t border-gray-700 pt-4 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">Ganancia Neta</p>
                                    <p className="text-2xl font-bold text-green-400">15,225 <span className="text-sm font-normal">CUP</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 mb-1">Margen</p>
                                    <p className="font-bold text-white bg-white/10 px-2 py-1 rounded">87%</p>
                                </div>
                            </div>
                        </div>

                        <button className="btn-primary">
                            Guardar Ficha
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}