import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import CreateEventModal from './CreateEventModal';
import EditEventModal from './EditEventModal';
import EventStatistics from '../events/EventStatistics';
import './AdminStyles.css';

function EventManagement() {
  const [events, setEvents] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventForStats, setSelectedEventForStats] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    if (window.confirm('Sei sicuro di voler eliminare questo evento? Questa azione non può essere annullata.')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Errore durante l\'eliminazione dell\'evento');
      }
    }
  }

  if (loading) {
    return <div>Caricamento eventi...</div>;
  }

  return (
    <div className="event-management">
      <div className="section-header">
        <h2>Gestione Eventi</h2>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Nuovo Evento
        </button>
      </div>

      <div className="events-grid">
        {events.map(event => (
          <div key={event.id} className="event-card">
            <div className="event-header">
              <h3>{event.name}</h3>
              <span className={`status-badge ${event.status}`}>
                {event.status}
              </span>
            </div>
            
            <div className="event-details">
              <p><strong>Data:</strong> {new Date(event.date).toLocaleDateString()}</p>
              <p><strong>Luogo:</strong> {event.location}</p>
              <p><strong>Prezzo:</strong> €{event.price}</p>
              <p><strong>Biglietti disponibili:</strong> {event.availableTickets}</p>
            </div>

            <div className="event-actions">
              <button 
                className="btn-edit"
                onClick={() => setEditingEvent(event)}
              >
                Modifica
              </button>
              <button 
                className="btn-info"
                onClick={() => setSelectedEventForStats(event)}
              >
                Statistiche
              </button>
              <button 
                className="btn-delete"
                onClick={() => handleDeleteEvent(event.id)}
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onEventCreated={fetchEvents}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onEventUpdated={fetchEvents}
        />
      )}

      {selectedEventForStats && (
        <EventStatistics
          event={selectedEventForStats}
          onClose={() => setSelectedEventForStats(null)}
        />
      )}
    </div>
  );
}

export default EventManagement; 