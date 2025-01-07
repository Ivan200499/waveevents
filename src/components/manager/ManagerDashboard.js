import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import TicketValidator from '../tickets/TicketValidator';
import Header from '../common/Header';
import '../dashboard/DashboardStyles.css';

function ManagerDashboard() {
  const { currentUser } = useAuth();
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('team'); // 'team' o 'tickets'
  const [stats, setStats] = useState({
    totalTickets: 0,
    totalRevenue: 0,
    totalEvents: 0
  });

  useEffect(() => {
    fetchTeamLeaders();
  }, [currentUser]);

  useEffect(() => {
    async function fetchManagerStats() {
      try {
        // Ottieni tutti i biglietti venduti dal team
        const ticketsQuery = query(
          collection(db, 'tickets'),
          where('managerId', '==', currentUser.uid)
        );
        
        const ticketsSnapshot = await getDocs(ticketsQuery);
        
        // Calcola le statistiche considerando la quantità
        const statistics = ticketsSnapshot.docs.reduce((acc, doc) => {
          const ticket = doc.data();
          return {
            totalTickets: acc.totalTickets + (ticket.quantity || 0),
            totalRevenue: acc.totalRevenue + ((ticket.price || 0) * (ticket.quantity || 0)),
            totalEvents: acc.totalEvents
          };
        }, {
          totalTickets: 0,
          totalRevenue: 0,
          totalEvents: 0
        });

        setStats(statistics);
      } catch (error) {
        console.error('Errore nel recupero delle statistiche:', error);
      }
    }

    fetchManagerStats();
  }, [currentUser]);

  async function fetchTeamLeaders() {
    try {
      // Carica solo i team leader assegnati a questo manager
      const teamLeadersQuery = query(
        collection(db, 'users'),
        where('managerId', '==', currentUser.uid),
        where('role', '==', 'teamLeader')
      );
      
      const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
      const teamLeadersData = teamLeadersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Per ogni team leader, ottieni le sue statistiche
      const leadersWithStats = await Promise.all(teamLeadersData.map(async (leader) => {
        const leaderTicketsQuery = query(
          collection(db, 'tickets'),
          where('teamLeaderId', '==', leader.id)
        );
        
        const ticketsSnapshot = await getDocs(leaderTicketsQuery);
        const stats = ticketsSnapshot.docs.reduce((acc, doc) => {
          const ticket = doc.data();
          return {
            totalTickets: acc.totalTickets + (ticket.quantity || 0),
            totalRevenue: acc.totalRevenue + ((ticket.price || 0) * (ticket.quantity || 0))
          };
        }, { totalTickets: 0, totalRevenue: 0 });

        return {
          ...leader,
          ...stats
        };
      }));
      
      setTeamLeaders(leadersWithStats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team leaders:', error);
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-container">
      <Header />
      <div className="dashboard-content">
        <div className="manager-dashboard">
          <div className="dashboard-tabs">
            <button 
              className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              Team Leaders
            </button>
            <button 
              className={`tab-button ${activeTab === 'tickets' ? 'active' : ''}`}
              onClick={() => setActiveTab('tickets')}
            >
              Validazione Biglietti
            </button>
          </div>

          {activeTab === 'team' ? (
            <div className="team-section">
              <h2>I Miei Team Leader</h2>
              {loading ? (
                <div className="loading-spinner">Caricamento...</div>
              ) : (
                <div className="users-grid">
                  {teamLeaders.map(teamLeader => (
                    <div key={teamLeader.id} className="user-card">
                      <div className="user-card-header">
                        <div className="user-avatar">
                          {teamLeader.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <div className="user-name">{teamLeader.name}</div>
                          <div className="user-email">{teamLeader.email}</div>
                        </div>
                      </div>
                      <div className={`user-status status-${teamLeader.status}`}>
                        {teamLeader.status === 'active' ? 'Attivo' : 'Inattivo'}
                      </div>
                      <div className="user-stats">
                        <div className="stat-item">
                          <span className="stat-label">Promoter Assegnati</span>
                          <span className="stat-value">{teamLeader.promotersCount || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Vendite Totali</span>
                          <span className="stat-value">€{teamLeader.totalSales || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="tickets-section">
              <h2>Validazione Biglietti</h2>
              <TicketValidator />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManagerDashboard; 