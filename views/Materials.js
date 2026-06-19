function Materials({ onBack }) {
    const { state, actions } = useFinanceApp();
    const mainCurrency = state.config.mainCurrency;
    const [showForm, setShowForm] = React.useState((state.materials || []).length === 0);
    const [editingId, setEditingId] = React.useState(null);
    const [savedMessage, setSavedMessage] = React.useState('');
    const [form, setForm] = React.useState({
        name: '',
        cost: '',
        currency: mainCurrency,
        uses: '',
        unit: 'uso',
        stock: ''
    });

    const materials = state.materials || [];
    const costPerUse = getMaterialCostPerUse(form);
    const totalInventoryValue = materials.reduce((sum, material) => (
        sum + convertToMainCurrency(material.cost, material.currency, state.config)
    ), 0);

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const resetForm = () => {
        setEditingId(null);
        setForm({
            name: '',
            cost: '',
            currency: mainCurrency,
            uses: '',
            unit: 'uso',
            stock: ''
        });
    };

    const editMaterial = (material) => {
        setEditingId(material.id);
        setShowForm(true);
        setSavedMessage('');
        setForm({
            name: material.name || '',
            cost: material.cost || '',
            currency: material.currency || mainCurrency,
            uses: material.uses || '',
            unit: material.unit || 'uso',
            stock: material.stock || ''
        });
    };

    const submitMaterial = async (event) => {
        event.preventDefault();
        await actions.saveMaterial({
            id: editingId,
            ...form,
            cost: toNumber(form.cost),
            uses: Math.max(toNumber(form.uses), 1),
            stock: toNumber(form.stock)
        });
        setSavedMessage(editingId ? 'Material actualizado.' : 'Material guardado.');
        resetForm();
        setShowForm(false);
    };

    const deleteMaterial = async (material) => {
        const confirmed = window.confirm(`Eliminar "${material.name}" de materiales y productos?`);
        if (!confirmed) return;

        await actions.deleteMaterial(material.id);
        if (String(editingId) === String(material.id)) {
            resetForm();
            setShowForm(false);
        }
        setSavedMessage('Material eliminado.');
    };

    return (
        <div className="p-4 space-y-5" data-name="materials" data-file="views/Materials.js">
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex gap-3">
                <div className="icon-box text-blue-600 mt-1"></div>
                <div>
                    <p className="text-sm font-semibold text-blue-900">Controla materiales y productos.</p>
                    <p className="text-sm text-blue-800 mt-1">Registra cuánto cuesta cada producto y cuántas citas rinde para conocer el costo real por servicio.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400">Productos</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{materials.length}</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400">Inversión</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">{formatMoney(totalInventoryValue, mainCurrency)}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => {
                    resetForm();
                    setShowForm((current) => !current);
                    setSavedMessage('');
                }}
                className="btn-secondary border-dashed border-2 text-blue-600 border-blue-200 bg-blue-50/50"
            >
                <div className={showForm ? 'icon-x' : 'icon-plus'}></div>
                {showForm ? 'Cerrar formulario' : 'Registrar material o producto'}
            </button>

            {showForm && (
                <form className="card p-4 space-y-4" onSubmit={submitMaterial}>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">{editingId ? 'Editar producto' : 'Nuevo producto'}</p>
                        <h3 className="font-bold text-gray-900">Datos del material</h3>
                    </div>

                    <div>
                        <label className="label">Nombre</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ej. Top coat, lima, acrílico"
                            value={form.name}
                            onChange={(event) => updateField('name', event.target.value)}
                            required
                        />
                    </div>

                    <div className="mobile-stack grid grid-cols-[1fr_110px] gap-2">
                        <div>
                            <label className="label">Costo de compra</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                min="0"
                                className="input-field font-bold"
                                placeholder="Ej. 1500"
                                value={form.cost}
                                onChange={(event) => updateField('cost', event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Moneda</label>
                            <select
                                className="input-field"
                                value={form.currency}
                                onChange={(event) => updateField('currency', event.target.value)}
                            >
                                {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mobile-stack grid grid-cols-2 gap-2">
                        <div>
                            <label className="label">Rinde</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                min="1"
                                className="input-field font-bold"
                                placeholder="Ej. 20"
                                value={form.uses}
                                onChange={(event) => updateField('uses', event.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Unidad</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="uso, cita, ml"
                                value={form.unit}
                                onChange={(event) => updateField('unit', event.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Stock actual opcional</label>
                        <input
                            type="text"
                                inputMode="decimal"
                            min="0"
                            className="input-field"
                            placeholder="Ej. 2"
                            value={form.stock}
                            onChange={(event) => updateField('stock', event.target.value)}
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold text-blue-700 uppercase">Costo por uso</p>
                            <p className="text-sm text-blue-800">Esto es lo que se carga a cada cita.</p>
                        </div>
                        <strong className="text-xl text-blue-900">{formatMoney(costPerUse, form.currency || mainCurrency)}</strong>
                    </div>

                    <button type="submit" className="btn-primary w-full">
                        <div className="icon-save text-sm"></div>
                        {editingId ? 'Actualizar producto' : 'Guardar producto'}
                    </button>
                </form>
            )}

            {savedMessage && (
                <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">
                    {savedMessage}
                </div>
            )}

            {state.syncError && (
                <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">
                    {state.syncError}
                </div>
            )}

            <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Inventario básico</h3>

                {materials.length === 0 ? (
                    <div className="card p-5 text-center">
                        <div className="icon-package-open text-3xl text-gray-300 mb-2"></div>
                        <p className="font-bold text-gray-900">Aún no hay productos.</p>
                        <p className="text-sm text-gray-500 mt-1">Empieza registrando los materiales que más usas.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {materials.map((mat) => (
                            <div key={mat.id} className="card p-4">
                                <div className="flex justify-between items-start gap-3 mb-2">
                                    <div>
                                        <h4 className="font-bold text-gray-900">{mat.name}</h4>
                                        <p className="text-xs text-gray-500 mt-1">Unidad: {mat.unit || 'uso'} · Stock: {toNumber(mat.stock)}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => editMaterial(mat)}
                                            className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"
                                            title="Editar producto"
                                        >
                                            <div className="icon-pencil text-sm"></div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteMaterial(mat)}
                                            className="w-9 h-9 rounded-full bg-red-50 text-red-700 flex items-center justify-center"
                                            title="Eliminar producto"
                                        >
                                            <div className="icon-trash-2 text-sm"></div>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-sm mt-3 pt-3 border-t border-gray-100">
                                    <div>
                                        <p className="text-gray-500 text-xs mb-0.5">Costo total</p>
                                        <p className="font-semibold text-gray-700">{formatMoney(mat.cost, mat.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs mb-0.5">Rinde</p>
                                        <p className="font-semibold text-gray-700">{mat.uses} usos</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-500 text-xs mb-0.5">Por uso</p>
                                        <p className="font-bold text-[var(--primary)]">{formatMoney(getMaterialCostPerUse(mat), mat.currency)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
