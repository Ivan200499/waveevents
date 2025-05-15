import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { FaQrcode, FaKeyboard, FaTicketAlt, FaUser, FaCalendarAlt, FaMapMarkerAlt, FaCheck, FaTimes } from 'react-icons/fa';
import './TicketValidator.css';

function TicketValidator({ initializeWithScanner = true }) {
  const { currentUser } = useAuth();
  const [ticketCode, setTicketCode] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [scannerActive, setScannerActive] = useState(initializeWithScanner);
  const scannerRef = useRef(null);
  const inputRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const [isScanPaused, setIsScanPaused] = useState(false);
  const scannerContainerRef = useRef(null);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const [lastScannedTicketDetails, setLastScannedTicketDetails] = useState(null);

  // Check user permissions
  useEffect(() => {
    async function checkUserRole() {
      try {
        if (!currentUser) {
          setMessage('Utente non autenticato.');
          setMessageType('error');
          return;
        }
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
          const currentRole = (userDoc.data().role || '').toLowerCase();
          const allowedRoles = ['manager', 'admin', 'validator']; 
          if (!allowedRoles.includes(currentRole)) {
            setMessage('Non hai i permessi per validare i biglietti.');
            setMessageType('error');
          }
        } else {
          setMessage('Utente non trovato.');
          setMessageType('error');
        }
      } catch (error) {
        console.error('Errore nel recupero del ruolo:', error);
        setMessage('Errore nel verificare i permessi.');
        setMessageType('error');
      }
    }
    checkUserRole();
  }, [currentUser]);

  // Cleanup when component unmounts
  useEffect(() => {
    const instanceAtMount = scannerRef.current;
    return () => {
        if (instanceAtMount) {
          try {
          instanceAtMount.clear();
        } catch (error) {
          console.log("Cleanup error on unmount:", error);
        }
      }
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);
  
  // Initialize scanner when scannerActive changes
  useEffect(() => {
    let isEffectActive = true;

    const initializeNewScanner = async () => {
      console.log("Attempting to initialize scanner...");
      if (!isEffectActive || !document.getElementById("html5qr-code-full-region")) {
        console.log("Scanner initialization aborted: effect not active or element not found.");
        return;
      }

      if (scannerRef.current) {
        console.log("Clearing previous scanner instance...");
        try {
          await scannerRef.current.clear();
          console.log("Previous scanner cleared.");
        } catch (e) { 
          console.warn("Error clearing previous scanner:", e);
        }
        scannerRef.current = null;
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        videoConstraints: { facingMode: "environment" },
        rememberLastUsedCamera: true,
        supportedScanTypes: [0] // SCAN_TYPE_CAMERA
      };
      console.log("Scanner config:", config);

      const html5QrcodeScanner = new Html5QrcodeScanner("html5qr-code-full-region", config, true);

      const onScanSuccess = (decodedText, decodedResult) => {
        console.log("[SCAN SUCCESS] Decoded Text:", decodedText, "Full Result:", decodedResult);
        if (!isEffectActive || loading || isScanPaused) {
          console.log("[SCAN SUCCESS] Aborted due to state:", { isEffectActive, loading, isScanPaused });
          return;
        }
        setIsScanPaused(true);
        console.log("[SCAN SUCCESS] Calling handleValidateTicket...");
        handleValidateTicket(decodedText);
        setTimeout(() => { 
          if (isEffectActive) {
            setIsScanPaused(false); 
            console.log("[SCAN SUCCESS] Scan pause released.");
          }
        }, 2000);
      };

      const onScanFailure = (errorMessage) => {
        if (!isEffectActive) return;
        // console.warn("[SCAN FAILURE]:", errorMessage); // Decommenta per debug dettagliato fallimenti scansione
      };
      
      try {
        console.log("Rendering scanner...");
        await html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        console.log("Scanner rendered successfully.");
        if (isEffectActive) {
          scannerRef.current = html5QrcodeScanner;
          setScannerInitialized(true);
          console.log("Scanner initialized and ref set.");
        } else {
          console.log("Effect became inactive during scanner render, clearing scanner.");
          if(html5QrcodeScanner && html5QrcodeScanner.getState && html5QrcodeScanner.getState() === 2) {
            html5QrcodeScanner.clear().catch(e => console.warn("Error clearing scanner on inactive effect:", e));
           }
        }
      } catch (renderError) {
        console.error("Error rendering scanner:", renderError);
        if (isEffectActive) {
            setMessage("Errore nell'avvio dello scanner. Verifica permessi fotocamera e ricarica.");
            setMessageType('error');
            setScannerActive(false);
            setScannerInitialized(false);
        }
      }
    };

    const cleanupCurrentScanner = async () => {
      console.log("Cleaning up current scanner...");
      if (scannerRef.current) {
        const instanceToCleanup = scannerRef.current;
        scannerRef.current = null; 
        try {
          if (instanceToCleanup && instanceToCleanup.getState && instanceToCleanup.getState() === 2) {
             await instanceToCleanup.clear();
            console.log("Scanner instance cleared in cleanup.");
          }
        } catch (error) {
          console.warn("Error in cleanupCurrentScanner:", error);
        }
      }
      if (isEffectActive) {
        setScannerInitialized(false);
        console.log("Scanner uninitialized.");
      }
    };

    if (scannerActive) {
      console.log("Scanner is active. Initialized:", scannerInitialized, "Loading:", loading);
      if (!scannerInitialized && !loading) {
        const initTimeout = setTimeout(() => {
          if(isEffectActive) initializeNewScanner();
        }, 100); // Ridotto il timeout, ma assicurati che il div sia nel DOM
        return () => clearTimeout(initTimeout);
      }
    } else { 
      console.log("Scanner is not active. Initialized:", scannerInitialized);
      if (scannerInitialized) {
        cleanupCurrentScanner();
      }
    }

    return () => {
      console.log("Effect cleanup for [scannerActive, scannerInitialized, loading, currentUser]");
      isEffectActive = false;
      // Considera se è necessario pulire lo scanner qui, 
      // potrebbe essere già gestito dalla logica if/else sopra
      // o dallo smontaggio del componente.
    };
  }, [scannerActive, scannerInitialized, loading, currentUser]);

  const showTemporaryMessage = (msg, type = 'info', duration = 4000) => {
    console.log(`[MESSAGE] Type: ${type}, Message: ${msg}`);
    setMessage(msg);
    setMessageType(type);
    if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => {
        setMessage('');
        setMessageType('info');
    }, duration);
  };

  async function handleValidateTicket(code) {
    console.log("[VALIDATE] Called with code:", code);
    setLastScannedTicketDetails(null);
    
    if (!code) {
        showTemporaryMessage('Codice biglietto non fornito.', 'error');
        setLastScannedTicketDetails({ ticketCode: 'N/A', error: 'Codice non fornito' });
        console.log("[VALIDATE] No code provided.");
        return;
    }
    
    setLoading(true);
    console.log("[VALIDATE] setLoading(true)");
    let currentTicketCode = '';
    let ticketDataForDisplay = null;

    try {
      try {
        const parsedCode = JSON.parse(code);
        currentTicketCode = parsedCode.ticketCode;
        console.log("[VALIDATE] Parsed QR as JSON. Ticket code:", currentTicketCode);
      } catch (e) {
        currentTicketCode = code;
        console.log("[VALIDATE] QR not JSON. Using raw code:", currentTicketCode);
      }

      if (!currentTicketCode || typeof currentTicketCode !== 'string') {
        showTemporaryMessage('Codice biglietto estratto non valido.', 'error');
        setLastScannedTicketDetails({ ticketCode: String(code), error: 'Codice estratto non valido' });
        setLoading(false);
        console.log("[VALIDATE] Invalid extracted ticket code.", currentTicketCode);
        return;
      }
      currentTicketCode = currentTicketCode.trim();
      console.log("[VALIDATE] Searching for ticket code:", currentTicketCode);

      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('ticketCode', '==', currentTicketCode));
      const querySnapshot = await getDocs(q);
      console.log("[VALIDATE] Firestore query result. Empty:", querySnapshot.empty, "Size:", querySnapshot.size);

      if (querySnapshot.empty) {
        showTemporaryMessage('Biglietto non trovato nel sistema.', 'error');
        setLastScannedTicketDetails({ ticketCode: currentTicketCode, error: 'Biglietto non trovato' });
        setLoading(false);
        console.log("[VALIDATE] Ticket not found in DB.");
        return;
      }
      
      const ticketDoc = querySnapshot.docs[0];
      const ticketData = ticketDoc.data();
      const ticketId = ticketDoc.id;
      console.log("[VALIDATE] Ticket found:", { ticketId, ticketData });

      ticketDataForDisplay = {
        ticketCode: currentTicketCode,
        id: ticketId,
        eventName: ticketData.eventName || 'N/D',
        eventDate: ticketData.eventDate?.seconds ? new Date(ticketData.eventDate.seconds * 1000).toLocaleDateString('it-IT') : 'N/D',
        eventLocation: ticketData.eventLocation || 'N/D',
        customerName: ticketData.customerName || 'N/D',
        customerEmail: ticketData.customerEmail || 'N/D',
        quantity: ticketData.quantity || 1,
        price: ticketData.price != null ? `€${Number(ticketData.price).toFixed(2)}` : 'N/D',
        isValidated: ticketData.isValidated || false,
        isDisabled: ticketData.isDisabled || false,
        validatedAt: ticketData.validatedAt?.seconds ? new Date(ticketData.validatedAt.seconds * 1000).toLocaleString('it-IT') : null
      };
      console.log("[VALIDATE] Ticket data for display:", ticketDataForDisplay);

      if (ticketData.isDisabled) {
        showTemporaryMessage('Questo biglietto è stato disabilitato.', 'error');
        setLastScannedTicketDetails({ ...ticketDataForDisplay, status: 'disabled', statusMessage: 'Biglietto disabilitato' });
        setLoading(false);
        console.log("[VALIDATE] Ticket is disabled.");
        return;
      }

      if (ticketData.isValidated) {
        showTemporaryMessage(`Biglietto già validato il ${ticketDataForDisplay.validatedAt}.`, 'error');
        setLastScannedTicketDetails({ ...ticketDataForDisplay, status: 'already_validated', statusMessage: `Già validato il ${ticketDataForDisplay.validatedAt}` });
        setLoading(false);
        console.log("[VALIDATE] Ticket already validated.");
        return;
      }

      await updateDoc(doc(db, 'tickets', ticketId), {
        isValidated: true,
        validatedAt: new Date(),
        validatedBy: currentUser.uid
      });
      console.log("[VALIDATE] Ticket successfully validated and updated in DB.");

      showTemporaryMessage('Biglietto validato con successo!', 'success');
      setLastScannedTicketDetails({
        ...ticketDataForDisplay,
        isValidated: true, // Aggiorna anche qui per coerenza immediata UI
        status: 'valid',
        statusMessage: 'Validato con successo',
        validatedAt: new Date().toLocaleString('it-IT')
      });

    } catch (error) {
      console.error("[VALIDATE] Error during validation process:", error);
      showTemporaryMessage('Errore durante la validazione del biglietto.', 'error');
      setLastScannedTicketDetails({
        ticketCode: currentTicketCode || String(code),
        error: 'Errore di sistema',
        errorDetails: error.message
      });
    } finally {
      setLoading(false);
      setTicketCode(''); 
      console.log("[VALIDATE] setLoading(false) in finally block.");
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!ticketCode.trim()) {
      showTemporaryMessage('Inserisci un codice biglietto valido.', 'error');
      return;
    }
      await handleValidateTicket(ticketCode);
  };

  return (
    <div className="validator-container">
      <h2>Validazione Biglietti</h2>
      
      <div className="input-methods">
        <button 
          className={`method-button ${scannerActive ? 'active' : ''}`}
          onClick={() => setScannerActive(true)}
        >
          <FaQrcode /> Scanner QR
        </button>
        <button 
          className={`method-button ${!scannerActive ? 'active' : ''}`}
          onClick={() => setScannerActive(false)}
        >
          <FaKeyboard /> Inserimento Manuale
        </button>
      </div>

      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      {scannerActive ? (
        <div className="scanner-wrapper">
          <div className="scanner-container" ref={scannerContainerRef}>
            <div id="html5qr-code-full-region"></div>
            {loading && (
              <div className="scanner-loading-overlay">
                <div className="loading-spinner"></div>
                <p>Validazione in corso...</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form className="manual-input" onSubmit={handleManualSubmit}>
          <input
            type="text"
            className="ticket-input"
            placeholder="Inserisci il codice del biglietto"
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value)}
            ref={inputRef}
            autoFocus
          />
          <button
            type="submit" 
            className="validate-button"
            disabled={loading || !ticketCode.trim()}
          >
            {loading ? 'Validazione...' : 'Valida Biglietto'}
          </button>
        </form>
      )}

      {lastScannedTicketDetails && (
        <div className="scanned-ticket-details-container">
          <h4>Dettagli Biglietto</h4>
          
          {lastScannedTicketDetails.error ? (
            <div className="ticket-detail-item error-highlight">
              <strong>Errore:</strong> {lastScannedTicketDetails.error}
              {lastScannedTicketDetails.errorDetails && <small style={{display: 'block', marginTop: '5px'}}>Dettagli: {lastScannedTicketDetails.errorDetails}</small>}
            </div>
          ) : (
            <>
              <div className="ticket-detail-item">
                <FaTicketAlt /> <strong>Evento:</strong> {lastScannedTicketDetails.eventName}
              </div>
              <div className="ticket-detail-item">
                <FaCalendarAlt /> <strong>Data:</strong> {lastScannedTicketDetails.eventDate}
              </div>
              <div className="ticket-detail-item">
                <FaMapMarkerAlt /> <strong>Luogo:</strong> {lastScannedTicketDetails.eventLocation}
              </div>
              <div className="ticket-detail-item">
                <FaUser /> <strong>Cliente:</strong> {lastScannedTicketDetails.customerName}
              </div>
              <div className="ticket-detail-item">
                <strong>Email:</strong> {lastScannedTicketDetails.customerEmail}
              </div>
              <div className="ticket-detail-item">
                <strong>Quantità:</strong> {lastScannedTicketDetails.quantity}
              </div>
              <div className="ticket-detail-item">
                <strong>Prezzo:</strong> {lastScannedTicketDetails.price}
              </div>
              <div className="ticket-detail-item">
                <strong>Stato:</strong> 
                {lastScannedTicketDetails.status === 'valid' ? (
                  <span className="status-validated"><FaCheck /> {lastScannedTicketDetails.statusMessage} (il {lastScannedTicketDetails.validatedAt})</span>
                ) : lastScannedTicketDetails.status === 'disabled' ? (
                  <span className="status-disabled"><FaTimes /> {lastScannedTicketDetails.statusMessage}</span>
                ) : lastScannedTicketDetails.status === 'already_validated' ? (
                  <span className="status-already-validated"><FaTimes /> {lastScannedTicketDetails.statusMessage}</span>
                ) : (
                  <span>Sconosciuto ({lastScannedTicketDetails.status})</span>
                )}
              </div>
              <div className="ticket-detail-item">
                <strong>Codice:</strong> {lastScannedTicketDetails.ticketCode}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TicketValidator; 