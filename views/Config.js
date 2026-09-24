function Config({ onBack }) {
    const { state, actions } = useFinanceApp();
    const [form, setForm] = React.useState({
        mainCurrency: state.config.mainCurrency,
        desiredMargin: state.config.desiredMargin,
        rates: { ...state.config.rates }
    });
    const [savedMessage, setSavedMessage] = React.useState('');
    const [formError, setFormError] = React.useState('');
    const [tramos, setTramos] = React.useState(() => getTasasPorFecha(state.config).map((t) => ({ ...t, tasa: String(t.tasa) })));
    const [tramosMensaje, setTramosMensaje] = React.useState('');
    const [tramosError, setTramosError] = React.useState('');
    const [aplicando, setAplicando] = React.useState(false);

    const cambiarTramo = (indice, campo, valor) => {
        setTramos((actual) => actual.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)));
    };
    const quitarTramo = (indice) => setTramos((actual) => actual.filter((_, i) => i !== indice));
    const anadirTramo = () => {
        const hoy = getTodayKey();
        setTramos((actual) => [...actual, { moneda: 'USD', desde: hoy.slice(0, 8) + '01', hasta: hoy, tasa: '' }]);
    };

    const guardarTramos = async () => {
        setTramosError('');
        setTramosMensaje('');
        const historial = tramos.map((t) => ({ moneda: t.moneda, desde: t.desde, hasta: t.hasta, tasa: toNumber(t.tasa) }));
        const errores = validarTasasPorFecha(historial);
        if (errores.length) {
            setTramosError(errores[0]);
            return;
        }
        // Una tasa muy lejos de la de hoy casi siempre es un dedo que se fue
        // ("18" en vez de "718"). Con ella, cada dolar de esos dias valdria 18
        // CUP y la ganancia del mes se hundiria. Se pregunta, no se prohibe.
        const rara = historial.find((t) => {
            const hoy = toNumber(state.config.rates?.[t.moneda]);
            return hoy > 0 && (t.tasa < hoy / 2 || t.tasa > hoy * 2);
        });
        if (rara && !window.confirm(`La tasa de ${rara.moneda} del ${rara.desde} al ${rara.hasta} es ${rara.tasa}, y la de hoy es ${toNumber(state.config.rates?.[rara.moneda])}. ¿Está bien escrita?`)) {
            return;
        }

        // Se avisa ANTES de tocar nada de cuantos movimientos cambian.
        const configNueva = { ...state.config, rates: { ...state.config.rates, historial } };
        const plan = planificarTasasPorFecha(state, configNueva, getTasasPorFecha(state.config));
        const cuantos = plan.cobros.length + plan.gastos.length;
        if (cuantos > 0) {
            const ok = window.confirm(`Se van a recalcular ${plan.cobros.length} cobro(s) y ${plan.gastos.length} gasto(s) de esas fechas con la nueva tasa. ¿Seguimos?`);
            if (!ok) return;
        }
        setAplicando(true);
        try {
            const r = await actions.aplicarTasasPorFecha(historial);
            setTramosMensaje(cuantos === 0
                ? 'Tasas guardadas. No había cobros ni gastos en moneda extranjera en esas fechas.'
                : `Tasas guardadas. Recalculados ${r.actualizados} de ${cuantos} movimientos.${r.fallidos ? ` ${r.fallidos} se guardarán cuando tengas internet.` : ''}`);
        } catch (error) {
            setTramosError(error.message || 'No se pudieron guardar las tasas.');
        } finally {
            setAplicando(false);
        }
    };

    const updateRate = (currency, value) => {
        setForm((current) => ({
            ...current,
            rates: {
                ...current.rates,
                [currency]: value
            }
        }));
    };

    const saveConfig = async () => {
        setFormError('');
        setSavedMessage('');
        try {
            await actions.updateConfig({
                mainCurrency: form.mainCurrency,
                desiredMargin: toNumber(form.desiredMargin),
                // historial (tasas por fechas) no es una tasa: se guarda aparte, en
                // su propio boton. Si entrara aqui, toNumber lo convertiria en 0.
                rates: Object.fromEntries(Object.entries(form.rates || {})
                    .filter(([currency]) => currency !== 'historial')
                    .map(([currency, value]) => [currency, toNumber(value)])),
                ratesUpdatedAt: new Date().toISOString()
            });
            setSavedMessage('Configuración guardada para este negocio.');
        } catch (error) {
            setFormError(error.message || 'Revisa las tasas y vuelve a intentar.');
        }
    };

    return (
        <div className="config-screen p-4 pb-10" data-name="config" data-file="views/Config.js">
            <div className="card p-5 mb-6">
                <p className="text-xs font-black uppercase tracking-wide text-gray-400">Estás trabajando en</p>
                <h2 className="text-xl font-black text-gray-900 mt-1">{state.business?.name || 'Mi salón'}</h2>
                <div className="flex items-center justify-between gap-3 mt-3 text-sm">
                    <span className="text-gray-500">Roma Finanzas</span>
                    <span className={`px-3 py-1 rounded-full font-bold ${state.business?.financeAccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {state.business?.financeAccess ? 'Listo para usar' : 'Sin acceso'}
                    </span>
                </div>
            </div>

            <div className="card p-5 mb-6">
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                        <div className="icon-coins text-gray-600"></div>
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">¿En qué moneda quieres ver los totales?</h3>
                        <p className="text-xs text-gray-500">Normalmente será CUP.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {SUPPORTED_CURRENCIES.map((currency) => (
                        <button
                            key={currency}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, mainCurrency: currency }))}
                            className={`rounded-2xl border p-4 text-left transition-colors ${form.mainCurrency === currency ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary-dark)]' : 'border-gray-200 bg-white text-gray-700'}`}
                        >
                            <span className="block text-lg font-black">{currency}</span>
                            <span className="block text-xs mt-1">Mostrar totales en {currency}</span>
                        </button>
                    ))}
                </div>
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">¿Cuánto vale hoy cada moneda?</h3>
            <p className="text-xs text-gray-500 mb-3 px-1">Escribe cuántos CUP recibes por 1 USD, 1 MLC o 1 EUR.</p>
            {state.config.ratesUpdatedAt && (
                <p className="text-xs text-gray-400 mb-3 px-1">Última actualización: {new Date(state.config.ratesUpdatedAt).toLocaleString('es-CU')}</p>
            )}
            <div className="card p-0 overflow-hidden mb-8">
                {['USD', 'MLC', 'EUR'].map((currency, index) => (
                    <div key={currency} className={`mobile-rate-row p-4 flex items-center justify-between ${index < 2 ? 'border-b border-gray-100' : ''} ${index === 1 ? 'bg-gray-50/50' : ''}`}>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 w-12">1 {currency}</span>
                            <div className="icon-arrow-right text-gray-400 text-sm"></div>
                        </div>
                        <div className="mobile-rate-input flex items-center gap-2 w-32">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={form.rates[currency]}
                                onChange={(event) => updateRate(currency, event.target.value)}
                                className="input-field !py-2 !px-3 text-right font-bold bg-white"
                            />
                            <span className="text-sm text-gray-500 font-medium">CUP</span>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-1">¿La tasa cambió durante el mes?</h3>
            <p className="text-xs text-gray-500 mb-3 px-1">
                Pon la tasa que hubo entre dos fechas. Los cobros y gastos de esos días se calculan con ella, también los que ya apuntaste. Fuera de esas fechas se usa la tasa de hoy.
            </p>
            <div className="card p-4 mb-8 space-y-3">
                {tramos.length === 0 && (
                    <p className="text-sm text-gray-500">Todavía no has puesto tasas por fechas.</p>
                )}
                {tramos.map((tramo, indice) => (
                    <div key={indice} className="rounded-2xl border border-gray-100 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <select
                                className="input-field !py-2 !px-3 w-24"
                                value={tramo.moneda}
                                onChange={(event) => cambiarTramo(indice, 'moneda', event.target.value)}
                                aria-label="Moneda"
                            >
                                {['USD', 'MLC', 'EUR'].map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <span className="text-sm text-gray-500">a</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                className="input-field !py-2 !px-3 text-right font-bold flex-1"
                                placeholder="690"
                                value={tramo.tasa}
                                onChange={(event) => cambiarTramo(indice, 'tasa', event.target.value)}
                                aria-label="Tasa en CUP"
                            />
                            <span className="text-sm text-gray-500">CUP</span>
                            <button type="button" onClick={() => quitarTramo(indice)} className="text-gray-400 px-2 text-lg" aria-label="Quitar estas fechas">×</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-gray-500">
                                Desde
                                <input type="date" className="input-field !py-2 !px-3 mt-1" value={tramo.desde} onChange={(event) => cambiarTramo(indice, 'desde', event.target.value)} />
                            </label>
                            <label className="text-xs text-gray-500">
                                Hasta
                                <input type="date" className="input-field !py-2 !px-3 mt-1" value={tramo.hasta} onChange={(event) => cambiarTramo(indice, 'hasta', event.target.value)} />
                            </label>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={anadirTramo} className="w-full rounded-xl border border-dashed border-gray-300 py-2 text-sm font-bold text-gray-700">
                    + Añadir fechas
                </button>
                <p className="text-xs text-gray-400">Si dos tramos comparten un día, vale el que empieza más tarde.</p>
                {tramosMensaje && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm">{tramosMensaje}</div>}
                {tramosError && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">{tramosError}</div>}
                <button type="button" onClick={guardarTramos} disabled={aplicando} className="btn-primary disabled:opacity-60">
                    {aplicando ? 'Recalculando…' : 'Guardar tasas por fechas'}
                </button>
            </div>

            <div className="card p-5 border-dashed border-2 border-gray-200 bg-transparent">
                <h3 className="font-bold text-gray-900 mb-1">¿Cuánto quieres que te quede?</h3>
                <p className="text-xs text-gray-500 mb-4">La app te avisará cuando un servicio deje menos de esta meta.</p>
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min="10"
                        max="99"
                        value={form.desiredMargin}
                        onChange={(event) => setForm((current) => ({ ...current, desiredMargin: toNumber(event.target.value) }))}
                        className="flex-1 accent-[var(--primary)]"
                    />
                    <span className="font-bold text-lg text-[var(--primary)]">{form.desiredMargin}%</span>
                </div>
                <div className="mt-4 rounded-xl bg-white border border-gray-100 p-3 text-sm text-gray-600">
                    Ejemplo: si cobras <strong>1,000 CUP</strong>, quieres que te queden al menos <strong>{formatMoney(toNumber(form.desiredMargin) * 10, 'CUP')}</strong> después de descontar costos.
                </div>
            </div>

            {savedMessage && <div className="bg-green-50 border border-green-100 text-green-700 rounded-xl p-3 text-sm mt-6">{savedMessage}</div>}
            {formError && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm mt-6">{formError}</div>}
            {state.syncError && <div className="bg-orange-50 border border-orange-100 text-orange-700 rounded-xl p-3 text-sm mt-6">{state.syncError}</div>}

            <button type="button" onClick={saveConfig} className="btn-primary mt-6">Guardar cambios</button>
        </div>
    );
}
