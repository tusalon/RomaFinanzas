function CobrosHistory({ onNavigate }) {
    const { state } = useFinanceApp();
    const mainCurrency = state.config.mainCurrency || 'CUP';
    const [month, setMonth] = React.useState('todo');
    const [origin, setOrigin] = React.useState('todos');
    const [query, setQuery] = React.useState('');
    const [visible, setVisible] = React.useState(50);

    const history = buildCobrosHistory(state.incomeEntries, state.services, state.config, { month, origin, query });
    const { rows, totals } = history;
    const hasAnyIncome = (state.incomeEntries || []).length > 0;
    const shownRows = rows.slice(0, visible);

    const changeFilter = (setter) => (value) => {
        setter(value);
        setVisible(50);
    };

    const monthLabel = (key) => {
        const label = new Date(`${key}-01T12:00:00`).toLocaleDateString('es-CU', { month: 'long', year: 'numeric' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    const dayLabel = (dateKey) => {
        const label = new Date(`${dateKey}T12:00:00`).toLocaleDateString('es-CU', { weekday: 'long', day: 'numeric', month: 'long' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    const downloadCsv = () => {
        const csv = buildCobrosCsv(rows, mainCurrency);
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `roma-finanzas-cobros-${month}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const origins = [
        { id: 'todos', label: 'Todos' },
        { id: 'agenda', label: 'De tu agenda' },
        { id: 'manual', label: 'Anotados a mano' }
    ];

    return (
        <div className="form-screen p-4 space-y-4" data-name="history" data-file="views/History.js">
            <div className="screen-intro screen-intro--income flex gap-3">
                <div className="icon-coins text-green-600 mt-1"></div>
                <p className="text-sm text-green-800">Todos tus cobros: los que llegan solos de las citas completadas y los que anotas tú.</p>
            </div>

            {!hasAnyIncome && (
                <div className="card p-4 text-center text-sm text-gray-500">
                    Todavía no hay cobros. Cuando completes una cita o anotes un cobro, aparecerá aquí.
                </div>
            )}

            {hasAnyIncome && (
                <>
                    <div className="card p-4 space-y-3">
                        <div>
                            <label htmlFor="history-month" className="label">Mes</label>
                            <select id="history-month" className="input-field" value={month} onChange={(event) => changeFilter(setMonth)(event.target.value)}>
                                <option value="todo">Todo el historial</option>
                                {history.months.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {origins.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => changeFilter(setOrigin)(item.id)}
                                    className={`text-xs font-bold px-2 py-2 rounded-xl border ${origin === item.id ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary)]' : 'bg-white border-gray-200 text-gray-600'}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="search"
                            className="input-field"
                            placeholder="Buscar por clienta, servicio o nota"
                            value={query}
                            onChange={(event) => changeFilter(setQuery)(event.target.value)}
                            aria-label="Buscar cobros"
                        />
                    </div>

                    <div className="card p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{totals.count} {totals.count === 1 ? 'cobro' : 'cobros'}</p>
                        <p className="text-2xl font-black text-green-700 mt-1">{formatMoney(totals.totalMain, mainCurrency)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Servicios {formatMoney(totals.serviceMain, mainCurrency)}
                            {totals.tipMain > 0 && <> · Propinas {formatMoney(totals.tipMain, mainCurrency)}</>}
                        </p>
                        <button type="button" onClick={downloadCsv} disabled={rows.length === 0} className="mt-3 px-4 py-2 rounded-xl border border-gray-200 font-bold text-sm text-gray-700 disabled:opacity-50" title="Descargar cada cobro para Excel">
                            Descargar para Excel
                        </button>
                    </div>

                    {rows.length === 0 && (
                        <div className="card p-4 text-center text-sm text-gray-500">No hay cobros con esos filtros.</div>
                    )}

                    <div className="space-y-3">
                        {shownRows.map((row, index) => (
                            <React.Fragment key={row.id}>
                                {(index === 0 || shownRows[index - 1].date !== row.date) && (
                                    <p className="text-xs font-black uppercase tracking-wide text-gray-400 pt-2">{dayLabel(row.date)}</p>
                                )}
                                <div className="rounded-xl bg-white border border-gray-100 p-3 shadow-sm">
                                    <div className="flex justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 truncate">{row.client || 'Sin nombre'}</p>
                                            <p className="text-xs text-gray-500 truncate">{row.serviceName}{row.paymentMethod ? ` · ${row.paymentMethod}` : ''}</p>
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.origin === 'agenda' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {row.origin === 'agenda' ? 'De tu agenda' : 'Anotado a mano'}
                                                </span>
                                                {row.missingCost && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">Sin costo</span>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-green-700">{formatMoney(row.amount, row.currency)}</p>
                                            {row.tipAmount > 0 && <p className="text-xs font-bold text-pink-600 mt-1">+ {formatMoney(row.tipAmount, row.tipCurrency)} de propina</p>}
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}
                    </div>

                    {rows.length > shownRows.length && (
                        <button type="button" onClick={() => setVisible(visible + 50)} className="btn-primary">
                            Ver más ({rows.length - shownRows.length} restantes)
                        </button>
                    )}

                    <div className="card p-4 text-sm text-gray-600">
                        Para corregir o borrar un cobro que anotaste a mano, ve a <strong>Anotar cobro</strong>. Los que vienen de tu agenda se corrigen desde la cita.
                        <button type="button" onClick={() => onNavigate('income')} className="simple-link-button mt-3">
                            <div className="icon-coins text-green-700"></div>
                            <span><strong>Anotar cobro</strong><small>Editar o eliminar cobros anotados</small></span>
                            <div className="icon-chevron-right text-gray-300 ml-auto"></div>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
