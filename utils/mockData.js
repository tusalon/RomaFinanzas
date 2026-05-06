const INITIAL_DATA = {
    business: {
        name: 'Roma Beauty Studio',
        accessStatus: 'trial',
        financeAccess: true
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
        {
            id: 'srv_balayage',
            name: 'Balayage',
            category: 'Cabello',
            price: 50,
            duration: 180,
            currency: 'USD',
            active: true,
            defaultMaterials: [
                { materialId: 'mat_decolorante', quantity: 1 },
                { materialId: 'mat_tinte', quantity: 0.5 }
            ]
        },
        {
            id: 'srv_unas_acrilicas',
            name: 'Unas acrilicas',
            category: 'Unas',
            price: 2500,
            duration: 90,
            currency: 'CUP',
            active: true,
            defaultMaterials: [
                { materialId: 'mat_acrilico', quantity: 1.5 },
                { materialId: 'mat_top_coat', quantity: 0.2 }
            ]
        }
    ],
    materials: [
        {
            id: 'mat_decolorante',
            name: 'Polvo decolorante',
            cost: 20,
            currency: 'USD',
            uses: 10,
            costPerUse: 2,
            unit: 'uso',
            stock: 7
        },
        {
            id: 'mat_tinte',
            name: 'Tinte rubio',
            cost: 9,
            currency: 'USD',
            uses: 1,
            costPerUse: 9,
            unit: 'tubo',
            stock: 4
        },
        {
            id: 'mat_acrilico',
            name: 'Acrilico transparente',
            cost: 15,
            currency: 'USD',
            uses: 20,
            costPerUse: 0.75,
            unit: 'uso',
            stock: 12
        },
        {
            id: 'mat_top_coat',
            name: 'Top coat',
            cost: 10,
            currency: 'USD',
            uses: 50,
            costPerUse: 0.2,
            unit: 'uso',
            stock: 20
        }
    ],
    incomeEntries: [
        {
            id: 'inc_demo_1',
            date: '',
            serviceId: 'srv_balayage',
            client: 'Maria',
            amount: 50,
            currency: 'USD',
            paymentMethod: 'Efectivo',
            note: 'Servicio demo'
        }
    ],
    expenseEntries: [
        {
            id: 'exp_demo_1',
            date: '',
            category: 'Comida',
            description: 'Cafe para clientes',
            amount: 500,
            currency: 'CUP',
            type: 'diario'
        }
    ],
    costSheets: []
};
