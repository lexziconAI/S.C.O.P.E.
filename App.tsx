import React, { useState, useEffect } from 'react';
import { LiveVoiceCoach } from './components/LiveVoiceCoach';
import Login from './components/Login';
import Register from './components/Register';
import { Globe, Mic, Info, LogOut } from 'lucide-react';
import { getApiUrl } from './src/config';

const App: React.FC = () => {
  const [showInfo, setShowInfo] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'login' | 'register' | 'app'>('login');

  useEffect(() => {
    // Validate token on startup
    const validateToken = async () => {
      if (token) {
        try {
          const response = await fetch(getApiUrl('/api/users/me'), {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setView('app');
          } else {
            // Token invalid, clear it
            localStorage.removeItem('token');
            setToken(null);
            setView('login');
          }
        } catch {
          // Network error, assume token might be valid
          setView('app');
        }
      } else {
        setView('login');
      }
    };
    
    validateToken();
  }, [token]);

  const handleLogin = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-36 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <img src="/logo.png" alt="Axiom Logo" className="h-32 w-auto" />
            <h1 className="font-bold text-xl tracking-tight">MetaGuardian</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 text-slate-500 hover:text-indigo-600 transition-colors rounded-full hover:bg-slate-100"
            >
              <Info className="w-5 h-5" />
            </button>
            {token && (
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 transition-colors rounded-full hover:bg-slate-100"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        
        {/* Info Modal / Overlay */}
        {showInfo && (
          <div className="absolute top-4 right-4 max-w-sm bg-white p-6 rounded-xl shadow-xl border border-slate-100 z-20 animate-fade-in-down">
            <h3 className="font-semibold text-lg mb-2">About MetaGuardian</h3>
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              This is an Axiom Intelligence Powered Experience – Interactive Oral Assessments as a Service (IOAaaS)
              brought to you by the Axiom Intelligence API. MetaGuardian assesses your readiness for AI-assisted
              early disease detection tools through natural voice conversations.
            </p>
            <button 
              onClick={() => setShowInfo(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Close
            </button>
          </div>
        )}

        <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8">
          {view === 'app' && (
            <>
              <div className="text-center space-y-2 max-w-2xl">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  MetaGuardian Health Assessment
                </h2>
                <p className="text-slate-500 text-lg">
                  Start a real-time voice conversation to assess your metabolic health readiness with AI-powered guidance.
                </p>
              </div>

              {/* The Core Voice Component */}
              <div className="w-full">
                <LiveVoiceCoach token={token!} />
              </div>
            </>
          )}

          {view === 'login' && (
            <Login 
              onLogin={handleLogin} 
              onSwitchToRegister={() => setView('register')} 
            />
          )}

          {view === 'register' && (
            <Register 
              onRegisterSuccess={() => setView('login')} 
              onSwitchToLogin={() => setView('login')} 
            />
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>Powered by Axiom Intelligence Live API</p>
      </footer>
    </div>
  );
};

export default App;