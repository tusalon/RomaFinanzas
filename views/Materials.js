function Materials({ onBack }) {
    const { state, actions } = useFinanceApp();
    const mainCurrency = state.config.mainCurrency;
    const [showForm, setShowForm] = React.useState((state.materials || []).length === 0);
    const [editingId, setEditingId] = React.useState(null);
    const [savedMessage, setSavedMessage] = React.useState('');
    const [formError, setFormError] = React.useState('');
    const [stockAdjustment, setStockAdjustment] = React.useState(null);
    const [form, setForm] = React.useState({
        name: '',
        cost: '',
        currency: mainCurrency,
        uses: '',
        unit: 'uso',
        stock: '',
        lowStockThreshold: ''
    });

    const materials = state.materials || [];
    const costPerUse = getMaterialCostPerUse(form);
    const totalInventoryValue = materials.reduce((sum, material) => {
        const unitPurchaseCost = Number.isFinite(Number(material.purchaseCostMain)) && toNumber(material.purchaseRateToMain) > 0
            ? toNumber(material.purchaseCostMain)
            : convertToMainCurrency(material.cost, material.currency, state.config);
        return sum + (unitPurchaseCost * Math.max(toNumber(material.stock), 0));
    }, 0);
    const lowStockCount = materials.filter((material) => (
        material.lowStockThreshold != null
        && toNumber(material.stock) <= toNumber(material.lowStockThreshold)
    )).length;

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
            stock: '',
            lowStockThreshold: ''
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
            stock: material.stock || '',
            lowStockThreshold: material.lowStockThreshold ?? ''
        });
    };

    const submitMaterial = async (event) => {
        event.preventDefault();
        await actions.saveMaterial({
            id: editingId,
            ...form,
            cost: toNumber(form.cost),
            uses: Math.max(toNumber(form.uses), 1),
            stock: toNumber(form.stock),
            lowStockThreshold: form.lowStockThreshold
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

    const submitStockAdjustment = async (event) => {
        event.preventDefault();
        const quantity = toNumber(stockAdjustment?.quantity);
        if (!stockAdjustment || quantity <= 0) {
            setFormError('Escribe una cantidad mayor que cero.');
            return;
        }

        try {
            const delta = stockAdjustment.kind === 'entrada' ? quantity : -quantity;
            await actions.adjustMaterialStock(stockAdjustment.material.id, delta, stockAdjustment.note || 'Ajuste manual');
            setSavedMessage(stockAdjustment.kind === 'entrada' ? 'Entrada de inventario guardada.' : 'Salida de inventario guardada.');
            setFormError('');
            setStockAdjustment(null);
        } catch (error) {
            setFormError(error.message || 'No se pudo ajustar el inventario.');
        }
    };

    return (
        <div className="catalog-screen p-4 space-y-5" data-name="materials" data-file="views/Materials.js">
            <div className="screen-intro screen-intro--product flex gap-3">
                <div className="icon-box text-blue-600 mt-1"></div>
                <div>
                    <p className="text-sm font-semibold text-blue-900">¿Qué usas para hacer tus servicios?</p>
                    <p className="text-sm text-blue-800 mt-1">Escribe cuánto te costó y para cuántas citas alcanza. La app calcula el costo de una cita.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400">Productos</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{materials.length}</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400">Valor en productos</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">{formatMoney(totalInventoryValue, mainCurrency)}</p>
                </div>
            </div>

            {lowStockCount > 0 && (
                <div className="bg-orange-50 border border-orange-100 text-orange-800 rounded-2xl p-4 text-sm">
                    {lowStockCount === 1 ? 'Un producto está por acabarse.' : `${lowStockCount} productos están por acabarse.`} Revisa lo que tienes antes de tu próxima cita.
                </div>
            )}

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
                {showForm ? 'Cerrar' : 'Añadir producto'}
            </button>

            {showForm && (
                <form className="card p-4 space-y-4" onSubmit={submitMaterial}>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">{editingId ? 'Editar producto' : 'Nuevo producto'}</p>
                        <h3 className="font-bold text-gray-900">Producto que usas</h3>
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
                            <label className="label">¿Para cuántas citas alcanza?</label>
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
                            <label className="label">Cómo lo cuentas</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="uso, cita, ml"
                                value={form.unit}
                                onChange={(event) => updateField('unit', event.target.value)}
                            />
                        </div>
                    </div>

                    <details className="simple-details" open={(editingId != null && (form.stock !== '' || form.lowStockThreshold !== '')) || undefined}>
                        <summary>Controlar cuántos quedan (opcional)</summary>
                        <div className="grid grid-cols-2 gap-3 pt-3">
                            <div>
                                <label className="label">Cuántos tienes</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    min="0"
                                    className="input-field bg-white"
                                    placeholder="Ej. 2"
                                    value={form.stock}
                                    onChange={(event) => updateField('stock', event.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label">Avisar cuando queden</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    min="0"
                                    className="input-field bg-white"
                                    placeholder="Ej. 1"
                                    value={form.lowStockThreshold}
                                    onChange={(event) => updateField('lowStockThreshold', event.target.value)}
                                />
                            </div>
                        </div>
                    </details>

                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold text-blue-700 uppercase">Te cuesta por cita</p>
                            <p className="text-sm text-blue-800">Este valor se usará en el cálculo.</p>
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

            {formError && (
                <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                    {formError}
                </div>
            )}

            {state.syncError && (
                <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">
                    {state.syncError}
                </div>
            )}

            <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">Tus productos</h3>

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
                                        <p className="text-xs text-gray-500 mt-1">Lo cuentas por {mat.unit || 'uso'}{toNumber(mat.stock) > 0 ? ` · Tienes ${toNumber(mat.stock)}` : ''}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => editMaterial(mat)}
                                            className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"
                                            title="Editar producto"
                                            aria-label={`Editar ${mat.name}`}
                                        >
                                            <div className="icon-pencil text-sm"></div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteMaterial(mat)}
                                            className="w-9 h-9 rounded-full bg-red-50 text-red-700 flex items-center justify-center"
                                            title="Eliminar producto"
                                            aria-label={`Eliminar ${mat.name}`}
                                        >
                                            <div className="icon-trash-2 text-sm"></div>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-sm mt-3 pt-3 border-t border-gray-100">
                                    <div>
                                        <p className="text-gray-500 text-xs mb-0.5">Te costó</p>
                                        <p className="font-semibold text-gray-700">{formatMoney(mat.cost, mat.currency)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs mb-0.5">Alcanza para</p>
                                        <p className="font-semibold text-gray-700">{mat.uses} usos</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-500 text-xs mb-0.5">Por cita</p>
                                        <p className="font-bold text-[var(--primary)]">{formatMoney(getMaterialCostPerUse(mat), mat.currency)}</p>
                                    </div>
                                </div>

                                <details className="simple-details !p-3 mt-3">
                                    <summary className="text-sm">Controlar cuántos quedan (opcional)</summary>
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        <button type="button" onClick={() => setStockAdjustment({ material: mat, kind: 'entrada', quantity: '', note: '' })} className="btn-secondary !py-2 text-sm text-green-700">
                                            <div className="icon-plus"></div> Añadir
                                        </button>
                                        <button type="button" onClick={() => setStockAdjustment({ material: mat, kind: 'salida', quantity: '', note: '' })} className="btn-secondary !py-2 text-sm text-orange-700">
                                            <div className="icon-minus"></div> Descontar
                                        </button>
                                    </div>

                                    {stockAdjustment && String(stockAdjustment.material.id) === String(mat.id) && (
                                        <form onSubmit={submitStockAdjustment} className="mt-3 bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-3">
                                            <p className="text-sm font-bold text-gray-900">
                                                {stockAdjustment.kind === 'entrada' ? '¿Cuántos llegaron?' : '¿Cuántos usaste o salieron?'}
                                            </p>
                                            <input type="text" inputMode="decimal" className="input-field bg-white" placeholder="Cantidad" value={stockAdjustment.quantity} onChange={(event) => setStockAdjustment((current) => ({ ...current, quantity: event.target.value }))} />
                                            <input type="text" className="input-field bg-white" placeholder="Nota opcional" value={stockAdjustment.note} onChange={(event) => setStockAdjustment((current) => ({ ...current, note: event.target.value }))} />
                                            <div className="grid grid-cols-2 gap-2">
                                                <button type="button" onClick={() => setStockAdjustment(null)} className="btn-secondary !py-2">Cancelar</button>
                                                <button type="submit" className="btn-primary !py-2">Guardar</button>
                                            </div>
                                        </form>
                                    )}
                                </details>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
