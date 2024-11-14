import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import CreateEvent from '../events/CreateEvent';
import { notifyPromoter } from '../../services/NotificationService';

function TeamLeaderDashboard() {
  const { currentUser } = useAuth();
  const [promoters, setPromoters] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  async function fetchData() {
    try {
      // Recupera promoter del team
      const promotersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'promoter'),
        where('teamLeaderId', '==', currentUser.uid)
      );
      const promotersSnapshot = await getDocs(promotersQuery);
      const promotersData = promotersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPromoters(promotersData);

      // Recupera eventi
      const eventsQuery = query(
        collection(db, 'events'),
        where('createdBy', '==', currentUser.uid)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsData = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);

      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero dei dati:', error);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  async function handlePromoterStatusChange(promoterId, newStatus) {
    try {
      const promoterRef = doc(db, 'users', promoterId);
      await updateDoc(promoterRef, {
        status: newStatus
      });

      // Invia notifica al promoter
      await notifyPromoter(promoterId,
        'Cambio stato account',
        `Il tuo account è stato ${newStatus === 'active' ? 'sbloccato' : 'bloccato'} dal team leader`
      );

      // Aggiorna i dati
      fetchData();
    } catch (error) {
      console.error('Errore nel cambio di stato del promoter:', error);
    }
  }

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div>
      <h2>Dashboard Team Leader</h2>
      
      <button
        onClick={() => setShowCreateEvent(!showCreateEvent)}
        style={{
          padding: '10px 20px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        {showCreateEvent ? 'Nascondi' : 'Crea Nuovo Evento'}
      </button>

      {showCreateEvent && (
        <CreateEvent onEventCreated={() => {
          fetchData();
          setShowCreateEvent(false);
        }} />
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h3>I Miei Promoter</h3>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {promoters.map(promoter => (
            <div key={promoter.id} style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <h4>{promoter.name}</h4>
              <p>Email: {promoter.email}</p>
              <p>Status: {promoter.status}</p>
              <button
                onClick={() => handlePromoterStatusChange(
                  promoter.id,
                  promoter.status === 'active' ? 'blocked' : 'active'
                )}
                style={{
                  padding: '5px 10px',
                  backgroundColor: promoter.status === 'active' ? '#ff4444' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {promoter.status === 'active' ? 'Blocca' : 'Sblocca'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>I Miei Eventi</h3>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {events.map(event => (
            <div key={event.id} style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <h4>{event.name}</h4>
              <p>Data: {new Date(event.date).toLocaleDateString()}</p>
              <p>Luogo: {event.location}</p>
              <p>Prezzo: €{event.price}</p>
              <p>Biglietti disponibili: {event.availableTickets}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TeamLeaderDashboard; 