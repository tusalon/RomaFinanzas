const SUPPORTED_CURRENCIES = ['CUP', 'USD', 'MLC', 'EUR'];

const EXPENSE_TYPES = [
    {
        id: 'fijo',
        label: 'Fijo mensual',
        description: 'Renta, corriente, salario, internet o pagos que se repiten.'
    },
    {
        id: 'cotidiano',
        label: 'Cotidiano',
        description: 'Café, galletas, transporte, comida u otros gastos del día.'
    },
    {
        id: 'herramienta',
        label: 'Herramienta/equipo',
        description: 'Lámparas, alicates, muebles o equipos que duran varios meses.'
    }
];

const EXPENSE_CATEGORIES = {
    fijo: ['Renta', 'Corriente', 'Salario', 'Internet', 'Teléfono', 'Contabilidad', 'RservasRoma', 'Otro fijo'],
    cotidiano: ['Materiales de uso rápido', 'Café y galletas', 'Transporte', 'Comida', 'Publicidad', 'Comisión', 'Otro cotidiano'],
    herramienta: ['Lámparas', 'Alicates', 'Limas', 'Muebles', 'Equipos', 'Herramientas', 'Otro equipo']
};

function getTodayKey() {
    return getLocalDateKey(new Date());
}

function getLocalDateKey(date = new Date(), timeZone = 'America/Havana') {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const rawValue = String(value ?? '')
        .trim()
        .replace(/\s+/g, '');

    if (!rawValue) return 0;

    const lastComma = rawValue.lastIndexOf(',');
    const lastDot = rawValue.lastIndexOf('.');
    const separators = (rawValue.match(/[.,]/g) || []).length;
    let cleanValue = rawValue;

    if (separators === 1) {
        const separatorIndex = Math.max(lastComma, lastDot);
        const before = rawValue.slice(0, separatorIndex);
        const after = rawValue.slice(separatorIndex + 1);
        const isLikelyThousands = before.length > 0 && after.length === 3 && before !== '0';
        cleanValue = isLikelyThousands ? `${before}${after}` : `${before}.${after}`;
    } else if (separators > 1) {
        const decimalIndex = Math.max(lastComma, lastDot);
        cleanValue = `${rawValue.slice(0, decimalIndex).replace(/[.,]/g, '')}.${rawValue.slice(decimalIndex + 1).replace(/[.,]/g, '')}`;
    }

    const numberValue = Number(cleanValue);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

function getRateToMainCurrency(currency, config) {
    const mainCurrency = config.mainCurrency || 'CUP';
    const sourceCurrency = currency || mainCurrency;
    const rates = config.rates || {};

    if (!SUPPORTED_CURRENCIES.includes(sourceCurrency) || !SUPPORTED_CURRENCIES.includes(mainCurrency)) {
        return null;
    }

    if (sourceCurrency === mainCurrency) return 1;

    const sourceRateInCup = sourceCurrency === 'CUP' ? 1 : toNumber(rates[sourceCurrency]);
    const mainRateInCup = mainCurrency === 'CUP' ? 1 : toNumber(rates[mainCurrency]);

    if (sourceRateInCup <= 0 || mainRateInCup <= 0) return null;
    return sourceRateInCup / mainRateInCup;
}

function convertToMainCurrency(amount, currency, config) {
    const value = toNumber(amount);
    const mainCurrency = config.mainCurrency || 'CUP';
    const sourceCurrency = currency || mainCurrency;
    const rateToMain = getRateToMainCurrency(sourceCurrency, config);

    if (rateToMain === null) {
        throw new Error(`Falta una tasa valida para convertir ${sourceCurrency} a ${mainCurrency}.`);
    }

    return value * rateToMain;
}

function createMoneySnapshot(amount, currency, config) {
    const cleanAmount = toNumber(amount);
    const cleanCurrency = currency || config.mainCurrency || 'CUP';
    const rateToMain = getRateToMainCurrency(cleanCurrency, config);

    if (rateToMain === null) {
        throw new Error(`Configura la tasa de ${cleanCurrency} antes de guardar.`);
    }

    return {
        amount: cleanAmount,
        currency: cleanCurrency,
        rateToMain,
        amountMain: cleanAmount * rateToMain
    };
}

function getHistoricalAmountMain(entry, config) {
    const savedAmountMain = Number(entry?.amountMain);
    const savedRate = Number(entry?.rateToMain);
    if (Number.isFinite(savedAmountMain) && Number.isFinite(savedRate) && savedRate > 0) {
        return savedAmountMain;
    }

    return convertToMainCurrency(entry?.amount, entry?.currency, config);
}

function getHistoricalTipMain(entry, config) {
    const tipAmount = toNumber(entry?.tipAmount);
    if (tipAmount <= 0) return 0;

    const savedTipMain = Number(entry?.tipAmountMain);
    const savedTipRate = Number(entry?.tipRateToMain);
    if (Number.isFinite(savedTipMain) && Number.isFinite(savedTipRate) && savedTipRate > 0) {
        return savedTipMain;
    }

    return convertToMainCurrency(tipAmount, entry?.tipCurrency || entry?.currency, config);
}

function getIncomeCollectedMain(entry, config) {
    return getHistoricalAmountMain(entry, config) + getHistoricalTipMain(entry, config);
}

function validateFinanceConfig(config) {
    const errors = [];
    const mainCurrency = config.mainCurrency || 'CUP';
    if (!SUPPORTED_CURRENCIES.includes(mainCurrency)) {
        errors.push('Selecciona una moneda principal valida.');
    }

    SUPPORTED_CURRENCIES
        .filter((currency) => currency !== 'CUP')
        .forEach((currency) => {
            if (toNumber(config.rates?.[currency]) <= 0) {
                errors.push(`La tasa de ${currency} debe ser mayor que cero.`);
            }
        });

    const desiredMargin = toNumber(config.desiredMargin);
    if (desiredMargin <= 0 || desiredMargin >= 100) {
        errors.push('El margen deseado debe estar entre 1% y 99%.');
    }

    return errors;
}

function formatMoney(amount, currency) {
    const value = toNumber(amount);
    return `${value.toLocaleString('en-US', {
        minimumFractionDigits: value % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    })} ${currency}`;
}

function getExpenseTypeMeta(type) {
    return EXPENSE_TYPES.find((item) => item.id === normalizeExpenseType(type)) || EXPENSE_TYPES[1];
}

function normalizeExpenseType(type) {
    if (type === 'diario') return 'cotidiano';
    return EXPENSE_TYPES.some((item) => item.id === type) ? type : 'cotidiano';
}

function getExpenseCategories(type) {
    return EXPENSE_CATEGORIES[normalizeExpenseType(type)] || EXPENSE_CATEGORIES.cotidiano;
}

function getMonthsBetween(startDate, endDate) {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

function getExpenseMonthlyDepreciation(entry, config) {
    const amountMain = getHistoricalAmountMain(entry, config);
    const lifeMonths = Math.max(toNumber(entry.usefulLifeMonths), 1);
    return amountMain / lifeMonths;
}

function getExpenseImpact(entry, config, periodType = 'day', referenceDate = new Date()) {
    if (normalizeExpenseType(entry.type) !== 'herramienta') {
        return getHistoricalAmountMain(entry, config);
    }

    const purchaseDate = new Date(`${entry.date || getTodayKey()}T00:00:00`);
    if (purchaseDate > referenceDate) return 0;

    const lifeMonths = Math.max(toNumber(entry.usefulLifeMonths), 1);
    const elapsedMonths = getMonthsBetween(purchaseDate, referenceDate);
    if (elapsedMonths >= lifeMonths) return 0;

    const monthlyDepreciation = getExpenseMonthlyDepreciation(entry, config);
    if (periodType === 'month') return monthlyDepreciation;
    if (periodType === 'week') return monthlyDepreciation / 4.345;
    return monthlyDepreciation / 30;
}

function getMaterialCostPerUse(material) {
    if (!material) return 0;
    if (toNumber(material.costPerUse) > 0) return toNumber(material.costPerUse);
    const uses = Math.max(toNumber(material.uses), 1);
    return toNumber(material.cost) / uses;
}

function getMaterialCostPerUseMain(material, config) {
    if (!material) return 0;
    const uses = Math.max(toNumber(material.uses), 1);
    const purchaseCostMain = Number(material.purchaseCostMain);
    const purchaseRate = Number(material.purchaseRateToMain);

    if (Number.isFinite(purchaseCostMain) && Number.isFinite(purchaseRate) && purchaseRate > 0) {
        return purchaseCostMain / uses;
    }

    return convertToMainCurrency(getMaterialCostPerUse(material), material.currency, config);
}

function calculateCostSheet(service, materialUsages, extraExpenses, materials, config, options = {}) {
    if (!service) {
        return {
            priceMain: 0,
            materialCostMain: 0,
            extraCostMain: 0,
            laborCostMain: 0,
            overheadCostMain: 0,
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
        const costMain = getMaterialCostPerUseMain(material, config) * quantity;

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
    const durationMinutes = Math.max(toNumber(options.durationMinutes), 0);
    const hourlyValueMain = convertToMainCurrency(toNumber(options.hourlyValue), options.hourlyCurrency || config.mainCurrency, config);
    const laborCostMain = hourlyValueMain > 0 && durationMinutes > 0 ? (hourlyValueMain / 60) * durationMinutes : 0;
    const overheadCostMain = toNumber(options.overheadCostMain);
    const totalCostMain = materialCostMain + extraCostMain + laborCostMain + overheadCostMain;
    const profitMain = priceMain - totalCostMain;
    const margin = priceMain > 0 ? (profitMain / priceMain) * 100 : 0;
    const targetMargin = Math.min(Math.max(toNumber(config.desiredMargin), 1), 95);
    const recommendedPriceMain = totalCostMain > 0 ? totalCostMain / (1 - targetMargin / 100) : priceMain;

    return {
        priceMain,
        materialCostMain,
        extraCostMain,
        laborCostMain,
        overheadCostMain,
        totalCostMain,
        profitMain,
        margin,
        recommendedPriceMain,
        materialRows,
        extraRows
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SUPPORTED_CURRENCIES,
        EXPENSE_TYPES,
        EXPENSE_CATEGORIES,
        getTodayKey,
        getLocalDateKey,
        makeId,
        toNumber,
        getRateToMainCurrency,
        convertToMainCurrency,
        createMoneySnapshot,
        getHistoricalAmountMain,
        getHistoricalTipMain,
        getIncomeCollectedMain,
        validateFinanceConfig,
        formatMoney,
        getExpenseTypeMeta,
        normalizeExpenseType,
        getExpenseCategories,
        getMonthsBetween,
        getExpenseMonthlyDepreciation,
        getExpenseImpact,
        getMaterialCostPerUse,
        getMaterialCostPerUseMain,
        calculateCostSheet
    };
}
