import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { FaUser, FaTicketAlt, FaEuroSign, FaQrcode, FaUsers, FaCalendarAlt, FaMapMarkerAlt, FaSearch, FaCogs, FaBullhorn } from 'react-icons/fa';
import Header from '../common/Header';
import TicketValidator from '../tickets/TicketValidator';
import './ManagerDashboard.css';
import TeamLeaderStats from '../statistics/TeamLeaderStats';
import SellTicketModal from '../tickets/SellTicketModal';
import TicketHistory from '../tickets/TicketHistory';
import EventCard from '../promoter/EventCard';
import { 
  getMemoryCache, 
  setMemoryCache, 
  getEventsListCacheKey, 
  CACHE_DURATION,
  cleanExpiredCache
} from '../../utils/cacheUtils';

function ManagerDashboard() {
  const { currentUser } = useAuth();
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [selectedTeamLeader, setSelectedTeamLeader] = useState(null);
  const [teamLeaderStats, setTeamLeaderStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [leaderSearchTerm, setLeaderSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [filteredStats, setFilteredStats] = useState(null);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    teamLeaderCount: 0,
    promoterCount: 0
  });
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDateItem, setSelectedDateItem] = useState(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [error, setError] = useState(null);
  const [showValidator, setShowValidator] = useState(false);

  useEffect(() => {
    // Pulisci la cache scaduta ogni volta che la dashboard si carica
    cleanExpiredCache();
    
    fetchEvents();
    fetchTeamLeaders();
    fetchStatistics();
  }, [currentUser.uid]);

  async function fetchTeamLeaders() {
    try {
      // Genera chiave di cache
      const cacheKey = 'team_leaders_' + currentUser.uid;
      
      // Verifica se i dati sono in cache
      const cachedLeaders = getMemoryCache(cacheKey);
      if (cachedLeaders) {
        console.log('Team leader recuperati da cache');
        setTeamLeaders(cachedLeaders);
        return;
      }
      
      // Se non in cache, carica da Firebase
      const usersRef = collection(db, 'users');
      
      // Recupera tutti gli utenti associati a questo manager
      const q = query(usersRef, where('managerId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      const teamLeadersList = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // Verifica se l'utente è un team leader indipendentemente da maiuscole/minuscole
        const userRole = userData.role ? userData.role.toLowerCase() : '';
        if (userRole === 'teamleader' || userRole === 'teamleader' || userRole === 'team leader' || userRole === 'team-leader') {
          teamLeadersList.push({
            id: doc.id,
            ...userData
          });
        }
      });
      
      console.log(`Trovati ${teamLeadersList.length} team leader`);
      
      // Per ogni team leader, calcola il numero di promoter
      for (const leader of teamLeadersList) {
        try {
          // Cerca tutti i promoter associati a questo team leader
        const promotersQuery = query(
          collection(db, 'users'),
            where('teamLeaderId', '==', leader.id)
        );
          
        const promotersSnapshot = await getDocs(promotersQuery);
        
          // Conta solo gli utenti con ruolo promoter (in qualsiasi formato)
          let promoterCount = 0;
          promotersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userRole = userData.role ? userData.role.toLowerCase() : '';
            if (userRole === 'promoter' || userRole === 'pr' || userRole === 'pubbliche relazioni') {
              promoterCount++;
            }
          });
          
          // Aggiorna il conteggio dei promoter
          leader.promotersCount = promoterCount;
          console.log(`Team leader ${leader.id} ha ${leader.promotersCount} promoter`);
        } catch (err) {
          console.error(`Errore nel conteggio promoter per team leader ${leader.id}:`, err);
          // In caso di errore, imposta un valore di default
          leader.promotersCount = 0;
        }
      }
      
      // Salva in cache e aggiorna lo stato
      setMemoryCache(cacheKey, teamLeadersList, CACHE_DURATION.USERS);
      setTeamLeaders(teamLeadersList);
    } catch (error) {
      console.error('Errore nel recupero dei team leader:', error);
      setError('Si è verificato un errore nel caricamento dei team leader.');
    }
  }

  async function fetchTeamLeaderStats(teamLeaderId) {
    try {
      // Recupera tutti i promoter del team leader
      const promotersQuery = query(
        collection(db, 'users'),
        where('teamLeaderId', '==', teamLeaderId),
        where('role', '==', 'promoter')
      );
      const promotersSnapshot = await getDocs(promotersQuery);
      const promoters = promotersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Per ogni promoter, recupera le statistiche di vendita
      const promoterStats = await Promise.all(
        promoters.map(async (promoter) => {
          const ticketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', promoter.id)
          );
          const ticketsSnapshot = await getDocs(ticketsQuery);
          
          const eventStats = {};
          ticketsSnapshot.docs.forEach(doc => {
            const ticket = doc.data();
            if (!eventStats[ticket.eventId]) {
              eventStats[ticket.eventId] = {
                eventId: ticket.eventId,
                eventName: ticket.eventName,
                totalTickets: 0,
                totalRevenue: 0
              };
            }
            eventStats[ticket.eventId].totalTickets += ticket.quantity;
            eventStats[ticket.eventId].totalRevenue += ticket.price * ticket.quantity;
          });

          return {
            promoter,
            events: Object.values(eventStats)
          };
        })
      );

      return promoterStats;
    } catch (error) {
      console.error('Errore nel recupero delle statistiche:', error);
      return [];
    }
  }

  const handleTeamLeaderClick = (leader) => {
    setSelectedTeamLeader(leader);
  };

  useEffect(() => {
    if (teamLeaderStats) {
      const filtered = teamLeaderStats.map(({ promoter, events }) => ({
        promoter,
        events: events.filter(event => {
          const matchesSearch = event.eventName.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesDate = !dateFilter || event.date === dateFilter;
          return matchesSearch && matchesDate;
        })
      })).filter(stat => stat.events.length > 0);
      setFilteredStats(filtered);
    }
  }, [teamLeaderStats, searchTerm, dateFilter]);

  const fetchEvents = async () => {
    setLoading(true);
    
    try {
      // Genera chiave di cache
      const cacheKey = getEventsListCacheKey('manager');
      
      // Verifica se i dati sono in cache
      const cachedEvents = getMemoryCache(cacheKey);
      if (cachedEvents) {
        console.log('Eventi recuperati da cache');
        setEvents(cachedEvents);
        setLoading(false);
        return;
      }
      
      // Se non in cache, carica da Firebase
      const eventsRef = collection(db, 'events');
      
      // Recupera tutti gli eventi senza filtrare
      const q = query(eventsRef);
      const querySnapshot = await getDocs(q);
      
      const eventsList = [];
      
      querySnapshot.forEach((doc) => {
        const eventData = {
        id: doc.id,
        ...doc.data()
        };
        
        // Aggiungi l'evento alla lista (non filtriamo per manager per vederli tutti)
        eventsList.push(eventData);
      });
      
      console.log(`Trovati ${eventsList.length} eventi`);
      
      if (eventsList.length === 0) {
        console.error('Nessun evento trovato nel database');
      } else {
        // Logga alcuni dettagli del primo evento per debug
        console.log('Esempio evento:', JSON.stringify(eventsList[0], null, 2));
      }
      
      // Salva in cache e aggiorna lo stato
      setMemoryCache(cacheKey, eventsList, CACHE_DURATION.EVENTS);
      setEvents(eventsList);
    } catch (error) {
      console.error('Errore nel recupero degli eventi:', error);
      setError('Si è verificato un errore nel caricamento degli eventi.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      // Genera chiave di cache
      const cacheKey = 'statistics_' + currentUser.uid;
      
      // Verifica se i dati sono in cache
      const cachedStats = getMemoryCache(cacheKey);
      if (cachedStats) {
        console.log('Statistiche recuperate da cache');
        setStats(cachedStats);
        return;
      }
      
      // Calcola le statistiche dai dati di eventi e vendite
      const ticketsRef = collection(db, 'tickets');
      const q = query(
        ticketsRef,
        where('sellerId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      let totalSales = 0;
      let totalRevenue = 0;
      
      querySnapshot.forEach(doc => {
        const ticket = doc.data();
        totalSales += ticket.quantity;
        totalRevenue += ticket.totalPrice;
      });
      
      const calculatedStats = {
        totalSales,
        totalRevenue,
        averageTicketPrice: totalSales > 0 ? totalRevenue / totalSales : 0
      };
      
      // Salva in cache e aggiorna lo stato
      setMemoryCache(cacheKey, calculatedStats, CACHE_DURATION.STATISTICS);
      setStats(calculatedStats);
    } catch (error) {
      console.error('Errore nel calcolo delle statistiche:', error);
    }
  };

  const handleSellTicket = (event, dateItem) => {
    if (!event || !dateItem) {
        console.error("Tentativo di vendita Manager senza evento o data valida", event, dateItem);
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
    fetchStatistics();
    handleModalClose();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Caricamento dashboard...</p>
      </div>
    );
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="manager-dashboard">
      <Header />
      <div className="dashboard-header">
        <h1 className="header-title">Dashboard Manager</h1>
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
          className={`tab-button ${activeTab === 'validate' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('validate');
            setShowValidator(true);
          }}
        >
          Valida Biglietti
        </button>
        <button
          className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          Gestione Team
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="dashboard-content">
          <div className="stats-overview">
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <FaTicketAlt />
                </div>
                <div className="stat-info">
                  <h3>Biglietti Totali (Gerarchia)</h3>
                  <div className="value">{stats.totalSales}</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <FaEuroSign />
                </div>
                <div className="stat-info">
                  <h3>Incasso Totale (Gerarchia)</h3>
                  <div className="value">€{stats.totalRevenue.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <FaUsers />
                </div>
                <div className="stat-info">
                  <h3>Team Leaders Gestiti</h3>
                  <div className="value">{stats.teamLeaderCount}</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon">
                  <FaBullhorn />
                </div>
                <div className="stat-info">
                  <h3>Promoters nel Team</h3>
                  <div className="value">{stats.promoterCount}</div>
                </div>
              </div>
            </div>
          </div>

          <TicketHistory />
        </div>
      )}

      {activeTab === 'sell' && (
        <div className="sell-tickets-container">
          <h2>Seleziona un Evento e una Data per la Vendita</h2>
          
          {loading ? (
             <div className="loading-container"><div className="loading-spinner"></div>Caricamento eventi...</div>
          ) : events.length === 0 ? (
            <div className="no-events-message">
              <p>Nessun evento disponibile per la vendita.</p>
            </div>
          ) : (
          <div className="events-grid promoter-events-grid">
              {events.map(event => (
                <EventCard 
                    key={event.id} 
                    event={event} 
                    onSell={handleSellTicket}
                />
              ))}
          </div>
          )}
        </div>
      )}

      {activeTab === 'validate' && (
        <div className="validator-section">
          <TicketValidator />
        </div>
      )}

      {activeTab === 'team' && (
        <div className="team-leaders-section">
          <h2>I Miei Team Leader</h2>
          
          <div className="search-container">
            <input
              type="text"
              placeholder="Cerca team leader..."
              value={leaderSearchTerm}
              onChange={(e) => setLeaderSearchTerm(e.target.value)}
              className="search-input"
            />
            <FaSearch className="search-icon" />
          </div>
          
          {teamLeaders.length === 0 ? (
            <div className="no-leaders-message">
              <p>Nessun team leader trovato. Aggiungi team leader dalla dashboard di amministrazione.</p>
            </div>
          ) : (
          <div className="leaders-grid">
              {teamLeaders
                .filter(leader => {
                  const leaderName = leader.name || leader.nome || leader.fullName || '';
                  const leaderEmail = leader.email || leader.emailAddress || '';
                  const searchTermLower = leaderSearchTerm.toLowerCase();
                  
                  return (
                    leaderName.toLowerCase().includes(searchTermLower) ||
                    leaderEmail.toLowerCase().includes(searchTermLower)
                  );
                })
                .map(leader => {
                  const leaderName = leader.name || leader.nome || leader.fullName || 'Team Leader';
                  const leaderEmail = leader.email || leader.emailAddress || 'Email non disponibile';
                  const promotersCount = leader.promotersCount || leader.numPromoters || 0;
                  
                  return (
              <div 
                key={leader.id}
                className="leader-card"
                onClick={() => {
                  console.log("Card cliccata:", leader);
                  handleTeamLeaderClick(leader);
                }}
              >
                <div className="leader-icon">
                  <FaUser size={24} />
                </div>
                      <h3>{leaderName}</h3>
                      <p>{leaderEmail}</p>
                <div className="leader-stats">
                  <div className="stat">
                    <FaUser />
                          <span>{promotersCount} Promoter</span>
                  </div>
                </div>
              </div>
                  );
                })}
          </div>
          )}

          {selectedTeamLeader && (
            <TeamLeaderStats 
              teamLeader={selectedTeamLeader}
              onClose={() => setSelectedTeamLeader(null)}
            />
          )}
        </div>
      )}

      {selectedEvent && selectedDateItem && (
        <SellTicketModal
          event={selectedEvent}
          selectedDateItem={selectedDateItem}
          onClose={handleModalClose}
          onSold={handleTicketSold}
        />
      )}
    </div>
  );
}

export default ManagerDashboard; 