import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import './TicketHistory.css';

function TicketHistory() {
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalTickets: 0,
    validatedTickets: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    async function fetchTickets() {
      try {
        const ticketsQuery = query(
          collection(db, 'tickets'),
          where('sellerId', '==', currentUser.uid)
        );

        const querySnapshot = await getDocs(ticketsQuery);
        const ticketsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Ordina i biglietti per data di creazione (dal più recente)
        ticketsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Calcola le statistiche corrette
        const statistics = ticketsList.reduce((acc, ticket) => ({
          totalTickets: acc.totalTickets + (ticket.quantity || 0),
          validatedTickets: acc.validatedTickets + (ticket.validatedAt ? ticket.quantity : 0),
          totalRevenue: acc.totalRevenue + ((ticket.price || 0) * (ticket.quantity || 0))
        }), {
          totalTickets: 0,
          validatedTickets: 0,
          totalRevenue: 0
        });

        setStats(statistics);
        setTickets(ticketsList);
      } catch (err) {
        console.error('Errore nel recupero dei biglietti:', err);
        setError('Errore nel caricamento dello storico biglietti');
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [currentUser]);

  if (loading) return <div>Caricamento storico biglietti...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="ticket-history-container">
      <h2>Storico Biglietti Venduti</h2>
      
      <div className="tickets-summary">
        <div className="summary-card">
          <h3>Totale Biglietti</h3>
          <p>{stats.totalTickets}</p>
        </div>
        <div className="summary-card">
          <h3>Biglietti Validati</h3>
          <p>{stats.validatedTickets}</p>
        </div>
        <div className="summary-card">
          <h3>Incasso Totale</h3>
          <p>€{stats.totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="tickets-list">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Codice</th>
              <th>Evento</th>
              <th>Cliente</th>
              <th>Quantità</th>
              <th>Prezzo Unitario</th>
              <th>Totale</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => (
              <tr key={ticket.id}>
                <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                <td>{ticket.ticketCode}</td>
                <td>{ticket.eventName}</td>
                <td>{ticket.customerEmail}</td>
                <td>{ticket.quantity}</td>
                <td>€{ticket.price?.toFixed(2) || '0.00'}</td>
                <td>€{((ticket.price || 0) * (ticket.quantity || 0)).toFixed(2)}</td>
                <td>
                  <span className={`status ${ticket.status}`}>
                    {ticket.validatedAt ? 'Validato' : ticket.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TicketHistory; 