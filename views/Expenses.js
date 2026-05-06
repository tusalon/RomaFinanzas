function Expenses() {
    const { state, actions } = useFinanceApp();
    const [form, setForm] = React.useState({
        category: 'Materiales',
        description: '',
        amount: 0,
        currency: state.config.mainCurrency,
        type: 'diario'
    });
    const [savedMessage, setSavedMessage] = React.useState('');
    const categories = ['Materiales', 'Renta', 'Electricidad', 'Internet', 'Transporte', 'Publicidad', 'Comision', 'Comida', 'Otro'];

    const updateField = (field, value) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const submitExpense = (event) => {
        event.preventDefault();
        actions.addExpense({
            ...form,
            amount: toNumber(form.amount)
        });
        setSavedMessage('Gasto guardado localmente.');
    };

    return (
        <div className="p-4" data-name="expenses" data-file="views/Expenses.js">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100 mb-6 flex gap-3">
                <div className="icon-receipt text-red-600 mt-1"></div>
                <p className="text-sm text-red-800">Registra compras de materiales, pagos de local u otros gastos del salon.</p>
            </div>

            <form className="space-y-5" onSubmit={submitExpense}>
                <div>
                    <label className="label">Categoria de gasto</label>
                    <select className="input-field" value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                        {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                </div>

                <div>
                    <label className="label">Descripcion</label>
                    <input type="text" className="input-field" placeholder="Ej. Compra de tinte rubio" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="label">Monto</label>
                        <input type="number" className="input-field font-bold text-lg" placeholder="0.00" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} />
                    </div>
                    <div>
                        <label className="label">Moneda</label>
                        <select className="input-field" value={form.currency} onChange={(event) => updateField('currency', event.target.value)}>
                            {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                        </select>
                    </div>
                </div>

                {savedMessage && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">{savedMessage}</div>}

                <button type="submit" className="w-full bg-gray-900 text-white font-medium py-3 px-4 rounded-xl shadow-sm active:scale-[0.98] transition-transform duration-150 flex items-center justify-center gap-2 mt-6">
                    Registrar Gasto
                </button>
            </form>
        </div>
    );
}
