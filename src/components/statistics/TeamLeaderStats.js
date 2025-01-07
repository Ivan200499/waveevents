import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './Statistics.css';

function TeamLeaderStats({ teamLeader, onClose }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [promoterStats, setPromoterStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamLeaderStats();
  }, [teamLeader.uid]);

  async function fetchTeamLeaderStats() {
    try {
      // Ottieni tutti i promoter del team leader
      const promotersQuery = query(
        collection(db, 'users'),
        where('teamLeaderId', '==', teamLeader.uid)
      );
      const promotersSnapshot = await getDocs(promotersQuery);
      const promoterIds = promotersSnapshot.docs.map(doc => doc.data().uid);

      // Ottieni tutti gli eventi
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);

      // Ottieni tutte le vendite dei promoter del team
      const salesStats = {};
      for (const eventId of eventsData.map(e => e.id)) {
        const ticketsQuery = query(
          collection(db, 'tickets'),
          where('eventId', '==', eventId),
          where('sellerId', 'in', promoterIds)
        );
        const ticketsSnapshot = await getDocs(ticketsQuery);
        
        salesStats[eventId] = ticketsSnapshot.docs.reduce((acc, doc) => {
          const ticket = doc.data();
          return {
            totalTickets: acc.totalTickets + ticket.quantity,
            totalRevenue: acc.totalRevenue + ticket.totalPrice
          };
        }, { totalTickets: 0, totalRevenue: 0 });
      }

      setPromoterStats(salesStats);
      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero delle statistiche:', error);
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content statistics-modal">
        <div className="modal-header">
          <h2>Statistiche Team Leader: {teamLeader.name}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className="loading">Caricamento statistiche...</div>
        ) : (
          <div className="statistics-content">
            <div className="team-summary">
              <p><strong>Email:</strong> {teamLeader.email}</p>
              <p><strong>Team:</strong> {teamLeader.teamName}</p>
            </div>

            <h3>Vendite per Evento</h3>
            <div className="events-stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Data</th>
                    <th>Biglietti Venduti</th>
                    <th>Incasso Totale</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(event => {
                    const stats = promoterStats[event.id] || { totalTickets: 0, totalRevenue: 0 };
                    return (
                      <tr key={event.id}>
                        <td>{event.name}</td>
                        <td>{new Date(event.date).toLocaleDateString()}</td>
                        <td>{stats.totalTickets}</td>
                        <td>€{stats.totalRevenue.toFixed(2)}</td>
                        <td>
                          <button 
                            className="btn-details"
                            onClick={() => setSelectedEvent(event)}
                          >
                            Dettagli Promoter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedEvent && (
              <PromoterEventStats 
                event={selectedEvent}
                teamLeaderId={teamLeader.uid}
                onClose={() => setSelectedEvent(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamLeaderStats; 