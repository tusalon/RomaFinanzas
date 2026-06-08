function CostSheet({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const mainCurrency = state.config.mainCurrency;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [selectedServiceId, setSelectedServiceId] = React.useState(activeServices[0] ? activeServices[0].id : '');
    const [salePrice, setSalePrice] = React.useState(activeServices[0] ? activeServices[0].price : 0);
    const [saleCurrency, setSaleCurrency] = React.useState(activeServices[0] ? activeServices[0].currency : mainCurrency);
    const [simpleMaterialCost, setSimpleMaterialCost] = React.useState(0);
    const [simpleExtraCost, setSimpleExtraCost] = React.useState(0);
    const [durationMinutes, setDurationMinutes] = React.useState(activeServices[0] ? activeServices[0].duration : 60);
    const [hourlyValue, setHourlyValue] = React.useState(0);
    const [monthlyServiceCount, setMonthlyServiceCount] = React.useState(0);
    const [includeOverhead, setIncludeOverhead] = React.useState(false);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [savedMessage, setSavedMessage] = React.useState('');
    const [copyMessage, setCopyMessage] = React.useState('');

    const selectedService = activeServices.find((service) => service.id === selectedServiceId);
    const effectiveService = selectedService ? {
        ...selectedService,
        price: toNumber(salePrice),
        currency: saleCurrency || selectedService.currency || mainCurrency
    } : null;

    const monthIncomeCount = (state.incomeEntries || []).filter((entry) => {
        const entryDate = new Date(`${entry.date || getTodayKey()}T00:00:00`);
        return entryDate >= monthStart;
    }).length;

    const monthlyBusinessLoad = (state.expenseEntries || []).reduce((sum, entry) => {
        const type = normalizeExpenseType(entry.type);
        if (type !== 'fijo' && type !== 'herramienta') return sum;
        return sum + getExpenseImpact(entry, state.config, 'month', now);
    }, 0);

    const serviceCountForOverhead = Math.max(toNumber(monthlyServiceCount) || monthIncomeCount || 1, 1);
    const overheadPerService = includeOverhead ? monthlyBusinessLoad / serviceCountForOverhead : 0;
    const simpleMaterial = {
        id: 'manual_material',
        name: 'Materiales usados',
        cost: toNumber(simpleMaterialCost),
        currency: mainCurrency,
        uses: 1,
        costPerUse: toNumber(simpleMaterialCost)
    };
    const materialUsages = toNumber(simpleMaterialCost) > 0
        ? [{ materialId: 'manual_material', quantity: 1 }]
        : [];
    const extraExpenses = toNumber(simpleExtraCost) > 0
        ? [{ id: 'manual_extra', description: 'Gastos extra', amount: toNumber(simpleExtraCost), currency: mainCurrency }]
        : [];

    React.useEffect(() => {
        if (!selectedService) return;

        setSalePrice(selectedService.price || 0);
        setSaleCurrency(selectedService.currency || mainCurrency);
        setDurationMinutes(selectedService.duration || 60);
        setMonthlyServiceCount(monthIncomeCount || 30);
        setSimpleMaterialCost(0);
        setSimpleExtraCost(0);
        setSavedMessage('');
        setCopyMessage('');
    }, [selectedServiceId]);

    const result = calculateCostSheet(
        effectiveService,
        materialUsages,
        extraExpenses,
        [simpleMaterial],
        state.config,
        {
            durationMinutes,
            hourlyValue,
            hourlyCurrency: mainCurrency,
            overheadCostMain: overheadPerService
        }
    );

    const savedSheets = (state.costSheets || [])
        .filter((sheet) => String(sheet.serviceId) === String(selectedServiceId))
        .slice(0, 3);

    const recommendedDifference = Math.max(0, result.recommendedPriceMain - result.priceMain);
    const profitLabel = result.profitMain >= 0 ? 'Ganancia limpia' : 'Pérdida';
    const marginWidth = `${Math.max(0, Math.min(100, result.margin))}%`;

    const getMarginAlert = () => {
        if (result.margin < 0) {
            return {
                title: 'Estás perdiendo dinero.',
                text: 'El precio no cubre los costos que pusiste.',
                className: 'bg-red-50 text-red-700 border-red-100',
                icon: 'icon-triangle-alert'
            };
        }

        if (result.margin >= state.config.desiredMargin) {
            return {
                title: 'Este servicio deja buena ganancia.',
                text: 'El precio está por encima del margen que quieres lograr.',
                className: 'bg-green-50 text-green-700 border-green-100',
                icon: 'icon-circle-check'
            };
        }

        return {
            title: 'Este servicio puede mejorar.',
            text: 'Deja ganancia, pero menos de la meta configurada.',
            className: 'bg-orange-50 text-orange-700 border-orange-100',
            icon: 'icon-circle-alert'
        };
    };

    const alert = getMarginAlert();

    const buildSummaryText = () => {
        if (!selectedService) return '';

        return [
            `Ficha de costo - ${selectedService.name}`,
            `Precio cobrado: ${formatMoney(result.priceMain, mainCurrency)}`,
            `Materiales: ${formatMoney(result.materialCostMain, mainCurrency)}`,
            showAdvanced ? `Tiempo/mano de obra: ${formatMoney(result.laborCostMain, mainCurrency)}` : '',
            showAdvanced ? `Carga del negocio: ${formatMoney(result.overheadCostMain, mainCurrency)}` : '',
            `Gastos extra: ${formatMoney(result.extraCostMain, mainCurrency)}`,
            `Costo total: ${formatMoney(result.totalCostMain, mainCurrency)}`,
            `${profitLabel}: ${formatMoney(result.profitMain, mainCurrency)}`,
            `Margen: ${result.margin.toFixed(1)}%`,
            `Precio recomendado: ${formatMoney(result.recommendedPriceMain, mainCurrency)}`
        ].filter(Boolean).join('\n');
    };

    const copySummary = async () => {
        const text = buildSummaryText();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage('Resumen copiado.');
        } catch (error) {
            console.warn('No se pudo copiar el resumen:', error);
            setCopyMessage('No se pudo copiar automáticamente.');
        }
    };

    const saveSheet = async () => {
        if (!selectedService) return;
        await actions.saveCostSheet({
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            materialUsages,
            extraExpenses,
            salePrice: toNumber(salePrice),
            saleCurrency,
            totals: {
                priceMain: result.priceMain,
                materialCostMain: result.materialCostMain,
                extraCostMain: result.extraCostMain,
                laborCostMain: result.laborCostMain,
                overheadCostMain: result.overheadCostMain,
                totalCostMain: result.totalCostMain,
                profitMain: result.profitMain,
                margin: result.margin,
                recommendedPriceMain: result.recommendedPriceMain,
                durationMinutes: toNumber(durationMinutes),
                hourlyValue: toNumber(hourlyValue),
                monthlyBusinessLoad,
                monthlyServiceCount: serviceCountForOverhead,
                simpleMode: !showAdvanced
            }
        });
        setSavedMessage('Ficha guardada para este negocio.');
    };

    return (
        <div className="p-4 pb-10 space-y-5" data-name="cost-sheet" data-file="views/CostSheet.js">
            <div className="px-1">
                <p className="text-sm text-gray-600">Calcula rápido si un servicio deja ganancia.</p>
            </div>

            <div className="card p-4 space-y-3">
                <label className="label">1. Servicio</label>
                <select
                    className="input-field bg-white"
                    value={selectedServiceId}
                    onChange={(event) => setSelectedServiceId(event.target.value)}
                >
                    {activeServices.map((service) => (
                        <option key={service.id} value={service.id}>{service.name}</option>
                    ))}
                </select>
            </div>

            {selectedService && (
                <div className="space-y-5">
                    <div className="card p-4 bg-[var(--primary-light)] border-pink-100 space-y-4">
                        <div>
                            <p className="text-xs font-bold text-[var(--primary-dark)] uppercase mb-1">2. Precio cobrado</p>
                            <h2 className="text-xl font-bold text-gray-900">{selectedService.name}</h2>
                            <p className="text-xs text-gray-600">{selectedService.category} · {selectedService.duration} min</p>
                        </div>

                        <div className="mobile-stack grid grid-cols-[1fr_110px] gap-2">
                            <input
                                type="number"
                                min="0"
                                className="input-field bg-white text-lg font-bold"
                                value={salePrice}
                                onChange={(event) => setSalePrice(event.target.value)}
                            />
                            <select
                                className="input-field bg-white"
                                value={saleCurrency}
                                onChange={(event) => setSaleCurrency(event.target.value)}
                            >
                                {SUPPORTED_CURRENCIES.map((currency) => (
                                    <option key={currency}>{currency}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="card p-4 space-y-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">3. Costos principales</p>
                            <h3 className="font-bold text-gray-900">¿Cuánto gastaste para hacer este servicio?</h3>
                        </div>

                        <div>
                            <label className="label">Materiales usados</label>
                            <input
                                type="number"
                                min="0"
                                className="input-field font-bold"
                                placeholder="Ej. 350"
                                value={simpleMaterialCost}
                                onChange={(event) => setSimpleMaterialCost(event.target.value)}
                            />
                        </div>

                        <div>
                            <label className="label">Otros gastos de este servicio</label>
                            <input
                                type="number"
                                min="0"
                                className="input-field font-bold"
                                placeholder="Ej. transporte, comisión, ayuda"
                                value={simpleExtraCost}
                                onChange={(event) => setSimpleExtraCost(event.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAdvanced((current) => !current)}
                        className="btn-secondary"
                    >
                        <div className={showAdvanced ? 'icon-chevron-up text-sm' : 'icon-chevron-down text-sm'}></div>
                        {showAdvanced ? 'Ocultar opciones avanzadas' : 'Opciones avanzadas'}
                    </button>

                    {showAdvanced && (
                        <div className="card p-4 border-blue-100 bg-blue-50 space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase text-blue-700 mb-1">Opcional</p>
                                <h3 className="font-bold text-blue-950">Tiempo y carga del negocio</h3>
                                <p className="text-sm text-blue-800 mt-1">Úsalo si quieres una ficha más realista.</p>
                            </div>

                            <div className="mobile-stack grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label text-blue-900">Duración real</label>
                                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                        <input
                                            type="number"
                                            min="1"
                                            className="input-field bg-white font-bold"
                                            value={durationMinutes}
                                            onChange={(event) => setDurationMinutes(event.target.value)}
                                        />
                                        <span className="text-sm font-semibold text-blue-900">min</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="label text-blue-900">Valor de tu hora</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="input-field bg-white font-bold"
                                        value={hourlyValue}
                                        onChange={(event) => setHourlyValue(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-blue-100 pt-4 space-y-3">
                                <label className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        className="mt-1 accent-blue-600"
                                        checked={includeOverhead}
                                        onChange={(event) => setIncludeOverhead(event.target.checked)}
                                    />
                                    <span>
                                        <span className="block font-bold text-blue-950">Incluir gastos fijos y herramientas</span>
                                        <span className="block text-sm text-blue-800">La app reparte {formatMoney(monthlyBusinessLoad, mainCurrency)} entre los servicios del mes.</span>
                                    </span>
                                </label>

                                {includeOverhead && (
                                    <div className="bg-white rounded-xl p-3 border border-blue-100 space-y-2">
                                        <label className="text-xs text-blue-700 font-semibold">Servicios estimados al mes</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="input-field !py-2 bg-white font-bold"
                                            value={monthlyServiceCount}
                                            onChange={(event) => setMonthlyServiceCount(event.target.value)}
                                        />
                                        <p className="text-xs text-blue-700">Carga por servicio: {formatMoney(overheadPerService, mainCurrency)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={`card p-4 border-2 ${alert.className}`}>
                        <div className="flex items-start gap-3">
                            <div className={`${alert.icon} text-xl mt-0.5`}></div>
                            <div>
                                <p className="font-bold leading-snug">{alert.title}</p>
                                <p className="text-sm opacity-90 mt-1">{alert.text}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card bg-gray-900 text-white p-5 border-none shadow-lg space-y-5">
                        <div>
                            <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Resultado</h3>
                            <p className="text-3xl font-black mt-2">{formatMoney(result.profitMain, mainCurrency)}</p>
                            <p className="text-sm text-gray-300">{profitLabel} después de descontar costos.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">Costo total</p>
                                <p className="text-lg font-bold">{formatMoney(result.totalCostMain, mainCurrency)}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">Margen</p>
                                <p className="text-lg font-bold">{result.margin.toFixed(1)}%</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">Precio recomendado</p>
                                <p className="text-lg font-bold">{formatMoney(result.recommendedPriceMain, mainCurrency)}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">Subir mínimo</p>
                                <p className="text-lg font-bold">{formatMoney(recommendedDifference, mainCurrency)}</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-2">
                                <span>Margen actual</span>
                                <span>Meta: {state.config.desiredMargin}%</span>
                            </div>
                            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: marginWidth }}></div>
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-400">Precio cobrado</span>
                                <strong>{formatMoney(result.priceMain, mainCurrency)}</strong>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-400">Materiales</span>
                                <strong>- {formatMoney(result.materialCostMain, mainCurrency)}</strong>
                            </div>
                            {showAdvanced && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-400">Tiempo</span>
                                    <strong>- {formatMoney(result.laborCostMain, mainCurrency)}</strong>
                                </div>
                            )}
                            {showAdvanced && includeOverhead && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-400">Gastos fijos</span>
                                    <strong>- {formatMoney(result.overheadCostMain, mainCurrency)}</strong>
                                </div>
                            )}
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-400">Otros gastos</span>
                                <strong>- {formatMoney(result.extraCostMain, mainCurrency)}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={copySummary} className="btn-secondary">
                            <div className="icon-copy text-sm"></div>
                            Copiar
                        </button>
                        <button type="button" onClick={saveSheet} className="btn-primary">
                            <div className="icon-save text-sm"></div>
                            Guardar
                        </button>
                    </div>

                    {(savedMessage || copyMessage) && (
                        <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">
                            {savedMessage || copyMessage}
                        </div>
                    )}

                    {state.syncError && (
                        <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm">
                            {state.syncError}
                        </div>
                    )}

                    {savedSheets.length > 0 && (
                        <div className="card p-4">
                            <h3 className="font-bold text-gray-900 mb-3">Últimas fichas guardadas</h3>
                            <div className="space-y-3">
                                {savedSheets.map((sheet) => (
                                    <div key={sheet.id} className="rounded-xl bg-gray-50 p-3 border border-gray-100">
                                        <div className="flex justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-gray-900">{sheet.serviceName}</p>
                                                <p className="text-xs text-gray-500">{new Date(sheet.createdAt).toLocaleDateString('es-CU')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-700">{formatMoney(sheet.totals.profitMain, mainCurrency)}</p>
                                                <p className="text-xs text-gray-500">{toNumber(sheet.totals.margin).toFixed(1)}%</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
