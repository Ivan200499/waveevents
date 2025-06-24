import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../common/Header';
import SellTicketModal from '../tickets/SellTicketModal';
import TicketHistory from '../tickets/TicketHistory';
import PromoterStats from './PromoterStats';
import PromoterReports from './PromoterReports';
import EventCard from '../promoter/EventCard';
import { FaTicketAlt, FaEuroSign, FaUsers, FaCalendarAlt, FaMapMarkerAlt, FaChartBar } from 'react-icons/fa';
import './TeamLeaderDashboard.css';

function TeamLeaderDashboard() {
  console.log('==================== TEAM LEADER DASHBOARD ====================');
  const { currentUser } = useAuth();
  console.log('Current User:', currentUser);

  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDateItem, setSelectedDateItem] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalCommissions: 0,
    promoterSales: 0,
    promoterCommissions: 0
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [promoters, setPromoters] = useState([]);
  const [selectedPromoter, setSelectedPromoter] = useState(null);

  console.log('Initial State:', {
    loading,
    error,
    activeTab,
    stats
  });

  useEffect(() => {
    console.log('useEffect triggered - checking currentUser');
    if (!currentUser) {
      console.log('No current user found - showing error');
      setError('Devi effettuare il login come Team Leader per accedere a questa pagina.');
      setLoading(false);
      return;
    }

    console.log('Starting data fetch for user:', currentUser.email);
    setLoading(true);
    Promise.all([
      fetchEvents(), 
      fetchStats(), 
      fetchPromoters()
    ]).catch(error => {
        console.error("Errore caricamento dati Team Leader:", error);
        setError('Errore nel caricamento dei dati.');
    }).finally(() => {
        console.log('Data fetch completed');
        setLoading(false);
    });
  }, [currentUser]);

  const fetchEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef);
      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(event => event.eventDates && event.eventDates.length > 0);
      
      setEvents(eventsData);
    } catch (error) {
      console.error('Errore nel caricamento degli eventi:', error);
      setError('Errore nel caricamento degli eventi');
      throw error;
    }
  };

  const fetchStats = async () => {
    try {
      const leaderTicketsQuery = query(
        collection(db, 'tickets'),
        where('sellerId', '==', currentUser.uid)
      );
      const leaderSnapshot = await getDocs(leaderTicketsQuery);
      let leaderSales = 0;
      let leaderCommissions = 0;
      leaderSnapshot.forEach(doc => {
        const ticket = doc.data();
        leaderSales += ticket.quantity || 0;
        leaderCommissions += ticket.commissionAmount || 0;
      });

      const promotersSnapshot = await getDocs(query(collection(db, 'users'), where('teamLeaderId', '==', currentUser.uid), where('role', '==', 'promoter')));
      const promoterIds = promotersSnapshot.docs.map(doc => doc.id);

      let teamSales = 0;
      let teamCommissionsFromPromoters = 0;
      let indirectCommissionsForTL = 0;

      if (promoterIds.length > 0) {
        const teamTicketsQuery = query(
          collection(db, 'tickets'),
          where('sellerId', 'in', promoterIds)
        );
        const teamSnapshot = await getDocs(teamTicketsQuery);
        teamSnapshot.forEach(doc => {
          const ticket = doc.data();
          teamSales += ticket.quantity || 0;
          teamCommissionsFromPromoters += ticket.commissionAmount || 0;

          indirectCommissionsForTL += ticket.commissionAmount || 0;
        });
      }

      setStats({
        totalSales: leaderSales + teamSales,
        totalCommissions: leaderCommissions + indirectCommissionsForTL,
        promoterSales: teamSales,
        promoterCommissions: teamCommissionsFromPromoters
      });
    } catch (error) {
      console.error('Errore nel recupero delle statistiche TL:', error);
      setError('Errore nel calcolo delle statistiche.');
      throw error;
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
        
        const ticketsRef = collection(db, 'tickets');
        const promoterTicketsQuery = query(
          ticketsRef,
          where('sellerId', '==', doc.id)
        );
        
        const ticketsSnapshot = await getDocs(promoterTicketsQuery);
        let totalSales = 0;
        let totalCommissions = 0;
        
        ticketsSnapshot.forEach(ticketDoc => {
          const ticket = ticketDoc.data();
          totalSales += ticket.quantity || 0;
          totalCommissions += ticket.commissionAmount || 0;
        });

        return {
          id: doc.id,
          uid: doc.id,
          ...promoterData,
          totalSales,
          totalCommissions
        };
      }));
      
      setPromoters(promotersData);
    } catch (error) {
      console.error('Errore nel caricamento dei promoter:', error);
      setError("Errore caricamento promoter.");
      throw error;
    }
  };

  const handleSellTicket = (event, dateItem) => {
    if (!event || !dateItem) {
        console.error("Tentativo di vendita senza evento o data valida", event, dateItem);
        setError("Errore interno: evento o data non validi per la vendita.");
        return;
    }
    setSelectedEvent(event);
    setSelectedDateItem(dateItem);
  };

  const handleModalClose = () => {
    setSelectedEvent(null);
    setSelectedDateItem(null);
  };

  const handleTicketSold = () => {
    fetchStats();
    handleModalClose();
  };

  const handlePromoterClick = (promoter) => {
    setSelectedPromoter(promoter);
  };

  const handleClosePromoterStats = () => {
    setSelectedPromoter(null);
  };

  if (loading) return <div className="loading-container"><div className="loading-spinner"></div>Caricamento dashboard...</div>;
  if (error) return <div className="error-message">{error}</div>;

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
        <button
          className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Report Promoter
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Storico Vendite
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-overview">
            <div className="stats-overview">
              <div className="stat-card">
                <FaTicketAlt />
                <div>
                  <h3>Biglietti Totali (Team)</h3>
                  <p>{stats.totalSales}</p>
                </div>
              </div>
              <div className="stat-card">
                <FaEuroSign />
                <div>
                  <h3>Commissioni Totali (Team)</h3>
                  <p>€ {stats.totalCommissions.toFixed(2)}</p>
                </div>
              </div>
              <div className="stat-card">
                <FaUsers />
                <div>
                  <h3>Promoter Attivi</h3>
                  <p>{promoters.length}</p>
                </div>
              </div>
              <div className="stat-card">
                <FaChartBar />
                <div>
                  <h3>Vendite Promoter</h3>
                  <p>{stats.promoterSales}</p>
                </div>
              </div>
            </div>

            <div className="events-section">
              <h2>Eventi Disponibili</h2>
              <div className="events-grid">
                {events.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSellTicket={handleSellTicket}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sell' && (
          <div className="sell-section">
            <div className="events-grid">
              {events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onSellTicket={handleSellTicket}
                />
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
                  <h3>{promoter.name}</h3>
                  <p>{promoter.email}</p>
                  <div className="promoter-stats">
                    <div className="stat">
                      <FaTicketAlt />
                      <span>{promoter.totalSales} Biglietti</span>
                    </div>
                    <div className="stat">
                      <FaEuroSign />
                      <span>€ {promoter.totalCommissions.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reports' && currentUser && (
          <PromoterReports teamLeaderId={currentUser.uid} />
        )}

        {activeTab === 'history' && (
          <TicketHistory />
        )}
      </div>

      {selectedEvent && selectedDateItem && (
        <SellTicketModal
          event={selectedEvent}
          dateItem={selectedDateItem}
          onClose={handleModalClose}
          onTicketSold={handleTicketSold}
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