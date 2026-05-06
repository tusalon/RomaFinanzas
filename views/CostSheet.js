function CostSheet({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const mainCurrency = state.config.mainCurrency;
    const [selectedServiceId, setSelectedServiceId] = React.useState(activeServices[0] ? activeServices[0].id : '');
    const [materialUsages, setMaterialUsages] = React.useState([]);
    const [extraExpenses, setExtraExpenses] = React.useState([
        { id: 'extra_1', description: 'Gasto asociado', amount: 0, currency: mainCurrency }
    ]);
    const [savedMessage, setSavedMessage] = React.useState('');

    const selectedService = activeServices.find((service) => service.id === selectedServiceId);

    React.useEffect(() => {
        if (!selectedService) {
            setMaterialUsages([]);
            return;
        }
        setMaterialUsages((selectedService.defaultMaterials || []).map((item) => ({ ...item })));
        setSavedMessage('');
    }, [selectedServiceId]);

    const result = calculateCostSheet(
        selectedService,
        materialUsages,
        extraExpenses,
        state.materials,
        state.config
    );

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

    const saveSheet = () => {
        if (!selectedService) return;
        actions.saveCostSheet({
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            materialUsages,
            extraExpenses,
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
        setSavedMessage('Ficha guardada localmente.');
    };

    return (
        <div className="p-4 pb-10" data-name="cost-sheet" data-file="views/CostSheet.js">
            <p className="text-sm text-gray-600 mb-6 px-1">Calcula cuanto te queda limpio despues de materiales y gastos asociados.</p>

            <div className="space-y-5">
                <div className="card p-4 bg-[var(--bg-color)] shadow-inner border-gray-200">
                    <label className="label">1. Seleccionar servicio</label>
                    <select
                        className="input-field bg-white"
                        value={selectedServiceId}
                        onChange={(event) => setSelectedServiceId(event.target.value)}
                    >
                        {activeServices.map((service) => (
                            <option key={service.id} value={service.id}>
                                {service.name} ({formatMoney(service.price, service.currency)})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedService && (
                    <div className="space-y-5">
                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <label className="label !mb-0">2. Materiales usados</label>
                                <button type="button" onClick={addMaterial} className="text-[var(--primary)] text-sm font-medium flex items-center gap-1">
                                    <div className="icon-plus text-xs"></div> Anadir
                                </button>
                            </div>

                            <div className="card p-0 overflow-hidden border border-gray-200">
                                {materialUsages.map((usage, index) => {
                                    const material = state.materials.find((item) => item.id === usage.materialId);
                                    const lineCost = material ? getMaterialCostPerUse(material) * toNumber(usage.quantity) : 0;

                                    return (
                                        <div key={`${usage.materialId}_${index}`} className="p-3 border-b border-gray-100 last:border-b-0 bg-gray-50 space-y-3">
                                            <div className="grid grid-cols-[1fr_90px_36px] gap-2 items-center">
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
                                                <button type="button" onClick={() => removeMaterial(index)} className="h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                                                    <div className="icon-x text-sm"></div>
                                                </button>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>{material ? `${formatMoney(getMaterialCostPerUse(material), material.currency)} por uso` : 'Sin material'}</span>
                                                <span className="font-semibold text-gray-700">{material ? formatMoney(lineCost, material.currency) : formatMoney(0, mainCurrency)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <label className="label !mb-0">3. Gastos asociados</label>
                                <button type="button" onClick={addExtra} className="text-[var(--primary)] text-sm font-medium flex items-center gap-1">
                                    <div className="icon-plus text-xs"></div> Anadir
                                </button>
                            </div>

                            <div className="space-y-3">
                                {extraExpenses.map((expense, index) => (
                                    <div key={expense.id} className="card p-3 grid grid-cols-[1fr_96px_82px] gap-2 items-center">
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

                        <div className="card bg-gray-900 text-white p-5 border-none mb-6 shadow-lg">
                            <h3 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Resultado en {mainCurrency}</h3>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-300">Precio cobrado</span>
                                    <span>{formatMoney(result.priceMain, mainCurrency)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-red-400">
                                    <span>Costo materiales</span>
                                    <span>- {formatMoney(result.materialCostMain, mainCurrency)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-red-400">
                                    <span>Gastos asociados</span>
                                    <span>- {formatMoney(result.extraCostMain, mainCurrency)}</span>
                                </div>
                            </div>

                            <div className="border-t border-gray-700 pt-4 flex justify-between items-end">
                                <div>
                                    <p className="text-xs text-gray-400 mb-1">Te queda limpio</p>
                                    <p className={`text-2xl font-bold ${result.profitMain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatMoney(result.profitMain, mainCurrency)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 mb-1">Margen</p>
                                    <p className="font-bold text-white bg-white/10 px-2 py-1 rounded">{result.margin.toFixed(1)}%</p>
                                </div>
                            </div>

                            <div className="mt-4 bg-white/10 rounded-xl p-3 text-sm">
                                Precio sugerido para {state.config.desiredMargin}%: <strong>{formatMoney(result.recommendedPriceMain, mainCurrency)}</strong>
                            </div>
                        </div>

                        {savedMessage && (
                            <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">
                                {savedMessage}
                            </div>
                        )}

                        <button type="button" onClick={saveSheet} className="btn-primary">
                            Guardar Ficha
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
