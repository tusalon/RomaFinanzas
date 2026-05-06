function Dashboard() {
    const { state } = useFinanceApp();
    const today = getTodayKey();
    const mainCurrency = state.config.mainCurrency;
    const todayIncome = state.incomeEntries.filter((entry) => entry.date === today);
    const todayExpenses = state.expenseEntries.filter((entry) => entry.date === today);
    const incomeTotal = todayIncome.reduce((sum, entry) => (
        sum + convertToMainCurrency(entry.amount, entry.currency, state.config)
    ), 0);
    const expenseTotal = todayExpenses.reduce((sum, entry) => (
        sum + convertToMainCurrency(entry.amount, entry.currency, state.config)
    ), 0);
    const profit = incomeTotal - expenseTotal;
    const margin = incomeTotal > 0 ? (profit / incomeTotal) * 100 : 0;
    const dateLabel = new Date().toLocaleDateString('es-CU', { day: 'numeric', month: 'long' });
    const recentActivity = [
        ...todayIncome.map((entry) => {
            const service = state.services.find((item) => item.id === entry.serviceId);
            return {
                id: entry.id,
                type: 'income',
                title: service ? service.name : 'Ingreso',
                detail: entry.client || entry.paymentMethod,
                amount: entry.amount,
                currency: entry.currency
            };
        }),
        ...todayExpenses.map((entry) => ({
            id: entry.id,
            type: 'expense',
            title: entry.description,
            detail: entry.category,
            amount: entry.amount,
            currency: entry.currency
        }))
    ].slice(0, 4);

    return (
        <div className="p-4 space-y-6" data-name="dashboard" data-file="views/Dashboard.js">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold">Hoy, {dateLabel}</h2>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <div className="icon-circle-check text-sm"></div>
                    Datos locales
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="card bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white p-5 border-none">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-4">
                        <div className="icon-arrow-down text-xl text-white"></div>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-1">Ingresos de hoy</p>
                    <h3 className="text-2xl font-bold">{formatMoney(incomeTotal, mainCurrency)}</h3>
                </div>

                <div className="card p-5">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <div className="icon-arrow-up text-xl text-red-500"></div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium mb-1">Gastos de hoy</p>
                    <h3 className="text-2xl font-bold text-gray-900">{formatMoney(expenseTotal, mainCurrency)}</h3>
                </div>
            </div>

            <div className="card bg-gray-900 text-white p-5">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Ganancia estimada</p>
                        <h3 className={`text-3xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(profit, mainCurrency)}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-[var(--primary)] flex items-center justify-center bg-gray-800">
                        <div className="icon-chart-pie text-xl text-[var(--primary)]"></div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm text-gray-300">Margen promedio</span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${margin >= state.config.desiredMargin ? 'text-green-400' : 'text-orange-300'}`}>
                        <div className="icon-arrow-up text-xs"></div> {margin.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold mb-3">Actividad reciente</h3>
                <div className="space-y-3">
                    {recentActivity.map((item) => (
                        <div key={item.id} className="card p-3 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                                <div className={`${item.type === 'income' ? 'icon-scissors text-green-600' : 'icon-receipt text-red-600'}`}></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                                <p className="text-xs text-gray-500">{item.detail}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className={`font-bold ${item.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.type === 'income' ? '+' : '-'} {formatMoney(item.amount, item.currency)}
                                </p>
                            </div>
                        </div>
                    ))}

                    {recentActivity.length === 0 && (
                        <div className="card p-4 text-center text-sm text-gray-500">
                            Todavia no hay movimientos hoy.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
