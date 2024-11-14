import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where } from 'firebase/firestore';

function ManagerDashboard() {
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Recupera team leader
        const teamLeadersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'teamLeader')
        );
        const teamLeadersSnapshot = await getDocs(teamLeadersQuery);
        const teamLeadersData = teamLeadersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTeamLeaders(teamLeadersData);

        // Recupera eventi
        const eventsSnapshot = await getDocs(collection(db, 'events'));
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

    fetchData();
  }, []);

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div>
      <h2>Dashboard Manager</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <h3>Team Leaders</h3>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {teamLeaders.map(leader => (
            <div key={leader.id} style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}>
              <h4>{leader.name}</h4>
              <p>Email: {leader.email}</p>
              <p>Status: {leader.status}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3>Eventi</h3>
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
              <p>Biglietti disponibili: {event.availableTickets}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ManagerDashboard; 