import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './UserTicketHistoryModal.css'; // Creeremo questo CSS
import { FaTimes, FaTicketAlt, FaCalendarAlt, FaEuroSign, FaInfoCircle, FaCheckCircle, FaBan, FaTimesCircle } from 'react-icons/fa';

// Helper per formattare date (può essere spostato in un file utils)
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Helper per lo stato (duplicato da TicketHistory.js, considerare refactoring in utils)
function getStatusLabel(status) {
    switch (status) {
      case 'active': return 'Attivo';
      case 'validated': return 'Validato';
      case 'disabled': return 'Disabilitato';
      case 'cancelled': return 'Annullato'; // Se mantenuto
      default: return status || 'Sconosciuto';
    }
}

function getStatusIcon(status) {
    switch (status) {
      case 'active': return <FaCheckCircle className="status-icon active" title="Attivo"/>;
      case 'validated': return <FaCheckCircle className="status-icon validated" title="Validato"/>;
      case 'disabled': return <FaBan className="status-icon disabled" title="Disabilitato"/>;
      case 'cancelled': return <FaTimesCircle className="status-icon cancelled" title="Annullato"/>;
      default: return <FaInfoCircle className="status-icon unknown" title="Sconosciuto"/>;
    }
}


function UserTicketHistoryModal({ member, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTickets = async () => {
      if (!member?.id) {
        setError('ID membro non fornito');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, where('sellerId', '==', member.id));
        const querySnapshot = await getDocs(q);
        
        const tickets = querySnapshot.docs.map(doc => {
          const data = doc.data();
          // Usa la data di creazione del documento come fallback se createdAt non è presente
          const createdAt = data.createdAt || doc.createTime?.toDate() || new Date();
          return {
            id: doc.id,
            ...data,
            createdAt,
            // Assicurati che i campi necessari siano presenti
            eventName: data.eventName || 'N/D',
            code: data.code || data.ticketCode || 'N/D',
            customerName: data.customerName || 'N/D',
            status: data.status || 'active',
            quantity: data.quantity || 1,
            totalPrice: data.totalPrice || data.price || 0,
            ticketType: data.ticketType || data.ticketTypeName || 'Standard',
            eventDate: data.eventDate,
            eventLocation: data.eventLocation || 'N/D',
            tableInfo: data.tableInfo
          };
        });

        // Ordina i biglietti per data di creazione
        tickets.sort((a, b) => b.createdAt - a.createdAt);
        
        setTickets(tickets);
        console.log(`Fetched and sorted ${tickets.length} tickets for member ${member.id}`);
      } catch (error) {
        console.error('Error fetching tickets:', error);
        setError('Errore nel caricamento dei biglietti. Riprova più tardi.');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [member]);

  return (
    <div className="modal-overlay user-ticket-history-modal-overlay" onClick={onClose}>
      <div className="modal-content user-ticket-history-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} title="Chiudi">
          <FaTimes />
        </button>
        
        <h2>Storico Biglietti Venduti - {member.name || 'Utente'}</h2>

        {loading && <div className="loading-container"><div className="loading-spinner"></div> Caricamento biglietti...</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && (
          <div className="tickets-table-container modal-table-container">
            {tickets.length > 0 ? (
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th><FaCalendarAlt /> Evento</th>
                    <th>Codice</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Data Evento</th>
                    <th>Luogo</th>
                    <th>Data Vendita</th>
                    <th>Q.tà</th>
                    <th><FaEuroSign /> Incasso</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.eventName}</td>
                      <td>{ticket.code}</td>
                      <td>{ticket.customerName}</td>
                      <td>
                        {ticket.ticketType}
                        {ticket.tableInfo && (
                          <span className="table-info-badge" title={`Tavolo: ${ticket.tableInfo.type?.name || 'N/D'}, Posti: ${ticket.tableInfo.seats || ticket.tableInfo.type?.seats || 'N/D'}`}> (Tavolo)</span>
                        )}
                      </td>
                      <td>{ticket.eventDateFormatted}</td>
                      <td>{ticket.eventLocation}</td>
                      <td>{ticket.createdAtFormatted}</td>
                      <td>{ticket.quantity}</td>
                      <td>€ {ticket.totalPrice.toFixed(2)}</td>
                      <td>
                        <span className={`status-badge ${ticket.status}`}>
                           {getStatusIcon(ticket.status)} 
                           {getStatusLabel(ticket.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-results">Nessun biglietto trovato per questo utente.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserTicketHistoryModal;