import React from 'react';
import './EventCard.css';

function EventCard({ event, onSell }) {
  // Controlla che event sia definito
  if (!event) {
    return null;
  }

  // Formatta la data in modo leggibile
  const formatDate = (dateString) => {
    if (!dateString) return "Data non disponibile";
    
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return "Data non valida";
    
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return dateObj.toLocaleDateString('it-IT', options);
  };

  // Verifica se l'evento ha date ricorrenti valide
  const hasValidRecurringDates = event.isRecurring && 
                               Array.isArray(event.dates) && 
                               event.dates.length > 0 &&
                               event.dates[0].date;

  // Calcola il prezzo minimo e massimo dai tipi di biglietti
  const getTicketPriceRange = () => {
    if (!event.ticketTypes || !Array.isArray(event.ticketTypes) || event.ticketTypes.length === 0) {
      return { min: Number(event.price || 0), max: Number(event.price || 0) };
    }
    
    const prices = event.ticketTypes.map(t => Number(t.price || 0)).filter(p => !isNaN(p));
    if (prices.length === 0) return { min: 0, max: 0 };
    
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  };

  const priceRange = getTicketPriceRange();

  return (
    <div className="event-card">
      {event.imageUrl && (
        <div className="event-image">
          <img src={event.imageUrl} alt={event.name} />
        </div>
      )}
      <div className="event-content">
        <h3>{event.name}</h3>
        
        {hasValidRecurringDates ? (
          <div className="event-dates">
            <p className="next-date">Prossima data: {formatDate(event.date || event.dates[0].date)}</p>
            <p className="total-dates">
              {event.dates.length > 1 
                ? `+${event.dates.length - 1} altre date disponibili` 
                : 'Ultima data disponibile'}
            </p>
          </div>
        ) : (
          <p className="event-date">Data: {formatDate(event.date)}</p>
        )}
        
        <p className="event-location">Luogo: {event.location || "Luogo non specificato"}</p>
        
        <div className="ticket-info">
          {event.ticketTypes && Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0 ? (
            <>
              <p className="ticket-types">
                Tipi di biglietti: {event.ticketTypes.length}
              </p>
              <p className="price-range">
                Prezzo: da €{priceRange.min.toFixed(2)} 
                {priceRange.min !== priceRange.max ? ` a €${priceRange.max.toFixed(2)}` : ''}
              </p>
            </>
          ) : (
            <p className="event-price">Prezzo: €{Number(event.price || 0).toFixed(2)}</p>
          )}
          
          <p className="tickets-available">
            Biglietti disponibili: {event.availableTickets || 0}
          </p>
        </div>
        
        {event.hasTables && (
          <div className="table-info">
            <p>Tavoli disponibili</p>
            {event.tableTypes && Array.isArray(event.tableTypes) && event.tableTypes.length > 0 && (
              <p className="table-types-count">{event.tableTypes.length} tipi di tavoli</p>
            )}
          </div>
        )}
        
        {event.description && (
          <div className="event-description">
            <p>{event.description}</p>
          </div>
        )}
        
        <button 
          onClick={() => onSell(event)}
          className="sell-button"
          disabled={event.availableTickets === 0}
        >
          Vendi Ticket
        </button>
      </div>
    </div>
  );
}

export default EventCard; 