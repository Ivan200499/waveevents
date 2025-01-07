import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import TeamLeaderStats from './TeamLeaderStats';
import './Stats.css';

function ManagerStats({ managerId }) {
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [managerStats, setManagerStats] = useState({
    totalTeamLeaders: 0,
    totalPromoters: 0,
    totalSales: 0,
    totalCommissions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManagerStats();
  }, [managerId]);

  async function fetchManagerStats() {
    try {
      // Recupera tutti i team leader del manager
      const teamLeadersQuery = query(
        collection(db, 'users'),
        where('managerId', '==', managerId),
        where('role', '==', 'teamLeader')
      );
      const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
      
      const teamLeadersData = teamLeadersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setTeamLeaders(teamLeadersData);

      // Calcola le statistiche complessive
      let totalPromoters = 0;
      let totalSales = 0;
      let totalCommissions = 0;

      for (const teamLeader of teamLeadersData) {
        const promotersQuery = query(
          collection(db, 'users'),
          where('teamLeaderId', '==', teamLeader.id),
          where('role', '==', 'promoter')
        );
        const promotersSnapshot = await getDocs(promotersQuery);
        totalPromoters += promotersSnapshot.size;

        for (const promoterDoc of promotersSnapshot.docs) {
          const ticketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', promoterDoc.id)
          );
          const ticketsSnapshot = await getDocs(ticketsQuery);
          
          ticketsSnapshot.forEach(doc => {
            const ticket = doc.data();
            totalSales += ticket.price;
            totalCommissions += ticket.commission;
          });
        }
      }

      setManagerStats({
        totalTeamLeaders: teamLeadersData.length,
        totalPromoters,
        totalSales,
        totalCommissions
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching manager stats:', error);
      setLoading(false);
    }
  }

  if (loading) return <div>Caricamento statistiche manager...</div>;

  return (
    <div className="manager-stats-container">
      <div className="manager-summary">
        <div className="stat-card">
          <h3>Team Leaders</h3>
          <p className="stat-value">{managerStats.totalTeamLeaders}</p>
        </div>
        <div className="stat-card">
          <h3>Totale Promoter</h3>
          <p className="stat-value">{managerStats.totalPromoters}</p>
        </div>
        <div className="stat-card">
          <h3>Vendite Totali</h3>
          <p className="stat-value">€{managerStats.totalSales.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Commissioni Totali</h3>
          <p className="stat-value">€{managerStats.totalCommissions.toFixed(2)}</p>
        </div>
      </div>

      <div className="team-leaders-stats">
        <h3>Statistiche Team Leaders</h3>
        {teamLeaders.map(teamLeader => (
          <div key={teamLeader.id} className="team-leader-stats-card">
            <h4>{teamLeader.name}</h4>
            <TeamLeaderStats teamLeaderId={teamLeader.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ManagerStats; 