import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import Header from '../common/Header';
import '../dashboard/DashboardStyles.css';

function TeamLeaderDashboard() {
  const { currentUser } = useAuth();
  const [promoterStats, setPromoterStats] = useState([]);

  useEffect(() => {
    async function fetchTeamStats() {
      try {
        // Ottieni tutti i promoter del team leader
        const promotersQuery = query(
          collection(db, 'users'),
          where('teamLeaderId', '==', currentUser.uid)
        );
        
        const promotersSnapshot = await getDocs(promotersQuery);
        
        // Per ogni promoter, ottieni le sue statistiche
        const statsPromises = promotersSnapshot.docs.map(async (promoterDoc) => {
          const promoter = promoterDoc.data();
          
          // Ottieni i biglietti venduti dal promoter
          const ticketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', promoterDoc.id)
          );
          
          const ticketsSnapshot = await getDocs(ticketsQuery);
          
          // Calcola le statistiche considerando la quantità
          const stats = ticketsSnapshot.docs.reduce((acc, doc) => {
            const ticket = doc.data();
            return {
              totalTickets: acc.totalTickets + (ticket.quantity || 0),
              totalRevenue: acc.totalRevenue + ((ticket.price || 0) * (ticket.quantity || 0))
            };
          }, { totalTickets: 0, totalRevenue: 0 });
          
          return {
            promoterId: promoterDoc.id,
            promoterName: promoter.name,
            ...stats
          };
        });
        
        const allStats = await Promise.all(statsPromises);
        setPromoterStats(allStats);
      } catch (error) {
        console.error('Errore nel recupero delle statistiche:', error);
      }
    }

    fetchTeamStats();
  }, [currentUser]);

  return (
    <div className="dashboard-container">
      <Header />
      <div className="dashboard-content">
        <div className="team-leader-dashboard">
          <h2>I Miei Promoter</h2>
          
          {promoterStats.length === 0 ? (
            <div className="loading-spinner">Caricamento...</div>
          ) : (
            <div className="users-grid">
              {promoterStats.map(promoter => (
                <div key={promoter.promoterId} className="user-card">
                  <div className="user-card-header">
                    <div className="user-avatar">
                      {promoter.promoterName.charAt(0).toUpperCase()}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{promoter.promoterName}</div>
                    </div>
                  </div>
                  
                  <div className="user-stats">
                    <div className="stat-item">
                      <span className="stat-label">Biglietti Venduti</span>
                      <span className="stat-value">{promoter.totalTickets}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Vendite Totali</span>
                      <span className="stat-value">€{promoter.totalRevenue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamLeaderDashboard; 