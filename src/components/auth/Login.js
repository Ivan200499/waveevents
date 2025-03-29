import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { FaUser, FaLock, FaEnvelope, FaMobileAlt } from 'react-icons/fa';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Rileva se l'utente sta usando iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Verifica se l'app è in modalità standalone
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone || 
                            document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);

    // Gestione dell'evento beforeinstallprompt per il pulsante di installazione PWA
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      const { user } = await login(email, password);
      
      // Verifica il ruolo dell'utente
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      // Reindirizza in base al ruolo
      switch(userData.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'manager':
          navigate('/manager');
          break;
        case 'teamLeader':
          navigate('/team-leader');
          break;
        case 'promoter':
          navigate('/promoter');
          break;
        case 'validator':
          navigate('/validate-ticket');
          break;
        default:
          navigate('/');
      }
    } catch (error) {
      setError('Credenziali non valide');
    }
  }

  // Mostra il pulsante di installazione solo se non siamo in modalità standalone
  const showInstallButton = (deferredPrompt || isIOS) && !isStandalone;

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img src="/logo.PNG" alt="Logo" className="login-logo" />
          <h2>Accedi</h2>
          <p>Benvenuto nel sistema di gestione biglietti</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <div className="input-with-icon">
              <FaUser className="input-icon" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="input-with-icon">
              <FaLock className="input-icon" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button type="submit" className="login-button">
            Accedi
          </button>
        </form>

        {showInstallButton && (
          <div className="pwa-install-section">
            <button onClick={handleInstallPWA} className="pwa-install-button">
              <FaMobileAlt className="pwa-icon" />
              {isIOS ? 'Aggiungi alla schermata Home' : 'Installa l\'App'}
            </button>
            {isIOS && (
              <div className="ios-instructions">
                <p>1. Tocca il pulsante "Condividi"</p>
                <p>2. Scorri verso il basso e seleziona "Aggiungi alla schermata Home"</p>
                <p>3. Tocca "Aggiungi"</p>
              </div>
            )}
          </div>
        )}

        <div className="login-footer">
          <p>© 2024 Wave Events</p>
        </div>
      </div>
    </div>
  );
}

export default Login; 