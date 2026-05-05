function Expenses() {
    return (
        <div className="p-4" data-name="expenses" data-file="views/Expenses.js">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100 mb-6 flex gap-3">
                <div className="icon-receipt text-red-600 mt-1"></div>
                <p className="text-sm text-red-800">Registra compras de materiales, pagos de local u otros gastos del salón.</p>
            </div>

            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
                <div>
                    <label className="label">Categoría de Gasto</label>
                    <select className="input-field">
                        <option value="">Selecciona una categoría...</option>
                        <option>Materiales y Productos</option>
                        <option>Alquiler / Local</option>
                        <option>Salarios</option>
                        <option>Servicios (Luz, Agua, Internet)</option>
                        <option>Dietas / Merienda</option>
                        <option>Otros</option>
                    </select>
                </div>

                <div>
                    <label className="label">Descripción</label>
                    <input type="text" className="input-field" placeholder="Ej. Compra de tinte rubio" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Monto</label>
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

                <button type="submit" className="w-full bg-gray-900 text-white font-medium py-3 px-4 rounded-xl shadow-sm active:scale-[0.98] transition-transform duration-150 flex items-center justify-center gap-2 mt-6">
                    Registrar Gasto
                </button>
            </form>
        </div>
    );
}