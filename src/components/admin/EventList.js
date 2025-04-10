import { FaCalendarAlt } from 'react-icons/fa';

function EventList({ events, onEdit, onDelete }) {
  return (
    <div className="events-grid">
      {events.map(event => (
        <div key={event.id} className="event-card">
          {/* Aggiungiamo la sezione immagine usando posterImageUrl */}
          {event.posterImageUrl && (
            <div className="event-image">
              <img src={event.posterImageUrl} alt={event.name} />
            </div>
          )}
          <div className="event-content">
            <h3>{event.name}</h3>
            {event.isRecurring ? (
              <div className="event-dates">
                <h4><FaCalendarAlt /> Date disponibili:</h4>
                <div className="dates-list">
                  {event.dates.map((date, index) => (
                    <div key={index} className="date-item">
                      {new Date(date.date).toLocaleDateString()} - {date.availableTickets} biglietti
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p><FaCalendarAlt /> Data: {new Date(event.date).toLocaleDateString()}</p>
            )}
            <p>Luogo: {event.location}</p>
            <p>Prezzo: €{event.price}</p>
            {event.description && (
              <div className="event-description">
                <p>{event.description}</p>
              </div>
            )}
            <div className="event-actions">
              <button onClick={() => onEdit(event)} className="edit-button">
                Modifica
              </button>
              <button onClick={() => onDelete(event.id)} className="delete-button">
                Elimina
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EventList; 