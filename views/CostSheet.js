function CostSheet({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const mainCurrency = state.config.mainCurrency;
    const [selectedServiceId, setSelectedServiceId] = React.useState(activeServices[0] ? activeServices[0].id : '');
    const [salePrice, setSalePrice] = React.useState(activeServices[0] ? activeServices[0].price : 0);
    const [saleCurrency, setSaleCurrency] = React.useState(activeServices[0] ? activeServices[0].currency : mainCurrency);
    const [materialUsages, setMaterialUsages] = React.useState([]);
    const [extraExpenses, setExtraExpenses] = React.useState([
        { id: 'extra_1', description: 'Gasto extra', amount: 0, currency: mainCurrency }
    ]);
    const [savedMessage, setSavedMessage] = React.useState('');
    const [copyMessage, setCopyMessage] = React.useState('');

    const selectedService = activeServices.find((service) => service.id === selectedServiceId);
    const effectiveService = selectedService ? {
        ...selectedService,
        price: toNumber(salePrice),
        currency: saleCurrency || selectedService.currency || mainCurrency
    } : null;

    React.useEffect(() => {
        if (!selectedService) {
            setMaterialUsages([]);
            return;
        }

        setSalePrice(selectedService.price || 0);
        setSaleCurrency(selectedService.currency || mainCurrency);
        setMaterialUsages((selectedService.defaultMaterials || []).map((item) => ({ ...item })));
        setSavedMessage('');
        setCopyMessage('');
    }, [selectedServiceId]);

    const result = calculateCostSheet(
        effectiveService,
        materialUsages,
        extraExpenses,
        state.materials,
        state.config
    );

    const savedSheets = (state.costSheets || [])
        .filter((sheet) => String(sheet.serviceId) === String(selectedServiceId))
        .slice(0, 3);

    const recommendedDifference = Math.max(0, result.recommendedPriceMain - result.priceMain);
    const profitLabel = result.profitMain >= 0 ? 'Ganancia limpia' : 'Perdida';
    const marginWidth = `${Math.max(0, Math.min(100, result.margin))}%`;

    const getMarginAlert = () => {
        if (result.margin < 0) {
            return {
                title: 'Estás perdiendo dinero con este servicio.',
                text: 'El precio que estás cobrando no cubre lo que gastas.',
                className: 'bg-red-50 text-red-700 border-red-100',
                icon: 'icon-triangle-alert'
            };
        }

        if (result.margin >= state.config.desiredMargin) {
            return {
                title: 'Este servicio sí deja buena ganancia.',
                text: 'Tu precio está por encima del margen que quieres lograr.',
                className: 'bg-green-50 text-green-700 border-green-100',
                icon: 'icon-circle-check'
            };
        }

        return {
            title: 'Estás cobrando poco para lo que gastas.',
            text: 'Puedes subir el precio o revisar materiales para mejorar la ganancia.',
            className: 'bg-orange-50 text-orange-700 border-orange-100',
            icon: 'icon-circle-alert'
        };
    };

    const alert = getMarginAlert();

    const updateMaterial = (index, field, value) => {
        setMaterialUsages((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: field === 'quantity' ? toNumber(value) : value } : item
        )));
    };

    const addMaterial = () => {
        const usedIds = materialUsages.map((item) => item.materialId);
        const nextMaterial = state.materials.find((item) => !usedIds.includes(item.id)) || state.materials[0];
        if (!nextMaterial) return;
        setMaterialUsages((current) => [...current, { materialId: nextMaterial.id, quantity: 1 }]);
    };

    const removeMaterial = (index) => {
        setMaterialUsages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const updateExtra = (index, field, value) => {
        setExtraExpenses((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [field]: field === 'amount' ? toNumber(value) : value } : item
        )));
    };

    const addExtra = () => {
        setExtraExpenses((current) => [
            ...current,
            { id: makeId('extra'), description: 'Otro gasto', amount: 0, currency: mainCurrency }
        ]);
    };

    const buildSummaryText = () => {
        if (!selectedService) return '';

        return [
            `Ficha de costo - ${selectedService.name}`,
            `Precio cobrado: ${formatMoney(result.priceMain, mainCurrency)}`,
            `Costo en materiales: ${formatMoney(result.materialCostMain, mainCurrency)}`,
            `Gastos extra: ${formatMoney(result.extraCostMain, mainCurrency)}`,
            `Costo total: ${formatMoney(result.totalCostMain, mainCurrency)}`,
            `${profitLabel}: ${formatMoney(result.profitMain, mainCurrency)}`,
            `Margen: ${result.margin.toFixed(1)}%`,
            `Precio recomendado: ${formatMoney(result.recommendedPriceMain, mainCurrency)}`
        ].join('\n');
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
                totalCostMain: result.totalCostMain,
                profitMain: result.profitMain,
                margin: result.margin,
                recommendedPriceMain: result.recommendedPriceMain
            }
        });
        setSavedMessage('Ficha guardada para este negocio.');
    };

    return (
        <div className="p-4 pb-10 space-y-5" data-name="cost-sheet" data-file="views/CostSheet.js">
            <div className="px-1">
                <p className="text-sm text-gray-600">Calcula cuánto te queda limpio y si el precio que cobras tiene sentido.</p>
            </div>

            <div className="card p-4 space-y-3">
                <label className="label">1. Servicio a revisar</label>
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

                        <p className="text-xs text-gray-600">
                            Puedes cambiar este precio para probar si conviene cobrar más o menos.
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="label !mb-0">3. Materiales usados</label>
                            <button type="button" onClick={addMaterial} className="text-[var(--primary)] text-sm font-medium flex items-center gap-1">
                                <div className="icon-plus text-xs"></div> Añadir
                            </button>
                        </div>

                        <div className="card p-0 overflow-hidden border border-gray-200">
                            {materialUsages.length === 0 && (
                                <div className="p-4 text-sm text-gray-500">No hay materiales asignados a este servicio.</div>
                            )}

                            {materialUsages.map((usage, index) => {
                                const material = state.materials.find((item) => item.id === usage.materialId);
                                const lineCost = material ? getMaterialCostPerUse(material) * toNumber(usage.quantity) : 0;
                                const lineCostMain = material ? convertToMainCurrency(lineCost, material.currency, state.config) : 0;

                                return (
                                    <div key={`${usage.materialId}_${index}`} className="p-3 border-b border-gray-100 last:border-b-0 bg-gray-50 space-y-3">
                                        <div className="mobile-stack grid grid-cols-[1fr_90px_36px] gap-2 items-center">
                                            <select
                                                className="input-field !py-2 !px-3 bg-white"
                                                value={usage.materialId}
                                                onChange={(event) => updateMaterial(index, 'materialId', event.target.value)}
                                            >
                                                {state.materials.map((item) => (
                                                    <option key={item.id} value={item.id}>{item.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                className="input-field !py-2 !px-3 text-right bg-white"
                                                value={usage.quantity}
                                                onChange={(event) => updateMaterial(index, 'quantity', event.target.value)}
                                            />
                                            <button type="button" onClick={() => removeMaterial(index)} className="icon-button h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                                                <div className="icon-x text-sm"></div>
                                            </button>
                                        </div>
                                        <div className="flex justify-between gap-3 text-xs text-gray-500">
                                            <span>{material ? `${formatMoney(getMaterialCostPerUse(material), material.currency)} por uso` : 'Sin material'}</span>
                                            <span className="font-semibold text-gray-800">{formatMoney(lineCostMain, mainCurrency)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="label !mb-0">4. Gastos extra</label>
                            <button type="button" onClick={addExtra} className="text-[var(--primary)] text-sm font-medium flex items-center gap-1">
                                <div className="icon-plus text-xs"></div> Añadir
                            </button>
                        </div>

                        <div className="space-y-3">
                            {extraExpenses.map((expense, index) => (
                                <div key={expense.id} className="mobile-stack card p-3 grid grid-cols-[1fr_96px_82px] gap-2 items-center">
                                    <input
                                        type="text"
                                        className="input-field !py-2 !px-3"
                                        value={expense.description}
                                        onChange={(event) => updateExtra(index, 'description', event.target.value)}
                                    />
                                    <input
                                        type="number"
                                        min="0"
                                        className="input-field !py-2 !px-3 text-right"
                                        value={expense.amount}
                                        onChange={(event) => updateExtra(index, 'amount', event.target.value)}
                                    />
                                    <select
                                        className="input-field !py-2 !px-2"
                                        value={expense.currency}
                                        onChange={(event) => updateExtra(index, 'currency', event.target.value)}
                                    >
                                        {SUPPORTED_CURRENCIES.map((currency) => (
                                            <option key={currency}>{currency}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

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
                                <span>Deseado: {state.config.desiredMargin}%</span>
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
