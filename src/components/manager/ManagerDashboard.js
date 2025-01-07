import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { FaUser, FaTicketAlt, FaEuroSign, FaQrcode } from 'react-icons/fa';
import Header from '../common/Header';
import TicketValidator from '../tickets/TicketValidator';
import './ManagerDashboard.css';

function ManagerDashboard() {
  const { currentUser } = useAuth();
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [selectedTeamLeader, setSelectedTeamLeader] = useState(null);
  const [teamLeaderStats, setTeamLeaderStats] = useState(null);
  const [activeTab, setActiveTab] = useState('team'); // 'team' o 'validator'
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [filteredStats, setFilteredStats] = useState(null);

  useEffect(() => {
    fetchTeamLeaders();
  }, [currentUser]);

  async function fetchTeamLeaders() {
    try {
      const leadersQuery = query(
        collection(db, 'users'),
        where('managerId', '==', currentUser.uid),
        where('role', '==', 'teamLeader')
      );
      const snapshot = await getDocs(leadersQuery);
      const leadersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeamLeaders(leadersData);
      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero dei team leader:', error);
      setLoading(false);
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

  const handleTeamLeaderClick = async (teamLeader) => {
    setSelectedTeamLeader(teamLeader);
    const stats = await fetchTeamLeaderStats(teamLeader.id);
    setTeamLeaderStats(stats);
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

  return (
    <div className="dashboard-container">
      <Header />
      
      <div className="tabs-container">
        <button 
          className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          <FaUser /> Team Leaders
        </button>
        <button 
          className={`tab-button ${activeTab === 'validator' ? 'active' : ''}`}
          onClick={() => setActiveTab('validator')}
        >
          <FaQrcode /> Valida Biglietti
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'team' ? (
          <div className="team-leaders-section">
            <h2>I Miei Team Leader</h2>
            
            <div className="leaders-grid">
              {teamLeaders.map(leader => (
                <div 
                  key={leader.id}
                  className="leader-card"
                  onClick={() => handleTeamLeaderClick(leader)}
                >
                  <div className="leader-icon">
                    <FaUser size={24} />
                  </div>
                  <h3>{leader.name}</h3>
                  <p>{leader.email}</p>
                  <div className="leader-stats">
                    <div className="stat">
                      <FaUser />
                      <span>{leader.promotersCount || 0} Promoter</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTeamLeader && teamLeaderStats && (
              <div className="stats-modal" onClick={() => setSelectedTeamLeader(null)}>
                <div className="stats-content" onClick={e => e.stopPropagation()}>
                  <button className="close-button" onClick={() => setSelectedTeamLeader(null)}>×</button>
                  <h3>Team di {selectedTeamLeader.name}</h3>
                  
                  <div className="filters">
                    <input
                      type="text"
                      placeholder="Cerca evento..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="date-filter"
                    />
                  </div>

                  <div className="stats-grid">
                    {filteredStats?.map(({ promoter, events }) => (
                      <div key={promoter.id} className="event-stat-card">
                        <div className="promoter-header">
                          <div className="promoter-icon">
                            <FaUser />
                          </div>
                          <div className="promoter-info">
                            <h4>{promoter.name}</h4>
                            <p>{promoter.email}</p>
                          </div>
                        </div>
                        
                        {events.map(event => (
                          <div key={event.eventId} className="event-stat">
                            <div className="event-header">
                              <h5>{event.eventName}</h5>
                              <span className="event-date">
                                {new Date(event.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="stat-row">
                              <div className="stat-item">
                                <FaTicketAlt />
                                <span>{event.totalTickets} biglietti</span>
                              </div>
                              <div className="stat-item">
                                <FaEuroSign />
                                <span>€{event.totalRevenue.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="validator-section">
            <h2>Validazione Biglietti</h2>
            <TicketValidator />
          </div>
        )}
      </div>
    </div>
  );
}

export default ManagerDashboard; 