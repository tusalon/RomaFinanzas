function Expenses() {
    const { state, actions } = useFinanceApp();
    const [form, setForm] = React.useState({
        category: 'Materiales de uso rápido',
        description: '',
        amount: 0,
        currency: state.config.mainCurrency,
        type: 'cotidiano',
        usefulLifeMonths: 12
    });
    const [savedMessage, setSavedMessage] = React.useState('');

    const selectedType = getExpenseTypeMeta(form.type);
    const categories = getExpenseCategories(form.type);
    const expenses = state.expenseEntries || [];
    const monthlyDepreciation = form.type === 'herramienta'
        ? getExpenseMonthlyDepreciation(form, state.config)
        : 0;

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const selectType = (type) => {
        const nextCategories = getExpenseCategories(type);
        setForm((current) => ({
            ...current,
            type,
            category: nextCategories[0],
            usefulLifeMonths: type === 'herramienta' ? current.usefulLifeMonths || 12 : current.usefulLifeMonths
        }));
    };

    const submitExpense = async (event) => {
        event.preventDefault();
        await actions.addExpense({
            ...form,
            amount: toNumber(form.amount),
            usefulLifeMonths: form.type === 'herramienta' ? Math.max(toNumber(form.usefulLifeMonths), 1) : null,
            depreciationNote: form.type === 'herramienta'
                ? `Depreciación mensual aproximada: ${formatMoney(monthlyDepreciation, state.config.mainCurrency)}`
                : ''
        });
        setSavedMessage('Gasto guardado para este negocio.');
    };

    const deleteExpense = async (expense) => {
        const confirmed = window.confirm(`Eliminar el gasto "${expense.description || expense.category || 'Gasto'}"?`);
        if (!confirmed) return;

        await actions.deleteExpense(expense.id);
        setSavedMessage('Gasto eliminado.');
    };

    return (
        <div className="p-4" data-name="expenses" data-file="views/Expenses.js">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100 mb-6 flex gap-3">
                <div className="icon-receipt text-red-600 mt-1"></div>
                <div>
                    <p className="text-sm font-semibold text-red-900">Registra gastos sin complicarte.</p>
                    <p className="text-sm text-red-800 mt-1">Separa pagos fijos, gastos cotidianos y herramientas que se usan durante varios meses.</p>
                </div>
            </div>

            <form className="space-y-5" onSubmit={submitExpense}>
                <div>
                    <label className="label">Tipo de gasto</label>
                    <div className="grid grid-cols-1 gap-3">
                        {EXPENSE_TYPES.map((type) => (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => selectType(type.id)}
                                className={`text-left rounded-2xl border p-4 transition-colors ${form.type === type.id ? 'border-[var(--primary)] bg-[var(--primary-light)]' : 'border-gray-200 bg-white'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${form.type === type.id ? 'bg-white text-[var(--primary)]' : 'bg-gray-100 text-gray-500'}`}>
                                        <div className={type.id === 'fijo' ? 'icon-calendar-days' : type.id === 'herramienta' ? 'icon-hammer' : 'icon-shopping-basket'}></div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{type.label}</p>
                                        <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-400 mb-1">Gasto seleccionado</p>
                    <p className="font-bold text-gray-900">{selectedType.label}</p>
                    <p className="text-sm text-gray-600 mt-1">{selectedType.description}</p>
                </div>

                <div>
                    <label className="label">Categoría de gasto</label>
                    <select className="input-field" value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                        {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                </div>

                <div>
                    <label className="label">Descripción</label>
                    <input
                        type="text"
                        className="input-field"
                        placeholder={form.type === 'herramienta' ? 'Ej. Lámpara UV, alicate, mesa auxiliar' : 'Ej. Corriente, salario, café, galletas'}
                        value={form.description}
                        onChange={(event) => updateField('description', event.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Monto pagado</label>
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

                {form.type === 'herramienta' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                        <div>
                            <label className="label text-blue-900">Vida útil estimada</label>
                            <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                                <input
                                    type="text"
                                inputMode="decimal"
                                    min="1"
                                    className="input-field bg-white"
                                    value={form.usefulLifeMonths}
                                    onChange={(event) => updateField('usefulLifeMonths', event.target.value)}
                                />
                                <span className="text-sm font-semibold text-blue-900">meses</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-3 border border-blue-100">
                            <p className="text-xs text-blue-700 font-semibold">Impacto mensual aproximado</p>
                            <p className="text-xl font-black text-blue-900 mt-1">{formatMoney(monthlyDepreciation, state.config.mainCurrency)}</p>
                            <p className="text-xs text-blue-700 mt-1">La app lo cuenta poco a poco para medir mejor la ganancia real.</p>
                        </div>
                    </div>
                )}

                {savedMessage && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">{savedMessage}</div>}
                {state.syncError && <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">{state.syncError}</div>}

                <button type="submit" className="w-full bg-gray-900 text-white font-medium py-3 px-4 rounded-xl shadow-sm active:scale-[0.98] transition-transform duration-150 flex items-center justify-center gap-2 mt-6">
                    Registrar gasto
                </button>
            </form>

            {expenses.length > 0 && (
                <div className="card p-4 mt-6">
                    <h3 className="font-bold text-gray-900 mb-3">Gastos registrados</h3>
                    <div className="space-y-3">
                        {expenses.slice(0, 20).map((expense) => (
                            <div key={expense.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 truncate">{expense.description || expense.category || 'Gasto'}</p>
                                        <p className="text-xs text-gray-500">{expense.date} - {getExpenseTypeMeta(expense.type).label}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-red-700">{formatMoney(expense.amount, expense.currency || state.config.mainCurrency)}</p>
                                        {String(expense.id || '').startsWith('gasto_rservasroma_') ? (
                                            <p className="text-xs font-semibold text-gray-400 mt-2">Fijo del sistema</p>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => deleteExpense(expense)}
                                                className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg mt-2"
                                            >
                                                Eliminar
                                            </button>
                                        )}
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
