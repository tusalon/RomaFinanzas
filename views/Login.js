function Login({ onLogin }) {
    return (
        <div className="min-h-screen flex flex-col p-6 items-center justify-center bg-white" data-name="login" data-file="views/Login.js">
            <div className="w-full max-w-sm text-center">
                
                <div className="w-24 h-24 bg-[var(--primary-light)] rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-inner transform rotate-3">
                    <div className="icon-calculator text-5xl text-[var(--primary)]"></div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">Roma Finanzas</h1>
                <p className="text-gray-500 mb-10 text-sm px-4">Herramienta exclusiva de cálculo de rentabilidad para salones de belleza.</p>

                <div className="space-y-4 w-full">
                    <button onClick={onLogin} className="btn-primary py-4 text-lg">
                        Entrar con RservasRoma
                    </button>
                </div>

                <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3 text-left">
                    <div className="icon-circle-alert text-gray-400 mt-0.5 shrink-0"></div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        <strong>Aviso de acceso:</strong> Solo los negocios con una suscripción activa en el ecosistema RservasRoma podrán utilizar esta herramienta.
                    </p>
                </div>
            </div>
        </div>
    );
}