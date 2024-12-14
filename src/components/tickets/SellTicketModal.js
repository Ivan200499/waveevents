import { useState } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { FaTicketAlt, FaEnvelope } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'qrcode';
import emailjs from '@emailjs/browser';
import './SellTicketModal.css';

const EMAILJS_SERVICE_ID = "service_sy3o38j";
const EMAILJS_TEMPLATE_ID = "template_hp3771g";
const EMAILJS_PUBLIC_KEY = "I-QS6yxI9dhNJuUZO";

// Inizializza EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

function SellTicketModal({ event, onClose, onSold }) {
  const { currentUser } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalPrice = quantity * event.price;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (quantity > event.availableTickets) {
        throw new Error('Quantità richiesta non disponibile');
      }

      const ticketCode = Math.random().toString(36).substr(2, 9).toUpperCase();
      
      // Test di generazione QR
      try {
        const testQR = await QRCode.toDataURL('test');
        console.log('Test QR generato:', testQR.substring(0, 100));
      } catch (qrError) {
        console.error('Errore test QR:', qrError);
      }

      // Dati QR semplificati
      const qrData = JSON.stringify({
        code: ticketCode,
        event: event.id
      });

      console.log('Dati QR:', qrData);

      // Genera QR
      let qrCodeUrl;
      try {
        qrCodeUrl = await QRCode.toDataURL(qrData, {
          width: 200,
          height: 200,
          margin: 0,
          errorCorrectionLevel: 'L',
          type: 'image/png',
          quality: 0.8,
        });
        console.log('QR generato:', qrCodeUrl.substring(0, 100));

        // Test validità URL
        const img = new Image();
        img.onload = () => console.log('QR URL valido');
        img.onerror = () => console.error('QR URL non valido');
        img.src = qrCodeUrl;
      } catch (qrError) {
        console.error('Errore generazione QR:', qrError);
        throw new Error('Errore nella generazione del QR code');
      }

      // Salva vendita
      const saleData = {
        eventId: event.id,
        eventName: event.name,
        quantity,
        totalPrice,
        customerEmail,
        ticketCode,
        date: new Date().toISOString(),
        promoterId: currentUser.uid,
        status: 'active',
        used: false,
        qrCode: qrCodeUrl // Salviamo il QR nel database per riferimento
      };

      await addDoc(collection(db, 'sales'), saleData);
      await updateDoc(doc(db, 'events', event.id), {
        availableTickets: event.availableTickets - quantity
      });

      // Prepara email con QR inline
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Biglietto per ${event.name}</h2>
          <p><strong>Codice:</strong> ${ticketCode}</p>
          <p><strong>Data:</strong> ${new Date(event.date).toLocaleDateString()}</p>
          <p><strong>Luogo:</strong> ${event.location}</p>
          <p><strong>Quantità:</strong> ${quantity}</p>
          <p><strong>Prezzo:</strong> €${totalPrice.toFixed(2)}</p>
          <div style="text-align: center; margin: 20px 0;">
            <img src="${qrCodeUrl}" alt="QR Code" style="width: 200px; height: 200px;">
          </div>
        </div>
      `;

      // Invia email
      try {
        console.log('Invio email...');
        const response = await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email: customerEmail,
            from_name: "Sistema Biglietti",
            content: emailHtml,
            ticket_code: ticketCode
          }
        );

        console.log('Risposta email:', response);

        if (response.status === 200) {
          onSold();
          onClose();
        }
      } catch (emailError) {
        console.error('Errore email:', emailError);
        setError('Biglietto creato. Email non inviata. Codice: ' + ticketCode);
      }

    } catch (error) {
      console.error('Errore generale:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-content sell-ticket-modal">
        <div className="modal-header">
          <h3><FaTicketAlt /> Vendi Biglietti</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="event-info">
          <h4>{event.name}</h4>
          <p>Prezzo: €{event.price}</p>
          <p>Biglietti disponibili: {event.availableTickets}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Quantità:</label>
            <input
              type="number"
              min="1"
              max={event.availableTickets}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              required
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Email Cliente:</label>
            <div className="input-with-icon">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="form-control"
                placeholder="email@esempio.com"
              />
            </div>
          </div>

          <div className="price-summary">
            <div>Totale da pagare:</div>
            <div className="total-price">€{totalPrice}</div>
          </div>

          <div className="modal-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Elaborazione...' : 'Conferma Vendita'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SellTicketModal; 