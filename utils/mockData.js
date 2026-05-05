const INITIAL_DATA = {
    dashboard: {
        income: 12500,
        expenses: 3200,
        estimatedProfit: 9300,
        margin: 74.4
    },
    config: {
        mainCurrency: 'CUP',
        rates: {
            USD: 350,
            MLC: 340,
            EUR: 360
        },
        desiredMargin: 60
    },
    services: [
        { id: 1, name: 'Balayage', category: 'Cabello', price: 50, duration: 180, currency: 'USD' },
        { id: 2, name: 'Uñas Acrílicas', category: 'Manicura', price: 2500, duration: 90, currency: 'CUP' }
    ],
    materials: [
        { id: 1, name: 'Polvo Decolorante', cost: 20, currency: 'USD', uses: 10, costPerUse: 2 },
        { id: 2, name: 'Acrílico Transparente', cost: 15, currency: 'USD', uses: 20, costPerUse: 0.75 }
    ]
};