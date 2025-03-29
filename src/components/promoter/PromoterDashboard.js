import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../common/Header';
import TicketHistory from '../tickets/TicketHistory';
import SellTicketModal from '../tickets/SellTicketModal';
import { FaTicketAlt, FaEuroSign, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaShoppingCart } from 'react-icons/fa';
import './PromoterDashboard.css';

function PromoterDashboard() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalTickets: 0,
    totalRevenue: 0
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero delle statistiche:', error);
      setLoading(false);
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Caricamento dashboard...</p>
      </div>
    );
  }

  return (
    <div className="promoter-dashboard">
      <Header />
      <div className="dashboard-header">
        <h1 className="header-title">Dashboard Promoter</h1>
        <p className="header-subtitle">Gestisci i tuoi eventi e monitora le vendite</p>
      </div>

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
          <div className="stats-overview">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <FaTicketAlt />
                </div>
                <div className="stat-info">
                  <h3>Biglietti Venduti</h3>
                  <div className="value">{stats.totalTickets}</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <FaEuroSign />
                </div>
                <div className="stat-info">
                  <h3>Ricavo Totale</h3>
                  <div className="value">€{stats.totalRevenue.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          <TicketHistory />
        </div>
      ) : (
        <div className="sell-tickets-container">
          <h2>Seleziona un Evento</h2>
          <div className="events-grid grid">
            {events.map((event) => (
              <div key={event.id} className="card">
                <div className="card-image" style={{ backgroundImage: `url(${event.imageUrl})` }} />
                <div className="card-content">
                  <h3 className="card-title">{event.name}</h3>
                  <div className="card-text">
                    <div className="event-date">
                      <FaCalendarAlt />
                      <span>{formatDate(event.date)}</span>
                    </div>
                    <div className="event-location">
                      <FaMapMarkerAlt />
                      <span>{event.location}</span>
                    </div>
                    <div className={`tickets-info ${event.availableTickets === 0 ? 'text-secondary' : ''}`}>
                      <FaTicketAlt className="ticket-icon" />
                      {event.availableTickets > 0 && (
                        <span>Disponibili: {event.availableTickets}</span>
                      )}
                    </div>
                  </div>
                  <div className="card-footer">
                    <button
                      className={`action-button ${event.availableTickets === 0 ? 'disabled' : ''}`}
                      onClick={() => handleSellTicket(event)}
                      disabled={event.availableTickets === 0}
                    >
                      <FaShoppingCart />
                      <span>Vendi Biglietto</span>
                    </button>
                  </div>
                </div>
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