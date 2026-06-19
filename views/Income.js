function Income() {
    const { state, actions } = useFinanceApp();
    const manualIncomeEntries = (state.incomeEntries || []).filter((entry) => String(entry.id || '').startsWith('inc_'));
    const [form, setForm] = React.useState({
        serviceId: state.services[0] ? state.services[0].id : '',
        client: '',
        amount: state.services[0] ? state.services[0].price : 0,
        currency: state.services[0] ? state.services[0].currency : state.config.mainCurrency,
        paymentMethod: 'Efectivo'
    });
    const [savedMessage, setSavedMessage] = React.useState('');

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const selectService = (serviceId) => {
        const service = state.services.find((item) => item.id === serviceId);
        setForm((current) => ({
            ...current,
            serviceId,
            amount: service ? service.price : current.amount,
            currency: service ? service.currency : current.currency
        }));
    };

    const submitIncome = async (event) => {
        event.preventDefault();
        await actions.addIncome({
            ...form,
            amount: toNumber(form.amount)
        });
        setSavedMessage('Ingreso guardado para este negocio.');
    };

    const deleteIncome = async (entry) => {
        const label = entry.client || 'este ingreso';
        const confirmed = window.confirm(`Eliminar el ingreso de "${label}"?`);
        if (!confirmed) return;

        await actions.deleteIncome(entry.id);
        setSavedMessage('Ingreso eliminado.');
    };

    return (
        <div className="p-4" data-name="income" data-file="views/Income.js">
            <div className="bg-green-50 rounded-2xl p-4 border border-green-100 mb-6 flex gap-3">
                <div className="icon-coins text-green-600 mt-1"></div>
                <p className="text-sm text-green-800">Registra un servicio completado para sumarlo a tus ingresos del día.</p>
            </div>

            <form className="space-y-5" onSubmit={submitIncome}>
                <div>
                    <label className="label">Servicio realizado</label>
                    <select className="input-field" value={form.serviceId} onChange={(event) => selectService(event.target.value)}>
                        {state.services.filter((service) => service.active).map((service) => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="label">Cliente (opcional)</label>
                    <input type="text" className="input-field" placeholder="Nombre del cliente" value={form.client} onChange={(event) => updateField('client', event.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Precio cobrado</label>
                        <input type="text"
                                inputMode="decimal" className="input-field font-bold text-lg" placeholder="0.00" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} />
                    </div>
                    <div>
                        <label className="label">Moneda</label>
                        <select className="input-field" value={form.currency} onChange={(event) => updateField('currency', event.target.value)}>
                            {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="label">Método de pago</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        {['Efectivo', 'Transferencia'].map((method) => (
                            <label key={method} className="relative flex cursor-pointer">
                                <input type="radio" name="payment" className="peer sr-only" checked={form.paymentMethod === method} onChange={() => updateField('paymentMethod', method)} />
                                <div className="w-full card border-2 border-transparent peer-checked:border-[var(--primary)] peer-checked:bg-[var(--primary-light)] text-center py-3">
                                    <div className={`${method === 'Efectivo' ? 'icon-banknote' : 'icon-credit-card'} text-gray-600 peer-checked:text-[var(--primary)] mb-1 mx-auto`}></div>
                                    <span className="text-sm font-medium">{method}</span>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {savedMessage && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">{savedMessage}</div>}
                {state.syncError && <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">{state.syncError}</div>}

                <button type="submit" className="btn-primary mt-6">
                    Guardar ingreso
                </button>
            </form>

            {manualIncomeEntries.length > 0 && (
                <div className="card p-4 mt-6">
                    <h3 className="font-bold text-gray-900 mb-3">Ingresos manuales registrados</h3>
                    <div className="space-y-3">
                        {manualIncomeEntries.slice(0, 20).map((entry) => (
                            <div key={entry.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 truncate">{entry.client || 'Ingreso manual'}</p>
                                        <p className="text-xs text-gray-500">{entry.date} - {entry.paymentMethod || 'Pago'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-green-700">{formatMoney(entry.amount, entry.currency || state.config.mainCurrency)}</p>
                                        <button
                                            type="button"
                                            onClick={() => deleteIncome(entry)}
                                            className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg mt-2"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
