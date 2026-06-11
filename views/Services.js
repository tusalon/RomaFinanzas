function Services({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const [editingId, setEditingId] = React.useState('');
    const [form, setForm] = React.useState({ price: '', currency: state.config.mainCurrency || 'CUP', duration: '' });

    const startEdit = (service) => {
        setEditingId(service.id);
        setForm({
            price: String(service.price ?? ''),
            currency: service.currency || state.config.mainCurrency || 'CUP',
            duration: String(service.duration ?? '')
        });
    };

    const cancelEdit = () => {
        setEditingId('');
        setForm({ price: '', currency: state.config.mainCurrency || 'CUP', duration: '' });
    };

    const saveEdit = async (service) => {
        await actions.saveService({
            ...service,
            price: toNumber(form.price),
            currency: form.currency || state.config.mainCurrency || 'CUP',
            duration: Math.max(toNumber(form.duration), 1)
        });
        cancelEdit();
    };

    return (
        <div className="p-4" data-name="services" data-file="views/Services.js">
            <div className="card p-4 mb-5 bg-blue-50 border-blue-100">
                <p className="text-sm font-bold text-blue-950">Precios por servicio</p>
                <p className="text-xs text-blue-800 mt-1">
                    Si un servicio se cobra en USD, selecciona USD en ese servicio. Los reportes lo convertirán a tu moneda principal usando la tasa configurada.
                </p>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Catálogo actual</h3>

            <div className="space-y-3">
                {activeServices.map((srv) => {
                    const isEditing = String(editingId) === String(srv.id);

                    return (
                        <div key={srv.id} className="card p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h4 className="font-bold text-gray-900">{srv.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                                        <span className="bg-gray-100 px-2 py-0.5 rounded">{srv.category}</span>
                                        <span><div className="icon-clock text-[10px] inline mr-1"></div>{srv.duration} min</span>
                                    </p>
                                </div>
                                {!isEditing && (
                                    <button className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => startEdit(srv)}>
                                        Editar
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="mt-4 space-y-3">
                                    <div className="grid grid-cols-[1fr_110px] gap-2">
                                        <input
                                            className="input-field"
                                            value={form.price}
                                            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                                            inputMode="decimal"
                                            placeholder="Precio"
                                        />
                                        <select
                                            className="input-field"
                                            value={form.currency}
                                            onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                                        >
                                            {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                                        </select>
                                    </div>
                                    <input
                                        className="input-field"
                                        value={form.duration}
                                        onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}
                                        inputMode="numeric"
                                        placeholder="Duración en minutos"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button className="btn-secondary" onClick={cancelEdit}>Cancelar</button>
                                        <button className="btn-primary" onClick={() => saveEdit(srv)}>Guardar</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <span className="text-xs text-gray-500">Precio configurado</span>
                                    <span className="font-black text-xl text-[var(--primary)]">{formatMoney(srv.price, srv.currency)}</span>
                                </div>
                            )}
                        </div>
                    );
                })}

                {activeServices.length === 0 && (
                    <div className="card p-6 text-center text-gray-500">
                        No hay servicios cargados todavía. Sincroniza para traer los servicios del negocio.
                    </div>
                )}
            </div>
        </div>
    );
}
