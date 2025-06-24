import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { FaSearch, FaTimes, FaCalendarAlt, FaTicketAlt, FaEuroSign } from 'react-icons/fa';
import './TeamLeaderStyles.css';

function PromoterStats({ promoter, onClose }) {
  const [eventStats, setEventStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);

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
          const eventDate = ticket.eventDate;

          if (!eventId) continue;

          // Crea una chiave unica per ogni combinazione evento-data
          const eventDateKey = `${eventId}_${eventDate?.seconds || 'nodate'}`;

          if (!eventSales[eventDateKey]) {
            let eventName = ticket.eventName || 'Evento Sconosciuto';
            try {
              const eventRef = doc(db, 'events', eventId);
              const eventSnap = await getDoc(eventRef);
              if (eventSnap.exists()) {
                eventName = eventSnap.data().name || eventName;
              }
            } catch (eventError) {
              console.warn(`Impossibile recuperare dettagli evento ${eventId}:`, eventError);
            }
            
            eventSales[eventDateKey] = {
              eventId: eventId,
              eventName: eventName,
              eventDate: eventDate,
              totalTickets: 0,
              totalRevenue: 0,
              commission: 0,
              ticketTypes: {}
            };
          }
          
          const commission = ticket.commission ?? ticket.commissionAmount ?? 0;
          eventSales[eventDateKey].totalTickets += ticket.quantity || 0;
          eventSales[eventDateKey].totalRevenue += ticket.totalPrice || 0;
          eventSales[eventDateKey].commission += commission;
          
          const typeKey = typeof ticket.ticketType === 'object' && ticket.ticketType !== null 
            ? (ticket.ticketType.name || 'Standard') 
            : (ticket.ticketType || 'Standard');

          if (!eventSales[eventDateKey].ticketTypes[typeKey]) {
            eventSales[eventDateKey].ticketTypes[typeKey] = {
              name: typeKey,
              quantity: 0,
              unitPrice: ticket.price || 0,
              total: 0,
              commission: 0,
              codes: [],
              tableInfo: ticket.tableInfo || null
            };
          }
          eventSales[eventDateKey].ticketTypes[typeKey].quantity += ticket.quantity || 0;
          eventSales[eventDateKey].ticketTypes[typeKey].total += ticket.totalPrice || 0;
          eventSales[eventDateKey].ticketTypes[typeKey].commission += commission;
          eventSales[eventDateKey].ticketTypes[typeKey].codes.push(ticket.code || ticket.ticketCode || 'N/D');
          if (ticket.tableInfo) {
            eventSales[eventDateKey].ticketTypes[typeKey].tableInfo = ticket.tableInfo;
          }
        }

        // Converti in array e ordina per data
        const statsArray = Object.values(eventSales).sort((a, b) => {
          const dateA = a.eventDate?.seconds || 0;
          const dateB = b.eventDate?.seconds || 0;
          return dateB - dateA;
        });

        setEventStats(statsArray);
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

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data non specificata';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenDetailModal = (eventData) => {
    setSelectedEventDetails(eventData);
  };

  const handleCloseDetailModal = () => {
    setSelectedEventDetails(null);
  };

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
                <span className="summary-value">{new Set(eventStats.map(s => s.eventId)).size}</span>
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

            <div className="search-section">
              <input
                type="text"
                placeholder="Cerca per nome evento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="events-list">
              {filteredEventStats.map((eventStat, index) => (
                <div key={`${eventStat.eventId}_${index}`} className="event-card">
                  <div className="event-header">
                    <h3>{eventStat.eventName}</h3>
                    <div className="event-date">
                      <FaCalendarAlt />
                      <span>{formatDate(eventStat.eventDate)}</span>
                    </div>
                  </div>
                  
                  <div className="event-stats">
                    <div className="stat-item">
                      <FaTicketAlt />
                      <div>
                        <span className="stat-label">Biglietti</span>
                        <span className="stat-value">{eventStat.totalTickets}</span>
                      </div>
                    </div>
                    <div className="stat-item">
                      <FaEuroSign />
                      <div>
                        <span className="stat-label">Incasso</span>
                        <span className="stat-value">€{eventStat.totalRevenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="ticket-types-section">
                    <h4>Dettaglio Biglietti</h4>
                    <table className="ticket-types-table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Quantità</th>
                          <th>Prezzo Unit.</th>
                          <th>Totale</th>
                          <th>Commissione</th>
                          {Object.values(eventStat.ticketTypes).some(type => type.tableInfo) && (
                            <th>Tavolo</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(eventStat.ticketTypes).map(([typeKey, typeData]) => (
                          <tr key={typeKey}>
                            <td>{typeData.name}</td>
                            <td>{typeData.quantity}</td>
                            <td>€{typeData.unitPrice.toFixed(2)}</td>
                            <td>€{typeData.total.toFixed(2)}</td>
                            <td>€{typeData.commission.toFixed(2)}</td>
                            {Object.values(eventStat.ticketTypes).some(type => type.tableInfo) && (
                              <td>
                                {typeData.tableInfo ? (
                                  typeData.tableInfo.type?.name || 'Tavolo'
                                ) : '-'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PromoterStats; 