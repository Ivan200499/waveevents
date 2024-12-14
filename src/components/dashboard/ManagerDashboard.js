import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import CreateEvent from '../events/CreateEvent';
import CreateTeamLeader from '../auth/CreateTeamLeader';
import TeamStatistics from '../statistics/TeamStatistics';
import EditEvent from '../events/EditEvent';
import CreatePromoter from '../auth/CreatePromoter';
import { FaUserTie, FaUsers, FaUser, FaChartBar, FaCalendar, FaMapMarkerAlt, FaEuroSign, FaEdit, FaTrash, FaPlus, FaUserPlus, FaCalendarAlt, FaExclamationTriangle } from 'react-icons/fa';
import './ManagerDashboard.css';

function TeamLeaderCard({ leader, onViewStats, onDelete }) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    onDelete(leader.id);
    setShowConfirmDelete(false);
  };

  return (
    <div className="card team-leader-card">
      <div className="card-header">
        <div className="header-content">
          <FaUserTie className="leader-icon" />
          <div>
            <h4>{leader.name}</h4>
            <span className="email">{leader.email}</span>
          </div>
        </div>
        <div className="stats-badge">
          {leader.promoters.length} Promoter
        </div>
      </div>

      <div className="card-actions">
        <button 
          className="btn btn-primary"
          onClick={() => onViewStats(leader.id)}
        >
          <FaChartBar /> Statistiche
        </button>
        <button 
          className="btn btn-danger"
          onClick={handleDeleteClick}
        >
          <FaTrash /> Elimina
        </button>
      </div>

      {leader.promoters.length > 0 && (
        <div className="promoters-list">
          <h5><FaUsers /> Promoter del Team</h5>
          {leader.promoters.map(promoter => (
            <div key={promoter.id} className="promoter-item">
              <FaUser className="promoter-icon" />
              <div>
                <div className="promoter-name">{promoter.name}</div>
                <div className="promoter-email">{promoter.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showConfirmDelete && (
        <div className="modal">
          <div className="modal-content delete-confirmation">
            <h3>Conferma Eliminazione</h3>
            <p>Sei sicuro di voler eliminare il team leader {leader.name}?</p>
            {leader.promoters.length > 0 && (
              <div className="warning-message">
                <FaExclamationTriangle /> Questo team leader ha {leader.promoters.length} promoter attivi.
                I promoter verranno scollegati dal team.
              </div>
            )}
            <div className="confirmation-actions">
              <button 
                className="btn btn-danger"
                onClick={handleConfirmDelete}
              >
                Conferma Eliminazione
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowConfirmDelete(false)}
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, onEdit, onDelete }) {
  return (
    <div className="card event-card">
      <div className="card-header">
        <h4>{event.name}</h4>
        <div className="event-status">
          {event.availableTickets > 0 ? (
            <span className="badge badge-success">
              {event.availableTickets} biglietti disponibili
            </span>
          ) : (
            <span className="badge badge-danger">Esaurito</span>
          )}
        </div>
      </div>

      <div className="event-details">
        <div className="detail-item">
          <FaCalendar className="icon" />
          <span>{new Date(event.date).toLocaleDateString()}</span>
        </div>
        <div className="detail-item">
          <FaMapMarkerAlt className="icon" />
          <span>{event.location}</span>
        </div>
        <div className="detail-item">
          <FaEuroSign className="icon" />
          <span>{event.price} €</span>
        </div>
      </div>

      <div className="card-actions">
        <button 
          className="btn btn-primary"
          onClick={() => onEdit(event)}
        >
          <FaEdit /> Modifica
        </button>
        <button 
          className="btn btn-danger"
          onClick={() => onDelete(event.id)}
        >
          <FaTrash /> Elimina
        </button>
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [events, setEvents] = useState([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateTeamLeader, setShowCreateTeamLeader] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showCreatePromoter, setShowCreatePromoter] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

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
        ...doc.data(),
        promoters: [] // Sarà popolato sotto
      }));

      // Per ogni team leader, recupera i suoi promoter
      for (let teamLeader of teamLeadersData) {
        const promotersQuery = query(
          collection(db, 'users'),
          where('teamLeaderId', '==', teamLeader.id),
          where('role', '==', 'promoter')
        );
        const promotersSnapshot = await getDocs(promotersQuery);
        teamLeader.promoters = promotersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      setTeamLeaders(teamLeadersData);

      // Recupera eventi
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      setEvents(eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));

      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero dei dati:', error);
      setLoading(false);
    }
  }

  async function handleDeleteEvent(eventId) {
    if (window.confirm('Sei sicuro di voler eliminare questo evento?')) {
      try {
        await updateDoc(doc(db, 'events', eventId), {
          status: 'deleted'
        });
        fetchData();
      } catch (error) {
        console.error('Errore nella cancellazione dell\'evento:', error);
      }
    }
  }

  async function handleDeleteTeamLeader(teamLeaderId) {
    try {
      // Prima aggiorna tutti i promoter del team leader
      const promotersQuery = query(
        collection(db, 'users'),
        where('teamLeaderId', '==', teamLeaderId)
      );
      const promotersSnapshot = await getDocs(promotersQuery);
      
      // Aggiorna lo stato di tutti i promoter
      const promoterUpdates = promotersSnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          teamLeaderId: '',
          status: 'inactive'
        })
      );
      await Promise.all(promoterUpdates);

      // Aggiorna lo stato del team leader
      await updateDoc(doc(db, 'users', teamLeaderId), {
        status: 'deleted',
        deletedAt: new Date().toISOString()
      });

      // Notifica il team leader
      await notifyTeamLeader(teamLeaderId, 
        'Account Eliminato',
        'Il tuo account è stato eliminato dall\'amministratore.'
      );

      // Notifica i promoter
      promotersSnapshot.docs.forEach(async (promoterDoc) => {
        await notifyPromoter(
          promoterDoc.id,
          'Team Leader Rimosso',
          'Il tuo team leader è stato rimosso. Verrai assegnato a un nuovo team.'
        );
      });

      // Aggiorna i dati nella dashboard
      fetchData();
    } catch (error) {
      console.error('Errore durante l\'eliminazione del team leader:', error);
    }
  }

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Dashboard Manager</h2>
        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateEvent(!showCreateEvent)}
          >
            <FaPlus /> {showCreateEvent ? 'Nascondi' : 'Nuovo Evento'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowCreateTeamLeader(!showCreateTeamLeader)}
          >
            <FaUserPlus /> {showCreateTeamLeader ? 'Nascondi' : 'Nuovo Team Leader'}
          </button>
          <button
            className="btn btn-success"
            onClick={() => setShowCreatePromoter(!showCreatePromoter)}
          >
            <FaUserPlus /> {showCreatePromoter ? 'Nascondi' : 'Nuovo Promoter'}
          </button>
        </div>
      </div>

      {/* Form di creazione */}
      {showCreateEvent && (
        <div className="create-form-container">
          <CreateEvent onEventCreated={() => {
            fetchData();
            setShowCreateEvent(false);
          }} />
        </div>
      )}

      {showCreateTeamLeader && (
        <div className="create-form-container">
          <CreateTeamLeader onTeamLeaderCreated={() => {
            fetchData();
            setShowCreateTeamLeader(false);
          }} />
        </div>
      )}

      {showCreatePromoter && (
        <div className="create-form-container">
          <CreatePromoter 
            teamLeaderId="" // Lasciamo vuoto per renderlo disponibile
            onPromoterCreated={() => {
              fetchData();
              setShowCreatePromoter(false);
            }} 
          />
        </div>
      )}

      {/* Sezione Team Leaders */}
      <section className="dashboard-section">
        <h3><FaUsers /> Team Leaders</h3>
        <div className="grid">
          {teamLeaders.map(leader => (
            <TeamLeaderCard
              key={leader.id}
              leader={leader}
              onViewStats={() => setSelectedTeam(leader.id)}
              onDelete={handleDeleteTeamLeader}
            />
          ))}
        </div>
      </section>

      {/* Sezione Eventi */}
      <section className="dashboard-section">
        <h3><FaCalendarAlt /> Eventi</h3>
        <div className="grid">
          {events.filter(event => event.status !== 'deleted').map(event => (
            <EventCard
              key={event.id}
              event={event}
              onEdit={setEditingEvent}
              onDelete={handleDeleteEvent}
            />
          ))}
        </div>
      </section>

      {/* Modali */}
      {selectedTeam && (
        <div className="modal">
          <div className="modal-content">
            <TeamStatistics 
              teamId={selectedTeam} 
              onClose={() => setSelectedTeam(null)}
            />
          </div>
        </div>
      )}

      {editingEvent && (
        <div className="modal">
          <div className="modal-content">
            <EditEvent 
              event={editingEvent}
              onClose={() => setEditingEvent(null)}
              onEventUpdated={() => {
                fetchData();
                setEditingEvent(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerDashboard; 