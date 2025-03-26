import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { FaCalendarAlt, FaChartLine, FaTicketAlt, FaHistory, FaEuroSign, FaUsers, FaQrcode } from 'react-icons/fa';
import './PromoterDashboard.css';
import SellTicketModal from '../tickets/SellTicketModal';

console.log("SONO IL PROMOTER DASHBOARD IN /dashboard");

function SalesSummaryCard({ salesData }) {
  return (
    <div className="stat-card">
      <div className="stat-content">
        <div className="stats-header">
          <h2>Riepilogo Vendite</h2>
        </div>

        <div className="stats-summary">
          <div className="summary-stat">
            <FaTicketAlt className="stat-icon" />
            <div className="stat-info">
              <h3>Biglietti Venduti</h3>
              <p className="stat-value">{salesData.totalTickets || 0}</p>
            </div>
          </div>

          <div className="summary-stat">
            <FaEuroSign className="stat-icon" />
            <div className="stat-info">
              <h3>Incasso Totale</h3>
              <p className="stat-value">€{(salesData.totalRevenue || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, onSell }) {
  return (
    <div className="card event-card">
      <div className="card-header">
        <h4>{event.name}</h4>
        <div className="event-status">
          <span className={`badge ${event.availableTickets > 0 ? 'badge-success' : 'badge-danger'}`}>
            {event.availableTickets} biglietti disponibili
          </span>
        </div>
      </div>

      <div className="event-details">
        <div className="detail-item">
          <FaEuroSign className="icon" />
          <span>{event.price} €</span>
        </div>
        <div className="detail-item">
          <FaTicketAlt className="icon" />
          <span>{event.location}</span>
        </div>
        {event.description && (
          <div className="event-description">
            <p>{event.description}</p>
          </div>
        )}
        {event.isRecurring && event.dates && event.dates.length > 0 && (
          <div className="event-dates">
            <h5>Date disponibili:</h5>
            <div className="dates-list">
              {event.dates.map((date, index) => (
                <div key={index} className="date-item">
                  <FaCalendarAlt className="icon" />
                  <span>{new Date(date).toLocaleDateString()}</span>
                  <span className={`tickets-badge ${date.availableTickets > 0 ? 'available' : 'unavailable'}`}>
                    {date.availableTickets} biglietti
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!event.isRecurring && (
          <div className="detail-item">
            <FaCalendarAlt className="icon" />
            <span>{new Date(event.date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <button 
        className="btn btn-primary sell-button"
        onClick={() => onSell(event)}
        disabled={event.availableTickets <= 0}
      >
        {event.availableTickets > 0 ? 'Vendi Biglietti' : 'Esaurito'}
      </button>
    </div>
  );
}

function SalesHistoryCard({ sale }) {
  return (
    <div className="card sale-card">
      <div className="sale-header">
        <h4>{sale.eventName}</h4>
        <span className="sale-date">{new Date(sale.date).toLocaleDateString()}</span>
      </div>
      <div className="sale-details">
        <div className="sale-info">
          <FaTicketAlt className="icon" />
          <span>{sale.quantity} biglietti</span>
        </div>
        <div className="sale-info">
          <FaEuroSign className="icon" />
          <span>{sale.totalPrice} €</span>
        </div>
        <div className="sale-info">
          <FaQrcode className="icon" />
          <span>Codice: {sale.ticketCode}</span>
        </div>
        <div className="sale-customer">
          <small>Cliente: {sale.customerEmail}</small>
        </div>
      </div>
    </div>
  );
}

function PromoterDashboard() {
  const { currentUser } = useAuth();
  const [salesData, setSalesData] = useState({
    totalSales: 0,
    totalRevenue: 0,
    salesByEvent: {},
    monthlySales: {}
  });
  const [events, setEvents] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  async function fetchData() {
    try {
      // Recupera eventi disponibili
      await fetchEvents();

      // Recupera vendite del promoter
      const salesQuery = query(
        collection(db, 'sales'),
        where('promoterId', '==', currentUser.uid)
      );
      const salesSnapshot = await getDocs(salesQuery);
      
      let total = 0;
      let revenue = 0;
      const byEvent = {};
      const byMonth = {};
      const sales = [];

      salesSnapshot.docs.forEach(doc => {
        const sale = { id: doc.id, ...doc.data() };
        sales.push(sale);
        total += sale.quantity;
        revenue += sale.totalPrice;
        
        byEvent[sale.eventId] = (byEvent[sale.eventId] || 0) + sale.quantity;
        
        const month = new Date(sale.date).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        byMonth[month] = (byMonth[month] || 0) + sale.quantity;
      });

      setSalesData({
        totalSales: total,
        totalRevenue: revenue,
        salesByEvent: byEvent,
        monthlySales: byMonth
      });

      // Ordina le vendite per data e prendi le ultime 5
      setRecentSales(
        sales.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
      );

    } catch (error) {
      console.error('Errore nel recupero dei dati:', error);
      setError('Si è verificato un errore durante il recupero dei dati. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvents() {
    setLoading(true);
    setError('');
    
    try {
      // Ottieni tutti gli eventi attivi
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      
      const eventsData = [];
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Reset time per confrontare solo le date
      
      // Filtra gli eventi per mostrare solo quelli futuri
      querySnapshot.forEach((doc) => {
        const eventData = { id: doc.id, ...doc.data() };
        
        // Console.log per debug
        console.log(`Evento ${eventData.name}:`, eventData);
        
        if (eventData.isRecurring && eventData.dates && Array.isArray(eventData.dates) && eventData.dates.length > 0) {
          // Verifica e filtra le date valide
          const validDates = eventData.dates.filter(date => {
            // Controlli di sicurezza
            if (!date || !date.date) {
              console.log(`Data invalida in ${eventData.name}:`, date);
              return false;
            }
            
            try {
              const eventDate = new Date(date.date);
              if (isNaN(eventDate.getTime())) {
                console.log(`Data non parsabile in ${eventData.name}:`, date.date);
                return false;
              }
              
              eventDate.setHours(0, 0, 0, 0);
              return eventDate >= now;
            } catch (error) {
              console.error(`Errore nel parsing della data in ${eventData.name}:`, error);
              return false;
            }
          });
          
          console.log(`Date valide per ${eventData.name}:`, validDates);
          
          if (validDates.length > 0) {
            // Ordina le date future in ordine cronologico
            validDates.sort((a, b) => {
              const dateA = new Date(a.date);
              const dateB = new Date(b.date);
              return dateA - dateB;
            });
            
            // Calcola i biglietti disponibili totali
            const totalAvailableTickets = validDates.reduce((sum, date) => sum + (date.availableTickets || 0), 0);
            
            // Aggiorna l'evento con le date filtrate e la prima data futura
            const nextDate = validDates[0];
            eventsData.push({
              ...eventData,
              dates: validDates,
              date: nextDate.date, // Usa la prima data futura per la visualizzazione
              availableTickets: totalAvailableTickets
            });
          }
        } else {
          // Per eventi singoli, verifica se la data è futura
          try {
            const eventDate = new Date(eventData.date);
            if (!isNaN(eventDate.getTime())) {
              eventDate.setHours(0, 0, 0, 0);
              
              if (eventDate >= now && (eventData.availableTickets > 0 || (eventData.ticketTypes && eventData.ticketTypes.some(t => t.totalTickets > 0)))) {
                eventsData.push(eventData);
              }
            } else {
              console.log(`Data non valida per evento singolo ${eventData.name}:`, eventData.date);
            }
          } catch (error) {
            console.error(`Errore nel parsing della data dell'evento ${eventData.name}:`, error);
          }
        }
      });
      
      // Ordina gli eventi per data (prossimi per primi)
      eventsData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA - dateB;
      });
      
      console.log("Eventi filtrati e ordinati:", eventsData);
      
      setEvents(eventsData);
    } catch (error) {
      console.error('Errore nel recupero degli eventi:', error);
      setError('Si è verificato un errore durante il recupero degli eventi. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Statistiche di {currentUser?.name || 'Promoter'}</h2>
        <div className="stats-filters">
          <input 
            type="text" 
            placeholder="Cerca evento..." 
            className="search-input"
          />
          <input 
            type="date" 
            className="date-input"
          />
        </div>
      </div>

      <div className="stats-overview">
        <div className="stat-box">
          <FaTicketAlt className="stat-icon" />
          <div className="stat-info">
            <div className="stat-value">{salesData.totalSales || 0} biglietti</div>
          </div>
        </div>
        <div className="stat-box">
          <FaEuroSign className="stat-icon" />
          <div className="stat-info">
            <div className="stat-value">€ {(salesData.totalRevenue || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <section className="dashboard-section">
        <h3><FaCalendarAlt /> Eventi Disponibili</h3>
        <div className="grid">
          {events.map(event => (
            <EventCard 
              key={event.id} 
              event={event}
              onSell={(event) => setSelectedEvent(event)}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <h3><FaHistory /> Ultime Vendite</h3>
        <div className="grid">
          {recentSales.map(sale => (
            <SalesHistoryCard key={sale.id} sale={sale} />
          ))}
        </div>
      </section>

      {selectedEvent && (
        <SellTicketModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSold={() => {
            fetchData();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}

export default PromoterDashboard; 