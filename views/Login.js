function Login({ onLogin, checkingSession }) {
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (loading) return;

        setError('');
        if (!username.trim() || !password) {
            setError('Escribe tu usuario y contrasena.');
            return;
        }

        setLoading(true);
        try {
            const result = await loginRomaFinanzas(username, password);
            await onLogin(result);
        } catch (loginError) {
            setError(loginError.message || 'No se pudo entrar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col p-6 items-center justify-center bg-white" data-name="login" data-file="views/Login.js">
            <div className="w-full max-w-sm">
                <div className="text-center">
                    <div className="w-24 h-24 bg-[var(--primary-light)] rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-inner transform rotate-3">
                        <div className="icon-calculator text-5xl text-[var(--primary)]"></div>
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Roma Finanzas</h1>
                    <p className="text-gray-500 mb-8 text-sm px-4">Calcula si tu salon realmente esta ganando.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 w-full">
                    <div>
                        <label className="label">Usuario del negocio</label>
                        <input
                            type="text"
                            className="input-field bg-white"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="usuario"
                            autoComplete="username"
                            autoCapitalize="none"
                        />
                    </div>

                    <div>
                        <label className="label">Contrasena</label>
                        <input
                            type="password"
                            className="input-field bg-white"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Tu contrasena"
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                            {error}
                        </div>
                    )}

                    {checkingSession && (
                        <div className="bg-gray-50 border border-gray-100 text-gray-600 rounded-xl p-3 text-sm">
                            Verificando sesion guardada...
                        </div>
                    )}

                    <button type="submit" disabled={loading || checkingSession} className="btn-primary py-4 text-lg disabled:opacity-60">
                        {loading ? 'Entrando...' : 'Entrar con RservasRoma'}
                    </button>
                </form>

                <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3 text-left">
                    <div className="icon-circle-alert text-gray-400 mt-0.5 shrink-0"></div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        <strong>Aviso de acceso:</strong> Solo los negocios con usuario activo de RservasRoma y acceso a Roma Finanzas podran utilizar esta herramienta.
                    </p>
                </div>
            </div>
        </div>
    );
}
