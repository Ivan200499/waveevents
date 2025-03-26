import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../common/Header';
import SellTicketModal from '../tickets/SellTicketModal';
import TicketHistory from '../tickets/TicketHistory';
import PromoterStats from './PromoterStats';
import { FaTicketAlt, FaEuroSign, FaUsers, FaCalendarAlt, FaMapMarkerAlt } from 'react-icons/fa';
import './TeamLeaderDashboard.css';

function TeamLeaderDashboard() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageTicketPrice: 0,
    promoterSales: 0
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [promoters, setPromoters] = useState([]);
  const [selectedPromoter, setSelectedPromoter] = useState(null);

  useEffect(() => {
    fetchEvents();
    fetchStats();
    fetchPromoters();
  }, []);

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef, orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const eventsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setEvents(eventsData);
    } catch (error) {
      console.error('Errore nel caricamento degli eventi:', error);
      setError('Errore nel caricamento degli eventi');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Recupera le vendite del team leader
      const ticketsRef = collection(db, 'tickets');
      const teamLeaderQuery = query(
        ticketsRef,
        where('sellerId', '==', currentUser.uid)
      );
      
      const teamLeaderSnapshot = await getDocs(teamLeaderQuery);
      let totalSales = 0;
      let totalRevenue = 0;
      
      teamLeaderSnapshot.forEach(doc => {
        const ticket = doc.data();
        totalSales += ticket.quantity;
        totalRevenue += ticket.totalPrice;
      });

      // Recupera le vendite dei promoter sotto il team leader
      const promoterQuery = query(
        ticketsRef,
        where('sellerRole', '==', 'promoter'),
        where('teamLeaderId', '==', currentUser.uid)
      );
      
      const promoterSnapshot = await getDocs(promoterQuery);
      let promoterSales = 0;
      
      promoterSnapshot.forEach(doc => {
        const ticket = doc.data();
        promoterSales += ticket.quantity || 0;
      });
      
      setStats({
        totalSales,
        totalRevenue,
        averageTicketPrice: totalSales > 0 ? totalRevenue / totalSales : 0,
        promoterSales
      });
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche:', error);
    }
  };

  const fetchPromoters = async () => {
    try {
      const promotersRef = collection(db, 'users');
      const q = query(
        promotersRef,
        where('teamLeaderId', '==', currentUser.uid),
        where('role', '==', 'promoter')
      );
      const querySnapshot = await getDocs(q);
      
      const promotersData = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const promoterData = doc.data();
        
        // Recupera le statistiche del promoter
        const ticketsRef = collection(db, 'tickets');
        const promoterTicketsQuery = query(
          ticketsRef,
          where('sellerId', '==', doc.id)
        );
        
        const ticketsSnapshot = await getDocs(promoterTicketsQuery);
        let totalSales = 0;
        let totalRevenue = 0;
        
        ticketsSnapshot.forEach(ticketDoc => {
          const ticket = ticketDoc.data();
          totalSales += ticket.quantity || 0;
          totalRevenue += ticket.totalPrice || 0;
        });

        return {
          id: doc.id,
          ...promoterData,
          totalSales,
          totalRevenue
        };
      }));
      
      setPromoters(promotersData);
    } catch (error) {
      console.error('Errore nel caricamento dei promoter:', error);
    }
  };

  const handleSellTicket = (event) => {
    setSelectedEvent(event);
    setShowSellModal(true);
  };

  const handleTicketSold = () => {
    fetchEvents();
    fetchStats();
    setShowSellModal(false);
  };

  const handlePromoterClick = (promoter) => {
    setSelectedPromoter(promoter);
  };

  const handleClosePromoterStats = () => {
    setSelectedPromoter(null);
  };

  if (loading) return <div className="loading">Caricamento...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="team-leader-dashboard">
      <Header />
      <div className="dashboard-header">
        <h1 className="header-title">Dashboard Team Leader</h1>
        <p className="header-subtitle">Gestisci il tuo team e monitora le vendite</p>
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
        <button
          className={`tab-button ${activeTab === 'promoters' ? 'active' : ''}`}
          onClick={() => setActiveTab('promoters')}
        >
          I Miei Promoter
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="dashboard-content">
          <div className="stats-overview">
            <div className="stat-card">
              <h3>Le Mie Vendite</h3>
              <p>{stats.totalSales}</p>
            </div>
            <div className="stat-card">
              <h3>I Miei Ricavi</h3>
              <p>€{stats.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h3>Prezzo Medio Biglietto</h3>
              <p>€{stats.averageTicketPrice.toFixed(2)}</p>
            </div>
            <div className="stat-card">
              <h3>Vendite Promoter</h3>
              <p>{stats.promoterSales}</p>
            </div>
          </div>

          <TicketHistory />
        </div>
      )}

      {activeTab === 'sell' && (
        <div className="events-section">
          <h2>Eventi Disponibili</h2>
          <div className="events-grid">
            {events.map(event => (
              <div key={event.id} className="event-card">
                {event.imageUrl && (
                  <div className="event-image">
                    <img src={event.imageUrl} alt={event.name} />
                  </div>
                )}
                <div className="event-content">
                  <h3>{event.name}</h3>
                  <p>
                    <FaCalendarAlt />
                    {new Date(event.date).toLocaleDateString()}
                  </p>
                  <p>
                    <FaMapMarkerAlt />
                    {event.location}
                  </p>
                  <div className="event-price">€{event.ticketPrice}</div>
                  <div className={`tickets-available ${event.availableTickets === 0 ? 'tickets-unavailable' : ''}`}>
                    {event.availableTickets === 0 && 'Esaurito'}
                  </div>
                  {event.description && (
                    <div className="event-description">
                      <p>{event.description}</p>
                    </div>
                  )}
                  <button 
                    onClick={() => handleSellTicket(event)}
                    className="sell-button"
                    disabled={event.availableTickets === 0}
                  >
                    Vendi Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'promoters' && (
        <div className="promoters-section">
          <h2>I Miei Promoter</h2>
          <div className="promoters-grid">
            {promoters.map(promoter => (
              <div 
                key={promoter.id} 
                className="promoter-card"
                onClick={() => handlePromoterClick(promoter)}
              >
                <div className="promoter-header">
                  <div className="avatar-circle">
                    {promoter.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="promoter-info">
                    <h3>{promoter.name}</h3>
                    <p>{promoter.email}</p>
                  </div>
                </div>
                <div className="promoter-stats">
                  <div className="stat-item">
                    <div className="stat-label">Vendite Totali</div>
                    <div className="stat-value">{promoter.totalSales}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Ricavi Totali</div>
                    <div className="stat-value">€{promoter.totalRevenue.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSellModal && (
        <SellTicketModal
          event={selectedEvent}
          onClose={() => setShowSellModal(false)}
          onSold={handleTicketSold}
        />
      )}

      {selectedPromoter && (
        <PromoterStats
          promoter={selectedPromoter}
          onClose={handleClosePromoterStats}
        />
      )}
    </div>
  );
}

export default TeamLeaderDashboard; 