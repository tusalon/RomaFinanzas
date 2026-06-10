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
    return new Date().toISOString().slice(0, 10);
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
    const amountMain = convertToMainCurrency(entry.amount, entry.currency, config);
    const lifeMonths = Math.max(toNumber(entry.usefulLifeMonths), 1);
    return amountMain / lifeMonths;
}

function getExpenseImpact(entry, config, periodType = 'day', referenceDate = new Date()) {
    if (normalizeExpenseType(entry.type) !== 'herramienta') {
        return convertToMainCurrency(entry.amount, entry.currency, config);
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
