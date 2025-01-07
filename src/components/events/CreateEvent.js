import { useState } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import './CreateEvent.css';

function CreateEvent({ onEventCreated }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [totalTickets, setTotalTickets] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Crea l'evento nel database
      const eventData = {
        name,
        date,
        location,
        totalTickets: parseInt(totalTickets),
        availableTickets: parseInt(totalTickets),
        ticketPrice: parseFloat(ticketPrice),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'events'), eventData);

      // Reset form
      setName('');
      setDate('');
      setLocation('');
      setTotalTickets('');
      setTicketPrice('');
      
      // Notifica il componente padre
      onEventCreated();

    } catch (error) {
      console.error('Errore nella creazione dell\'evento:', error);
      setError('Errore nella creazione dell\'evento: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-event-container">
      <h2>Crea Nuovo Evento</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nome Evento:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Data:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Luogo:</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Numero Totale Biglietti:</label>
          <input
            type="number"
            value={totalTickets}
            onChange={(e) => setTotalTickets(e.target.value)}
            required
            min="1"
          />
        </div>

        <div className="form-group">
          <label>Prezzo Biglietto (€):</label>
          <input
            type="number"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(e.target.value)}
            required
            min="0"
            step="0.01"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Creazione in corso...' : 'Crea Evento'}
        </button>
      </form>
    </div>
  );
}

export default CreateEvent;