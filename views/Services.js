function Services({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const emptyServiceForm = {
        name: '',
        category: '',
        price: '',
        currency: state.config.mainCurrency || 'CUP',
        duration: ''
    };
    const [showCreateForm, setShowCreateForm] = React.useState(activeServices.length === 0);
    const [editingId, setEditingId] = React.useState('');
    const [form, setForm] = React.useState({ price: '', currency: state.config.mainCurrency || 'CUP', duration: '' });
    const [newService, setNewService] = React.useState(emptyServiceForm);
    const [savedMessage, setSavedMessage] = React.useState('');

    const updateNewService = (field, value) => {
        setNewService((current) => ({ ...current, [field]: value }));
    };

    const resetNewService = () => {
        setNewService({
            name: '',
            category: '',
            price: '',
            currency: state.config.mainCurrency || 'CUP',
            duration: ''
        });
    };

    const startEdit = (service) => {
        setEditingId(service.id);
        setSavedMessage('');
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

    const createService = async (event) => {
        event.preventDefault();
        await actions.saveService({
            name: newService.name,
            category: String(newService.category || '').trim() || 'General',
            price: toNumber(newService.price),
            currency: newService.currency || state.config.mainCurrency || 'CUP',
            duration: Math.max(toNumber(newService.duration), 1),
            active: true
        });
        resetNewService();
        setShowCreateForm(false);
        setSavedMessage('Servicio creado para este negocio.');
    };

    const saveEdit = async (service) => {
        await actions.saveService({
            ...service,
            price: toNumber(form.price),
            currency: form.currency || state.config.mainCurrency || 'CUP',
            duration: Math.max(toNumber(form.duration), 1)
        });
        setSavedMessage('Servicio actualizado.');
        cancelEdit();
    };

    const deleteService = async (service) => {
        const confirmed = window.confirm(`Eliminar "${service.name}" de Roma Finanzas?`);
        if (!confirmed) return;

        await actions.deleteService(service);
        if (String(editingId) === String(service.id)) {
            cancelEdit();
        }
        setSavedMessage('Servicio eliminado.');
    };

    return (
        <div className="catalog-screen p-4" data-name="services" data-file="views/Services.js">
            <div className="screen-intro screen-intro--service mb-5">
                <p className="text-sm font-bold text-blue-950">¿Qué haces y cuánto cobras?</p>
                <p className="text-xs text-blue-800 mt-1">
                    Guarda cada servicio una sola vez. Después podrás elegirlo rápidamente al anotar un cobro.
                </p>
            </div>

            <button
                type="button"
                onClick={() => {
                    setShowCreateForm((current) => !current);
                    setSavedMessage('');
                    cancelEdit();
                }}
                className="btn-secondary border-dashed border-2 text-blue-600 border-blue-200 bg-blue-50/50 mb-5"
            >
                <div className={showCreateForm ? 'icon-x' : 'icon-plus'}></div>
                {showCreateForm ? 'Cerrar formulario' : 'Crear servicio'}
            </button>

            {showCreateForm && (
                <form className="card p-4 mb-5 space-y-4" onSubmit={createService}>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Nuevo servicio</p>
                        <h3 className="font-bold text-gray-900">Solo necesitamos estos datos</h3>
                    </div>

                    <div>
                        <label className="label">Nombre del servicio</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ej. Manicura semipermanente"
                            value={newService.name}
                            onChange={(event) => updateNewService('name', event.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-[1fr_110px] gap-2 mobile-stack">
                        <div>
                            <label className="label">Precio de venta</label>
                            <input
                                className="input-field font-bold"
                                value={newService.price}
                                onChange={(event) => updateNewService('price', event.target.value)}
                                inputMode="decimal"
                                placeholder="Ej. 2500"
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Moneda</label>
                            <select
                                className="input-field"
                                value={newService.currency}
                                onChange={(event) => updateNewService('currency', event.target.value)}
                            >
                                {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="label">¿Cuánto demora? (minutos)</label>
                        <input
                            className="input-field"
                            value={newService.duration}
                            onChange={(event) => updateNewService('duration', event.target.value)}
                            inputMode="numeric"
                            placeholder="Ej. 60"
                            required
                        />
                    </div>

                    <details className="simple-details">
                        <summary>Añadir tipo de servicio (opcional)</summary>
                        <div className="pt-3">
                            <label className="label">Tipo</label>
                            <input
                                type="text"
                                className="input-field bg-white"
                                placeholder="Ej. Uñas, Cabello, Barbería"
                                value={newService.category}
                                onChange={(event) => updateNewService('category', event.target.value)}
                            />
                        </div>
                    </details>

                    <button type="submit" className="btn-primary">
                        <div className="icon-save text-sm"></div>
                        Guardar servicio
                    </button>
                </form>
            )}

            {savedMessage && (
                <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm mb-5">
                    {savedMessage}
                </div>
            )}

            {state.syncError && (
                <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm mb-5">
                    {state.syncError}
                </div>
            )}

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Tus servicios</h3>

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
                                    <div className="flex gap-2 shrink-0">
                                        <button className="btn-secondary w-auto px-3 py-2 text-sm" onClick={() => startEdit(srv)}>
                                            Editar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="mt-4 space-y-3">
                                    <div className="grid grid-cols-[1fr_110px] gap-2 mobile-stack">
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
                                        placeholder="Duracion en minutos"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button className="btn-secondary" onClick={cancelEdit}>Cancelar</button>
                                        <button className="btn-primary" onClick={() => saveEdit(srv)}>Guardar</button>
                                    </div>
                                    <button className="w-full text-sm font-bold text-red-700 py-2" onClick={() => deleteService(srv)}>Eliminar este servicio</button>
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
                        No hay servicios cargados todavia. Crea el primero para empezar a calcular cuanto te queda limpio.
                    </div>
                )}
            </div>
        </div>
    );
}
