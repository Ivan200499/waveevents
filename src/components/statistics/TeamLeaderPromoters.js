import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FaUser, FaTicketAlt, FaEuroSign, FaSearch } from 'react-icons/fa';
import './TeamLeaderPromoters.css';

function TeamLeaderPromoters({ teamLeaderId }) {
  const [promoters, setPromoters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [promoterSearchTerm, setPromoterSearchTerm] = useState('');

  useEffect(() => {
    fetchPromoters();
  }, [teamLeaderId]);

  async function fetchPromoters() {
    try {
      setLoading(true);
      // Recupera tutti i promoter del team leader
      const promotersQuery = query(
        collection(db, 'users'),
        where('teamLeaderId', '==', teamLeaderId),
        where('role', '==', 'promoter')
      );
      const promotersSnapshot = await getDocs(promotersQuery);
      
      // Per ogni promoter, recupera le statistiche di vendita
      const promotersData = await Promise.all(
        promotersSnapshot.docs.map(async (doc) => {
          const promoterData = doc.data();
          
          // Recupera le statistiche di vendita del promoter
          const ticketsQuery = query(
            collection(db, 'tickets'),
            where('sellerId', '==', doc.id)
          );
          const ticketsSnapshot = await getDocs(ticketsQuery);
          
          let totalTickets = 0;
          let totalRevenue = 0;
          const eventStats = {};
          
          ticketsSnapshot.docs.forEach(ticketDoc => {
            const ticket = ticketDoc.data();
            totalTickets += ticket.quantity;
            totalRevenue += ticket.totalPrice;
            
            // Statistiche per evento
            if (!eventStats[ticket.eventId]) {
              eventStats[ticket.eventId] = {
                eventName: ticket.eventName,
                tickets: 0,
                revenue: 0
              };
            }
            eventStats[ticket.eventId].tickets += ticket.quantity;
            eventStats[ticket.eventId].revenue += ticket.totalPrice;
          });

          return {
            id: doc.id,
            ...promoterData,
            stats: {
              totalTickets,
              totalRevenue,
              eventStats: Object.values(eventStats)
            }
          };
        })
      );
      
      setPromoters(promotersData);
    } catch (error) {
      console.error('Errore nel recupero dei promoter:', error);
      setError('Errore nel caricamento dei promoter');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Caricamento promoter...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="promoters-container">
      <h3>Promoter del Team</h3>
      
      <div className="search-container">
        <input
          type="text"
          placeholder="Cerca promoter..."
          value={promoterSearchTerm}
          onChange={(e) => setPromoterSearchTerm(e.target.value)}
          className="search-input"
        />
        <FaSearch className="search-icon" />
      </div>
      
      {promoters.length === 0 ? (
        <p>Nessun promoter assegnato a questo team leader.</p>
      ) : (
        promoters
          .filter(promoter => 
            promoter.name.toLowerCase().includes(promoterSearchTerm.toLowerCase()) ||
            promoter.email.toLowerCase().includes(promoterSearchTerm.toLowerCase())
          )
          .map(promoter => (
            <div key={promoter.id} className="promoter-card">
              <div className="promoter-header">
                <div className="promoter-info">
                  <FaUser className="icon" />
                  <div>
                    <h4>{promoter.name}</h4>
                    <p>{promoter.email}</p>
                  </div>
                </div>
                <div className="promoter-stats">
                  <div className="stat-item">
                    <FaTicketAlt className="icon" />
                    <span>{promoter.stats.totalTickets} biglietti</span>
                  </div>
                  <div className="stat-item">
                    <FaEuroSign className="icon" />
                    <span>€{promoter.stats.totalRevenue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="promoter-events">
                <h5>Vendite per Evento</h5>
                {promoter.stats.eventStats.map((event, index) => (
                  <div key={index} className="event-stat">
                    <span className="event-name">{event.eventName}</span>
                    <span className="event-tickets">{event.tickets} biglietti</span>
                    <span className="event-revenue">€{event.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

export default TeamLeaderPromoters; 