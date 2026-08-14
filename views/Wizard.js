function Wizard({ onNavigate }) {
    const { state } = useFinanceApp();
    const [step, setStep] = React.useState('bienvenida');

    const issues = React.useMemo(() => auditFinanceState(state), [state]);

    const goToFix = (issue) => {
        if (issue.view) onNavigate(issue.view);
    };

    return (
        <div className="p-4" data-name="wizard" data-file="views/Wizard.js">
            <div className="flex items-center gap-3 mb-5">
                <button type="button" onClick={() => onNavigate('menu')} className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0">
                    <div className="icon-arrow-left text-gray-600"></div>
                </button>
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Asistente de finanzas</p>
                    <h1 className="text-xl font-black text-gray-900">
                        {step === 'bienvenida' && 'Vamos a revisar tu negocio'}
                        {step === 'auditoria' && 'Lo que encontré en tus datos'}
                        {step === 'habitos' && 'Para que esto no vuelva a pasar'}
                    </h1>
                </div>
            </div>

            {step === 'bienvenida' && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mb-3">
                            <div className="icon-sparkles text-xl"></div>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            Voy a revisar los servicios, materiales, gastos y cobros que ya tienes cargados
                            en tu cuenta real, y te digo puntualmente qué falta o qué está mal para que tu
                            ganancia se calcule bien de aquí en adelante.
                        </p>
                    </div>
                    <button type="button" onClick={() => setStep('auditoria')} className="btn-primary w-full py-4">
                        Revisar mis datos
                        <div className="icon-arrow-right text-sm"></div>
                    </button>
                </div>
            )}

            {step === 'auditoria' && (
                <div className="space-y-4">
                    {issues.length === 0 && (
                        <div className="insight-card bg-green-50 text-green-800 border-green-100">
                            <div className="flex items-start gap-3">
                                <div className="icon-circle-check text-xl shrink-0"></div>
                                <div>
                                    <h3 className="font-black text-lg leading-tight">Todo está en orden.</h3>
                                    <p className="text-sm mt-2 opacity-90">No encontré nada que te esté distorsionando la ganancia. Sigue anotando cobros y gastos cada día.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {issues.map((issue) => (
                        <div key={issue.id} className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="icon-triangle-alert text-orange-600 text-lg shrink-0 mt-0.5"></div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-sm">{issue.title}</h3>
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{issue.description}</p>
                                    {issue.view && (
                                        <button type="button" onClick={() => goToFix(issue)} className="mt-3 text-sm font-bold text-[var(--primary)] flex items-center gap-1">
                                            {issue.actionLabel}
                                            <div className="icon-arrow-right text-xs"></div>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    <button type="button" onClick={() => setStep('habitos')} className="btn-primary w-full py-4">
                        Continuar
                        <div className="icon-arrow-right text-sm"></div>
                    </button>
                </div>
            )}

            {step === 'habitos' && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                        {[
                            'Anota cada cobro el mismo día, aunque sea rápido.',
                            'Calcula la ficha de costo de un servicio nuevo antes de cobrarlo la primera vez.',
                            'Registra el gasto de RservasRoma y tus demás gastos fijos una vez al mes.',
                            'Vuelve a este asistente de vez en cuando para revisar que todo siga en orden.'
                        ].map((habit, index) => (
                            <div key={index} className="flex gap-3 text-sm text-gray-700">
                                <div className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0 font-bold text-xs">
                                    {index + 1}
                                </div>
                                <p>{habit}</p>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={() => onNavigate('menu')} className="btn-primary w-full py-4">
                        Terminar
                    </button>
                </div>
            )}
        </div>
    );
}
