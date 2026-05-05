function Income() {
    return (
        <div className="p-4" data-name="income" data-file="views/Income.js">
            <div className="bg-green-50 rounded-2xl p-4 border border-green-100 mb-6 flex gap-3">
                <div className="icon-coins text-green-600 mt-1"></div>
                <p className="text-sm text-green-800">Registra un servicio completado para añadirlo a tus ingresos del día.</p>
            </div>

            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
                <div>
                    <label className="label">Servicio Realizado</label>
                    <select className="input-field">
                        <option value="">Selecciona un servicio...</option>
                        <option value="1">Balayage</option>
                        <option value="2">Uñas Acrílicas</option>
                    </select>
                </div>

                <div>
                    <label className="label">Cliente (Opcional)</label>
                    <input type="text" className="input-field" placeholder="Nombre del cliente" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Precio Cobrado</label>
                        <input type="number" className="input-field font-bold text-lg" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="label">Moneda</label>
                        <select className="input-field">
                            <option>CUP</option>
                            <option>USD</option>
                            <option>MLC</option>
                            <option>EUR</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="label">Método de Pago</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <label className="relative flex cursor-pointer">
                            <input type="radio" name="payment" className="peer sr-only" defaultChecked />
                            <div className="w-full card border-2 border-transparent peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary-light)] text-center py-3">
                                <div className="icon-banknote text-gray-600 peer-checked:text-[var(--primary)] mb-1 mx-auto"></div>
                                <span className="text-sm font-medium">Efectivo</span>
                            </div>
                        </label>
                        <label className="relative flex cursor-pointer">
                            <input type="radio" name="payment" className="peer sr-only" />
                            <div className="w-full card border-2 border-transparent peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary-light)] text-center py-3">
                                <div className="icon-credit-card text-gray-600 peer-checked:text-[var(--primary)] mb-1 mx-auto"></div>
                                <span className="text-sm font-medium">Transferencia</span>
                            </div>
                        </label>
                    </div>
                </div>

                <button type="submit" className="btn-primary mt-6">
                    Guardar Ingreso
                </button>
            </form>
        </div>
    );
}