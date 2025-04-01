import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { FaQrcode, FaKeyboard } from 'react-icons/fa';
import './TicketValidator.css';
import QRCodeGenerator from './QRCodeGenerator';

function TicketValidator() {
  const { currentUser } = useAuth();
  const [ticketCode, setTicketCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const navigate = useNavigate();
  const [scanner, setScanner] = useState(null);

  useEffect(() => {
    async function checkUserRole() {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
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

  useEffect(() => {
    if (scannerActive) {
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          videoConstraints: {
            facingMode: { exact: "environment" }
          }
        },
        false
      );

      html5QrcodeScanner.render(async (decodedText) => {
        try {
          await handleValidateTicket(decodedText);
          setTimeout(() => {
            setMessage('');
          }, 3000);
        } catch (error) {
          console.error('Errore durante la validazione:', error);
        }
      }, (error) => {
        console.warn(`Code scan error = ${error}`);
      });

      setScanner(html5QrcodeScanner);
    }
  }, [scannerActive]);

  async function handleValidateTicket(code) {
    setLoading(true);
    try {
      console.log('Codice ricevuto:', code);
      let ticketCode;

      try {
        const ticketData = JSON.parse(code);
        console.log('Dati QR decodificati:', ticketData);
        ticketCode = ticketData.ticketCode;
      } catch (e) {
        console.log('Usando il codice come stringa semplice');
        ticketCode = code;
      }

      console.log('Cercando biglietto con codice:', ticketCode);

      const salesQuery = query(
        collection(db, 'tickets'),
        where('ticketCode', '==', ticketCode.trim())
      );

      const salesSnapshot = await getDocs(salesQuery);
      console.log('Risultati ricerca:', salesSnapshot.size);

      if (salesSnapshot.empty) {
        setMessage('Biglietto non trovato');
        return;
      }

      const saleDoc = salesSnapshot.docs[0];
      const saleData = saleDoc.data();
      console.log('Dati della vendita:', saleData);

      if (saleData.validatedAt) {
        setMessage('Questo biglietto è già stato utilizzato!');
        return;
      }

      const eventRef = doc(db, 'events', saleData.eventId);
      const eventSnap = await getDoc(eventRef);
      
      if (!eventSnap.exists()) {
        setMessage('Evento non trovato');
        return;
      }

      const eventData = eventSnap.data();
      const eventDate = new Date(eventData.date);
      const now = new Date();

      if (eventDate < now) {
        setMessage('Questo evento è già passato');
        return;
      }

      await updateDoc(doc(db, 'tickets', saleDoc.id), {
        validatedAt: now.toISOString(),
        status: 'used',
        validatedBy: currentUser.uid
      });

      setMessage(`✅ Biglietto validato!\n${saleData.eventName}\n${saleData.customerEmail}`);
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