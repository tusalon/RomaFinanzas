function CostSheet({ onBack }) {
    const { state, actions } = useFinanceApp();
    const activeServices = state.services.filter((service) => service.active);
    const mainCurrency = state.config.mainCurrency;
    const [selectedServiceId, setSelectedServiceId] = React.useState(activeServices[0] ? activeServices[0].id : '');
    const [materialUsages, setMaterialUsages] = React.useState([]);
    const [extraExpenses, setExtraExpenses] = React.useState([
        { id: 'extra_1', description: 'Gasto extra', amount: 0, currency: mainCurrency }
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

    const getMarginAlert = () => {
        if (result.margin < 0) {
            return {
                text: 'Este servicio te esta dejando perdida.',
                className: 'bg-red-50 text-red-700 border-red-100',
                icon: 'icon-triangle-alert'
            };
        }

        if (result.margin >= state.config.desiredMargin) {
            return {
                text: 'Este servicio si deja buena ganancia.',
                className: 'bg-green-50 text-green-700 border-green-100',
                icon: 'icon-circle-check'
            };
        }

        return {
            text: 'Estas cobrando poco para lo que gastas.',
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
        <div className="p-4 pb-10 space-y-5" data-name="cost-sheet" data-file="views/CostSheet.js">
            <div className="px-1">
                <p className="text-sm text-gray-600">Calcula rapido si este servicio te deja dinero limpio.</p>
            </div>

            <div className="card p-4">
                <label className="label">1. Seleccionar servicio</label>
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
                    <div className="card p-4 bg-[var(--primary-light)] border-pink-100">
                        <p className="text-xs font-bold text-[var(--primary-dark)] uppercase mb-1">2. Precio actual del servicio</p>
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedService.name}</h2>
                                <p className="text-xs text-gray-600">{selectedService.category} · {selectedService.duration} min</p>
                            </div>
                            <p className="text-2xl font-bold text-[var(--primary-dark)] text-right">{formatMoney(result.priceMain, mainCurrency)}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="label !mb-0">3. Materiales usados</label>
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
                            <label className="label !mb-0">Gastos extra (opcional)</label>
                            <button type="button" onClick={addExtra} className="text-[var(--primary)] text-sm font-medium flex items-center gap-1">
                                <div className="icon-plus text-xs"></div> Anadir
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
                            <p className="font-bold leading-snug">{alert.text}</p>
                        </div>
                    </div>

                    <div className="card bg-gray-900 text-white p-5 border-none shadow-lg">
                        <h3 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Resumen claro</h3>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">4. Costo total</p>
                                <p className="text-lg font-bold">{formatMoney(result.totalCostMain, mainCurrency)}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">5. Ganancia</p>
                                <p className={`text-lg font-bold ${result.profitMain >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatMoney(result.profitMain, mainCurrency)}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">6. Margen</p>
                                <p className="text-lg font-bold">{result.margin.toFixed(1)}%</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-3">
                                <p className="text-xs text-gray-400 mb-1">7. Precio recomendado</p>
                                <p className="text-lg font-bold">{formatMoney(result.recommendedPriceMain, mainCurrency)}</p>
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-gray-400">Precio actual</span>
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
    );
}
