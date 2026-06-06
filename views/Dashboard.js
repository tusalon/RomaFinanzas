function Dashboard() {
    const { state } = useFinanceApp();
    const today = getTodayKey();
    const mainCurrency = state.config.mainCurrency;
    const desiredMargin = toNumber(state.config.desiredMargin);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const dateLabel = now.toLocaleDateString('es-CU', { day: 'numeric', month: 'long' });
    const monthLabel = now.toLocaleDateString('es-CU', { month: 'long', year: 'numeric' });

    const entryDate = (entry) => new Date(`${entry.date}T00:00:00`);
    const isToday = (entry) => entry.date === today;
    const isThisWeek = (entry) => entryDate(entry) >= weekStart;
    const isThisMonth = (entry) => entryDate(entry) >= monthStart;

    const sumIncome = (entries) => entries.reduce((sum, entry) => (
        sum + convertToMainCurrency(entry.amount, entry.currency, state.config)
    ), 0);

    const sumExpenseImpact = (entries, periodType) => entries.reduce((sum, entry) => (
        sum + getExpenseImpact(entry, state.config, periodType, now)
    ), 0);

    const buildPeriod = (label, incomeEntries, expenseEntries, periodType) => {
        const incomeTotal = sumIncome(incomeEntries);
        const expenseTotal = sumExpenseImpact(expenseEntries, periodType);
        const profit = incomeTotal - expenseTotal;
        const margin = incomeTotal > 0 ? (profit / incomeTotal) * 100 : 0;

        return {
            label,
            periodType,
            incomeEntries,
            expenseEntries,
            incomeTotal,
            expenseTotal,
            profit,
            margin
        };
    };

    const todayPeriod = buildPeriod(
        'Hoy',
        state.incomeEntries.filter(isToday),
        state.expenseEntries.filter((entry) => isToday(entry) || normalizeExpenseType(entry.type) === 'herramienta'),
        'day'
    );
    const weekPeriod = buildPeriod(
        'Esta semana',
        state.incomeEntries.filter(isThisWeek),
        state.expenseEntries.filter((entry) => isThisWeek(entry) || normalizeExpenseType(entry.type) === 'herramienta'),
        'week'
    );
    const monthPeriod = buildPeriod(
        'Este mes',
        state.incomeEntries.filter(isThisMonth),
        state.expenseEntries.filter((entry) => isThisMonth(entry) || normalizeExpenseType(entry.type) === 'herramienta'),
        'month'
    );

    const expenseBreakdown = monthPeriod.expenseEntries.reduce((acc, entry) => {
        const type = normalizeExpenseType(entry.type);
        const impact = getExpenseImpact(entry, state.config, 'month', now);
        acc[type] = (acc[type] || 0) + impact;
        return acc;
    }, {});

    const serviceStats = monthPeriod.incomeEntries.reduce((acc, entry) => {
        const service = state.services.find((item) => String(item.id) === String(entry.serviceId));
        const serviceName = service ? service.name : 'Ingreso sin servicio';
        const amount = convertToMainCurrency(entry.amount, entry.currency, state.config);
        const current = acc[serviceName] || { name: serviceName, amount: 0, count: 0 };
        current.amount += amount;
        current.count += 1;
        acc[serviceName] = current;
        return acc;
    }, {});
    const topService = Object.values(serviceStats).sort((a, b) => b.amount - a.amount)[0];
    const expensePressure = monthPeriod.incomeTotal > 0 ? (monthPeriod.expenseTotal / monthPeriod.incomeTotal) * 100 : 0;
    const assetCount = (state.expenseEntries || []).filter((entry) => normalizeExpenseType(entry.type) === 'herramienta').length;

    const getDiagnosis = () => {
        if (monthPeriod.incomeTotal <= 0) {
            return {
                title: 'Todavía faltan datos para medir tu negocio.',
                text: 'Cuando entren citas completadas o ingresos manuales, Roma Finanzas podrá decirte si estás ganando de verdad.',
                color: 'bg-blue-50 text-blue-800 border-blue-100',
                icon: 'icon-info'
            };
        }

        if (monthPeriod.profit <= 0) {
            return {
                title: 'Tu negocio está generando ventas, pero no ganancia.',
                text: 'Los gastos están absorbiendo el dinero cobrado. Revisa precios, materiales y gastos fijos antes de seguir vendiendo igual.',
                color: 'bg-red-50 text-red-800 border-red-100',
                icon: 'icon-triangle-alert'
            };
        }

        if (monthPeriod.margin >= desiredMargin) {
            return {
                title: 'Tu sistema de generación va bien.',
                text: 'La ganancia real está por encima del margen que quieres lograr. Mantén controlados los gastos y protege tus servicios más rentables.',
                color: 'bg-green-50 text-green-800 border-green-100',
                icon: 'icon-circle-check'
            };
        }

        return {
            title: 'Hay ventas, pero la rentabilidad puede mejorar.',
            text: 'El negocio está dejando ganancia, aunque por debajo del margen deseado. Conviene revisar fichas de costo y precios.',
            color: 'bg-orange-50 text-orange-800 border-orange-100',
            icon: 'icon-circle-alert'
        };
    };

    const diagnosis = getDiagnosis();
    const recommendations = [
        state.costSheets.length === 0 ? 'Crea fichas de costo para saber qué servicios dejan dinero limpio.' : '',
        expensePressure > 35 ? 'Los gastos del mes están altos frente a los ingresos. Revisa gastos fijos, cotidianos y herramientas.' : '',
        topService ? `${topService.name} es tu servicio más fuerte del mes: generó ${formatMoney(topService.amount, mainCurrency)} en ${topService.count} cita(s).` : '',
        assetCount > 0 ? `Tienes ${assetCount} herramienta(s) registradas con depreciación, así la ganancia se mide más realista.` : '',
        monthPeriod.margin < desiredMargin && monthPeriod.incomeTotal > 0 ? `Tu margen actual es ${monthPeriod.margin.toFixed(1)}% y tu meta es ${desiredMargin}%.` : '',
        monthPeriod.incomeEntries.length > 0 ? 'Registra cobros reales y gastos cada día para que el diagnóstico sea más exacto.' : 'Completa o registra al menos una cita para empezar el diagnóstico.'
    ].filter(Boolean).slice(0, 4);

    const recentActivity = [
        ...todayPeriod.incomeEntries.map((entry) => {
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
        ...state.expenseEntries.filter(isToday).map((entry) => ({
            id: entry.id,
            type: 'expense',
            title: entry.description || entry.category,
            detail: getExpenseTypeMeta(entry.type).label,
            amount: entry.amount,
            currency: entry.currency
        }))
    ].slice(0, 4);

    const PeriodCard = ({ period, tone }) => (
        <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{period.label}</p>
            <h3 className={`text-2xl font-black mt-1 ${tone}`}>{formatMoney(period.profit, mainCurrency)}</h3>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                    <span>Ingresos</span>
                    <strong>{formatMoney(period.incomeTotal, mainCurrency)}</strong>
                </div>
                <div className="flex justify-between">
                    <span>Gastos reales</span>
                    <strong>{formatMoney(period.expenseTotal, mainCurrency)}</strong>
                </div>
                <div className="flex justify-between">
                    <span>Margen</span>
                    <strong>{period.margin.toFixed(1)}%</strong>
                </div>
            </div>
        </div>
    );

    return (
        <div className="p-4 space-y-6" data-name="dashboard" data-file="views/Dashboard.js">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-bold">Hoy, {dateLabel}</h2>
                    <p className="text-sm text-gray-500 capitalize">{monthLabel}</p>
                </div>
                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1">
                    <div className="icon-circle-check text-sm"></div>
                    Datos reales
                </div>
            </div>

            {state.loadingFinanceData && (
                <div className="card p-3 text-sm text-gray-600">
                    Cargando datos financieros del negocio...
                </div>
            )}

            {state.syncError && (
                <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">
                    {state.syncError}
                </div>
            )}

            <div className={`rounded-2xl border p-4 ${diagnosis.color}`}>
                <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center shrink-0">
                        <div className={`${diagnosis.icon} text-xl`}></div>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide opacity-70">Diagnóstico del negocio</p>
                        <h3 className="font-black text-lg leading-tight mt-1">{diagnosis.title}</h3>
                        <p className="text-sm mt-2 opacity-90">{diagnosis.text}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="card bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white p-5 border-none">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-4">
                        <div className="icon-arrow-down text-xl text-white"></div>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-1">Ingresos de hoy</p>
                    <h3 className="text-2xl font-bold">{formatMoney(todayPeriod.incomeTotal, mainCurrency)}</h3>
                </div>

                <div className="card p-5">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <div className="icon-arrow-up text-xl text-red-500"></div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium mb-1">Gastos de hoy</p>
                    <h3 className="text-2xl font-bold text-gray-900">{formatMoney(todayPeriod.expenseTotal, mainCurrency)}</h3>
                </div>
            </div>

            <div className="card bg-gray-900 text-white p-5">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Ganancia real de hoy</p>
                        <h3 className={`text-3xl font-bold ${todayPeriod.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(todayPeriod.profit, mainCurrency)}
                        </h3>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-[var(--primary)] flex items-center justify-center bg-gray-800">
                        <div className="icon-chart-pie text-xl text-[var(--primary)]"></div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm text-gray-300">Margen de hoy</span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${todayPeriod.margin >= desiredMargin ? 'text-green-400' : 'text-orange-300'}`}>
                        <div className="icon-arrow-up text-xs"></div> {todayPeriod.margin.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <PeriodCard period={weekPeriod} tone={weekPeriod.profit >= 0 ? 'text-green-600' : 'text-red-600'} />
                <PeriodCard period={monthPeriod} tone={monthPeriod.profit >= 0 ? 'text-green-600' : 'text-red-600'} />
            </div>

            <div className="card p-4">
                <h3 className="text-lg font-bold mb-3">Gastos del mes por tipo</h3>
                <div className="space-y-3">
                    {EXPENSE_TYPES.map((type) => (
                        <div key={type.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                            <div>
                                <p className="font-semibold text-gray-900">{type.label}</p>
                                <p className="text-xs text-gray-500">{type.id === 'herramienta' ? 'Depreciación mensual' : 'Monto registrado'}</p>
                            </div>
                            <p className="font-bold text-gray-900">{formatMoney(expenseBreakdown[type.id] || 0, mainCurrency)}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card p-4">
                <h3 className="text-lg font-bold mb-3">Qué revisar ahora</h3>
                <div className="space-y-3">
                    {recommendations.map((recommendation, index) => (
                        <div key={index} className="flex gap-3 text-sm text-gray-700">
                            <div className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0 font-bold text-xs">
                                {index + 1}
                            </div>
                            <p>{recommendation}</p>
                        </div>
                    ))}
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
                            Todavía no hay movimientos hoy.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
