import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import './TicketPage.css';
import { FaTicketAlt, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaUser, FaMoneyBillWave, FaQrcode } from 'react-icons/fa';
import { getTicketCacheKey, getPersistentCache, setPersistentCache, CACHE_DURATION } from '../../utils/cacheUtils';

// Componente per la visualizzazione elegante del biglietto
function TicketPage() {
  const { ticketCode } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Funzione per impostare il titolo e i meta tag
  const updateMetaTags = (title, isError = false) => {
    document.title = title;
    
    // Trova il meta tag del viewport esistente o ne crea uno nuovo
    let metaViewport = document.querySelector('meta[name="viewport"]');
    if (!metaViewport) {
      metaViewport = document.createElement('meta');
      metaViewport.name = 'viewport';
      document.head.appendChild(metaViewport);
    }
    metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    // Imposta il meta tag theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = '#1a1a1a';
  };

  useEffect(() => {
    // Imposta titolo e meta tag quando il componente si monta
    updateMetaTags('Caricamento biglietto...');
    
    async function fetchTicket() {
      try {
        // Genera chiave di cache per questo biglietto
        const cacheKey = getTicketCacheKey(ticketCode);
        
        // Controlla prima se il biglietto è in cache
        const cachedTicket = getPersistentCache(cacheKey);
        
        if (cachedTicket) {
          console.log('Biglietto recuperato dalla cache');
          setTicket(cachedTicket);
          
          // Aggiorna il titolo con il nome dell'evento dal cache
          const pageTitle = cachedTicket.eventName 
            ? `Biglietto: ${cachedTicket.eventName}` 
            : 'Visualizza biglietto';
          updateMetaTags(pageTitle);
          
          setLoading(false);
          return;
        }
        
        // Se non in cache, cerca il biglietto usando il codice
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, where('ticketCode', '==', ticketCode));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Biglietto non trovato');
          updateMetaTags('Errore - Biglietto non trovato', true);
          setLoading(false);
          return;
        }
        
        // Prendi il primo risultato (dovrebbe essere solo uno)
        const ticketData = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data()
        };
        
        // Recupera anche i dettagli dell'evento
        const eventRef = doc(db, 'events', ticketData.eventId);
        const eventSnap = await getDoc(eventRef);
        
        if (eventSnap.exists()) {
          ticketData.eventDetails = eventSnap.data();
        }
        
        setTicket(ticketData);
        
        // Salva il biglietto in cache per uso futuro
        setPersistentCache(cacheKey, ticketData, CACHE_DURATION.TICKETS);
        
        // Aggiorna il titolo con il nome dell'evento
        const pageTitle = ticketData.eventName ? `Biglietto: ${ticketData.eventName}` : 'Visualizza biglietto';
        updateMetaTags(pageTitle);
      } catch (err) {
        console.error('Errore nel recupero del biglietto:', err);
        setError('Errore nel caricamento del biglietto');
        updateMetaTags('Errore - Biglietto', true);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTicket();
    
    // Ripristina il titolo originale quando il componente si smonta
    return () => {
      document.title = 'Ticket Management System';
    };
  }, [ticketCode]);

  // Genera l'URL del QR code con caching locale
  const generateQRCode = (code) => {
    // Controlla se abbiamo già l'URL del QR code in sessionStorage
    const cachedQR = sessionStorage.getItem(`qr_${code}`);
    if (cachedQR) {
      return cachedQR;
    }
    
    // Altrimenti genera nuovo URL
    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(code)}&size=300x300&margin=10&color=000000&bgcolor=FFFFFF&qzone=1&format=png&ecc=H`;
    
    // Memorizza in sessionStorage per uso futuro
    try {
      sessionStorage.setItem(`qr_${code}`, qrURL);
    } catch (err) {
      console.warn('Impossibile salvare QR in sessionStorage:', err);
    }
    
    return qrURL;
  };

  // Formatta la data in modo leggibile
  const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      console.error('Errore nel formattare la data:', e);
      return 'Data non valida';
    }
  };

  // Formatta l'ora in modo leggibile
  const formatTime = (dateString) => {
    if (!dateString) return 'N/D';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Errore nel formattare l\'ora:', e);
      return 'Ora non valida';
    }
  };

  // Formatta la data Firebase Timestamp
  const formatFirebaseTimestamp = (timestamp) => {
    if (!timestamp) return 'N/D';
    
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('it-IT', { 
        day: '2-digit',
        month: '2-digit',
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Errore nel formattare il timestamp:', e);
      return 'Data non valida';
    }
  };

  if (loading) {
    return (
      <div className="ticket-page-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento biglietto...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ticket-page-error">
        <h2>Errore</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="ticket-page">
      <div className="ticket-container">
        {/* Logo dell'evento in alto */}
        <div className="event-logo-header">
          {ticket.eventDetails?.logoUrl ? (
            <img src={ticket.eventDetails.logoUrl} alt="Logo Evento" />
          ) : (
            <div className="default-event-logo">
              <FaTicketAlt size={40} />
              <span>{ticket.eventName}</span>
            </div>
          )}
        </div>
        
        <div className="ticket-qr">
          <img 
            src={generateQRCode(ticket.ticketCode)} 
            alt="QR Code" 
            className="qr-code"
          />
          <span className="qr-label">
            <FaQrcode /> Scansiona all'ingresso
          </span>
        </div>
        
        <div className="ticket-details">
          <h2>{ticket.eventName}</h2>
          
          <div className="detail-row">
            <div className="detail-icon"><FaCalendarAlt /></div>
            <div>{formatDate(ticket.eventDate)}</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon"><FaClock /></div>
            <div>{formatTime(ticket.eventDate)}</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon"><FaMapMarkerAlt /></div>
            <div>{ticket.eventDetails?.location || 'Sede non specificata'}</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon"><FaUser /></div>
            <div>{ticket.customerName}</div>
          </div>
          
          {ticket.ticketType && (
            <div className="ticket-type-section">
              <h3>Tipo Biglietto</h3>
              <div className="detail-row">
                <div className="detail-icon"><FaTicketAlt /></div>
                <div>{typeof ticket.ticketType === 'object' ? ticket.ticketType.name : ticket.ticketType}</div>
              </div>
              
              <div className="detail-row">
                <div className="detail-icon"><FaMoneyBillWave /></div>
                <div>€ {typeof ticket.ticketType === 'object' ? ticket.ticketType.price : ticket.price} / biglietto</div>
              </div>
              
              <div className="total-price">
                Totale: € {(
                  (typeof ticket.ticketType === 'object' ? ticket.ticketType.price : ticket.price) * ticket.quantity
                ).toFixed(2)}
              </div>
            </div>
          )}
          
          {ticket.tableName && (
            <div className="table-info">
              <h3>Informazioni Tavolo</h3>
              <p><strong>Tavolo:</strong> {ticket.tableName}</p>
              {ticket.tableLocation && <p><strong>Posizione:</strong> {ticket.tableLocation}</p>}
            </div>
          )}
          
          <div className="ticket-code">
            <p>Codice Biglietto:</p>
            <p><strong>{ticket.ticketCode}</strong></p>
          </div>
        </div>
        
        <div className="ticket-footer">
          <p>Biglietto acquistato il {formatFirebaseTimestamp(ticket.purchaseDate)}</p>
          <p>Per assistenza: {ticket.eventDetails?.contactEmail || 'support@ticketsystem.com'}</p>
        </div>
      </div>
    </div>
  );
}

export default TicketPage; 