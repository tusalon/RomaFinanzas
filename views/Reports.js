function Reports({ onBack }) {
    const { state } = useFinanceApp();
    const today = getTodayKey();
    const [selectedMonth, setSelectedMonth] = React.useState(today.slice(0, 7));
    const mainCurrency = state.config.mainCurrency || 'CUP';
    const desiredMargin = toNumber(state.config.desiredMargin);

    const monthLabel = new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString('es-CU', {
        month: 'long',
        year: 'numeric'
    });
    const monthEnd = new Date(`${selectedMonth}-01T12:00:00`);
    monthEnd.setMonth(monthEnd.getMonth() + 1, 0);

    const isSelectedMonth = (entry) => String(entry.date || '').slice(0, 7) === selectedMonth;
    const incomeEntries = (state.incomeEntries || []).filter(isSelectedMonth);
    const cashExpenses = (state.expenseEntries || []).filter(isSelectedMonth);
    const isMaterialPurchase = (entry) => normalizeFinanceText(entry.category).includes('material');
    const operatingExpenses = (state.expenseEntries || []).filter((entry) => {
        if (isMaterialPurchase(entry)) return false;
        if (normalizeExpenseType(entry.type) === 'herramienta') {
            return getExpenseImpact(entry, state.config, 'month', monthEnd) > 0;
        }
        return isSelectedMonth(entry);
    });

    const serviceIncomeTotal = incomeEntries.reduce((sum, entry) => sum + getHistoricalAmountMain(entry, state.config), 0);
    const tipTotal = incomeEntries.reduce((sum, entry) => sum + getHistoricalTipMain(entry, state.config), 0);
    const incomeTotal = serviceIncomeTotal + tipTotal;
    const serviceCostTotal = incomeEntries.reduce((sum, entry) => sum + toNumber(entry.unitCostMain), 0);
    const operatingExpenseTotal = operatingExpenses.reduce((sum, entry) => (
        sum + getExpenseImpact(entry, state.config, 'month', monthEnd)
    ), 0);
    const cashExpenseTotal = cashExpenses.reduce((sum, entry) => sum + getHistoricalAmountMain(entry, state.config), 0);
    const profit = incomeTotal - serviceCostTotal - operatingExpenseTotal;
    const cashFlow = incomeTotal - cashExpenseTotal;
    const margin = incomeTotal > 0 ? (profit / incomeTotal) * 100 : 0;
    const missingCostCount = incomeEntries.filter((entry) => !entry.costSheetId).length;

    const serviceStats = Object.values(incomeEntries.reduce((acc, entry) => {
        const service = (state.services || []).find((item) => String(item.id) === String(entry.serviceId));
        const name = service?.name || 'Ingreso sin servicio';
        const amount = getHistoricalAmountMain(entry, state.config);
        const contribution = amount - toNumber(entry.unitCostMain);
        const row = acc[name] || { name, count: 0, amount: 0, cost: 0, contribution: 0 };
        row.count += 1;
        row.amount += amount;
        row.cost += toNumber(entry.unitCostMain);
        row.contribution += contribution;
        acc[name] = row;
        return acc;
    }, {})).sort((a, b) => b.contribution - a.contribution);

    const expenseStats = Object.values(operatingExpenses.reduce((acc, entry) => {
        const name = entry.category || 'Otro';
        const amount = getExpenseImpact(entry, state.config, 'month', monthEnd);
        acc[name] = { name, amount: (acc[name]?.amount || 0) + amount };
        return acc;
    }, {})).sort((a, b) => b.amount - a.amount);
    const maxExpense = Math.max(...expenseStats.map((entry) => entry.amount), 1);

    const downloadCsv = () => {
        const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = [
            ['Reporte Roma Finanzas', monthLabel],
            ['Moneda principal', mainCurrency],
            ['Ingresos', incomeTotal.toFixed(2)],
            ['Servicios cobrados', serviceIncomeTotal.toFixed(2)],
            ['Propinas', tipTotal.toFixed(2)],
            ['Costo de servicios', serviceCostTotal.toFixed(2)],
            ['Gastos del negocio', operatingExpenseTotal.toFixed(2)],
            ['Ganancia estimada', profit.toFixed(2)],
            ['Margen', `${margin.toFixed(2)}%`],
            ['Flujo de caja', cashFlow.toFixed(2)],
            [],
            ['Servicio', 'Veces', 'Ingresos', 'Costo', 'Deja antes de gastos'],
            ...serviceStats.map((row) => [row.name, row.count, row.amount.toFixed(2), row.cost.toFixed(2), row.contribution.toFixed(2)]),
            [],
            ['Categoría de gasto', 'Impacto del mes'],
            ...expenseStats.map((row) => [row.name, row.amount.toFixed(2)])
        ];
        const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `roma-finanzas-${selectedMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="reports-screen p-4 space-y-4" data-name="reports" data-file="views/Reports.js">
            <div className="card p-4">
                <label htmlFor="report-month" className="block text-sm font-bold text-gray-800 mb-2">Mes que quieres revisar</label>
                <div className="flex gap-2">
                    <input
                        id="report-month"
                        type="month"
                        value={selectedMonth}
                        max={today.slice(0, 7)}
                        onChange={(event) => setSelectedMonth(event.target.value || today.slice(0, 7))}
                        className="input-field flex-1"
                    />
                    <button type="button" onClick={downloadCsv} className="px-4 rounded-xl border border-gray-200 font-bold text-sm text-gray-700" title="Descargar archivo para Excel">
                        Descargar
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 capitalize">Resumen de {monthLabel}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                    <p className="text-xs text-gray-500">Entró este mes</p>
                    <p className="text-lg font-black text-gray-900 mt-1">{formatMoney(incomeTotal, mainCurrency)}</p>
                    {tipTotal > 0 && <p className="text-xs font-bold text-pink-600 mt-1">{formatMoney(tipTotal, mainCurrency)} en propinas</p>}
                </div>
                <div className={`card p-4 ${profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-xs text-gray-500">Te quedó estimado</p>
                    <p className={`text-lg font-black mt-1 ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMoney(profit, mainCurrency)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs text-gray-500">Ganancia en %</p>
                    <p className={`text-lg font-black mt-1 ${margin >= desiredMargin ? 'text-green-700' : 'text-orange-700'}`}>{margin.toFixed(1)}%</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs text-gray-500">Dinero disponible</p>
                    <p className={`text-lg font-black mt-1 ${cashFlow >= 0 ? 'text-gray-900' : 'text-red-700'}`}>{formatMoney(cashFlow, mainCurrency)}</p>
                </div>
            </div>

            <details className="simple-details">
                <summary>Ver cómo se calculó</summary>
                <div className="space-y-3 pt-4">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Servicios cobrados</span><strong>{formatMoney(serviceIncomeTotal, mainCurrency)}</strong></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Propinas</span><strong>{formatMoney(tipTotal, mainCurrency)}</strong></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Productos usados</span><strong>- {formatMoney(serviceCostTotal, mainCurrency)}</strong></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Otros gastos</span><strong>- {formatMoney(operatingExpenseTotal, mainCurrency)}</strong></div>
                    <div className="pt-3 border-t border-gray-100 flex justify-between"><span className="font-bold">Te quedó aproximadamente</span><strong>{formatMoney(profit, mainCurrency)}</strong></div>
                    <p className="text-xs text-gray-500">La compra completa de un producto baja el dinero disponible. En la ganancia solo contamos la parte usada en cada servicio.</p>
                </div>
            </details>

            {missingCostCount > 0 && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800">
                    <p className="font-bold">Falta calcular el costo de {missingCostCount} cobro(s)</p>
                    <p className="text-sm mt-1">La ganancia puede verse más alta de lo real. Calcula cuánto deja cada servicio.</p>
                </div>
            )}

            <details className="simple-details">
                <summary>Ver servicios que más dejan</summary>
                <div className="pt-4">
                {serviceStats.length === 0 ? (
                    <p className="text-sm text-gray-500">Todavía no hay cobros anotados en este mes.</p>
                ) : (
                    <div className="space-y-3">
                        {serviceStats.map((row) => (
                            <div key={row.name} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                                <div className="flex justify-between gap-3">
                                    <div><p className="font-bold text-sm text-gray-900">{row.name}</p><p className="text-xs text-gray-500">{row.count} servicio(s)</p></div>
                                    <div className="text-right"><p className={`font-black text-sm ${row.contribution >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMoney(row.contribution, mainCurrency)}</p><p className="text-xs text-gray-500">antes de otros gastos</p></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </details>

            <details className="simple-details">
                <summary>Ver en qué se fue el dinero</summary>
                <div className="pt-4">
                {expenseStats.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay gastos del negocio para este mes.</p>
                ) : (
                    <div className="space-y-3">
                        {expenseStats.map((row) => (
                            <div key={row.name}>
                                <div className="flex justify-between gap-3 text-sm"><span className="font-bold text-gray-700">{row.name}</span><strong>{formatMoney(row.amount, mainCurrency)}</strong></div>
                                <div className="h-2 rounded-full bg-gray-100 mt-2 overflow-hidden"><div className="h-full rounded-full bg-pink-400" style={{ width: `${Math.max(3, (row.amount / maxExpense) * 100)}%` }}></div></div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </details>
        </div>
    );
}
