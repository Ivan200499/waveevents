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

  // Cleanup dello scanner quando il componente si smonta o lo scanner si disattiva
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Errore nella pulizia dello scanner:", error);
        });
        scannerRef.current = null;
      }
      // Pulisci anche il timeout del messaggio
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []); // Esegui solo allo smontaggio
  
  // Gestione avvio/stop scanner
  useEffect(() => {
      if (scannerActive) {
          if (!scannerRef.current) {
              try { // Aggiungo un try...catch per l'inizializzazione
                const html5QrcodeScanner = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        videoConstraints: {
                            facingMode: { exact: "environment" }
                        },
                        supportedScanTypes: [/* Html5QrcodeScanType.SCAN_TYPE_CAMERA */ 0]
                    },
                    false // verbose = false
                );
  
                html5QrcodeScanner.render(
                    (decodedText) => {
                        // Non bloccare il thread UI, valida in background
                        // Aggiungo un piccolo delay per evitare scansioni multiple immediate dello stesso codice
                        if (!loading) { 
                          handleValidateTicket(decodedText);
                        }
                    },
                    (errorMessage) => {
                        // Gestisce errori di scansione, ma non fermare
                        // console.warn(`QR error = ${errorMessage}`);
                    }
                );
                // Se render non lancia errori, l'inizializzazione è ok
                console.log("Scanner QR avviato.");
                scannerRef.current = html5QrcodeScanner;
              } catch (err) {
                // Cattura errori durante la creazione o il render dello scanner
                console.error("Errore inizializzazione scanner QR:", err);
                setMessage("Errore nell'avvio dello scanner QR. Controlla i permessi della fotocamera o ricarica la pagina.");
                setMessageType('error');
                setScannerActive(false); // Disattiva se c'è un errore grave
              }
          }
      } else {
          // Se scannerActive diventa false, ferma lo scanner
          if (scannerRef.current) {
              scannerRef.current.clear().then(() => {
                  console.log("Scanner QR fermato con successo.");
              }).catch(error => {
                  console.error("Errore nella pulizia dello scanner:", error);
              });
              scannerRef.current = null;
          }
      }
  }, [scannerActive, loading]); // Aggiungo loading alle dipendenze per evitare scansioni multiple

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
    setLoading(true); // Mostra caricamento solo per la validazione effettiva
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
        throw new Error(`Biglietto non trovato (${currentTicketCode})`);
      }

      const ticketDoc = ticketsSnapshot.docs[0];
      const ticketData = ticketDoc.data();

      if (ticketData.validatedAt || ticketData.status === 'used') {
         throw new Error(`❌ Biglietto GIA' VALIDATO\n${ticketData.eventName}\n(${currentTicketCode})`);
      }

      // Aggiungi controllo opzionale sull'evento (se necessario)
      // const eventRef = doc(db, 'events', ticketData.eventId);
      // const eventSnap = await getDoc(eventRef);
      // if (!eventSnap.exists()) { throw new Error('Evento associato non trovato'); }
      // const eventData = eventSnap.data();
      // const eventDate = eventData.date ? new Date(eventData.date) : null;
      // const now = new Date();
      // if (eventDate && eventDate < now) { throw new Error('Evento già passato'); }

      await updateDoc(doc(db, 'tickets', ticketDoc.id), {
        validatedAt: new Date().toISOString(),
        status: 'used',
        validatedBy: currentUser.uid,
        validatorName: currentUser.displayName || currentUser.email // Aggiungi nome validatore
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
        <div className="scanner-container">
           {/* Contenitore per lo scanner QR */}
           <div id="reader"></div> 
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