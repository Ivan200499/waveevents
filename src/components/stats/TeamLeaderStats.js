import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import PromoterStats from './PromoterStats';
import './Stats.css';

function TeamLeaderStats({ teamLeaderId }) {
  const [promoters, setPromoters] = useState([]);
  const [teamStats, setTeamStats] = useState({
    totalPromoters: 0,
    totalTeamSales: 0,
    totalTeamCommissions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamStats();
  }, [teamLeaderId]);

  async function fetchTeamStats() {
    try {
      // Recupera tutti i promoter del team
      const promotersQuery = query(
        collection(db, 'users'),
        where('teamLeaderId', '==', teamLeaderId),
        where('role', '==', 'promoter')
      );
      const promotersSnapshot = await getDocs(promotersQuery);
      
      const promotersData = promotersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPromoters(promotersData);

      // Calcola le statistiche del team
      let totalTeamSales = 0;
      let totalTeamCommissions = 0;

      for (const promoter of promotersData) {
        const ticketsQuery = query(
          collection(db, 'tickets'),
          where('sellerId', '==', promoter.id)
        );
        const ticketsSnapshot = await getDocs(ticketsQuery);
        
        ticketsSnapshot.forEach(doc => {
          const ticket = doc.data();
          totalTeamSales += ticket.price;
          totalTeamCommissions += ticket.commission;
        });
      }

      setTeamStats({
        totalPromoters: promotersData.length,
        totalTeamSales,
        totalTeamCommissions
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team stats:', error);
      setLoading(false);
    }
  }

  if (loading) return <div>Caricamento statistiche del team...</div>;

  return (
    <div className="team-stats-container">
      <div className="team-summary">
        <div className="stat-card">
          <h3>Totale Promoter</h3>
          <p className="stat-value">{teamStats.totalPromoters}</p>
        </div>
        <div className="stat-card">
          <h3>Vendite Totali Team</h3>
          <p className="stat-value">€{teamStats.totalTeamSales.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Commissioni Totali Team</h3>
          <p className="stat-value">€{teamStats.totalTeamCommissions.toFixed(2)}</p>
        </div>
      </div>

      <div className="promoters-stats">
        <h3>Statistiche Promoter</h3>
        {promoters.map(promoter => (
          <div key={promoter.id} className="promoter-stats-card">
            <h4>{promoter.name}</h4>
            <PromoterStats promoterId={promoter.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamLeaderStats; 