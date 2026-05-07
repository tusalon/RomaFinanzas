function Config({ onBack }) {
    const { state, actions } = useFinanceApp();
    const [form, setForm] = React.useState({
        mainCurrency: state.config.mainCurrency,
        desiredMargin: state.config.desiredMargin,
        rates: { ...state.config.rates }
    });
    const [savedMessage, setSavedMessage] = React.useState('');

    const updateRate = (currency, value) => {
        setForm((current) => ({
            ...current,
            rates: {
                ...current.rates,
                [currency]: toNumber(value)
            }
        }));
    };

    const saveConfig = () => {
        actions.updateConfig({
            mainCurrency: form.mainCurrency,
            desiredMargin: toNumber(form.desiredMargin),
            rates: form.rates
        });
        setSavedMessage('Configuracion guardada localmente.');
    };

    return (
        <div className="p-4 pb-10" data-name="config" data-file="views/Config.js">
            <div className="card p-5 mb-6">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                        <div className="icon-coins text-gray-600"></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">Moneda principal</h3>
                        <p className="text-xs text-gray-500">Para reportes y calculos totales</p>
                    </div>
                </div>

                <select className="input-field font-semibold" value={form.mainCurrency} onChange={(event) => setForm((current) => ({ ...current, mainCurrency: event.target.value }))}>
                    <option value="CUP">CUP (Peso Cubano)</option>
                </select>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Tasas de cambio actuales</h3>
            <div className="card p-0 overflow-hidden mb-8">
                {['USD', 'MLC', 'EUR'].map((currency, index) => (
                    <div key={currency} className={`mobile-rate-row p-4 flex items-center justify-between ${index < 2 ? 'border-b border-gray-100' : ''} ${index === 1 ? 'bg-gray-50/50' : ''}`}>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 w-12">1 {currency}</span>
                            <div className="icon-arrow-right text-gray-400 text-sm"></div>
                        </div>
                        <div className="mobile-rate-input flex items-center gap-2 w-32">
                            <input
                                type="number"
                                value={form.rates[currency]}
                                onChange={(event) => updateRate(currency, event.target.value)}
                                className="input-field !py-2 !px-3 text-right font-bold bg-white"
                            />
                            <span className="text-sm text-gray-500 font-medium">CUP</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card p-5 border-dashed border-2 border-gray-200 bg-transparent">
                <h3 className="font-bold text-gray-900 mb-1">Margen deseado</h3>
                <p className="text-xs text-gray-500 mb-4">La app te avisara si la ficha de costo baja de este margen.</p>
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min="10"
                        max="100"
                        value={form.desiredMargin}
                        onChange={(event) => setForm((current) => ({ ...current, desiredMargin: toNumber(event.target.value) }))}
                        className="flex-1 accent-[var(--primary)]"
                    />
                    <span className="font-bold text-lg text-[var(--primary)]">{form.desiredMargin}%</span>
                </div>
            </div>

            {savedMessage && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm mt-6">{savedMessage}</div>}

            <button type="button" onClick={saveConfig} className="btn-primary mt-6">Guardar Cambios</button>
        </div>
    );
}
