import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'qrcode.react';
import { notifyTeamLeader } from '../../services/NotificationService';

function PromoterDashboard() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [customerEmail, setCustomerEmail] = useState('');
  const [error, setError] = useState('');
  const [showTicket, setShowTicket] = useState(null);

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  async function fetchData() {
    try {
      // Recupera eventi disponibili
      const eventsQuery = query(
        collection(db, 'events'),
        where('status', '==', 'active')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);

      // Recupera vendite del promoter
      const salesQuery = query(
        collection(db, 'sales'),
        where('promoterId', '==', currentUser.uid)
      );
      const salesSnapshot = await getDocs(salesQuery);
      const salesData = salesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSales(salesData);

      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero dei dati:', error);
      setLoading(false);
    }
  }

  async function handleSale(e) {
    e.preventDefault();
    if (!selectedEvent) {
      setError('Seleziona un evento');
      return;
    }

    try {
      const event = events.find(e => e.id === selectedEvent);
      if (event.availableTickets < ticketQuantity) {
        setError('Non ci sono abbastanza biglietti disponibili');
        return;
      }

      // Crea la vendita
      const saleData = {
        eventId: selectedEvent,
        promoterId: currentUser.uid,
        customerEmail,
        quantity: ticketQuantity,
        totalPrice: event.price * ticketQuantity,
        date: new Date().toISOString(),
        status: 'completed',
        ticketCode: Math.random().toString(36).substr(2, 9).toUpperCase()
      };

      const saleRef = await addDoc(collection(db, 'sales'), saleData);

      // Aggiorna i biglietti disponibili
      const eventRef = doc(db, 'events', selectedEvent);
      await updateDoc(eventRef, {
        availableTickets: event.availableTickets - ticketQuantity
      });

      // Mostra il biglietto
      setShowTicket({
        ...saleData,
        eventName: event.name,
        eventDate: event.date,
        eventLocation: event.location
      });

      // Reset form
      setSelectedEvent(null);
      setTicketQuantity(1);
      setCustomerEmail('');
      setError('');

      // Aggiorna i dati
      fetchData();

      // Invia notifica al team leader
      await notifyTeamLeader(event.createdBy,
        'Nuova vendita effettuata',
        `Il promoter ${currentUser.email} ha venduto ${ticketQuantity} biglietti per l'evento ${event.name}`
      );
    } catch (error) {
      setError('Errore durante la vendita: ' + error.message);
    }
  }

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div>
      <h2>Dashboard Promoter</h2>

      {/* Form Vendita Biglietti */}
      <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>Vendi Biglietti</h3>
        {error && <div style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
        <form onSubmit={handleSale}>
          <div style={{ marginBottom: '15px' }}>
            <label>Evento:</label>
            <select
              value={selectedEvent || ''}
              onChange={(e) => setSelectedEvent(e.target.value)}
              required
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">Seleziona un evento</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} - €{event.price} ({event.availableTickets} disponibili)
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Quantità:</label>
            <input
              type="number"
              min="1"
              value={ticketQuantity}
              onChange={(e) => setTicketQuantity(Number(e.target.value))}
              required
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Email Cliente:</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Vendi Biglietti
          </button>
        </form>
      </div>

      {/* Biglietto Generato */}
      {showTicket && (
        <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center' }}>
          <h3>Biglietto Generato</h3>
          <div style={{ marginBottom: '15px' }}>
            <p><strong>Evento:</strong> {showTicket.eventName}</p>
            <p><strong>Data:</strong> {new Date(showTicket.eventDate).toLocaleDateString()}</p>
            <p><strong>Luogo:</strong> {showTicket.eventLocation}</p>
            <p><strong>Quantità:</strong> {showTicket.quantity}</p>
            <p><strong>Codice:</strong> {showTicket.ticketCode}</p>
          </div>
          <QRCode value={showTicket.ticketCode} size={200} />
          <button
            onClick={() => setShowTicket(null)}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Chiudi
          </button>
        </div>
      )}

      {/* Storico Vendite */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Le Mie Vendite</h3>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {sales.map(sale => (
            <div key={sale.id} style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <p><strong>Codice:</strong> {sale.ticketCode}</p>
              <p><strong>Cliente:</strong> {sale.customerEmail}</p>
              <p><strong>Quantità:</strong> {sale.quantity}</p>
              <p><strong>Totale:</strong> €{sale.totalPrice}</p>
              <p><strong>Data:</strong> {new Date(sale.date).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PromoterDashboard; 