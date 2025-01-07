import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../common/Header';
import TicketHistory from '../tickets/TicketHistory';
import SellTicketModal from '../tickets/SellTicketModal';

function PromoterDashboard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalTickets: 0,
    totalRevenue: 0
  });
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' o 'sell'
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchEvents();
  }, [currentUser]);

  async function fetchStats() {
    try {
      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('sellerId', '==', currentUser.uid)
      );
      
      const ticketsSnapshot = await getDocs(ticketsQuery);
      
      const statistics = ticketsSnapshot.docs.reduce((acc, doc) => {
        const ticket = doc.data();
        return {
          totalTickets: acc.totalTickets + (ticket.quantity || 0),
          totalRevenue: acc.totalRevenue + ((ticket.price || 0) * (ticket.quantity || 0))
        };
      }, { totalTickets: 0, totalRevenue: 0 });
      
      setStats(statistics);
    } catch (error) {
      console.error('Errore nel recupero delle statistiche:', error);
    }
  }

  async function fetchEvents() {
    try {
      const eventsRef = collection(db, 'events');
      const snapshot = await getDocs(eventsRef);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
    } catch (error) {
      console.error('Errore nel recupero degli eventi:', error);
    }
  }

  return (
    <div className="dashboard-container">
      <Header />
      <div className="tabs-container">
        <button 
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`tab-button ${activeTab === 'sell' ? 'active' : ''}`}
          onClick={() => setActiveTab('sell')}
        >
          Vendi Biglietti
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="dashboard-content">
          <div className="stats-container">
            <div className="stat-card">
              <h3>Totale Biglietti Venduti</h3>
              <p>{stats.totalTickets}</p>
            </div>
            <div className="stat-card">
              <h3>Incasso Totale</h3>
              <p>€{stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
          <TicketHistory />
        </div>
      ) : (
        <div className="sell-tickets-content">
          <h2>Seleziona un Evento</h2>
          <div className="events-grid">
            {events.map(event => (
              <div key={event.id} className="event-card">
                <h3>{event.name}</h3>
                <p>Data: {new Date(event.date).toLocaleDateString()}</p>
                <p>Luogo: {event.location}</p>
                <p>Prezzo: €{event.price}</p>
                <p>Biglietti disponibili: {event.availableTickets}</p>
                <button 
                  className="sell-button"
                  onClick={() => setSelectedEvent(event)}
                  disabled={event.availableTickets <= 0}
                >
                  {event.availableTickets > 0 ? 'Vendi Biglietti' : 'Esaurito'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedEvent && (
        <SellTicketModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSold={() => {
            fetchStats();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

export default PromoterDashboard; 