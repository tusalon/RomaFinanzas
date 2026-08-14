function Dashboard({ onNavigate }) {
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
        sum + getIncomeCollectedMain(entry, state.config)
    ), 0);

    const sumTips = (entries) => entries.reduce((sum, entry) => (
        sum + getHistoricalTipMain(entry, state.config)
    ), 0);

    const sumServiceCosts = (entries) => entries.reduce((sum, entry) => (
        sum + toNumber(entry.unitCostMain)
    ), 0);

    const isMaterialPurchase = (entry) => normalizeFinanceText(entry.category).includes('material');

    const sumExpenseImpact = (entries, periodType) => entries.reduce((sum, entry) => (
        sum + getExpenseImpact(entry, state.config, periodType, now)
    ), 0);

    const buildPeriod = (label, incomeEntries, expenseEntries, cashExpenseEntries, periodType) => {
        const incomeTotal = sumIncome(incomeEntries);
        const tipTotal = sumTips(incomeEntries);
        const serviceCostTotal = sumServiceCosts(incomeEntries);
        const operatingExpenseEntries = expenseEntries.filter((entry) => !isMaterialPurchase(entry));
        const expenseTotal = sumExpenseImpact(operatingExpenseEntries, periodType);
        const cashExpenseTotal = cashExpenseEntries.reduce((sum, entry) => (
            sum + getHistoricalAmountMain(entry, state.config)
        ), 0);
        const profit = incomeTotal - serviceCostTotal - expenseTotal;
        const cashFlow = incomeTotal - cashExpenseTotal;
        const margin = incomeTotal > 0 ? (profit / incomeTotal) * 100 : 0;
        const missingCostCount = incomeEntries.filter((entry) => !entry.costSheetId).length;

        return {
            label,
            periodType,
            incomeEntries,
            expenseEntries,
            incomeTotal,
            tipTotal,
            serviceCostTotal,
            expenseTotal,
            cashExpenseTotal,
            cashFlow,
            profit,
            margin,
            missingCostCount
        };
    };

    const todayPeriod = buildPeriod(
        'Hoy',
        state.incomeEntries.filter(isToday),
        state.expenseEntries.filter((entry) => isToday(entry) || normalizeExpenseType(entry.type) === 'herramienta'),
        state.expenseEntries.filter(isToday),
        'day'
    );
    const weekPeriod = buildPeriod(
        'Esta semana',
        state.incomeEntries.filter(isThisWeek),
        state.expenseEntries.filter((entry) => isThisWeek(entry) || normalizeExpenseType(entry.type) === 'herramienta'),
        state.expenseEntries.filter(isThisWeek),
        'week'
    );
    const monthPeriod = buildPeriod(
        'Este mes',
        state.incomeEntries.filter(isThisMonth),
        state.expenseEntries.filter((entry) => isThisMonth(entry) || normalizeExpenseType(entry.type) === 'herramienta'),
        state.expenseEntries.filter(isThisMonth),
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
        const amount = getHistoricalAmountMain(entry, state.config);
        const profit = toNumber(entry.profitMain) || (amount - toNumber(entry.unitCostMain));
        const current = acc[serviceName] || { name: serviceName, amount: 0, profit: 0, count: 0 };
        current.amount += amount;
        current.profit += profit;
        current.count += 1;
        acc[serviceName] = current;
        return acc;
    }, {});
    const sortedServices = Object.values(serviceStats).sort((a, b) => b.profit - a.profit);
    const topService = sortedServices[0];
    const lowService = sortedServices.length > 1 ? sortedServices[sortedServices.length - 1] : null;
    const expensePressure = monthPeriod.incomeTotal > 0 ? (monthPeriod.expenseTotal / monthPeriod.incomeTotal) * 100 : 0;
    const assetCount = (state.expenseEntries || []).filter((entry) => normalizeExpenseType(entry.type) === 'herramienta').length;

    const getDiagnosis = () => {
        if (monthPeriod.incomeTotal <= 0) {
            return {
                title: 'Anota tu primer cobro para empezar.',
                text: 'Con tus cobros y gastos, Roma Finanzas te dirá cuánto te está quedando limpio.',
                color: 'bg-blue-50 text-blue-800 border-blue-100',
                icon: 'icon-info'
            };
        }

        if (monthPeriod.profit <= 0) {
            return {
                title: 'Está saliendo más dinero del que te queda.',
                text: 'Revisa lo que cobras, los productos que usas y tus pagos mensuales.',
                color: 'bg-red-50 text-red-800 border-red-100',
                icon: 'icon-triangle-alert'
            };
        }

        if (monthPeriod.margin >= desiredMargin) {
            return {
                title: 'Vas por buen camino.',
                text: 'Te está quedando más de la meta que elegiste. Sigue anotando cobros y gastos.',
                color: 'bg-green-50 text-green-800 border-green-100',
                icon: 'icon-circle-check'
            };
        }

        return {
            title: 'Estás ganando, pero puede quedarte más.',
            text: 'Revisa cuánto cuestan tus servicios y si necesitas ajustar algún precio.',
            color: 'bg-orange-50 text-orange-800 border-orange-100',
            icon: 'icon-circle-alert'
        };
    };

    const diagnosis = getDiagnosis();
    const hasRservasRomaExpenseThisMonth = monthPeriod.expenseEntries.some((entry) => (
        normalizeFinanceText(entry.category) === normalizeFinanceText('RservasRoma')
    ));
    const recommendations = [
        state.costSheets.length === 0 ? 'Calcula cuánto te deja cada servicio para conocer tu ganancia.' : '',
        !hasRservasRomaExpenseThisMonth ? 'Anota este mes lo que pagas a RservasRoma como gasto fijo. Escribe el monto real de tu plan, no lo copies de otro negocio.' : '',
        expensePressure > 35 ? 'Los gastos del mes están altos frente a los ingresos. Revisa gastos fijos, cotidianos y herramientas.' : '',
        topService ? `${topService.name} es tu servicio más rentable del mes: dejó aproximadamente ${formatMoney(topService.profit, mainCurrency)} en ${topService.count} cita(s).` : '',
        lowService ? `${lowService.name} es el servicio que menos ganancia dejó este mes.` : '',
        assetCount > 0 ? `Tienes ${assetCount} herramienta(s) registradas con depreciación, así la ganancia se mide más realista.` : '',
        monthPeriod.margin < desiredMargin && monthPeriod.incomeTotal > 0 ? `Ahora te queda ${monthPeriod.margin.toFixed(1)}% y tu meta es ${desiredMargin}%.` : '',
        monthPeriod.incomeEntries.length > 0 ? 'Registra cobros reales y gastos cada día para que el diagnóstico sea más exacto.' : 'Completa o registra al menos una cita para empezar el diagnóstico.',
        monthPeriod.missingCostCount > 0 ? `Falta calcular el costo de ${monthPeriod.missingCostCount} cobro(s); la ganancia puede ser menor.` : ''
    ].filter(Boolean).slice(0, 4);

    const dataQuality = monthPeriod.incomeEntries.length === 0
        ? { label: 'Esperando datos', className: 'bg-gray-100 text-gray-600' }
        : monthPeriod.missingCostCount > 0
            ? { label: 'Costos incompletos', className: 'bg-orange-100 text-orange-700' }
            : { label: 'Datos calculados', className: 'bg-green-100 text-green-700' };

    const recentActivity = [
        ...todayPeriod.incomeEntries.map((entry) => {
            const service = state.services.find((item) => item.id === entry.serviceId);
            return {
                id: entry.id,
                type: 'income',
                title: service ? service.name : 'Ingreso',
                detail: entry.client || entry.paymentMethod,
                amount: getIncomeCollectedMain(entry, state.config),
                currency: mainCurrency,
                tip: getHistoricalTipMain(entry, state.config)
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
    const pendingCount = (state.pendingSync || []).length;
    const syncLabel = state.syncStatus === 'syncing'
        ? 'Sincronizando...'
        : pendingCount > 0
            ? `${pendingCount} cambio(s) pendiente(s)`
            : state.lastSyncAt
                ? `Sincronizado ${new Date(state.lastSyncAt).toLocaleString('es-CU')}`
                : 'Listo para trabajar offline';
    const nextSetup = !(state.services || []).some((service) => service.active)
        ? { view: 'services', title: 'Crea tu primer servicio', text: 'Pon el nombre y cuánto cobras.' }
        : (state.materials || []).length === 0
            ? { view: 'materials', title: 'Añade los productos que usas', text: 'Con uno solo ya puedes hacer un cálculo aproximado.' }
            : (state.costSheets || []).length === 0
                ? { view: 'costSheet', title: 'Calcula cuánto te queda limpio', text: 'Usa tu servicio y los productos que ya añadiste.' }
                : null;

    const PeriodCard = ({ period, tone }) => (
        <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{period.label}</p>
            <h3 className={`text-2xl font-black mt-1 ${tone}`}>{formatMoney(period.profit, mainCurrency)}</h3>
            <div className="mt-3 space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                    <span>Dinero que entró</span>
                    <strong>{formatMoney(period.incomeTotal, mainCurrency)}</strong>
                </div>
                {period.tipTotal > 0 && (
                    <div className="flex justify-between text-pink-600">
                        <span>Incluye propinas</span>
                        <strong>{formatMoney(period.tipTotal, mainCurrency)}</strong>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>Costos de servicios</span>
                    <strong>{formatMoney(period.serviceCostTotal, mainCurrency)}</strong>
                </div>
                <div className="flex justify-between">
                    <span>Otros gastos</span>
                    <strong>{formatMoney(period.expenseTotal, mainCurrency)}</strong>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
                    <span>Dinero en caja</span>
                    <strong>{formatMoney(period.cashFlow, mainCurrency)}</strong>
                </div>
                <div className="flex justify-between">
                    <span>Ganancia en %</span>
                    <strong>{period.margin.toFixed(1)}%</strong>
                </div>
            </div>
        </div>
    );

    return (
        <div className="dashboard-screen p-4 space-y-6" data-name="dashboard" data-file="views/Dashboard.js">
            <div className="dashboard-heading flex items-center justify-between mb-2">
                <div>
                    <p className="section-eyebrow">Resumen diario</p>
                    <h2 className="text-2xl font-black tracking-tight">Hoy, {dateLabel}</h2>
                    <p className="text-sm text-gray-500 capitalize">{monthLabel}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${dataQuality.className}`}>
                    <div className="icon-circle-check text-sm"></div>
                    {dataQuality.label}
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

            {(pendingCount > 0 || state.isOnline === false || state.syncStatus === 'syncing') && (
            <div className={`rounded-2xl border p-4 ${pendingCount > 0 ? 'bg-amber-50 border-amber-100 text-amber-800' : state.isOnline === false ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-green-50 border-green-100 text-green-800'}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                            <div className={state.syncStatus === 'syncing' ? 'icon-loader-circle animate-spin' : pendingCount > 0 ? 'icon-cloud-upload' : state.isOnline === false ? 'icon-wifi-off' : 'icon-cloud-check'}></div>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-wide opacity-70">Tus datos</p>
                            <p className="font-bold">{syncLabel}</p>
                            <p className="text-xs opacity-80">Puedes seguir trabajando. Se guardará cuando vuelva la conexión.</p>
                        </div>
                    </div>
                </div>
            </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => onNavigate('income')} className="daily-action daily-action--income">
                    <span className="daily-action__icon"><span className="icon-plus-circle"></span></span>
                    Anotar cobro
                </button>
                <button type="button" onClick={() => onNavigate('expenses')} className="daily-action daily-action--expense">
                    <span className="daily-action__icon"><span className="icon-receipt"></span></span>
                    Anotar gasto
                </button>
            </div>

            {nextSetup && (
                <button type="button" onClick={() => onNavigate(nextSetup.view)} className="next-step-card">
                    <div className="w-11 h-11 rounded-full bg-white text-[var(--primary)] flex items-center justify-center shrink-0">
                        <div className="icon-arrow-right"></div>
                    </div>
                    <span className="flex-1">
                        <strong className="block text-gray-900">{nextSetup.title}</strong>
                        <span className="block text-sm text-gray-600 mt-1">{nextSetup.text}</span>
                    </span>
                </button>
            )}

            <div className={`insight-card ${diagnosis.color}`}>
                <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center shrink-0">
                        <div className={`${diagnosis.icon} text-xl`}></div>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-wide opacity-70">En pocas palabras</p>
                        <h3 className="font-black text-lg leading-tight mt-1">{diagnosis.title}</h3>
                        <p className="text-sm mt-2 opacity-90">{diagnosis.text}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="metric-card metric-card--income">
                    <div className="metric-card__icon">
                        <div className="icon-arrow-down text-xl text-white"></div>
                    </div>
                    <p className="text-white/80 text-sm font-medium mb-1">Entró hoy</p>
                    <h3 className="text-2xl font-bold">{formatMoney(todayPeriod.incomeTotal, mainCurrency)}</h3>
                    {todayPeriod.tipTotal > 0 && <p className="text-xs text-white/80 mt-2">Incluye {formatMoney(todayPeriod.tipTotal, mainCurrency)} en propinas</p>}
                </div>

                <div className="metric-card metric-card--expense">
                    <div className="metric-card__icon">
                        <div className="icon-arrow-up text-xl text-red-500"></div>
                    </div>
                    <p className="text-gray-500 text-sm font-medium mb-1">Salió hoy</p>
                    <h3 className="text-2xl font-bold text-gray-900">{formatMoney(todayPeriod.cashExpenseTotal, mainCurrency)}</h3>
                </div>
            </div>

            <div className="profit-hero">
                <div className="profit-hero__glow"></div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-white/60 text-sm font-medium mb-1">Te quedó aproximadamente</p>
                        <h3 className={`text-3xl font-bold ${todayPeriod.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatMoney(todayPeriod.profit, mainCurrency)}
                        </h3>
                    </div>
                    <div className="profit-hero__icon">
                        <div className="icon-chart-pie text-xl text-[var(--primary)]"></div>
                    </div>
                </div>

                <div className="profit-hero__row">
                    <span className="text-sm text-white/70">Ganancia en %</span>
                    <span className={`text-sm font-bold flex items-center gap-1 ${todayPeriod.margin >= desiredMargin ? 'text-green-400' : 'text-orange-300'}`}>
                        <div className="icon-arrow-up text-xs"></div> {todayPeriod.margin.toFixed(1)}%
                    </span>
                </div>
                {todayPeriod.missingCostCount > 0 && (
                    <p className="text-xs text-orange-300 mt-3">
                        Falta calcular el costo de {todayPeriod.missingCostCount} cobro(s); la ganancia puede ser menor.
                    </p>
                )}
                {todayPeriod.incomeTotal <= 0 && todayPeriod.expenseTotal > 0 && (
                    <p className="text-xs text-gray-300 mt-3">
                        Este valor incluye la parte diaria de equipos que duran varios meses.
                    </p>
                )}
            </div>

            <details className="simple-details">
                <summary>Ver semana, mes y consejos</summary>
                <div className="space-y-4 pt-4">
                    <PeriodCard period={weekPeriod} tone={weekPeriod.profit >= 0 ? 'text-green-600' : 'text-red-600'} />
                    <PeriodCard period={monthPeriod} tone={monthPeriod.profit >= 0 ? 'text-green-600' : 'text-red-600'} />

                    <div className="rounded-2xl border border-gray-100 bg-white p-4">
                        <h3 className="font-bold mb-3">En qué se fue el dinero este mes</h3>
                        <div className="space-y-3">
                            {EXPENSE_TYPES.map((type) => (
                                <div key={type.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                                    <p className="font-semibold text-gray-900">{type.label}</p>
                                    <p className="font-bold text-gray-900">{formatMoney(expenseBreakdown[type.id] || 0, mainCurrency)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-4">
                        <h3 className="font-bold mb-3">Qué puedes hacer ahora</h3>
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
                </div>
            </details>

            <div className="recent-section">
                <div className="flex items-end justify-between mb-3">
                    <div><p className="section-eyebrow">Movimientos</p><h3 className="text-xl font-black">Actividad reciente</h3></div>
                    <span className="text-xs font-bold text-gray-400">Hoy</span>
                </div>
                <div className="space-y-3">
                    {recentActivity.map((item) => (
                        <div key={item.id} className="card p-3 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                                <div className={`${item.type === 'income' ? 'icon-scissors text-green-600' : 'icon-receipt text-red-600'}`}></div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                                <p className="text-xs text-gray-500">{item.detail}</p>
                                {item.type === 'income' && item.tip > 0 && <p className="text-xs font-bold text-pink-600">Propina: {formatMoney(item.tip, mainCurrency)}</p>}
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
