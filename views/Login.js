function Login({ onLogin, checkingSession }) {
    const usesEmailLogin = window.ROMA_CONFIG?.backendMode === 'standalone-auth';
    const usesRservasRomaLogin = window.ROMA_CONFIG?.backendMode === 'federated-rservasroma';
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (loading) return;

        setError('');
        if (!username.trim() || !password) {
            setError(usesEmailLogin ? 'Escribe tu correo y contraseña.' : 'Escribe tu usuario y contraseña.');
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
        <div className="login-screen min-h-screen flex flex-col p-6 items-center justify-center" data-name="login" data-file="views/Login.js">
            <div className="login-orb login-orb--one"></div>
            <div className="login-orb login-orb--two"></div>
            <div className="w-full max-w-sm relative z-10">
                <div className="text-center login-brand">
                    <div className="login-logo">
                        <img src="icons/icon-192x192.png" alt="Roma Finanzas" className="w-full h-full object-cover" />
                    </div>

                    <div className="login-badge"><span className="icon-sparkles"></span> RservasRoma · Acceso privado</div>
                    <h1 className="login-title">Roma Finanzas</h1>
                    <p className="login-subtitle">Tus precios. Tus costos. Tu ganancia.</p>
                </div>

                <form onSubmit={handleSubmit} className="login-card space-y-4 w-full">
                    <div className="mb-5">
                        <h2 className="text-xl font-black text-[var(--text-main)]">Bienvenida</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Entra para ver cuánto te está quedando limpio.</p>
                    </div>
                    <div>
                        <label htmlFor="roma-username" className="label">
                            {usesEmailLogin ? 'Correo' : (usesRservasRomaLogin ? 'Slug de RservasRoma' : 'Usuario del negocio')}
                        </label>
                        <input
                            id="roma-username"
                            type={usesEmailLogin ? 'email' : 'text'}
                            className="input-field bg-white"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder={usesEmailLogin ? 'tu@correo.com' : (usesRservasRomaLogin ? 'slug-de-tu-negocio' : 'usuario')}
                            autoComplete={usesEmailLogin ? 'email' : 'username'}
                            autoCapitalize="none"
                        />
                    </div>

                    <div>
                        <label htmlFor="roma-password" className="label">Contraseña</label>
                        <input
                            id="roma-password"
                            type="password"
                            className="input-field bg-white"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Tu contraseña"
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div role="alert" className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                            {error}
                        </div>
                    )}

                    {checkingSession && (
                        <div role="status" className="bg-gray-50 border border-gray-100 text-gray-600 rounded-xl p-3 text-sm">
                            Verificando sesión guardada...
                        </div>
                    )}

                    <button type="submit" disabled={loading || checkingSession} className="btn-primary py-4 text-base disabled:opacity-60">
                        {loading ? 'Entrando...' : (usesEmailLogin ? 'Entrar a Roma Finanzas' : 'Entrar con RservasRoma')}
                        {!loading && !checkingSession && <span className="icon-arrow-right text-sm"></span>}
                    </button>
                </form>

                <div className="login-notice">
                    <div className="icon-shield-check text-[var(--primary)] mt-0.5 shrink-0"></div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {usesRservasRomaLogin
                            ? 'Usa el mismo slug y la misma contraseña con que entras a RservasRoma.'
                            : 'Protegido para negocios invitados y activos de RservasRoma. No existe registro público.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
