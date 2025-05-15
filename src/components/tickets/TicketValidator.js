import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';
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
  const [lastScannedTicketDetails, setLastScannedTicketDetails] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  
  // Refs
  const scannerRef = useRef(null);
  const inputRef = useRef(null);
  const messageTimeoutRef = useRef(null);
  const lastScanTimeRef = useRef(0); // Riferimento per l'ultimo tempo di scansione
  const scanTimeoutRef = useRef(null); // Riferimento per il timeout tra scansioni

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

  // Nuova implementazione del QR scanner usando Html5Qrcode diretto
  useEffect(() => {
    // Se lo scanner non è attivo, pulire le risorse
    if (!scannerActive) {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(e => console.error("Errore durante l'arresto dello scanner:", e));
          scannerRef.current = null;
        } catch (error) {
          console.error("Errore durante la pulizia dello scanner:", error);
        }
      }
      return;
    }

    // Reset errore fotocamera
    setCameraError(false);
    
    const qrContainer = document.getElementById('qr-reader');
    if (!qrContainer) {
      console.error("Elemento 'qr-reader' non trovato nel DOM");
      return;
    }

    console.log("Inizializzazione QR scanner diretto...");
    
    // Crea una nuova istanza di Html5Qrcode
    const html5QrCode = new Html5Qrcode("qr-reader");
    
    // Configurazione della scansione
    const qrConfig = {
      fps: 10,
      qrbox: 250,
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      hideControls: true,
      drawScanRegion: false // Disabilita il disegno del mirino della libreria
    };
    
    // Scegli la fotocamera frontale per localhost, altrimenti quella posteriore
    const cameraConfig = {
      facingMode: window.location.hostname === "localhost" ? "user" : "environment"
    };

    // Avvia lo scanner
    html5QrCode.start(
      cameraConfig, 
      qrConfig,
      (decodedText) => {
        // Successo: QR Code decodificato
        console.log("QR Code decodificato:", decodedText);
        
        // Verifica se è troppo presto per una nuova scansione (2 secondi di timeout)
        const now = Date.now();
        if (now - lastScanTimeRef.current < 2000) {
          console.log("Ignorata scansione troppo rapida");
          return; // Ignora questa scansione, è troppo presto
        }
        
        // Aggiorna l'ultimo tempo di scansione
        lastScanTimeRef.current = now;
        
        // Feedback audio alla scansione
        try {
          const beep = new Audio();
          beep.src = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUt..."; // Base64 troncato
          beep.volume = 0.3;
          beep.play().catch(e => {}); // Ignora errori audio
        } catch (e) {
          // Ignora errori audio
        }
        
        // Pausa la scansione 
        try {
          const pausePromise = html5QrCode.pause();
          // Solo se .pause() restituisce una promise con .catch, la usiamo
          if (pausePromise && typeof pausePromise.catch === 'function') {
            pausePromise.catch(e => console.error("Errore pausa scanner:", e));
          }
        } catch (error) {
          console.error("Errore durante la pausa dello scanner:", error);
        }
        
        // Elabora il codice
        handleValidateTicket(decodedText)
          .finally(() => {
            // Riprendi la scansione dopo 2 secondi
            scanTimeoutRef.current = setTimeout(() => {
              if (scannerActive && scannerRef.current) {
                try {
                  const resumePromise = html5QrCode.resume();
                  // Solo se .resume() restituisce una promise con .catch, la usiamo
                  if (resumePromise && typeof resumePromise.catch === 'function') {
                    resumePromise.catch(e => console.error("Errore ripresa scanner:", e));
                  }
                } catch (error) {
                  console.error("Errore durante la ripresa dello scanner:", error);
                }
              }
            }, 2000);
          });
      },
      (errorMessage) => {
        // Ignora gli errori di scansione normali
        if (errorMessage.includes("No QR code found")) {
          return;
        }
        console.log("Errore scanner:", errorMessage);
      }
    )
    .then(() => {
      console.log("Scanner QR avviato con successo!");
      scannerRef.current = html5QrCode;
      
      // Fix per l'interfaccia utente su mobile - rimuovi elementi duplicati
      setTimeout(() => {
        // Rimuovi eventuali elementi UI indesiderati creati dalla libreria
        try {
          // Inietta uno stile CSS direttamente nel documento per nascondere tutti i mirini della libreria
          // ma NON il nostro mirino personalizzato con classe custom-scanner-viewfinder
          const style = document.createElement('style');
          style.type = 'text/css';
          style.innerHTML = `
            /* Nascondi solo i mirini generati dalla libreria ma non il nostro mirino personalizzato */
            div[style*="border: 6px solid rgb(255, 255, 255)"],
            div[style*="border:6px solid rgb(255,255,255)"],
            div[style*="border: 2px solid rgb(255, 255, 255)"],
            div[style*="border:2px solid rgb(255,255,255)"],
            #html5-qrcode-code-full-region canvas {
              display: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
            }
            
            /* Assicurati che il nostro mirino rimanga sempre visibile */
            .custom-scanner-viewfinder {
              display: block !important;
              opacity: 1 !important;
              visibility: visible !important;
              z-index: 1000 !important; /* Z-index più alto per rimanere sopra altri elementi */
            }
          `;
          document.head.appendChild(style);
          console.log('Iniettato CSS per gestire i mirini');
          
          // Rimuovi tutti gli span e div superflui che la libreria crea
          const scanTypeSelector = document.getElementById('html5-qrcode-select-camera');
          if (scanTypeSelector) scanTypeSelector.style.display = 'none';
          
          // Rimuovi tutti i bottoni tranne quello della torcia
          const buttons = qrContainer.querySelectorAll('button');
          buttons.forEach(button => {
            if (!button.innerHTML.includes('torch')) {
              button.style.display = 'none';
            }
          });
          
          // Rimuovi l'header con testo duplicato (se presente)
          const headers = qrContainer.querySelectorAll('div[style*="border-bottom"]');
          headers.forEach(header => header.style.display = 'none');
          
          // Assicurati che ci sia un solo video attivo
          const videos = qrContainer.querySelectorAll('video');
          console.log(`Trovati ${videos.length} elementi video`);
          
          if (videos.length > 1) {
            // Mantieni solo il primo video
            for (let i = 1; i < videos.length; i++) {
              videos[i].style.display = 'none';
            }
          }
          
          // Assicurati che il video principale sia ben visibile
          if (videos.length > 0) {
            const mainVideo = videos[0];
            mainVideo.style.width = '100%';
            mainVideo.style.height = '100%';
            mainVideo.style.objectFit = 'cover';
            mainVideo.style.borderRadius = '12px';
            mainVideo.style.transform = 'scaleX(1)'; // Rimuove eventuali rotazioni
          }
        } catch (e) {
          console.warn("Errore durante la pulizia dell'interfaccia:", e);
        }
      }, 500);
      
      // Assicurati che il mirino personalizzato sia sempre visibile anche dopo che la libreria prova a modificare l'UI
      setInterval(() => {
        try {
          // Controlla e ripristina il mirino personalizzato se necessario
          const customViewfinder = document.querySelector('.custom-scanner-viewfinder');
          if (customViewfinder && (
              customViewfinder.style.display === 'none' || 
              customViewfinder.style.visibility === 'hidden' ||
              customViewfinder.style.opacity === '0'
          )) {
            console.log('Ripristino visibilità del mirino personalizzato');
            customViewfinder.style.display = 'block';
            customViewfinder.style.visibility = 'visible';
            customViewfinder.style.opacity = '1';
            customViewfinder.style.zIndex = '1000';
          }
        } catch (e) {
          // Ignora errori
        }
      }, 1000); // Controlla ogni secondo
    })
    .catch((err) => {
      console.error("Errore avvio scanner QR:", err);
      setCameraError(true);
      
      if (err.toString().includes("Permission")) {
        showTemporaryMessage("Permessi fotocamera negati. Controlla le impostazioni del browser.", "error", 8000);
      } else {
        showTemporaryMessage("Errore nell'avvio dello scanner. Ricarica la pagina.", "error", 5000);
      }
    });

    // Cleanup
    return () => {
      if (scannerRef.current) {
        console.log("Arresto scanner in cleanup");
        scannerRef.current.stop().catch(e => console.error("Errore arresto scanner:", e));
        scannerRef.current = null;
      }
      
      // Pulisci anche i timeout se sono attivi
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [scannerActive]);

  // Funzione per mostrare messaggi temporanei
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

  // La logica di validazione dei biglietti rimane invariata
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
        eventDate: ticketData.eventDate ? (
          ticketData.eventDate.seconds 
          ? new Date(ticketData.eventDate.seconds * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : new Date(ticketData.eventDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
        ) : 'N/D',
        eventLocation: ticketData.eventLocation || 'N/D',
        ticketType: ticketData.ticketType || 'Standard',
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
  
  // Funzione per richiedere manualmente i permessi fotocamera
  const requestCameraPermission = async () => {
    try {
      showTemporaryMessage("Richiesta permessi fotocamera...", "info");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      
      setCameraError(false);
      setScannerActive(false);
      setTimeout(() => setScannerActive(true), 500);
      
      showTemporaryMessage("Permessi ottenuti, riavvio scanner...", "success");
    } catch (error) {
      console.error("Errore permessi fotocamera:", error);
      showTemporaryMessage("Impossibile ottenere i permessi fotocamera.", "error");
    }
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
          <div className="scanner-container" style={{
            height: "350px", 
            background: "#000", // Sfondo nero per contrasto migliore
            border: "1px solid #444",
            borderRadius: "12px",
            overflow: "hidden",
            position: "relative"
          }}>
            {/* Elemento contenitore per QR */}
            <div id="qr-reader" style={{
              width: "100%", 
              height: "100%",
              position: "relative"
            }}></div>
            
            {/* Mirino centrale per QR code - con classe per evitare che venga nascosto */}
            <div className="custom-scanner-viewfinder" style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "200px",
              height: "200px",
              border: "2px solid rgba(255, 255, 255, 0.5)",
              borderRadius: "20px",
              boxShadow: "0 0 0 4000px rgba(0, 0, 0, 0.3)",
              zIndex: 5,
              pointerEvents: "none"
            }}>
              {/* Angoli del mirino */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "30px", height: "30px", borderTop: "4px solid #fff", borderLeft: "4px solid #fff", borderTopLeftRadius: "16px" }}></div>
              <div style={{ position: "absolute", top: 0, right: 0, width: "30px", height: "30px", borderTop: "4px solid #fff", borderRight: "4px solid #fff", borderTopRightRadius: "16px" }}></div>
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "30px", height: "30px", borderBottom: "4px solid #fff", borderLeft: "4px solid #fff", borderBottomLeftRadius: "16px" }}></div>
              <div style={{ position: "absolute", bottom: 0, right: 0, width: "30px", height: "30px", borderBottom: "4px solid #fff", borderRight: "4px solid #fff", borderBottomRightRadius: "16px" }}></div>
            </div>
            
            {loading && (
              <div className="scanner-loading-overlay">
                <div className="loading-spinner"></div>
                <p>Validazione in corso...</p>
              </div>
            )}
            
            {cameraError && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                color: "white",
                padding: "20px",
                textAlign: "center",
                zIndex: 10
              }}>
                <div style={{ fontSize: "18px", marginBottom: "10px" }}>Errore fotocamera</div>
                <p>Verifica i permessi del browser</p>
                <button 
                  onClick={requestCameraPermission}
                  style={{
                    padding: "10px 20px",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    marginTop: "15px",
                    cursor: "pointer",
                    fontSize: "16px"
                  }}
                >
                  Autorizza Fotocamera
                </button>
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
                <strong>Tipo Biglietto:</strong> {lastScannedTicketDetails.ticketType || 'Standard'}
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