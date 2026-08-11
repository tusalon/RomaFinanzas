function Income() {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const activeServiceSignature = activeServices.map((service) => String(service.id)).join('|');
    const manualIncomeEntries = (state.incomeEntries || []).filter((entry) => String(entry.id || '').startsWith('inc_'));
    const [form, setForm] = React.useState({
        date: getTodayKey(),
        serviceId: state.services[0] ? state.services[0].id : '',
        client: '',
        amount: state.services[0] ? state.services[0].price : 0,
        currency: state.services[0] ? state.services[0].currency : state.config.mainCurrency,
        tipAmount: '',
        tipCurrency: state.services[0] ? state.services[0].currency : state.config.mainCurrency,
        paymentMethod: 'Efectivo',
        note: ''
    });
    const [savedMessage, setSavedMessage] = React.useState('');
    const [formError, setFormError] = React.useState('');
    const [editingId, setEditingId] = React.useState('');

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    React.useEffect(() => {
        if (activeServices.length === 0) return;

        const serviceStillExists = activeServices.some((service) => String(service.id) === String(form.serviceId));
        if (form.serviceId && serviceStillExists) return;

        const firstService = activeServices[0];
        setForm((current) => ({
            ...current,
            serviceId: firstService.id,
            amount: firstService.price,
            currency: firstService.currency || state.config.mainCurrency,
            tipCurrency: firstService.currency || state.config.mainCurrency
        }));
    }, [activeServiceSignature, form.serviceId, state.config.mainCurrency]);

    const selectService = (serviceId) => {
        const service = state.services.find((item) => item.id === serviceId);
        setForm((current) => ({
            ...current,
            serviceId,
            amount: service ? service.price : current.amount,
            currency: service ? service.currency : current.currency,
            tipCurrency: service ? service.currency : current.tipCurrency
        }));
    };

    const submitIncome = async (event) => {
        event.preventDefault();
        setFormError('');
        if (activeServices.length === 0) {
            setSavedMessage('Primero crea o sincroniza un servicio.');
            return;
        }

        if (!form.date || toNumber(form.amount) <= 0) {
            setFormError('Selecciona una fecha y escribe un monto mayor que cero.');
            return;
        }
        if (toNumber(form.tipAmount) < 0) {
            setFormError('La propina no puede ser negativa.');
            return;
        }

        const duplicateBooking = !editingId && normalizeFinanceText(form.client) && (state.incomeEntries || []).some((entry) => (
            entry.source === 'reserva'
            && entry.date === form.date
            && String(entry.serviceId) === String(form.serviceId)
            && normalizeFinanceText(entry.client) === normalizeFinanceText(form.client)
        ));
        if (duplicateBooking) {
            setFormError('Esta cita ya llegó desde RservasRoma. No hace falta registrarla otra vez.');
            return;
        }

        await actions.addIncome({
            ...form,
            id: editingId || undefined,
            amount: toNumber(form.amount),
            tipAmount: Math.max(toNumber(form.tipAmount), 0)
        });
        const selected = activeServices.find((service) => String(service.id) === String(form.serviceId));
        setSavedMessage(editingId ? 'Cobro actualizado.' : 'Cobro guardado.');
        setEditingId('');
        setForm((current) => ({
            ...current,
            date: getTodayKey(),
            client: '',
            note: '',
            tipAmount: '',
            amount: selected?.price || current.amount,
            currency: selected?.currency || current.currency,
            tipCurrency: selected?.currency || current.tipCurrency
        }));
    };

    const editIncome = (entry) => {
        setEditingId(entry.id);
        setSavedMessage('');
        setFormError('');
        setForm({
            date: entry.date || getTodayKey(),
            serviceId: entry.serviceId || activeServices[0]?.id || '',
            client: entry.client || '',
            amount: entry.amount,
            currency: entry.currency || state.config.mainCurrency,
            tipAmount: entry.tipAmount || '',
            tipCurrency: entry.tipCurrency || entry.currency || state.config.mainCurrency,
            paymentMethod: entry.paymentMethod || 'Efectivo',
            note: entry.note || ''
        });
        window.scrollTo(0, 0);
    };

    const deleteIncome = async (entry) => {
        const label = entry.client || 'este cobro';
        const confirmed = window.confirm(`¿Eliminar el cobro de "${label}"?`);
        if (!confirmed) return;

        await actions.deleteIncome(entry.id);
        setSavedMessage('Cobro eliminado.');
    };

    return (
        <div className="form-screen p-4" data-name="income" data-file="views/Income.js">
            <div className="screen-intro screen-intro--income mb-6 flex gap-3">
                <div className="icon-coins text-green-600 mt-1"></div>
                <p className="text-sm text-green-800">Anota lo que cobraste por un servicio. Solo necesitas servicio, precio y forma de pago.</p>
            </div>

            <form className="space-y-5" onSubmit={submitIncome}>
                <div>
                    <label className="label">Fecha</label>
                    <input type="date" className="input-field" value={form.date} onChange={(event) => updateField('date', event.target.value)} max={getTodayKey()} required />
                </div>
                <div>
                    <label className="label">Servicio realizado</label>
                    <select className="input-field" value={form.serviceId} onChange={(event) => selectService(event.target.value)}>
                        {activeServices.map((service) => (
                            <option key={service.id} value={service.id}>{service.name}</option>
                        ))}
                    </select>
                    {activeServices.length === 0 && (
                        <p className="text-sm text-gray-500 mt-2">Primero crea un servicio para poder anotar el cobro.</p>
                    )}
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

                <details className="simple-details" open={toNumber(form.tipAmount) > 0 || undefined}>
                    <summary>Añadir propina (opcional)</summary>
                    <div className="rounded-2xl bg-pink-50/60 p-4 mt-3">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="icon-heart text-pink-600 mt-0.5"></div>
                        <div>
                            <p className="font-bold text-gray-900">Propina (opcional)</p>
                            <p className="text-xs text-gray-600 mt-1">Se suma al dinero recibido, pero no cambia el precio del servicio.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Monto</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input-field bg-white font-bold"
                                placeholder="0"
                                value={form.tipAmount}
                                onChange={(event) => updateField('tipAmount', event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Moneda</label>
                            <select className="input-field bg-white" value={form.tipCurrency} onChange={(event) => updateField('tipCurrency', event.target.value)}>
                                {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                            </select>
                        </div>
                    </div>
                    {toNumber(form.tipAmount) > 0 && form.tipCurrency === form.currency && (
                        <p className="text-sm font-bold text-pink-700 mt-3">
                            Total recibido: {formatMoney(toNumber(form.amount) + toNumber(form.tipAmount), form.currency)}
                        </p>
                    )}
                    </div>
                </details>

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

                <details className="simple-details" open={(Boolean(form.client) || Boolean(form.note)) || undefined}>
                    <summary>Añadir cliente o una nota (opcional)</summary>
                    <div className="space-y-4 pt-3">
                        <div>
                            <label className="label">Nombre del cliente</label>
                            <input type="text" className="input-field bg-white" placeholder="Ej. Laura" value={form.client} onChange={(event) => updateField('client', event.target.value)} />
                        </div>
                        <div>
                            <label className="label">Nota</label>
                            <textarea className="input-field bg-white min-h-20" placeholder="Ej. Descuento o pago pendiente" value={form.note} onChange={(event) => updateField('note', event.target.value)}></textarea>
                        </div>
                    </div>
                </details>

                {savedMessage && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">{savedMessage}</div>}
                {formError && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">{formError}</div>}
                {state.syncError && <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">{state.syncError}</div>}

                <button type="submit" disabled={activeServices.length === 0} className="btn-primary mt-6 disabled:opacity-60">
                    {editingId ? 'Actualizar cobro' : 'Guardar cobro'}
                </button>
            </form>

            {manualIncomeEntries.length > 0 && (
                <div className="card p-4 mt-6">
                    <h3 className="font-bold text-gray-900 mb-3">Últimos cobros anotados</h3>
                    <div className="space-y-3">
                        {manualIncomeEntries.slice(0, 20).map((entry) => (
                            <div key={entry.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 truncate">{entry.client || 'Cobro manual'}</p>
                                        <p className="text-xs text-gray-500">{entry.date} - {entry.paymentMethod || 'Pago'}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-green-700">{formatMoney(entry.amount, entry.currency || state.config.mainCurrency)}</p>
                                        {toNumber(entry.tipAmount) > 0 && (
                                            <p className="text-xs font-bold text-pink-600 mt-1">+ {formatMoney(entry.tipAmount, entry.tipCurrency || entry.currency)} de propina</p>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            <button type="button" onClick={() => editIncome(entry)} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 px-2 py-1 rounded-lg">Editar</button>
                                            <button type="button" onClick={() => deleteIncome(entry)} className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg">Eliminar</button>
                                        </div>
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
