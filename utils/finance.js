const SUPPORTED_CURRENCIES = ['CUP', 'USD', 'MLC', 'EUR'];

function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function convertToMainCurrency(amount, currency, config) {
    const value = toNumber(amount);
    const mainCurrency = config.mainCurrency || 'CUP';

    if (currency === mainCurrency) return value;
    if (mainCurrency !== 'CUP') return value;

    const rate = toNumber(config.rates && config.rates[currency]);
    return rate > 0 ? value * rate : value;
}

function formatMoney(amount, currency) {
    const value = toNumber(amount);
    return `${value.toLocaleString('en-US', {
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    })} ${currency}`;
}

function getMaterialCostPerUse(material) {
    if (!material) return 0;
    if (toNumber(material.costPerUse) > 0) return toNumber(material.costPerUse);
    const uses = Math.max(toNumber(material.uses), 1);
    return toNumber(material.cost) / uses;
}

function calculateCostSheet(service, materialUsages, extraExpenses, materials, config) {
    if (!service) {
        return {
            priceMain: 0,
            materialCostMain: 0,
            extraCostMain: 0,
            totalCostMain: 0,
            profitMain: 0,
            margin: 0,
            recommendedPriceMain: 0,
            materialRows: [],
            extraRows: []
        };
    }

    const materialRows = materialUsages.map((usage) => {
        const material = materials.find((item) => String(item.id) === String(usage.materialId));
        const quantity = toNumber(usage.quantity);
        const unitCost = getMaterialCostPerUse(material);
        const cost = unitCost * quantity;
        const costMain = convertToMainCurrency(cost, material ? material.currency : config.mainCurrency, config);

        return { material, quantity, cost, costMain };
    }).filter((row) => row.material && row.quantity > 0);

    const extraRows = extraExpenses.map((expense) => {
        const amount = toNumber(expense.amount);
        return {
            ...expense,
            amount,
            costMain: convertToMainCurrency(amount, expense.currency || config.mainCurrency, config)
        };
    }).filter((row) => row.amount > 0);

    const priceMain = convertToMainCurrency(service.price, service.currency, config);
    const materialCostMain = materialRows.reduce((sum, row) => sum + row.costMain, 0);
    const extraCostMain = extraRows.reduce((sum, row) => sum + row.costMain, 0);
    const totalCostMain = materialCostMain + extraCostMain;
    const profitMain = priceMain - totalCostMain;
    const margin = priceMain > 0 ? (profitMain / priceMain) * 100 : 0;
    const targetMargin = Math.min(Math.max(toNumber(config.desiredMargin), 1), 95);
    const recommendedPriceMain = totalCostMain > 0 ? totalCostMain / (1 - targetMargin / 100) : priceMain;

    return {
        priceMain,
        materialCostMain,
        extraCostMain,
        totalCostMain,
        profitMain,
        margin,
        recommendedPriceMain,
        materialRows,
        extraRows
    };
}
