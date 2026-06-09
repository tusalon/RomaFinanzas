function CostSheet({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const mainCurrency = state.config.mainCurrency;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [selectedServiceId, setSelectedServiceId] = React.useState(activeServices[0] ? activeServices[0].id : '');
    const [salePrice, setSalePrice] = React.useState(activeServices[0] ? activeServices[0].price : 0);
    const [saleCurrency, setSaleCurrency] = React.useState(activeServices[0] ? activeServices[0].currency : mainCurrency);
    const [manualMaterials, setManualMaterials] = React.useState([]);
    const [manualExtras, setManualExtras] = React.useState([]);
    const [selectedFixedCosts, setSelectedFixedCosts] = React.useState(['rservasroma']);
    const [durationMinutes, setDurationMinutes] = React.useState(activeServices[0] ? activeServices[0].duration : 60);
    const [hourlyValue, setHourlyValue] = React.useState(0);
    const [monthlyServiceCount, setMonthlyServiceCount] = React.useState(0);
    const [includeOverhead, setIncludeOverhead] = React.useState(true);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    const [savedMessage, setSavedMessage] = React.useState('');
    const [copyMessage, setCopyMessage] = React.useState('');
    const savedMaterials = state.materials || [];

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

    const fixedCostOptions = React.useMemo(() => {
        const registeredCosts = (state.expenseEntries || [])
            .filter((entry) => ['fijo', 'herramienta'].includes(normalizeExpenseType(entry.type)))
            .map((entry) => {
                const monthlyAmount = getExpenseImpact(entry, state.config, 'month', now);
                return {
                    id: entry.id,
                    label: entry.description || entry.category || 'Gasto fijo',
                    amount: monthlyAmount,
                    currency: mainCurrency,
                    source: normalizeExpenseType(entry.type) === 'herramienta' ? 'Herramienta depreciada' : 'Gasto fijo mensual'
                };
            })
            .filter((entry) => entry.amount > 0);

        const hasRservasRoma = registeredCosts.some((entry) => String(entry.label).toLowerCase().includes('rservasroma'));

        return [
            ...(!hasRservasRoma ? [{
                id: 'rservasroma',
                label: 'RservasRoma',
                amount: 1000,
                currency: 'CUP',
                source: 'Inversión mensual del sistema'
            }] : []),
            ...registeredCosts
        ];
    }, [state.expenseEntries, state.config, mainCurrency]);

    const selectedFixedRows = fixedCostOptions.filter((item) => selectedFixedCosts.includes(item.id));
    const monthlyBusinessLoad = selectedFixedRows.reduce((sum, item) => (
        sum + convertToMainCurrency(item.amount, item.currency, state.config)
    ), 0);
    const serviceCountForOverhead = Math.max(toNumber(monthlyServiceCount) || monthIncomeCount || 30, 1);
    const overheadPerService = includeOverhead ? monthlyBusinessLoad / serviceCountForOverhead : 0;

    const manualMaterialCatalog = manualMaterials
        .map((item) => {
            const totalCost = toNumber(item.totalCost);
            const uses = Math.max(toNumber(item.uses), 1);
            return {
                id: item.id,
                name: String(item.name || '').trim() || 'Material',
                cost: totalCost,
                currency: mainCurrency,
                uses,
                costPerUse: totalCost / uses,
                unit: 'servicio'
            };
        })
        .filter((item) => item.cost > 0);

    const materialUsages = manualMaterialCatalog.map((material) => ({
        materialId: material.id,
        quantity: 1,
        name: material.name,
        totalCost: material.cost,
        uses: material.uses,
        costPerService: material.costPerUse
    }));

    const extraExpenses = manualExtras
        .map((item) => ({
            id: item.id,
            description: String(item.description || '').trim() || 'Gasto extra',
            amount: toNumber(item.amount),
            currency: item.currency || mainCurrency
        }))
        .filter((item) => item.amount > 0);

    React.useEffect(() => {
        if (!selectedService) return;

        setSalePrice(selectedService.price || 0);
        setSaleCurrency(selectedService.currency || mainCurrency);
        setDurationMinutes(selectedService.duration || 60);
        setMonthlyServiceCount(monthIncomeCount || 30);
        setManualMaterials([]);
        setManualExtras([]);
        setSelectedFixedCosts(['rservasroma']);
        setSavedMessage('');
        setCopyMessage('');
    }, [selectedServiceId]);

    const result = calculateCostSheet(
        effectiveService,
        materialUsages,
        extraExpenses,
        manualMaterialCatalog,
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

    const addMaterial = () => {
        setManualMaterials((current) => ([
            ...current,
            { id: makeId('mat'), productId: '', name: '', totalCost: '', uses: '' }
        ]));
    };

    const updateMaterial = (id, field, value) => {
        setManualMaterials((current) => current.map((item) => (
            item.id === id ? { ...item, [field]: value } : item
        )));
    };

    const selectSavedMaterial = (id, productId) => {
        const product = savedMaterials.find((item) => String(item.id) === String(productId));
        setManualMaterials((current) => current.map((item) => (
            item.id === id ? {
                ...item,
                productId,
                name: product ? product.name : item.name,
                totalCost: product ? product.cost : item.totalCost,
                uses: product ? product.uses : item.uses
            } : item
        )));
    };

    const removeMaterial = (id) => {
        setManualMaterials((current) => current.filter((item) => item.id !== id));
    };

    const getMaterialCostPerService = (item) => {
        const totalCost = toNumber(item.totalCost);
        const uses = Math.max(toNumber(item.uses), 1);
        return totalCost > 0 ? totalCost / uses : 0;
    };

    const addExtra = () => {
        setManualExtras((current) => ([
            ...current,
            { id: makeId('extra'), description: '', amount: '', currency: mainCurrency }
        ]));
    };

    const updateExtra = (id, field, value) => {
        setManualExtras((current) => current.map((item) => (
            item.id === id ? { ...item, [field]: value } : item
        )));
    };

    const removeExtra = (id) => {
        setManualExtras((current) => current.filter((item) => item.id !== id));
    };

    const toggleFixedCost = (id) => {
        setSelectedFixedCosts((current) => (
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        ));
    };

    const buildSummaryText = () => {
        if (!selectedService) return '';

        return [
            `Ficha de costo - ${selectedService.name}`,
            `Precio cobrado: ${formatMoney(result.priceMain, mainCurrency)}`,
            `Materiales: ${formatMoney(result.materialCostMain, mainCurrency)}`,
            `Gastos extra: ${formatMoney(result.extraCostMain, mainCurrency)}`,
            showAdvanced ? `Tiempo/mano de obra: ${formatMoney(result.laborCostMain, mainCurrency)}` : '',
            includeOverhead ? `Gastos fijos repartidos: ${formatMoney(result.overheadCostMain, mainCurrency)}` : '',
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
            fixedCostUsages: selectedFixedRows,
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
                fixedCostUsages: selectedFixedRows,
                simpleMode: !showAdvanced
            }
        });
        setSavedMessage('Ficha guardada para este negocio.');
    };

    const FieldRow = ({ label, children }) => (
        <div>
            <label className="label">{label}</label>
            {children}
        </div>
    );

    return (
        <div className="p-4 pb-10 space-y-5" data-name="cost-sheet" data-file="views/CostSheet.js">
            <div className="px-1">
                <p className="text-sm text-gray-600">Calcula rápido si un servicio deja ganancia real.</p>
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
                            <p className="text-xs text-gray-600">{selectedService.category} - {selectedService.duration} min</p>
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
                        <p className="text-xs text-gray-600">Puedes cambiar este precio para probar si conviene cobrar más o menos.</p>
                    </div>

                    <div className="card p-4 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">3. Materiales usados</p>
                                <h3 className="font-bold text-gray-900">Nombre, costo y rendimiento</h3>
                                <p className="text-sm text-gray-600 mt-1">La inversión por servicio se calcula dividiendo el costo entre las citas que rinde.</p>
                            </div>
                            <button type="button" onClick={addMaterial} className="text-sm font-bold text-[var(--primary)] bg-pink-50 px-3 py-2 rounded-xl shrink-0">
                                + Añadir
                            </button>
                        </div>

                        {manualMaterials.length === 0 ? (
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-600">
                                No hay materiales agregados. Toca <strong>Añadir</strong> para poner nombre, costo total y cuántas citas rinde.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {manualMaterials.map((item, index) => (
                                    <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase">Material {index + 1}</p>
                                            <button type="button" onClick={() => removeMaterial(item.id)} className="text-xs text-red-600 font-bold px-2 py-1 bg-red-50 rounded-lg">
                                                Quitar
                                            </button>
                                        </div>
                                        {savedMaterials.length > 0 && (
                                            <FieldRow label="Producto guardado">
                                                <select
                                                    className="input-field bg-white"
                                                    value={item.productId || ''}
                                                    onChange={(event) => selectSavedMaterial(item.id, event.target.value)}
                                                >
                                                    <option value="">Escribir manualmente</option>
                                                    {savedMaterials.map((product) => (
                                                        <option key={product.id} value={product.id}>
                                                            {product.name} - {formatMoney(getMaterialCostPerUse(product), product.currency)} por uso
                                                        </option>
                                                    ))}
                                                </select>
                                            </FieldRow>
                                        )}
                                        <FieldRow label="Nombre">
                                            <input
                                                type="text"
                                                className="input-field bg-white"
                                                placeholder="Ej. Base, top coat, lima"
                                                value={item.name}
                                                onChange={(event) => updateMaterial(item.id, 'name', event.target.value)}
                                            />
                                        </FieldRow>
                                        <div className="mobile-stack grid grid-cols-[1fr_1fr] gap-2">
                                            <FieldRow label="Costo de compra">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="input-field bg-white font-bold"
                                                    placeholder="Ej. 1500"
                                                    value={item.totalCost}
                                                    onChange={(event) => updateMaterial(item.id, 'totalCost', event.target.value)}
                                                />
                                            </FieldRow>
                                            <FieldRow label="Rinde citas">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="input-field bg-white font-bold"
                                                    placeholder="Ej. 10"
                                                    value={item.uses}
                                                    onChange={(event) => updateMaterial(item.id, 'uses', event.target.value)}
                                                />
                                            </FieldRow>
                                        </div>
                                        <div className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between gap-3">
                                            <span className="text-sm text-gray-500">Inversión por servicio</span>
                                            <strong className="text-[var(--primary)]">{formatMoney(getMaterialCostPerService(item), mainCurrency)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card p-4 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">4. Gastos extra</p>
                                <h3 className="font-bold text-gray-900">Añade todos los gastos del servicio</h3>
                                <p className="text-sm text-gray-600 mt-1">Ejemplos: transporte, comisión, ayuda, decoración o gasto puntual.</p>
                            </div>
                            <button type="button" onClick={addExtra} className="text-sm font-bold text-[var(--primary)] bg-pink-50 px-3 py-2 rounded-xl shrink-0">
                                + Añadir
                            </button>
                        </div>

                        {manualExtras.length === 0 ? (
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm text-gray-600">
                                No hay gastos extra. Puedes añadir tantos como necesites.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {manualExtras.map((item, index) => (
                                    <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold text-gray-500 uppercase">Gasto {index + 1}</p>
                                            <button type="button" onClick={() => removeExtra(item.id)} className="text-xs text-red-600 font-bold px-2 py-1 bg-red-50 rounded-lg">
                                                Quitar
                                            </button>
                                        </div>
                                        <FieldRow label="Descripción">
                                            <input
                                                type="text"
                                                className="input-field bg-white"
                                                placeholder="Ej. Transporte, comisión, ayuda"
                                                value={item.description}
                                                onChange={(event) => updateExtra(item.id, 'description', event.target.value)}
                                            />
                                        </FieldRow>
                                        <div className="mobile-stack grid grid-cols-[1fr_110px] gap-2">
                                            <FieldRow label="Monto">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="input-field bg-white font-bold"
                                                    placeholder="Ej. 500"
                                                    value={item.amount}
                                                    onChange={(event) => updateExtra(item.id, 'amount', event.target.value)}
                                                />
                                            </FieldRow>
                                            <FieldRow label="Moneda">
                                                <select
                                                    className="input-field bg-white"
                                                    value={item.currency}
                                                    onChange={(event) => updateExtra(item.id, 'currency', event.target.value)}
                                                >
                                                    {SUPPORTED_CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                                                </select>
                                            </FieldRow>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card p-4 border-blue-100 bg-blue-50 space-y-4">
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                className="mt-1 accent-blue-600"
                                checked={includeOverhead}
                                onChange={(event) => setIncludeOverhead(event.target.checked)}
                            />
                            <div>
                                <p className="font-bold text-blue-950">5. Incluir gastos fijos mensuales</p>
                                <p className="text-sm text-blue-800 mt-1">
                                    Reparte gastos como RservasRoma, renta, salario, corriente o herramientas entre los servicios del mes.
                                </p>
                            </div>
                        </div>

                        {includeOverhead && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    {fixedCostOptions.map((item) => (
                                        <label key={item.id} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-blue-100">
                                            <input
                                                type="checkbox"
                                                className="mt-1 accent-blue-600"
                                                checked={selectedFixedCosts.includes(item.id)}
                                                onChange={() => toggleFixedCost(item.id)}
                                            />
                                            <span className="flex-1">
                                                <span className="block font-bold text-blue-950">{item.label}</span>
                                                <span className="block text-xs text-blue-700">{item.source}</span>
                                            </span>
                                            <strong className="text-blue-950">{formatMoney(item.amount, item.currency)}</strong>
                                        </label>
                                    ))}
                                </div>

                                <div className="bg-white rounded-xl p-3 border border-blue-100 space-y-2">
                                    <label className="text-xs text-blue-700 font-semibold">Servicios estimados al mes</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="input-field !py-2 bg-white font-bold"
                                        value={monthlyServiceCount}
                                        onChange={(event) => setMonthlyServiceCount(event.target.value)}
                                    />
                                    <p className="text-xs text-blue-700">Gasto mensual seleccionado: {formatMoney(monthlyBusinessLoad, mainCurrency)}</p>
                                    <p className="text-xs text-blue-700">Carga por servicio: {formatMoney(overheadPerService, mainCurrency)}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAdvanced((current) => !current)}
                        className="btn-secondary"
                    >
                        <div className={showAdvanced ? 'icon-chevron-up text-sm' : 'icon-chevron-down text-sm'}></div>
                        {showAdvanced ? 'Ocultar mano de obra' : 'Añadir mano de obra'}
                    </button>

                    {showAdvanced && (
                        <div className="card p-4 border-blue-100 bg-blue-50 space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase text-blue-700 mb-1">Opcional</p>
                                <h3 className="font-bold text-blue-950">Tiempo y valor de tu trabajo</h3>
                                <p className="text-sm text-blue-800 mt-1">Úsalo si quieres sumar tu mano de obra al costo del servicio.</p>
                            </div>

                            <div className="mobile-stack grid grid-cols-2 gap-3">
                                <FieldRow label="Duración real">
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
                                </FieldRow>
                                <FieldRow label="Valor de tu hora">
                                    <input
                                        type="number"
                                        min="0"
                                        className="input-field bg-white font-bold"
                                        value={hourlyValue}
                                        onChange={(event) => setHourlyValue(event.target.value)}
                                    />
                                </FieldRow>
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
                            <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider">Resumen de ganancia</h3>
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
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-400">Gastos extra</span>
                                <strong>- {formatMoney(result.extraCostMain, mainCurrency)}</strong>
                            </div>
                            {showAdvanced && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-400">Mano de obra</span>
                                    <strong>- {formatMoney(result.laborCostMain, mainCurrency)}</strong>
                                </div>
                            )}
                            {includeOverhead && (
                                <div className="flex justify-between gap-3">
                                    <span className="text-gray-400">Gastos fijos</span>
                                    <strong>- {formatMoney(result.overheadCostMain, mainCurrency)}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={copySummary} className="btn-secondary">
                            <div className="icon-copy text-sm"></div>
                            Copiar resumen
                        </button>
                        <button type="button" onClick={saveSheet} className="btn-primary">
                            <div className="icon-save text-sm"></div>
                            Guardar ficha
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
