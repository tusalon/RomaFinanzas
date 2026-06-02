class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] p-6">
          <div className="text-center card w-full max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="icon-circle-alert text-2xl text-red-500"></div>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-main)] mb-2">Algo salió mal</h1>
            <p className="text-[var(--text-muted)] mb-6 text-sm">Ha ocurrido un error inesperado en la aplicación.</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { actions } = useFinanceApp();
  const [currentView, setCurrentView] = React.useState('login');
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [authUser, setAuthUser] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const result = await getRomaAuthSession();
        if (!mounted) return;

        if (result.session && result.business) {
          actions.setBusiness(result.business);
          setAuthUser(result.user);
          setIsAuthenticated(true);
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.warn('No se pudo verificar la sesion:', error);
      } finally {
        if (mounted) setCheckingSession(false);
      }
    };

    checkSession();
    return () => {
      mounted = false;
    };
  }, []);

  // Simple router logic
  const navigate = (view) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const handleLogin = (authResult) => {
    if (authResult?.business) {
      actions.setBusiness(authResult.business);
    }
    setAuthUser(authResult?.user || null);
    setIsAuthenticated(true);
    navigate('dashboard');
  };

  const handleLogout = async () => {
    await logoutRomaFinanzas();
    setAuthUser(null);
    setIsAuthenticated(false);
    navigate('login');
  };

  const renderView = () => {
    switch (currentView) {
      case 'login': return <Login onLogin={handleLogin} checkingSession={checkingSession} />;
      case 'dashboard': return <Dashboard />;
      case 'income': return <Income />;
      case 'expenses': return <Expenses />;
      case 'menu': return <Menu onNavigate={navigate} />;
      case 'services': return <Services onBack={() => navigate('menu')} />;
      case 'materials': return <Materials onBack={() => navigate('menu')} />;
      case 'costSheet': return <CostSheet onBack={() => navigate('menu')} />;
      case 'config': return <Config onBack={() => navigate('menu')} />;
      default: return <Dashboard />;
    }
  };

  try {
    return (
      <div className="mobile-shell w-full max-w-md mx-auto min-h-screen bg-[var(--bg-color)] relative shadow-2xl overflow-x-hidden" data-name="app" data-file="app.js">
        {isAuthenticated && currentView !== 'login' && <TopBar view={currentView} onBack={() => navigate('menu')} onLogout={handleLogout} authUser={authUser} />}
        
        <main className={`w-full ${isAuthenticated && currentView !== 'login' ? 'pt-16 pb-24' : ''}`}>
            {renderView()}
        </main>

        {isAuthenticated && currentView !== 'login' && ['dashboard', 'income', 'expenses', 'menu'].includes(currentView) && (
          <BottomNav currentView={currentView} onNavigate={navigate} />
        )}
      </div>
    );
  } catch (error) {
    console.error('App component error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <FinanceProvider>
      <App />
    </FinanceProvider>
  </ErrorBoundary>
);
