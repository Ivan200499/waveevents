import React, { useState } from 'react';
import './EventCard.css';

function EventCard({ event, onSell }) {
  const [selectedDate, setSelectedDate] = useState('');
  const [showDateSelector, setShowDateSelector] = useState(false);

  if (!event || !event.eventDates || event.eventDates.length === 0) {
    // Se non ci sono dati validi o date, non mostrare la card
    return null;
  }

  // Formattatore data (riutilizzabile)
  const formatDate = (dateString) => {
    if (!dateString) return "Data non specificata";
    try {
      const dateObj = new Date(dateString);
      if (isNaN(dateObj.getTime())) return "Data non valida";
      const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      return dateObj.toLocaleDateString('it-IT', options);
    } catch (e) {
        return "Data non valida";
    }
  };

  // Calcola il range di prezzo generale tra tutte le date e tipi
  const getOverallPriceRange = () => {
    let minPrice = Infinity;
    let maxPrice = 0;
    let hasAnyTickets = false;

    event.eventDates.forEach(dateItem => {
      dateItem.ticketTypes?.forEach(ticket => {
        const price = Number(ticket.price);
        if (!isNaN(price)) {
          hasAnyTickets = true;
          minPrice = Math.min(minPrice, price);
          maxPrice = Math.max(maxPrice, price);
        }
      });
      // Considera anche i tavoli se presenti nel calcolo del range
      if (dateItem.hasTablesForDate) {
          dateItem.tableTypes?.forEach(table => {
            const price = Number(table.price);
            if (!isNaN(price)) {
              hasAnyTickets = true;
              minPrice = Math.min(minPrice, price);
              maxPrice = Math.max(maxPrice, price);
            }
          });
      }
    });

    if (!hasAnyTickets) return { min: 0, max: 0, text: "N/D" };
    if (minPrice === maxPrice) return { min: minPrice, max: maxPrice, text: `€${minPrice.toFixed(2)}` };
    return { min: minPrice, max: maxPrice, text: `da €${minPrice.toFixed(2)} a €${maxPrice.toFixed(2)}` };
  };

  const priceInfo = getOverallPriceRange();

  // Gestore per il pulsante "Vendi"
  const handleSellClick = () => {
    if (event.eventDates.length === 1) {
      // Se c'è solo una data, vendi direttamente per quella
      onSell(event, event.eventDates[0]);
    } else {
      // Altrimenti mostra il selettore date
      setShowDateSelector(true);
    }
  };

  // Gestore per la selezione della data
  const handleDateSelection = (dateItem) => {
    setSelectedDate(dateItem.date);
    setShowDateSelector(false);
    onSell(event, dateItem); // Chiama onSell con l'evento e la data selezionata
  };

  return (
    <div className="event-card">
      {/* Mostra locandina se disponibile */} 
      {event.posterImageUrl && (
        <div className="event-image">
          <img src={event.posterImageUrl} alt={event.name} />
        </div>
      )}
      <div className="event-content">
        <h3>{event.name}</h3>
        <p className="event-location">Luogo: {event.location || "N/D"}</p>

        {/* Elenco Date */} 
        <div className="event-dates-list">
          <h5>Date Disponibili:</h5>
          <ul>
            {event.eventDates.map((dateItem, index) => (
              <li key={dateItem.id || index}>{formatDate(dateItem.date)}</li>
            ))}
          </ul>
        </div>

         {/* Info Generali (Prezzo Range, Descrizione) */} 
        <div className="event-general-info">
             <p className="price-range">Prezzo: {priceInfo.text}</p>
            <p className="availability-note">Disponibilità e tipi biglietti/tavoli variano per data.</p>
            {event.description && (
             <div className="event-description">
                <p>{event.description}</p>
              </div>
             )}
        </div>


        {/* Pulsante Vendi / Selettore Data */} 
        {!showDateSelector ? (
          <button 
            onClick={handleSellClick}
            className="sell-button"
            // Disabilita se non ci sono date? O la logica di vendita gestirà date senza biglietti?
            // disabled={event.eventDates.length === 0} 
          >
            {event.eventDates.length === 1 ? 'Vendi Ticket' : 'Seleziona Data per Vendere'}
          </button>
        ) : (
          <div className="date-selector">
            <h5>Seleziona la data per la vendita:</h5>
            <ul>
              {event.eventDates.map((dateItem, index) => (
                <li key={dateItem.id || index}>
                  <button onClick={() => handleDateSelection(dateItem)} className="date-select-button">
                    {formatDate(dateItem.date)}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowDateSelector(false)} className="cancel-date-select">Annulla</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventCard; 