import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { FaSearch, FaTimesCircle, FaCheckCircle, FaBan, FaUndo, FaInfoCircle, FaWhatsapp, FaTrash, FaShoppingCart, FaQuestionCircle } from 'react-icons/fa';
import './TicketHistory.css';

function TicketHistory() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [events, setEvents] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [cancellingTicket, setCancellingTicket] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchTickets();
    fetchEvents();
  }, [page, statusFilter, eventFilter]);

  async function fetchTickets() {
    try {
      setLoading(true);
      setError(null);

      // Costruisce la query base
      let ticketsQuery = collection(db, 'tickets');
      let conditions = [];

      // Applica filtri solo se sono validi
      if (statusFilter && statusFilter !== 'all') {
        conditions.push(where('status', '==', statusFilter));
      }

      if (eventFilter && eventFilter !== 'all') {
        conditions.push(where('eventId', '==', eventFilter));
      }

      // Crea query con condizioni
      if (conditions.length > 0) {
        ticketsQuery = query(
          collection(db, 'tickets'),
          ...conditions,
          orderBy('createdAt', 'desc'),
          limit(itemsPerPage)
        );
      } else {
        ticketsQuery = query(
          collection(db, 'tickets'),
          orderBy('createdAt', 'desc'),
          limit(itemsPerPage)
        );
      }

      const snapshot = await getDocs(ticketsQuery);
      const ticketsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          eventId: data.eventId || data.event_id || null,
          createdAtFormatted: formatDate(data.soldAt || data.createdAt),
          qrCode: data.qrCode || data.qr_code || null,
          code: data.code || data.ticketCode || null,
          eventName: data.eventName || data.event_name || 'Evento non specificato',
          customerName: data.customerName || data.customer_name || 'Cliente non specificato',
          customerEmail: data.customerEmail || data.customer_email || 'Email non specificata',
          status: data.status || 'active',
          price: data.price || data.ticketPrice || 0,
          totalPrice: data.totalPrice || data.total_price || 0,
          quantity: data.quantity || 1,
          eventDate: data.eventDate || data.event_date,
          eventLocation: data.eventLocation || data.event_location,
          ticketType: data.ticketType || data.ticket_type || 'Standard',
          tableNumber: data.tableNumber || data.table_number,
          sellerId: data.sellerId || data.seller_id,
          sellerName: data.sellerName || data.seller_name,
          usedAt: data.usedAt || data.used_at,
          cancelledAt: data.cancelledAt || data.cancelled_at,
          previousStatus: data.previousStatus || data.previous_status
        };
      });

      setTickets(ticketsData);
      
      // Stima del numero totale di pagine
      const totalTicketsQuery = collection(db, 'tickets');
      const totalSnapshot = await getDocs(totalTicketsQuery);
      setTotalPages(Math.ceil(totalSnapshot.size / itemsPerPage));
      
      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero dei biglietti:', error);
      setError('Si è verificato un errore nel caricamento dei biglietti.');
      setLoading(false);
    }
  }

  async function fetchEvents() {
    try {
      const eventsRef = collection(db, 'events');
      const snapshot = await getDocs(eventsRef);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
    } catch (error) {
      console.error('Errore nel recupero degli eventi:', error);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      fetchTickets(); // Se la ricerca è vuota, ricarica tutti i biglietti
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const lowerQuery = searchQuery.toLowerCase();
      const ticketsRef = collection(db, 'tickets');
      let searchResults = [];
      
      // Cerca per codice esatto
      if (/^[a-zA-Z0-9]+$/.test(searchQuery)) {
        const [codeSnapshot, ticketCodeSnapshot] = await Promise.all([
          getDocs(query(ticketsRef, where('code', '==', searchQuery))),
          getDocs(query(ticketsRef, where('ticketCode', '==', searchQuery)))
        ]);
        
        searchResults = [...codeSnapshot.docs, ...ticketCodeSnapshot.docs];
      }
      
      // Se non trova risultati esatti per codice, cerca in tutti i campi
      if (searchResults.length === 0) {
        // Esegui ricerche separate per ogni campo
        const [
          customerNameSnapshot,
          customerEmailSnapshot,
          eventNameSnapshot,
          codePartialSnapshot,
          ticketCodePartialSnapshot
        ] = await Promise.all([
          getDocs(query(ticketsRef, where('customerName', '>=', lowerQuery), where('customerName', '<=', lowerQuery + '\uf8ff'), limit(50))),
          getDocs(query(ticketsRef, where('customerEmail', '>=', lowerQuery), where('customerEmail', '<=', lowerQuery + '\uf8ff'), limit(50))),
          getDocs(query(ticketsRef, where('eventName', '>=', lowerQuery), where('eventName', '<=', lowerQuery + '\uf8ff'), limit(50))),
          getDocs(query(ticketsRef, where('code', '>=', lowerQuery), where('code', '<=', lowerQuery + '\uf8ff'), limit(50))),
          getDocs(query(ticketsRef, where('ticketCode', '>=', lowerQuery), where('ticketCode', '<=', lowerQuery + '\uf8ff'), limit(50)))
        ]);

        // Unisci i risultati rimuovendo i duplicati
        const seenIds = new Set();
        searchResults = [
          ...customerNameSnapshot.docs,
          ...customerEmailSnapshot.docs,
          ...eventNameSnapshot.docs,
          ...codePartialSnapshot.docs,
          ...ticketCodePartialSnapshot.docs
        ].filter(doc => {
          if (seenIds.has(doc.id)) return false;
          seenIds.add(doc.id);
          return true;
        });
      }

      // Mappa i risultati nel formato corretto
      const ticketsData = searchResults.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          eventId: data.eventId || data.event_id || null,
          createdAtFormatted: formatDate(data.soldAt || data.createdAt),
          qrCode: data.qrCode || data.qr_code || null,
          code: data.code || data.ticketCode || null,
          eventName: data.eventName || data.event_name || 'Evento non specificato',
          customerName: data.customerName || data.customer_name || 'Cliente non specificato',
          customerEmail: data.customerEmail || data.customer_email || 'Email non specificata',
          status: data.status || 'active',
          price: data.price || data.ticketPrice || 0,
          totalPrice: data.totalPrice || data.total_price || 0,
          quantity: data.quantity || 1,
          eventDate: data.eventDate || data.event_date,
          eventLocation: data.eventLocation || data.event_location,
          ticketType: data.ticketType || data.ticket_type || 'Standard',
          tableNumber: data.tableNumber || data.table_number,
          sellerId: data.sellerId || data.seller_id,
          sellerName: data.sellerName || data.seller_name,
          usedAt: data.usedAt || data.used_at,
          cancelledAt: data.cancelledAt || data.cancelled_at,
          previousStatus: data.previousStatus || data.previous_status
        };
      });

      // Ordina i risultati per data di creazione (più recenti prima)
      ticketsData.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      setTickets(ticketsData);
      
      if (ticketsData.length === 0) {
        setError('Nessun biglietto trovato con i criteri di ricerca specificati.');
      }
    } catch (error) {
      console.error('Errore nella ricerca:', error);
      setError('Si è verificato un errore durante la ricerca. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date) {
    if (!date) return 'N/D';
    
    if (typeof date === 'string') {
      return new Date(date).toLocaleString('it-IT');
    }
    
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleString('it-IT');
    }
    
    if (date instanceof Date) {
      return date.toLocaleString('it-IT');
    }
    
    return 'N/D';
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active':
        return 'Attivo';
      case 'validated':
        return 'Validato';
      case 'disabled':
        return 'Disabilitato';
      case 'sold':
        return 'Venduto';
      case 'cancelled':
        return 'Cancellato';
      default:
        return 'Sconosciuto';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <FaCheckCircle className="status-icon active" />;
      case 'validated':
        return <FaCheckCircle className="status-icon validated" />;
      case 'disabled':
        return <FaBan className="status-icon disabled" />;
      case 'sold':
        return <FaShoppingCart className="status-icon sold" />;
      case 'cancelled':
        return <FaTimesCircle className="status-icon cancelled" />;
      default:
        return <FaQuestionCircle className="status-icon" />;
    }
  };

  return (
    <div className="ticket-history">
      <h2>Storico Biglietti</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      
      <div className="filters-container">
        <div className="search-container">
          <input
            type="text"
            placeholder="Cerca per codice, cliente, email o evento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-button">
            <FaSearch /> Cerca
          </button>
        </div>
        
        <div className="filters">
          <div className="filter">
            <label>Stato:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tutti</option>
              <option value="active">Attivo</option>
              <option value="validated">Validato</option>
              <option value="disabled">Disabilitato</option>
              <option value="cancelled">Annullato</option>
            </select>
          </div>
          
          <div className="filter">
            <label>Evento:</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tutti</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="loading">Caricamento biglietti...</div>
      ) : tickets.length === 0 ? (
        <div className="no-tickets">
          Nessun biglietto trovato. Prova a modificare i filtri di ricerca.
        </div>
      ) : (
        <>
          <div className="table-responsive-wrapper tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Evento</th>
                  <th>Cliente</th>
                  <th>Data Vendita</th>
                  <th>Quantità</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => (
                  <tr key={ticket.id} className={`status-${ticket.status}`}>
                    <td>{ticket.code}</td>
                    <td>{ticket.eventName}</td>
                    <td>{ticket.customerName}</td>
                    <td>{ticket.createdAtFormatted}</td>
                    <td>{ticket.quantity}</td>
                    <td>
                      <div className="status">
                        {getStatusIcon(ticket.status)}
                        <span>{getStatusLabel(ticket.status)}</span>
                      </div>
                    </td>
                    <td className="ticket-actions">
                      <button 
                        onClick={() => setSelectedTicket(ticket)} 
                        className="action-btn details-btn"
                        title="Vedi Dettagli"
                      >
                        <FaInfoCircle />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="pagination">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="pagination-btn"
            >
              Precedente
            </button>
            <span className="page-info">
              Pagina {page} di {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => p < totalPages ? p + 1 : p)}
              disabled={page >= totalPages}
              className="pagination-btn"
            >
              Successiva
            </button>
          </div>
        </>
      )}
      
      {selectedTicket && (
        <div className="modal">
          <div className="modal-content">
            <h3>Dettagli Biglietto</h3>
            <div className="ticket-details">
              <p><strong>Codice:</strong> {selectedTicket.code}</p>
              <p><strong>Evento:</strong> {selectedTicket.eventName}</p>
              <p><strong>Cliente:</strong> {selectedTicket.customerName}</p>
              <p><strong>Email:</strong> {selectedTicket.customerEmail}</p>
              <p><strong>Data Vendita:</strong> {selectedTicket.createdAtFormatted}</p>
              <p><strong>Quantità:</strong> {selectedTicket.quantity}</p>
              <p><strong>Stato:</strong> {getStatusLabel(selectedTicket.status)}</p>
              {selectedTicket.eventDate && (
                <p><strong>Data Evento:</strong> {formatDate(selectedTicket.eventDate)}</p>
              )}
              {selectedTicket.eventLocation && (
                <p><strong>Luogo:</strong> {selectedTicket.eventLocation}</p>
              )}
            </div>
            <button onClick={() => setSelectedTicket(null)} className="close-btn">
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketHistory; 