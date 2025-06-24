import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { FaUser, FaTicketAlt, FaEuroSign, FaCalendarAlt } from 'react-icons/fa';
import './TeamLeaderDashboard.css';

function PromoterReports({ teamLeaderId }) {
  console.log('==================== PROMOTER REPORTS ====================');
  console.log('Team Leader ID:', teamLeaderId);

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEventDate, setSelectedEventDate] = useState('');
  const [eventDates, setEventDates] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [promoters, setPromoters] = useState([]);
  const [selectedPromoter, setSelectedPromoter] = useState('');

  console.log('Initial State:', {
    events,
    selectedEventId,
    selectedEventDate,
    eventDates,
    loading,
    error,
    promoters,
    selectedPromoter
  });

  // Carica gli eventi
  useEffect(() => {
    console.log('Loading events for team leader:', teamLeaderId);
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const eventsCollection = collection(db, 'events');
        const eventSnapshot = await getDocs(eventsCollection);
        const eventsList = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Events loaded:', eventsList);
        setEvents(eventsList);
        setError('');
      } catch (err) {
        console.error("Errore nel caricamento degli eventi:", err);
        setError("Errore nel caricamento degli eventi.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Carica i promoter del team leader
  useEffect(() => {
    const fetchPromoters = async () => {
      if (!teamLeaderId) return;
      
      try {
        setLoading(true);
        const promotersQuery = query(
          collection(db, 'users'),
          where('teamLeaderId', '==', teamLeaderId),
          where('role', '==', 'promoter')
        );
        const promotersSnapshot = await getDocs(promotersQuery);
        const promotersList = promotersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPromoters(promotersList);
      } catch (err) {
        console.error("Errore nel caricamento dei promoter:", err);
        setError("Errore nel caricamento dei promoter.");
      } finally {
        setLoading(false);
      }
    };
    fetchPromoters();
  }, [teamLeaderId]);

  // Aggiorna le date disponibili quando viene selezionato un evento
  useEffect(() => {
    if (selectedEventId) {
      const selectedEvent = events.find(event => event.id === selectedEventId);
      if (selectedEvent && Array.isArray(selectedEvent.eventDates)) {
        const dates = selectedEvent.eventDates
          .map(ed => ed.date)
          .filter(Boolean);
        setEventDates([...new Set(dates)].sort());
      } else {
        setEventDates([]);
      }
      setSelectedEventDate('');
      setReportData(null);
    }
  }, [selectedEventId, events]);

  // Genera il report quando cambiano i filtri
  useEffect(() => {
    const generateReport = async () => {
      if (!selectedEventId || (!selectedEventDate && !selectedPromoter)) return;

      setLoading(true);
      setError('');
      setReportData(null);

      try {
        let ticketsQuery = query(
          collection(db, 'tickets'),
          where('eventId', '==', selectedEventId)
        );

        if (selectedEventDate) {
          ticketsQuery = query(ticketsQuery, where('eventDate', '==', selectedEventDate));
        }

        if (selectedPromoter) {
          ticketsQuery = query(ticketsQuery, where('sellerId', '==', selectedPromoter));
        } else {
          // Se non è selezionato un promoter specifico, filtra per tutti i promoter del team
          const promoterIds = promoters.map(p => p.id);
          if (promoterIds.length > 0) {
            ticketsQuery = query(ticketsQuery, where('sellerId', 'in', promoterIds));
          }
        }

        const ticketSnapshot = await getDocs(ticketsQuery);
        const tickets = ticketSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Raggruppa i biglietti per promoter
        const aggregatedReport = tickets.reduce((acc, ticket) => {
          const sellerId = ticket.sellerId;
          const promoter = promoters.find(p => p.id === sellerId) || {};
          
          if (!acc[sellerId]) {
            acc[sellerId] = {
              promoterName: promoter.name || ticket.sellerName || 'Promoter Sconosciuto',
              promoterEmail: promoter.email || 'Email non disponibile',
              totalTickets: 0,
              totalRevenue: 0,
              totalCommissions: 0,
              ticketTypes: {},
              eventDates: {},
              tickets: []
            };
          }

          const quantity = Number(ticket.quantity) || 0;
          const totalPrice = Number(ticket.totalPrice) || 0;
          const commission = Number(ticket.commissionAmount) || 0;
          const ticketType = ticket.ticketType || 'Standard';
          const eventDate = ticket.eventDate || 'Data non specificata';

          // Aggiorna i totali
          acc[sellerId].totalTickets += quantity;
          acc[sellerId].totalRevenue += totalPrice;
          acc[sellerId].totalCommissions += commission;

          // Aggiorna le statistiche per tipo di biglietto
          if (!acc[sellerId].ticketTypes[ticketType]) {
            acc[sellerId].ticketTypes[ticketType] = {
              quantity: 0,
              revenue: 0,
              commission: 0
            };
          }
          acc[sellerId].ticketTypes[ticketType].quantity += quantity;
          acc[sellerId].ticketTypes[ticketType].revenue += totalPrice;
          acc[sellerId].ticketTypes[ticketType].commission += commission;

          // Aggiorna le statistiche per data
          if (!acc[sellerId].eventDates[eventDate]) {
            acc[sellerId].eventDates[eventDate] = {
              quantity: 0,
              revenue: 0,
              commission: 0
            };
          }
          acc[sellerId].eventDates[eventDate].quantity += quantity;
          acc[sellerId].eventDates[eventDate].revenue += totalPrice;
          acc[sellerId].eventDates[eventDate].commission += commission;

          // Aggiungi il biglietto alla lista
          acc[sellerId].tickets.push(ticket);

          return acc;
        }, {});

        // Calcola i totali generali
        const totals = Object.values(aggregatedReport).reduce((acc, promoterData) => {
          acc.totalTickets += promoterData.totalTickets;
          acc.totalRevenue += promoterData.totalRevenue;
          acc.totalCommissions += promoterData.totalCommissions;
          return acc;
        }, { totalTickets: 0, totalRevenue: 0, totalCommissions: 0 });

        setReportData({ aggregated: aggregatedReport, totals });
      } catch (err) {
        console.error("Errore nella generazione del report:", err);
        setError("Errore nella generazione del report: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, [selectedEventId, selectedEventDate, selectedPromoter, promoters]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Data non specificata';
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return new Date(timestamp).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="promoter-reports">
      <div className="filters-section">
        <div className="filter-group">
          <label>
            Evento:
            <select 
              value={selectedEventId} 
              onChange={(e) => setSelectedEventId(e.target.value)}
            >
              <option value="">Seleziona un evento</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data:
            <select 
              value={selectedEventDate} 
              onChange={(e) => setSelectedEventDate(e.target.value)}
              disabled={!selectedEventId}
            >
              <option value="">Tutte le date</option>
              {eventDates.map((date, index) => (
                <option key={index} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Promoter:
            <select 
              value={selectedPromoter} 
              onChange={(e) => setSelectedPromoter(e.target.value)}
            >
              <option value="">Tutti i promoter</option>
              {promoters.map(promoter => (
                <option key={promoter.id} value={promoter.id}>
                  {promoter.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading && <div className="loading">Generazione report in corso...</div>}
      {error && <div className="error-message">{error}</div>}

      {reportData && (
        <div className="report-content">
          <div className="report-summary">
            <div className="summary-card">
              <FaTicketAlt />
              <div>
                <h3>Biglietti Totali</h3>
                <p>{reportData.totals.totalTickets}</p>
              </div>
            </div>
            <div className="summary-card">
              <FaEuroSign />
              <div>
                <h3>Incasso Totale</h3>
                <p>€ {reportData.totals.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
            <div className="summary-card">
              <FaEuroSign />
              <div>
                <h3>Commissioni Totali</h3>
                <p>€ {reportData.totals.totalCommissions.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="promoters-report">
            {Object.entries(reportData.aggregated).map(([sellerId, data]) => (
              <div key={sellerId} className="promoter-report-card">
                <div className="promoter-header">
                  <FaUser />
                  <div>
                    <h3>{data.promoterName}</h3>
                    <p>{data.promoterEmail}</p>
                  </div>
                </div>

                <div className="promoter-stats">
                  <div className="stat">
                    <FaTicketAlt />
                    <div>
                      <span>Biglietti Venduti</span>
                      <strong>{data.totalTickets}</strong>
                    </div>
                  </div>
                  <div className="stat">
                    <FaEuroSign />
                    <div>
                      <span>Incasso Totale</span>
                      <strong>€ {data.totalRevenue.toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="stat">
                    <FaEuroSign />
                    <div>
                      <span>Commissioni</span>
                      <strong>€ {data.totalCommissions.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                <div className="ticket-types-breakdown">
                  <h4>Dettaglio per Tipo Biglietto</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Quantità</th>
                        <th>Incasso</th>
                        <th>Commissione</th>
                        <th>Dettagli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.ticketTypes).map(([type, stats]) => (
                        <React.Fragment key={type}>
                          <tr>
                            <td>{type}</td>
                            <td>{stats.quantity}</td>
                            <td>€ {stats.revenue.toFixed(2)}</td>
                            <td>€ {stats.commission.toFixed(2)}</td>
                            <td>
                              <button 
                                className="toggle-details-btn"
                                onClick={() => {
                                  const element = document.getElementById(`tickets-${sellerId}-${type.replace(/\s+/g, '-')}`);
                                  if (element) {
                                    element.style.display = element.style.display === 'none' ? 'table-row' : 'none';
                                  }
                                }}
                              >
                                Mostra Biglietti
                              </button>
                            </td>
                          </tr>
                          <tr 
                            id={`tickets-${sellerId}-${type.replace(/\s+/g, '-')}`} 
                            style={{display: 'none'}}
                            className="ticket-details-row"
                          >
                            <td colSpan="5">
                              <div className="ticket-details-container">
                                <table className="ticket-details-table">
                                  <thead>
                                    <tr>
                                      <th>ID Biglietto</th>
                                      <th>Data Vendita</th>
                                      <th>Stato Pagamento</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {data.tickets
                                      .filter(ticket => ticket.ticketType === type)
                                      .map(ticket => (
                                        <tr key={ticket.id}>
                                          <td>{ticket.code || ticket.id}</td>
                                          <td>{formatDate(ticket.createdAt || ticket.soldAt)}</td>
                                          <td>
                                            <label className="payment-checkbox">
                                              <input 
                                                type="checkbox" 
                                                defaultChecked={false}
                                                onChange={(e) => {
                                                  // Questa è solo una funzione visiva
                                                  e.target.closest('tr').classList.toggle('paid');
                                                }}
                                              />
                                              <span className="checkmark"></span>
                                            </label>
                                          </td>
                                        </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dates-breakdown">
                  <h4>Dettaglio per Data</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Quantità</th>
                        <th>Incasso</th>
                        <th>Commissione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.eventDates).map(([date, stats]) => (
                        <tr key={date}>
                          <td>{formatDate(date)}</td>
                          <td>{stats.quantity}</td>
                          <td>€ {stats.revenue.toFixed(2)}</td>
                          <td>€ {stats.commission.toFixed(2)}</td>
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
  );
}

export default PromoterReports; 