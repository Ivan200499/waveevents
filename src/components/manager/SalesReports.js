import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import './SalesReports.css';
import { useAuth } from '../../contexts/AuthContext';
import SellerTicketsDetailModal from '../admin/SellerTicketsDetailModal';

function SalesReports({ usersMap }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedEventDate, setSelectedEventDate] = useState('');
  const [eventDates, setEventDates] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSellerTickets, setSelectedSellerTickets] = useState([]);
  const [selectedSellerNameForModal, setSelectedSellerNameForModal] = useState('');
  const [selectedSellerIdForModal, setSelectedSellerIdForModal] = useState(null);

  // Helper function to chunk array into smaller arrays of max size
  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // Helper function to fetch tickets for a chunk of seller IDs
  const fetchTicketsForSellerIds = async (sellerIds, eventId, eventDate) => {
    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('eventId', '==', eventId),
      where('eventDate', '==', eventDate),
      where('sellerId', 'in', sellerIds),
      where('itemType', '==', 'ticket')
    );
    const ticketSnapshot = await getDocs(ticketsQuery);
    return ticketSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const eventsCollection = collection(db, 'events');
        const eventSnapshot = await getDocs(eventsCollection);
        const eventsList = eventSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEvents(eventsList);
        setError('');
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Errore nel caricamento degli eventi.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

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

  useEffect(() => {
    const generateReport = async () => {
      if (selectedEventId && selectedEventDate) {
        setLoading(true);
        setError('');
        setReportData(null);
        try {
          // Query per ottenere i team leader sotto questo manager
          const teamLeadersQuery = query(
            collection(db, 'users'),
            where('managerId', '==', currentUser.uid)
          );
          const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
          const teamLeaderIds = teamLeadersSnapshot.docs.map(doc => doc.id);

          // Query per ottenere i promoter sotto i team leader
          let allPromoters = [];
          // Chunk team leader IDs into groups of 30 for the 'in' clause
          const teamLeaderChunks = chunkArray(teamLeaderIds, 30);
          for (const chunk of teamLeaderChunks) {
            const promotersQuery = query(
              collection(db, 'users'),
              where('teamLeaderId', 'in', chunk)
            );
            const promotersSnapshot = await getDocs(promotersQuery);
            allPromoters = [...allPromoters, ...promotersSnapshot.docs.map(doc => doc.id)];
          }

          // Combina tutti gli ID dei venditori (manager, team leader e promoter)
          const allSellerIds = [currentUser.uid, ...teamLeaderIds, ...allPromoters];

          // Fetch tickets in chunks of 30 seller IDs
          let allTickets = [];
          const sellerIdChunks = chunkArray(allSellerIds, 30);
          for (const chunk of sellerIdChunks) {
            const tickets = await fetchTicketsForSellerIds(chunk, selectedEventId, selectedEventDate);
            allTickets = [...allTickets, ...tickets];
          }

          if (allTickets.length === 0) {
            setReportData({ aggregated: {}, totals: { tickets: 0, revenue: 0, commissions: 0 }, ticketsBySellerForModal: {} });
            return;
          }

          const ticketsBySellerForModal = allTickets.reduce((acc, ticket) => {
            const sellerId = ticket.sellerId;
            if (!acc[sellerId]) {
              acc[sellerId] = [];
            }
            acc[sellerId].push(ticket);
            return acc;
          }, {});

          const aggregatedReport = allTickets.reduce((acc, ticket) => {
            const sellerId = ticket.sellerId;
            const sellerName = usersMap && usersMap[sellerId]?.name ? usersMap[sellerId].name : (ticket.sellerName || 'Venditore Sconosciuto');
            
            if (!acc[sellerId]) {
              acc[sellerId] = {
                sellerName: sellerName,
                totalTicketsSold: 0,
                totalRevenue: 0,
                totalCommissions: 0,
                ticketsByType: {},
              };
            }

            const quantity = Number(ticket.quantity) || 0;
            const totalPrice = Number(ticket.totalPrice) || 0;
            const commissionAmount = Number(ticket.commissionAmount) || 0;
            const ticketTypeName = ticket.itemName || 'Tipo Sconosciuto';

            acc[sellerId].totalTicketsSold += quantity;
            acc[sellerId].totalRevenue += totalPrice;
            acc[sellerId].totalCommissions += commissionAmount;
            acc[sellerId].ticketsByType[ticketTypeName] = (acc[sellerId].ticketsByType[ticketTypeName] || 0) + quantity;
            
            return acc;
          }, {});

          const overallTotals = {
            tickets: Object.values(aggregatedReport).reduce((sum, data) => sum + data.totalTicketsSold, 0),
            revenue: Object.values(aggregatedReport).reduce((sum, data) => sum + data.totalRevenue, 0),
            commissions: Object.values(aggregatedReport).reduce((sum, data) => sum + data.totalCommissions, 0),
          };

          setReportData({ aggregated: aggregatedReport, totals: overallTotals, ticketsBySellerForModal });

        } catch (err) {
          console.error("Error generating report:", err);
          setError("Errore nella generazione del report: " + err.message);
        } finally {
          setLoading(false);
        }
      }
    };

    generateReport();
  }, [selectedEventId, selectedEventDate, usersMap, currentUser.uid]);

  const handleUpdateTicketPaymentStatus = async (ticketId, newPaymentStatus) => {
    if (!selectedSellerIdForModal) {
      console.error("Seller ID for modal is not set, cannot update payment status.");
      setError("Impossibile aggiornare lo stato del pagamento: venditore non identificato.");
      return;
    }
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      await updateDoc(ticketRef, {
        paymentStatus: newPaymentStatus
      });

      const updatedTicketsForSeller = selectedSellerTickets.map(ticket => 
        ticket.id === ticketId ? { ...ticket, paymentStatus: newPaymentStatus } : ticket
      );
      setSelectedSellerTickets(updatedTicketsForSeller);

      setReportData(prevReportData => {
        if (!prevReportData || !prevReportData.ticketsBySellerForModal) return prevReportData;

        const sellerTickets = prevReportData.ticketsBySellerForModal[selectedSellerIdForModal] || [];
        const updatedSellerSpecificTickets = sellerTickets.map(ticket => 
          ticket.id === ticketId ? { ...ticket, paymentStatus: newPaymentStatus } : ticket
        );

        return {
          ...prevReportData,
          ticketsBySellerForModal: {
            ...prevReportData.ticketsBySellerForModal,
            [selectedSellerIdForModal]: updatedSellerSpecificTickets
          }
        };
      });

      console.log(`Stato pagamento per il biglietto ${ticketId} aggiornato a ${newPaymentStatus}`);

    } catch (err) {
      console.error("Error updating ticket payment status:", err);
      setError("Errore nell'aggiornamento dello stato di pagamento del biglietto.");
    }
  };

  const handleShowSellerTicketDetails = (sellerId, sellerName) => {
    if (reportData && reportData.ticketsBySellerForModal && reportData.ticketsBySellerForModal[sellerId]) {
      setSelectedSellerIdForModal(sellerId);
      setSelectedSellerTickets(reportData.ticketsBySellerForModal[sellerId]);
      setSelectedSellerNameForModal(sellerName);
      setIsDetailModalOpen(true);
    } else {
      console.warn("Dati biglietti per il venditore non trovati.");
    }
  };
  
  const handleCloseSellerTicketDetails = () => {
    setIsDetailModalOpen(false);
    setSelectedSellerIdForModal(null);
  };

  return (
    <div className="sales-reports-container">
      <h2 className="main-title">Report Vendite Dettagliato</h2>
      
      {error && <p className="error-message">{error}</p>}

      <div className="filters-section">
        <div className="filter-control">
          <label htmlFor="event-select">Seleziona Evento:</label>
          <select 
            id="event-select" 
            value={selectedEventId} 
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={loading || events.length === 0}
          >
            <option value="">-- Seleziona un evento --</option>
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>

        {selectedEventId && (
          <div className="filter-control">
            <label htmlFor="date-select">Seleziona Data Evento:</label>
            <select 
              id="date-select" 
              value={selectedEventDate} 
              onChange={(e) => setSelectedEventDate(e.target.value)}
              disabled={loading || eventDates.length === 0}
            >
              <option value="">-- Seleziona una data --</option>
              {eventDates.map(date => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString('it-IT')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <div className="loading-message">Caricamento report in corso...</div>}

      {reportData && (
        <div className="report-content">
          <div className="totals-section">
            <div className="total-box">
              <h3>Totale Biglietti</h3>
              <p>{reportData.totals.tickets}</p>
            </div>
            <div className="total-box">
              <h3>Ricavo Totale</h3>
              <p>€{reportData.totals.revenue.toFixed(2)}</p>
            </div>
            <div className="total-box">
              <h3>Commissioni Totali</h3>
              <p>€{reportData.totals.commissions.toFixed(2)}</p>
            </div>
          </div>

          <div className="sellers-section">
            <h3>Dettaglio per Venditore</h3>
            <div className="sellers-grid">
              {Object.entries(reportData.aggregated).map(([sellerId, data]) => (
                <div key={sellerId} className="seller-card" onClick={() => handleShowSellerTicketDetails(sellerId, data.sellerName)}>
                  <h4>{data.sellerName}</h4>
                  <div className="seller-stats">
                    <p>Biglietti: {data.totalTicketsSold}</p>
                    <p>Ricavo: €{data.totalRevenue.toFixed(2)}</p>
                    <p>Commissioni: €{data.totalCommissions.toFixed(2)}</p>
                  </div>
                  <div className="ticket-types">
                    {Object.entries(data.ticketsByType).map(([type, count]) => (
                      <p key={type}>{type}: {count}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isDetailModalOpen && (
        <SellerTicketsDetailModal
          isOpen={isDetailModalOpen}
          onClose={handleCloseSellerTicketDetails}
          tickets={selectedSellerTickets}
          sellerName={selectedSellerNameForModal}
          onUpdatePaymentStatus={handleUpdateTicketPaymentStatus}
        />
      )}
    </div>
  );
}

export default SalesReports; 