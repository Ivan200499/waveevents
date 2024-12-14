import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const navigate = useNavigate();
  const [scanner, setScanner] = useState(null);

  // Verifica il ruolo dell'utente
  useEffect(() => {
    async function checkUserRole() {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
          // Reindirizza se non è un manager
          if (userDoc.data().role !== 'manager') {
            setMessage('Solo i manager possono validare i biglietti');
            navigate('/');
          }
        }
      } catch (error) {
        console.error('Errore nel recupero del ruolo:', error);
      }
    }
    checkUserRole();
  }, [currentUser, navigate]);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [scanner]);

  const startScanner = () => {
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );
    
    html5QrcodeScanner.render((decodedText) => {
      handleValidateTicket(decodedText);
      html5QrcodeScanner.clear();
    }, (error) => {
      console.warn(`Code scan error = ${error}`);
    });

    setScanner(html5QrcodeScanner);
  };

  async function handleValidateTicket(code) {
    setLoading(true);
    try {
      console.log('Codice ricevuto:', code); // Debug

      let ticketData;
      try {
        ticketData = JSON.parse(code);
        console.log('Dati QR decodificati:', ticketData); // Debug
      } catch (e) {
        console.log('Usando il codice come stringa semplice');
        ticketData = { ticketCode: code };
      }

      const ticketCode = ticketData.ticketCode;

      // Cerca il biglietto
      const salesQuery = query(
        collection(db, 'sales'),
        where('ticketCode', '==', ticketCode)
      );

      const salesSnapshot = await getDocs(salesQuery);
      console.log('Risultati ricerca:', salesSnapshot.size); // Debug

      if (salesSnapshot.empty) {
        throw new Error('Biglietto non trovato');
      }

      const saleDoc = salesSnapshot.docs[0];
      const saleData = saleDoc.data();

      if (saleData.used) {
        throw new Error('Questo biglietto è già stato utilizzato!');
      }

      // Verifica la data dell'evento
      const eventRef = doc(db, 'events', saleData.eventId);
      const eventSnap = await getDoc(eventRef);
      
      if (!eventSnap.exists()) {
        throw new Error('Evento non trovato');
      }

      const eventData = eventSnap.data();
      const eventDate = new Date(eventData.date);
      const now = new Date();

      if (eventDate < now) {
        throw new Error('Questo evento è già passato');
      }

      // Marca il biglietto come utilizzato
      await updateDoc(doc(db, 'sales', saleDoc.id), {
        used: true,
        usedAt: now.toISOString(),
        validatedBy: currentUser.uid
      });

      setMessage(`Biglietto validato con successo!
        Evento: ${eventData.name}
        Cliente: ${saleData.customerEmail}
        Quantità: ${saleData.quantity}
      `);
      setTicketCode('');

    } catch (error) {
      console.error('Errore validazione:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="validator-container">
      <h2>Valida Biglietto</h2>
      
      <div className="input-methods">
        <button 
          className={`method-button ${!scannerActive ? 'active' : ''}`}
          onClick={() => setScannerActive(false)}
        >
          <FaKeyboard /> Inserisci Codice
        </button>
        <button 
          className={`method-button ${scannerActive ? 'active' : ''}`}
          onClick={() => {
            setScannerActive(true);
            startScanner();
          }}
        >
          <FaQrcode /> Scansiona QR
        </button>
      </div>

      {scannerActive ? (
        <div className="scanner-container">
          <div id="reader"></div>
        </div>
      ) : (
        <div className="manual-input">
          <input
            type="text"
            value={ticketCode}
            onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
            placeholder="Inserisci codice biglietto"
            className="ticket-input"
          />
          <button
            onClick={() => handleValidateTicket(ticketCode)}
            disabled={loading || !ticketCode}
            className={`validate-button ${loading ? 'loading' : ''}`}
          >
            {loading ? 'Validazione...' : 'Valida Biglietto'}
          </button>
        </div>
      )}

      {message && (
        <div className={`message ${message.includes('successo') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default TicketValidator; 