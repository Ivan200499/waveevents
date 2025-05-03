import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { FaQrcode, FaKeyboard } from 'react-icons/fa';
import './TicketValidator.css';

function TicketValidator() {
  const { currentUser } = useAuth();
  const [ticketCode, setTicketCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const navigate = useNavigate();
  const scannerRef = useRef(null); // Ref per l'istanza dello scanner
  const inputRef = useRef(null); // Ref per l'input manuale
  const messageTimeoutRef = useRef(null); // Ref per il timeout del messaggio
  const [isScanPaused, setIsScanPaused] = useState(false); // Stato per pausa scansione
  const scannerContainerRef = useRef(null);
  const [scannerInitialized, setScannerInitialized] = useState(false);

  useEffect(() => {
    async function checkUserRole() {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
          // Permetti validazione a manager E admin (o ruolo specifico 'validator')
          const allowedRoles = ['manager', 'admin', 'validator']; 
          if (!allowedRoles.includes(userDoc.data().role)) {
            setMessage('Non hai i permessi per validare i biglietti.');
            setMessageType('error');
            navigate('/'); // Reindirizza se non autorizzato
          }
        } else {
          setMessage('Utente non trovato.');
          setMessageType('error');
          navigate('/');
        }
      } catch (error) {
        console.error('Errore nel recupero del ruolo:', error);
        setMessage('Errore nel verificare i permessi.');
        setMessageType('error');
      }
    }
    checkUserRole();
  }, [currentUser, navigate]);

  // Cleanup migliorato
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
        scannerRef.current.clear().catch(error => {
          console.error("Errore nella pulizia dello scanner:", error);
        });
        scannerRef.current = null;
        } catch (error) {
          console.error("Errore durante il cleanup dello scanner:", error);
        }
      }
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      setScannerInitialized(false);
    };
  }, []);
  
  // Gestione scanner migliorata
  useEffect(() => {
    if (scannerActive && !scannerInitialized) {
      const initializeScanner = async () => {
        try {
          if (scannerRef.current) {
            await scannerRef.current.clear();
            scannerRef.current = null;
          }

                const html5QrcodeScanner = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        videoConstraints: {
                facingMode: "environment",
                width: { min: 640, ideal: 1280, max: 1920 },
                height: { min: 480, ideal: 720, max: 1080 }
                        },
              supportedScanTypes: [0]
                    },
            false
                );
  
                html5QrcodeScanner.render(
                    (decodedText) => {
              if (loading || isScanPaused) return;
                        
                        setIsScanPaused(true);
                        handleValidateTicket(decodedText);

                        setTimeout(() => {
                            setIsScanPaused(false);
                        }, 2000);
                    },
                    (errorMessage) => {
              // Gestione errori migliorata
              if (errorMessage.includes("No MultiFormat Readers were able to detect the code")) {
                return;
              }
              if (errorMessage.includes("OverconstrainedError")) {
                console.warn("Errore vincoli fotocamera, riprovo con configurazione base");
                // Riprova con configurazione base
                html5QrcodeScanner.clear();
                const basicScanner = new Html5QrcodeScanner(
                  "reader",
                  { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    videoConstraints: {
                      facingMode: "environment"
                    },
                    supportedScanTypes: [0]
                  },
                  false
                );
                basicScanner.render(
                  (decodedText) => {
                    if (loading || isScanPaused) return;
                    setIsScanPaused(true);
                    handleValidateTicket(decodedText);
                    setTimeout(() => {
                      setIsScanPaused(false);
                    }, 2000);
                  },
                  (error) => {
                    console.warn(`QR Scanner warning: ${error}`);
                  }
                );
                scannerRef.current = basicScanner;
                return;
              }
              console.warn(`QR Scanner warning: ${errorMessage}`);
            }
          );

                scannerRef.current = html5QrcodeScanner;
          setScannerInitialized(true);
              } catch (err) {
                console.error("Errore inizializzazione scanner QR:", err);
          setMessage("Errore nell'avvio dello scanner QR. Ricarica la pagina e riprova.");
                setMessageType('error');
          setScannerActive(false);
          setScannerInitialized(false);
        }
      };

      initializeScanner();
    } else if (!scannerActive && scannerInitialized) {
      const cleanupScanner = async () => {
        try {
          if (scannerRef.current) {
            await scannerRef.current.clear();
              scannerRef.current = null;
          }
          setScannerInitialized(false);
        } catch (error) {
          console.error("Errore durante la pulizia dello scanner:", error);
        }
      };
      cleanupScanner();
    }
  }, [scannerActive, loading, isScanPaused]);

  // Funzione per mostrare messaggi temporanei
  const showTemporaryMessage = (msg, type = 'info', duration = 4000) => {
    setMessage(msg);
    setMessageType(type);
    // Cancella timeout precedente se esiste
    if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
    }
    // Imposta nuovo timeout
    messageTimeoutRef.current = setTimeout(() => {
        setMessage('');
        setMessageType('info'); // Resetta tipo messaggio
    }, duration);
  };

  async function handleValidateTicket(code) {
    if (!code) {
        showTemporaryMessage('Codice biglietto non fornito.', 'error');
        return;
    }
    setLoading(true);
    let currentTicketCode = '';

    try {
      // Prova a parsare come JSON (formato QR consigliato)
      try {
        const ticketData = JSON.parse(code);
        currentTicketCode = ticketData.ticketCode;
        console.log('QR Code JSON valido, codice estratto:', currentTicketCode);
      } catch (e) {
        // Altrimenti, usa il codice come stringa
        currentTicketCode = code;
        console.log('Codice trattato come stringa:', currentTicketCode);
      }

      if (!currentTicketCode) {
        throw new Error("Codice biglietto non valido nel QR code.");
      }
      
      currentTicketCode = currentTicketCode.trim();

      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('ticketCode', '==', currentTicketCode)
      );
      const ticketsSnapshot = await getDocs(ticketsQuery);

      if (ticketsSnapshot.empty) {
        throw new Error(`❌ Biglietto ELIMINATO\n(${currentTicketCode})`);
      }

      const ticketDoc = ticketsSnapshot.docs[0];
      const ticketData = ticketDoc.data();

      // Controllo stato del biglietto
      if (ticketData.status === 'disabled') {
        throw new Error(`❌ Biglietto DISABILITATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      if (ticketData.validatedAt || ticketData.status === 'used') {
         throw new Error(`❌ Biglietto GIA' VALIDATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      if (ticketData.status === 'cancelled') {
        throw new Error(`❌ Biglietto CANCELLATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      await updateDoc(doc(db, 'tickets', ticketDoc.id), {
        validatedAt: new Date().toISOString(),
        status: 'validated',
        validatedBy: currentUser.uid,
        validatorName: currentUser.displayName || currentUser.email
      });

      showTemporaryMessage(
        `✅ Biglietto VALIDATO!\nEvento: ${ticketData.eventName}\nCliente: ${ticketData.customerEmail || 'N/D'}\nTipo: ${ticketData.ticketType || 'Standard'}\nCodice: ${currentTicketCode}`,
        'success'
      );

    } catch (error) {
      console.error('Errore validazione:', error);
      showTemporaryMessage(error.message || 'Errore sconosciuto durante la validazione.', 'error');
    } finally {
      setLoading(false);
      setTicketCode(''); // Svuota sempre l'input manuale dopo il tentativo
    }
  }

  const handleManualSubmit = async (e) => {
      e.preventDefault(); // Previene ricaricamento pagina se usato in form
      await handleValidateTicket(ticketCode);
      // Riporta focus sull'input dopo il tentativo
      inputRef.current?.focus(); 
  };

  return (
    <div className="validator-container">
      <h2>Valida Biglietto</h2>
      <div className="input-methods">
        <button 
          className={`method-button ${!scannerActive ? 'active' : ''}`}
          onClick={() => setScannerActive(false)}
          title="Inserisci manualmente il codice del biglietto"
        >
          <FaKeyboard /> Inserisci Codice
        </button>
        <button 
          className={`method-button ${scannerActive ? 'active' : ''}`}
          onClick={() => setScannerActive(true)}
          title="Attiva la fotocamera per scansionare il QR code"
        >
          <FaQrcode /> Scansiona QR
        </button>
      </div>

      {/* Messaggio di stato */}
      {message && (
        <div 
          key={message} // Cambia key per forzare update pulito del messaggio
          className={`message ${messageType}`}>
          {message}
        </div>
      )}

      {scannerActive ? (
        <div className="scanner-container" ref={scannerContainerRef}>
          <div id="reader" style={{ width: '100%', height: '100%' }}></div>
           {loading && <div className="scanner-loading-overlay">Validazione...</div>}
        </div>
      ) : (
        // Form per input manuale
        <form onSubmit={handleManualSubmit} className="manual-input">
          <input
            ref={inputRef} // Associa ref all'input
            type="text"
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value.toUpperCase())} // Mantieni uppercase
            placeholder="Inserisci codice biglietto"
            className="ticket-input"
            aria-label="Codice Biglietto"
            disabled={loading}
          />
          <button
            type="submit" // Cambia in type submit per il form
            disabled={loading || !ticketCode}
            className={`validate-button ${loading ? 'loading' : ''}`}
          >
            {loading ? 'Validazione...' : 'Valida Biglietto'}
          </button>
        </form>
      )}

    </div>
  );
}

export default TicketValidator; 