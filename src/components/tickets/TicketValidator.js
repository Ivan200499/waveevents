import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { FaQrcode, FaKeyboard } from 'react-icons/fa';
import './TicketValidator.css';

function TicketValidator({ initializeWithScanner = false }) {
  const { currentUser } = useAuth();
  const [ticketCode, setTicketCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'success', 'error', 'info'
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [scannerActive, setScannerActive] = useState(initializeWithScanner);
  const navigate = useNavigate();
  const scannerRef = useRef(null); // Ref per l'istanza dello scanner
  const inputRef = useRef(null); // Ref per l'input manuale
  const messageTimeoutRef = useRef(null); // Ref per il timeout del messaggio
  const [isScanPaused, setIsScanPaused] = useState(false); // Stato per pausa scansione
  const scannerContainerRef = useRef(null);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const [lastScannedTicketDetails, setLastScannedTicketDetails] = useState(null);

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
    setLastScannedTicketDetails(null); // Resetta i dettagli precedenti
    if (!code) {
        showTemporaryMessage('Codice biglietto non fornito.', 'error');
        setLastScannedTicketDetails({ ticketCode: 'N/A', error: 'Codice non fornito' });
        return;
    }
    setLoading(true);
    let currentTicketCode = '';
    let ticketDataForDisplay = null;

    try {
      // Prova a parsare come JSON (formato QR consigliato)
      try {
        const parsedCode = JSON.parse(code);
        currentTicketCode = parsedCode.ticketCode;
        console.log('QR Code JSON valido, codice estratto:', currentTicketCode);
      } catch (e) {
        // Altrimenti, usa il codice come stringa
        currentTicketCode = code;
        console.log('Codice trattato come stringa:', currentTicketCode);
      }

      if (!currentTicketCode) {
        showTemporaryMessage("Codice biglietto non valido nel QR code.", 'error');
        setLastScannedTicketDetails({ ticketCode: code, error: 'Codice non valido nel QR' });
        setLoading(false);
        return;
      }
      
      currentTicketCode = currentTicketCode.trim();
      ticketDataForDisplay = { ticketCode: currentTicketCode };


      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('ticketCode', '==', currentTicketCode)
      );
      const ticketsSnapshot = await getDocs(ticketsQuery);

      if (ticketsSnapshot.empty) {
        ticketDataForDisplay = { ...ticketDataForDisplay, error: `Biglietto ELIMINATO o NON ESISTENTE` };
        throw new Error(`❌ Biglietto ELIMINATO o NON ESISTENTE\n(${currentTicketCode})`);
      }

      const ticketDoc = ticketsSnapshot.docs[0];
      const ticketData = ticketDoc.data();
      ticketDataForDisplay = { // Popola con più dati possibili
        ticketCode: currentTicketCode,
        eventName: ticketData.eventName,
        customerName: ticketData.customerName || ticketData.customerEmail || 'N/D',
        ticketType: ticketData.ticketType || 'Standard',
        eventDate: ticketData.eventDate, // Verrà formattato poi
        status: ticketData.status,
      };

      // Controllo stato del biglietto
      if (ticketData.status === 'disabled') {
        ticketDataForDisplay = { ...ticketDataForDisplay, error: 'Biglietto DISABILITATO' };
        throw new Error(`❌ Biglietto DISABILITATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      if (ticketData.validatedAt || ticketData.status === 'used') {
        ticketDataForDisplay = { ...ticketDataForDisplay, error: 'Biglietto GIA\' VALIDATO', validatedAt: ticketData.validatedAt, validatorName: ticketData.validatorName };
         throw new Error(`❌ Biglietto GIA' VALIDATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      if (ticketData.status === 'cancelled') {
        ticketDataForDisplay = { ...ticketDataForDisplay, error: 'Biglietto CANCELLATO' };
        throw new Error(`❌ Biglietto CANCELLATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      await updateDoc(doc(db, 'tickets', ticketDoc.id), {
        validatedAt: new Date().toISOString(),
        status: 'validated', // Cambiato da 'used' a 'validated' per coerenza
        validatedBy: currentUser.uid,
        validatorName: currentUser.displayName || currentUser.email
      });
      
      ticketDataForDisplay = { ...ticketDataForDisplay, status: 'validated'}; // Aggiorna lo stato per display

      showTemporaryMessage(
        `✅ Biglietto VALIDATO!\nEvento: ${ticketData.eventName}\nCliente: ${ticketData.customerName || ticketData.customerEmail || 'N/D'}\nTipo: ${ticketData.ticketType || 'Standard'}\nCodice: ${currentTicketCode}`,
        'success'
      );

    } catch (error) {
      console.error('Errore validazione:', error);
      // ticketDataForDisplay potrebbe essere già parzialmente popolato
      // o contenere solo il ticketCode se l'errore è avvenuto presto.
      // Se l'errore ha un messaggio specifico, usalo, altrimenti "Errore sconosciuto".
      const displayError = ticketDataForDisplay.error || error.message || 'Errore sconosciuto durante la validazione.';
      showTemporaryMessage(displayError, 'error');
      // Assicurati che ticketDataForDisplay contenga almeno il codice
      if (!ticketDataForDisplay.ticketCode && currentTicketCode) {
        ticketDataForDisplay.ticketCode = currentTicketCode;
      } else if (!ticketDataForDisplay.ticketCode && code) {
         ticketDataForDisplay.ticketCode = code; // Fallback al codice raw se parsing fallito
      }
      // Aggiungi l'errore specifico se non già presente
      if (!ticketDataForDisplay.error) {
          ticketDataForDisplay.error = displayError.split('\n')[0]; // Prendi solo la prima riga dell'errore per brevità
      }

    } finally {
      setLoading(false);
      setTicketCode(''); // Svuota sempre l'input manuale dopo il tentativo
      if (ticketDataForDisplay) {
        setLastScannedTicketDetails(ticketDataForDisplay);
      }
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

      {/* Dettagli del biglietto scansionato */} 
      {lastScannedTicketDetails && (
        <div className="scanned-ticket-details-container">
          <h4>Dettagli Biglietto Scansionato:</h4>
          <div className="ticket-detail-item">
            <strong>Codice:</strong> {lastScannedTicketDetails.ticketCode || 'N/D'}
          </div>
          {lastScannedTicketDetails.eventName && (
            <div className="ticket-detail-item">
              <strong>Evento:</strong> {lastScannedTicketDetails.eventName}
            </div>
          )}
          {lastScannedTicketDetails.customerName && (
            <div className="ticket-detail-item">
              <strong>Cliente:</strong> {lastScannedTicketDetails.customerName}
            </div>
          )}
          {lastScannedTicketDetails.ticketType && (
            <div className="ticket-detail-item">
              <strong>Tipo:</strong> {lastScannedTicketDetails.ticketType}
            </div>
          )}
          {lastScannedTicketDetails.eventDate && (
            <div className="ticket-detail-item">
              <strong>Data Evento:</strong> 
              {new Date(lastScannedTicketDetails.eventDate.seconds ? lastScannedTicketDetails.eventDate.seconds * 1000 : lastScannedTicketDetails.eventDate).toLocaleDateString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })}
            </div>
          )}
          {/* Mostra lo stato attuale del biglietto (potrebbe essere diverso dal messaggio di errore se l'errore non è di stato) */}
          {lastScannedTicketDetails.status && !lastScannedTicketDetails.error && (
             <div className="ticket-detail-item">
               <strong>Stato:</strong> <span className={`status-${lastScannedTicketDetails.status}`}>{lastScannedTicketDetails.status}</span>
             </div>
          )}
          {/* Mostra informazioni sulla validazione precedente, se presenti e se il biglietto è già stato validato */}
          {lastScannedTicketDetails.error && lastScannedTicketDetails.error.includes("GIA' VALIDATO") && lastScannedTicketDetails.validatedAt && (
            <div className="ticket-detail-item">
              <strong>Già Validato Il:</strong> 
              {new Date(lastScannedTicketDetails.validatedAt).toLocaleString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
              {lastScannedTicketDetails.validatorName && ` da ${lastScannedTicketDetails.validatorName}`}
            </div>
          )}
           {/* Mostra un messaggio di errore specifico per il biglietto, se presente */}
          {lastScannedTicketDetails.error && (
            <div className="ticket-detail-item error-highlight">
              <strong>Problema Rilevato:</strong> {lastScannedTicketDetails.error}
            </div>
          )}
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