import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  const [manualCameraActive, setManualCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
        videoConstraints: { 
          facingMode: "environment",
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 }
        },
        rememberLastUsedCamera: false,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        showTorchButtonIfSupported: true,
        useBarCodeDetectorIfSupported: false,
      };
      console.log("Scanner config:", config);

      console.log("[DEBUG] Prima di creare Html5QrcodeScanner");
      const html5QrcodeScanner = new Html5QrcodeScanner("html5qr-code-full-region", config, true);
      console.log("[DEBUG] Dopo aver creato Html5QrcodeScanner, oggetto:", html5QrcodeScanner);

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
        console.log("[DEBUG] Prima di chiamare html5QrcodeScanner.render()");
        
        try {
          console.log("[DEBUG] Richiesta esplicita permessi fotocamera");
          const constraints = { video: { facingMode: "environment" } };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log("[DEBUG] Permessi fotocamera ottenuti, stream:", stream.id);
          stream.getTracks().forEach(track => track.stop());
        } catch (permissionError) {
          console.error("[DEBUG] Errore permessi fotocamera:", permissionError);
        }
        
        await html5QrcodeScanner.render(onScanSuccess, onScanFailure);
        console.log("[DEBUG] Dopo aver chiamato html5QrcodeScanner.render() con successo");
        console.log("Scanner rendered successfully.");
        
        setTimeout(() => {
          try {
            const videos = document.querySelectorAll('#html5qr-code-full-region video');
            console.log("[DEBUG] Video trovati dopo render:", videos.length);
            videos.forEach((video, index) => {
              video.style.width = "100%";
              video.style.height = "100%";
              video.style.objectFit = "cover";
              video.style.display = "block";
              video.style.opacity = "1";
              video.style.visibility = "visible";
              video.style.zIndex = "5";
              console.log(`[DEBUG] Stili applicati a video[${index}]`);
            });
          } catch (cssError) {
            console.error("[DEBUG] Errore nell'applicare stili video:", cssError);
          }
        }, 1000);
        
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
        console.error("[DEBUG] Errore DENTRO il catch di render():", renderError);
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

  // Modifica all'useEffect per gestire manualmente la fotocamera solo su mobile reale
  useEffect(() => {
    // Rilevamento REALE mobile (non basato solo su user agent)
    const isMobileDevice = () => {
      // Verifica dimensione schermo piuttosto che user-agent
      return (window.innerWidth <= 768) && ('ontouchstart' in window);
    };
    
    // Fallback manuale che si attiva SOLO su dispositivi mobile REALI
    async function setupManualCamera() {
      // Uscita rapida se non siamo su mobile o la fotocamera manuale è già attiva
      if (!scannerActive || !isMobileDevice() || manualCameraActive) return;

      console.log("[MANUAL CAMERA] Verifica se attivare fallback su dispositivo mobile");
      
      try {
        // Verifica più accurata degli elementi video dopo un tempo maggiore
        setTimeout(async () => {
          if (!scannerActive) return; // Uscita se nel frattempo lo scanner è disattivato
          
          const videos = document.querySelectorAll('#html5qr-code-full-region video');
          const visibleVideos = Array.from(videos).filter(v => {
            // Verifica se il video è realmente visibile
            const rect = v.getBoundingClientRect();
            const style = window.getComputedStyle(v);
            return rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && 
                style.visibility !== 'hidden' && 
                style.opacity !== '0';
          });
          
          console.log("[MANUAL CAMERA] Video totali:", videos.length, "Video visibili:", visibleVideos.length);
          
          // Attiva fallback SOLO se non ci sono video visibili su un dispositivo mobile
          if (videos.length === 0 && isMobileDevice() && scannerActive && !manualCameraActive) {
            console.log("[MANUAL CAMERA] Attivazione fallback su mobile");
            setManualCameraActive(true);
            
            try {
              // Richiesta fotocamera in modo esplicito
              const constraints = { 
                video: { 
                  facingMode: "environment",
                  width: { min: 480, ideal: 720, max: 1280 },
                  height: { min: 360, ideal: 540, max: 720 }
                } 
              };
              
              const stream = await navigator.mediaDevices.getUserMedia(constraints);
              streamRef.current = stream;
              
              // Collegamento stream dopo che il DOM è aggiornato
              setTimeout(() => {
                if (videoRef.current) {
                  console.log("[MANUAL CAMERA] Collegamento stream a video");
                  videoRef.current.srcObject = stream;
                  videoRef.current.play().catch(e => console.error("[MANUAL CAMERA] Errore play:", e));
                  
                  // IMPORTANTE: Configuriamo la decodifica QR per il fallback manuale
                  setupQRScanner(stream);
                }
              }, 100);
            } catch (err) {
              console.error("[MANUAL CAMERA] Errore attivazione fallback:", err);
              setManualCameraActive(false);
            }
          }
        }, 5000); // Tempo aumentato a 5 secondi 
      } catch (err) {
        console.error("[MANUAL CAMERA] Errore generale:", err);
      }
    }
    
    // Funzione per configurare la scansione QR sul video manuale
    async function setupQRScanner(stream) {
      console.log("[MANUAL CAMERA] Configurazione scanner QR sul video manuale");
      
      try {
        // Importiamo dinamicamente la libreria jsQR (la libreria più leggera e compatibile per la decodifica QR)
        let jsQR;
        try {
          jsQR = await import('jsqr');
          console.log("[MANUAL CAMERA] Libreria jsqr caricata con successo");
        } catch (e) {
          console.error("[MANUAL CAMERA] Libreria jsqr non trovata. Esegui 'npm install jsqr --save' e riprova.");
          showTemporaryMessage("Per il riconoscimento QR, installa jsqr: 'npm install jsqr --save'", "error", 10000);
          return;
        }
        
        const canvasRef = document.createElement('canvas');
        const canvasCtx = canvasRef.getContext('2d');
        const videoElem = videoRef.current;
        
        if (!videoElem || !canvasCtx) {
          console.error("[MANUAL CAMERA] Elementi video o canvas non disponibili");
          return;
        }
        
        // Funzione che analizza i frame video alla ricerca di QR code
        const scanQRFrame = () => {
          if (!videoElem || !scannerActive || !manualCameraActive || isScanPaused) {
            return; // Non continuare se lo scanner è disattivato o in pausa
          }
          
          try {
            if (videoElem.readyState === videoElem.HAVE_ENOUGH_DATA) {
              // Configura canvas per catturare l'immagine dalla fotocamera
              canvasRef.height = videoElem.videoHeight;
              canvasRef.width = videoElem.videoWidth;
              canvasCtx.drawImage(videoElem, 0, 0, canvasRef.width, canvasRef.height);
              
              // Ottieni i dati dell'immagine per l'analisi
              const imageData = canvasCtx.getImageData(0, 0, canvasRef.width, canvasRef.height);
              
              // Prova a decodificare il QR code
              console.log("[MANUAL CAMERA] Analisi frame per QR code...");
              const code = jsQR.default(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth", // Prova sia invertito che non invertito
              });
              
              if (code && code.data) {
                console.log("[MANUAL CAMERA] QR Code rilevato:", code.data);
                
                // Mostra un feedback visivo che abbiamo trovato un QR
                canvasCtx.beginPath();
                canvasCtx.lineWidth = 4;
                canvasCtx.strokeStyle = "#FF3B58";
                canvasCtx.rect(
                  code.location.topLeftCorner.x, 
                  code.location.topLeftCorner.y, 
                  code.location.bottomRightCorner.x - code.location.topLeftCorner.x, 
                  code.location.bottomRightCorner.y - code.location.topLeftCorner.y
                );
                canvasCtx.stroke();
                
                // Pausa la scansione per evitare scansioni multiple
                setIsScanPaused(true);
                
                // Aggiungi suono di scansione riuscita (opzionale)
                try {
                  const beep = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjU2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU3LjY0AAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs4EcUAAAAAAAAAAAAAAAAAP/7UMQAAAesTXWUEQBBilO7IAgCDaqbubm5uVVVVVVVyqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqg==");
                  beep.play();
                } catch (e) {
                  // Ignora errori audio
                }
                
                // Mostra messaggio di elaborazione QR
                showTemporaryMessage("QR Code rilevato, elaborazione...", "info", 2000);
                
                // Usa la stessa funzione di validazione dello scanner originale
                // Piccolo delay per dare il tempo all'utente di vedere il feedback
                setTimeout(() => {
                  try {
                    console.log("[MANUAL CAMERA] Chiamo handleValidateTicket con:", code.data);
                    handleValidateTicket(code.data);
                  } catch (err) {
                    console.error("[MANUAL CAMERA] Errore durante handleValidateTicket:", err);
                    showTemporaryMessage("Errore durante la validazione del QR", "error");
                    setIsScanPaused(false); // Riprendi la scansione in caso di errore
                  }
                }, 800);
                
                // Ripristina la scansione dopo un ritardo
                setTimeout(() => {
                  if (scannerActive && manualCameraActive) {
                    setIsScanPaused(false);
                    console.log("[MANUAL CAMERA] Scansione ripresa");
                  }
                }, 3000);
                
                return; // Esci dalla funzione dopo aver trovato un QR
              }
            }
          } catch (e) {
            console.error("[MANUAL CAMERA] Errore durante la scansione del frame:", e);
          }
          
          // Continua la scansione al prossimo frame se ancora attiva
          if (scannerActive && manualCameraActive && !isScanPaused) {
            requestAnimationFrame(scanQRFrame);
          } else {
            console.log("[MANUAL CAMERA] Loop di scansione interrotto:", {
              scannerActive, manualCameraActive, isScanPaused
            });
          }
        };
        
        // Avvia il loop di scansione e assicurati che non si fermi
        console.log("[MANUAL CAMERA] Avvio loop di scansione QR");
        scanQRFrame();
        
        // Riavvia il loop di scansione ogni 5 secondi se si è fermato per qualche motivo
        const scanInterval = setInterval(() => {
          if (scannerActive && manualCameraActive && !isScanPaused) {
            const videos = document.querySelectorAll('#html5qr-code-full-region video');
            console.log("[MANUAL CAMERA] Controllo loop di scansione. Video attivi:", videos.length);
            if (videoElem.readyState === videoElem.HAVE_ENOUGH_DATA) {
              scanQRFrame();
            }
          } else if (!scannerActive || !manualCameraActive) {
            clearInterval(scanInterval);
          }
        }, 5000);
        
        // Pulisci l'intervallo quando il componente si smonta
        return () => {
          clearInterval(scanInterval);
        };
      } catch (err) {
        console.error("[MANUAL CAMERA] Errore nel setup del decoder QR:", err);
      }
    }
    
    // Attiva il fallback solo all'inizio di scannerActive
    if (scannerActive && !manualCameraActive) {
      setupManualCamera();
    }
    
    // Cleanup
    return () => {
      if (streamRef.current) {
        console.log("[MANUAL CAMERA] Rilascio stream");
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [scannerActive, manualCameraActive, isScanPaused]); // Aggiungi isScanPaused alle dipendenze

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
            
            {manualCameraActive && (
              <div className="manual-camera-container">
                <video 
                  ref={videoRef} 
                  className="camera-video" 
                  autoPlay 
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    borderRadius: '8px',
                    zIndex: 4
                  }}
                ></video>
                <div className="qr-scanner-overlay" style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '250px',
                  height: '250px',
                  border: '3px solid rgba(255,255,255,0.8)',
                  borderRadius: '8px',
                  boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)',
                  zIndex: 5
                }}></div>
                {isScanPaused && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    fontSize: '18px',
                    zIndex: 6
                  }}>
                    <div>Elaborazione QR...</div>
                  </div>
                )}
              </div>
            )}
            
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