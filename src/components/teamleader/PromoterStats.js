import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { FaSearch } from 'react-icons/fa';
import './TeamLeaderStyles.css';

function PromoterStats({ promoter, onClose }) {
  const [eventStats, setEventStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchPromoterStats() {
      setLoading(true);
      try {
        const ticketsQuery = query(
          collection(db, 'tickets'),
          where('sellerId', '==', promoter.uid)
        );
        const ticketsSnapshot = await getDocs(ticketsQuery);

        const eventSales = {};
        
        for (const ticketDoc of ticketsSnapshot.docs) {
          const ticket = ticketDoc.data();
          const eventId = ticket.eventId;

          if (!eventId) continue;

          if (!eventSales[eventId]) {
            let eventName = ticket.eventName || 'Evento Sconosciuto';
            let eventDate = ticket.eventDate;
            try {
                const eventRef = doc(db, 'events', eventId);
                const eventSnap = await getDoc(eventRef);
                if (eventSnap.exists()) {
                    eventName = eventSnap.data().name || eventName;
                }
            } catch (eventError) {
                console.warn(`Impossibile recuperare dettagli evento ${eventId}:`, eventError);
            }
            
            eventSales[eventId] = {
              eventId: eventId,
              eventName: eventName,
              eventDate: eventDate,
              totalTickets: 0,
              totalRevenue: 0,
              commission: 0
            };
          }
          
          eventSales[eventId].totalTickets += ticket.quantity || 0;
          eventSales[eventId].totalRevenue += ticket.totalPrice || 0;
          eventSales[eventId].commission += ticket.commission || 0;
        }

        setEventStats(Object.values(eventSales));
      } catch (error) {
        console.error('Errore nel recupero delle statistiche:', error);
      } finally {
         setLoading(false);
      }
    }

    if (promoter?.uid) {
        fetchPromoterStats();
    }
  }, [promoter?.uid]);

  const filteredEventStats = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) {
      return eventStats;
    }
    return eventStats.filter(stat => 
      (stat.eventName && stat.eventName.toLowerCase().includes(lowerSearchTerm)) ||
      (stat.eventId && stat.eventId.toLowerCase().includes(lowerSearchTerm))
    );
  }, [eventStats, searchTerm]);

  const totalStats = useMemo(() => {
      return eventStats.reduce((acc, stat) => {
          acc.totalTickets += stat.totalTickets || 0;
          acc.totalRevenue += stat.totalRevenue || 0;
          acc.totalCommission += stat.commission || 0;
          return acc;
      }, { totalTickets: 0, totalRevenue: 0, totalCommission: 0 });
  }, [eventStats]);

  return (
    <div className="modal-overlay">
      <div className="modal-content statistics-modal">
        <div className="modal-header">
          <h2>Statistiche Promoter: {promoter.name}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className="loading">Caricamento statistiche...</div>
        ) : (
          <div className="statistics-content">
            <div className="promoter-summary stats-grid">
               <div className="summary-stat-item">
                  <span className="summary-label">Email</span>
                  <span className="summary-value email">{promoter.email || 'N/D'}</span>
              </div>
               <div className="summary-stat-item">
                  <span className="summary-label">Eventi Unici</span>
                  <span className="summary-value">{eventStats.length}</span>
              </div>
               <div className="summary-stat-item">
                  <span className="summary-label">Biglietti Totali</span>
                  <span className="summary-value">{totalStats.totalTickets}</span>
              </div>
               <div className="summary-stat-item">
                  <span className="summary-label">Incasso Totale</span>
                  <span className="summary-value">€{totalStats.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="summary-stat-item">
                  <span className="summary-label">Commissione Totale</span>
                  <span className="summary-value">€{totalStats.totalCommission.toFixed(2)}</span>
              </div>
            </div>

            <h3>Vendite per Evento</h3>

            <div className="search-filter-container">
              <FaSearch className="search-icon" />
              <input 
                type="text"
                placeholder="Cerca per nome o codice evento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="stats-search-input"
              />
            </div>

            {filteredEventStats.length > 0 ? (
              <div className="events-stats-table">
                <table>
                  <thead>
                    <tr>
                      <th>Evento</th>
                      <th>Data</th>
                      <th>Biglietti</th>
                      <th>Incasso</th>
                      <th>Commissione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEventStats.map((stat, index) => (
                      <tr key={stat.eventId || index}>
                        <td data-label="Evento">{stat.eventName}</td>
                        <td data-label="Data">{new Date(stat.eventDate?.seconds * 1000 || stat.eventDate).toLocaleDateString()}</td>
                        <td data-label="Biglietti">{stat.totalTickets}</td>
                        <td data-label="Incasso">€{stat.totalRevenue.toFixed(2)}</td>
                        <td data-label="Commissione">€{stat.commission.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data">
                {searchTerm 
                  ? 'Nessun evento trovato per la ricerca.' 
                  : 'Nessuna vendita registrata per questo promoter.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PromoterStats; 