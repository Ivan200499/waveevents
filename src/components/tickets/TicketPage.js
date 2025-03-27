import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import './TicketPage.css';
import { FaTicketAlt, FaMapMarkerAlt, FaCalendarAlt, FaClock, FaUser, FaMoneyBillWave, FaQrcode } from 'react-icons/fa';
import { getTicketCacheKey, getPersistentCache, setPersistentCache, CACHE_DURATION } from '../../utils/cacheUtils';
import { IoCalendarOutline, IoTimeOutline, IoLocationOutline, IoPersonOutline, IoTicketOutline, IoCardOutline, IoPricetagOutline, IoInformationCircleOutline, IoQrCodeOutline, IoCheckmarkCircle } from 'react-icons/io5';
// Importiamo il nostro hook di device detection
import { useDevice } from '../../contexts/DeviceContext';
import { wp, hp, scaleSize } from '../../utils/responsiveUtils';

// Logo dell'app in base64 (placeholder - sostituire con il logo reale)
const APP_LOGO = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjQiIGZpbGw9IiM0QTkwRTIiLz4KPHBhdGggZD0iTTM2IDQxQzM2IDM4LjIzODYgMzguMjM4NiAzNiA0MSAzNkg4N0M4OS43NjE0IDM2IDkyIDM4LjIzODYgOTIgNDFWODdDOTIgODkuNzYxNCA4OS43NjE0IDkyIDg3IDkySDQxQzM4LjIzODYgOTIgMzYgODkuNzYxNCAzNiA4N1Y0MVoiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNCIvPgo8cGF0aCBkPSJNOTIgNTJIMTA0QzEwNi43NjEgNTIgMTA5IDU0LjIzODYgMTA5IDU3VjcyQzEwOSA3NC43NjE0IDEwNi43NjEgNzcgMTA0IDc3SDkyVjUyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+CjxwYXRoIGQ9Ik0zNiA1MkgyNEMyMS4yMzg2IDUyIDE5IDU0LjIzODYgMTkgNTdWNzJDMTkgNzQuNzYxNCAyMS4yMzg2IDc3IDI0IDc3SDM2VjUyWiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSI0Ii8+CjxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjE2IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQiLz4KPC9zdmc+Cg==";

// Funzione di fallback per rilevamento dispositivo
const useDeviceFallback = () => {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    ...dimensions,
    isMobile: dimensions.width < 768,
    isIPhoneSE1: dimensions.width <= 320 && dimensions.height <= 568,
    orientation: dimensions.height > dimensions.width ? 'portrait' : 'landscape'
  };
};

// Componente per la visualizzazione elegante del biglietto
function TicketPage() {
  const { ticketCode } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const ticketContainerRef = useRef(null);

  // Utilizziamo il nostro hook con gestione errori
  let device;
  try {
    device = useDevice();
  } catch (e) {
    console.warn('Device context non disponibile, uso fallback:', e);
    device = useDeviceFallback();
  }
  
  // Configurazione reattiva in base al tipo di dispositivo
  const getDeviceConfiguration = () => {
    const isSmallPhone = device.isIPhoneSE1 || device.width < 360;
    const isNormalPhone = device.width >= 360 && device.width < 414;
    const isLargePhone = device.width >= 414 && device.width < 768;
    
    // Configurazione per QR code e altri elementi in base al dispositivo
    let config = {
      qrSize: 200, // Default
      fontSize: {
        title: '1.5rem',
        subtitle: '1.1rem',
        normal: '0.95rem',
        small: '0.85rem'
      },
      iconSize: {
        normal: 20,
        small: 16
      },
      padding: {
        container: '15px',
        section: '12px'
      }
    };
    
    if (isSmallPhone) {
      // iPhone 5/SE 1st gen/dispositivi piccoli
      config = {
        ...config,
        qrSize: wp(50), // 50% della larghezza dello schermo
        fontSize: {
          title: '1.2rem',
          subtitle: '1rem',
          normal: '0.85rem',
          small: '0.75rem'
        },
        iconSize: {
          normal: 16,
          small: 14
        },
        padding: {
          container: '10px',
          section: '8px'
        }
      };
    } else if (isNormalPhone) {
      // iPhone 6-8, X, dispositivi medi
      config = {
        ...config,
        qrSize: wp(60),
        fontSize: {
          title: '1.4rem',
          subtitle: '1.1rem',
          normal: '0.9rem',
          small: '0.8rem'
        },
        iconSize: {
          normal: 18,
          small: 15
        },
        padding: {
          container: '12px',
          section: '10px'
        }
      };
    } else if (isLargePhone) {
      // iPhone Plus e dispositivi grandi
      config = {
        ...config,
        qrSize: wp(65),
        fontSize: {
          title: '1.5rem',
          subtitle: '1.15rem',
          normal: '0.95rem',
          small: '0.85rem'
        },
        iconSize: {
          normal: 22,
          small: 18
        },
        padding: {
          container: '15px',
          section: '12px'
        }
      };
    } else {
      // Tablet e desktop
      config = {
        ...config,
        qrSize: 250,
        fontSize: {
          title: '1.7rem',
          subtitle: '1.25rem',
          normal: '1rem',
          small: '0.9rem'
        },
        iconSize: {
          normal: 24,
          small: 20
        },
        padding: {
          container: '20px',
          section: '15px'
        }
      };
    }
    
    return config;
  };

  // Ottieni la configurazione corrente in base al dispositivo
  const deviceConfig = getDeviceConfiguration();

  // Funzione per impostare il titolo e i meta tag
  const updateMetaTags = (title, description = '', isError = false) => {
    document.title = title;
    
    // Meta tag theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = isError ? '#ff5252' : '#1a1a1a';
    
    // Meta tag per Open Graph (condivisione social)
    let metaOgTitle = document.querySelector('meta[property="og:title"]');
    if (!metaOgTitle) {
      metaOgTitle = document.createElement('meta');
      metaOgTitle.setAttribute('property', 'og:title');
      document.head.appendChild(metaOgTitle);
    }
    metaOgTitle.content = title;
    
    let metaOgDesc = document.querySelector('meta[property="og:description"]');
    if (!metaOgDesc) {
      metaOgDesc = document.createElement('meta');
      metaOgDesc.setAttribute('property', 'og:description');
      document.head.appendChild(metaOgDesc);
    }
    metaOgDesc.content = description;

    // Aggiungi il meta tag mobile-web-app-capable
    let mobileWebApp = document.querySelector('meta[name="mobile-web-app-capable"]');
    if (!mobileWebApp) {
      mobileWebApp = document.createElement('meta');
      mobileWebApp.name = 'mobile-web-app-capable';
      mobileWebApp.content = 'yes';
      document.head.appendChild(mobileWebApp);
    }
  };

  // Formatta date da firebase
  const formatFirebaseTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('it-IT', { 
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Errore nella formattazione del timestamp:', error);
      return 'Data non disponibile';
    }
  };

  // Funzione per formattare la data
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Data non disponibile';
    try {
      let date;
      
      // Gestisci diversi formati di data
      if (typeof dateStr === 'object' && dateStr.seconds) {
        // Timestamp Firestore
        date = new Date(dateStr.seconds * 1000);
      } else if (typeof dateStr === 'string') {
        // Stringa di data (ISO o altro formato)
        date = new Date(dateStr);
      } else if (dateStr instanceof Date) {
        // Già un oggetto Date
        date = dateStr;
      } else {
        return 'Data non valida';
      }
      
      // Verifica se la data è valida
      if (isNaN(date.getTime())) return 'Data non valida';
      
      // Formatta la data in italiano
      const options = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      };
      
      return date.toLocaleDateString('it-IT', options);
    } catch (error) {
      console.error('Errore nella formattazione della data:', error);
      return 'Data non valida';
    }
  };

  // Funzione per formattare l'ora
  const formatTime = (dateStr) => {
    if (!dateStr) return 'Ora non disponibile';
    try {
      let date;
      
      if (typeof dateStr === 'object' && dateStr.seconds) {
        date = new Date(dateStr.seconds * 1000);
      } else if (typeof dateStr === 'string') {
        date = new Date(dateStr);
      } else if (dateStr instanceof Date) {
        date = dateStr;
      } else {
        return 'Ora non valida';
      }
      
      if (isNaN(date.getTime())) return 'Ora non valida';
      
      return date.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Errore nella formattazione dell\'ora:', error);
      return 'Ora non valida';
    }
  };

  // Genera un QR code per il biglietto
  const generateQRCode = (code) => {
    const size = deviceConfig.qrSize;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(code)}`;
  };

  // Gestisce il click sul QR code
  const handleQrCodeClick = () => {
    setIsZoomed(!isZoomed);
  };

  // Gestisce il caricamento del QR code
  const handleQRLoad = () => {
    setQrLoaded(true);
  };

  // Carica i dati del biglietto
  useEffect(() => {
    // Imposta titolo e meta tag quando il componente si monta
    updateMetaTags('Caricamento Biglietto', 'Caricamento dei dettagli del biglietto in corso...');
    
    async function fetchTicket() {
      try {
        // Verifica se il biglietto è già in cache
        const cacheKey = getTicketCacheKey(ticketCode);
        const cachedTicket = getPersistentCache(cacheKey);
        
        if (cachedTicket) {
          setTicket(cachedTicket);
          
          // Anche con i dati in cache, aggiorna i meta tag
          const pageTitle = cachedTicket.eventName ? `Biglietto: ${cachedTicket.eventName}` : 'Visualizza biglietto';
          const pageDesc = cachedTicket.eventName
            ? `Biglietto per ${cachedTicket.eventName}${cachedTicket.eventDate ? ` il ${formatDate(cachedTicket.eventDate)}` : ''}`
            : 'Dettagli del biglietto per l\'evento';
            
          updateMetaTags(pageTitle, pageDesc);
          setLoading(false);
          return;
        }
        
        // Se non in cache, carica dal database
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, where('ticketCode', '==', ticketCode));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Biglietto non trovato');
          updateMetaTags('Biglietto non trovato', 'Il biglietto richiesto non è stato trovato nel sistema', true);
          setLoading(false);
          return;
        }
        
        // Prendi il primo risultato (dovrebbe essere unico)
        const ticketDoc = querySnapshot.docs[0];
        const ticketData = {
          id: ticketDoc.id,
          ...ticketDoc.data()
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
        const pageDesc = ticketData.eventName
          ? `Biglietto per ${ticketData.eventName}${ticketData.eventDate ? ` il ${formatDate(ticketData.eventDate)}` : ''}`
          : 'Dettagli del biglietto per l\'evento';
        
        updateMetaTags(pageTitle, pageDesc);
      } catch (err) {
        console.error('Errore nel recupero del biglietto:', err);
        setError('Errore nel caricamento del biglietto');
        updateMetaTags('Errore - Biglietto', 'Si è verificato un errore durante il caricamento del biglietto', true);
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

  // Mostra stato di caricamento
  if (loading) {
    return (
      <div className="ticket-page loading-state">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Caricamento biglietto...</p>
        </div>
      </div>
    );
  }

  // Mostra stato di errore
  if (error || !ticket) {
    return (
      <div className="ticket-page error-state">
        <div className="error-container">
          <div className="error-icon">
            <IoInformationCircleOutline size={scaleSize(50)} />
          </div>
          <h2>Impossibile caricare il biglietto</h2>
          <p>{error || 'Si è verificato un errore durante il caricamento del biglietto'}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  // Stile inline per QR code basato sulle dimensioni del dispositivo
  const qrCodeStyle = {
    maxWidth: typeof deviceConfig.qrSize === 'number' ? `${deviceConfig.qrSize}px` : deviceConfig.qrSize, 
    height: 'auto'
  };

  // Stile per testo basato sulla configurazione del dispositivo
  const textStyles = {
    title: { fontSize: deviceConfig.fontSize.title },
    subtitle: { fontSize: deviceConfig.fontSize.subtitle },
    normal: { fontSize: deviceConfig.fontSize.normal },
    small: { fontSize: deviceConfig.fontSize.small }
  };

  // Mostra il biglietto
  return (
    <div className={`ticket-page ${device.isMobile ? 'mobile' : 'desktop'}`}>
      <div 
        className="ticket-container"
        ref={ticketContainerRef}
        style={{ padding: deviceConfig.padding.container }}
      >
        <img src={APP_LOGO} alt="Logo App" className="app-logo" />
        
        <div className="event-logo-header">
          {ticket.eventDetails?.logoUrl ? (
            <img 
              src={ticket.eventDetails.logoUrl} 
              alt="Logo Evento"
              loading="eager" 
            />
          ) : (
            <div className="default-event-logo">
              <IoTicketOutline size={deviceConfig.iconSize.normal} />
              <span style={textStyles.normal}>{ticket.eventName || ticket.eventDetails?.name || 'Evento'}</span>
            </div>
          )}
        </div>
        
        <div className="ticket-qr" style={{ padding: deviceConfig.padding.section }}>
          <img 
            src={generateQRCode(ticket.ticketCode)} 
            alt="QR Code" 
            className={`qr-code ${qrLoaded ? 'loaded' : ''} ${isZoomed ? 'qr-zoomed' : ''}`}
            onClick={handleQrCodeClick}
            onLoad={handleQRLoad}
            loading="eager"
            style={qrCodeStyle}
          />
          <span className="qr-label" style={textStyles.small}>
            <IoQrCodeOutline size={deviceConfig.iconSize.small} /> Scansiona all'ingresso
          </span>
        </div>
        
        <div className="ticket-details" style={{ padding: deviceConfig.padding.section }}>
          <h2 style={textStyles.title}>{ticket.eventName || ticket.eventDetails?.name || 'Evento'}</h2>
          
          <div className="detail-row">
            <div className="detail-icon"><IoCalendarOutline size={deviceConfig.iconSize.small} /></div>
            <div style={textStyles.normal}>{formatDate(ticket.eventDate)}</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon"><IoTimeOutline size={deviceConfig.iconSize.small} /></div>
            <div style={textStyles.normal}>{formatTime(ticket.eventDate)}</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon"><IoLocationOutline size={deviceConfig.iconSize.small} /></div>
            <div style={textStyles.normal}>{ticket.eventDetails?.location || 'Sede non specificata'}</div>
          </div>
          
          <div className="detail-row">
            <div className="detail-icon"><IoPersonOutline size={deviceConfig.iconSize.small} /></div>
            <div style={textStyles.normal}>{ticket.customerName}</div>
          </div>
          
          {ticket.ticketType && (
            <div className="ticket-type-section">
              <h3 style={textStyles.subtitle}>Tipo Biglietto</h3>
              <div className="detail-row">
                <div className="detail-icon"><IoTicketOutline size={deviceConfig.iconSize.small} /></div>
                <div style={textStyles.normal}>{typeof ticket.ticketType === 'object' ? ticket.ticketType.name : ticket.ticketType}</div>
              </div>
              
              <div className="detail-row">
                <div className="detail-icon"><IoPricetagOutline size={deviceConfig.iconSize.small} /></div>
                <div style={textStyles.normal}>€ {typeof ticket.ticketType === 'object' ? ticket.ticketType.price : ticket.price} / biglietto</div>
              </div>
              
              <div className="total-price" style={textStyles.normal}>
                Totale: € {(
                  (typeof ticket.ticketType === 'object' ? ticket.ticketType.price : ticket.price) * ticket.quantity
                ).toFixed(2)}
              </div>
            </div>
          )}
          
          {ticket.tableName && (
            <div className="table-info">
              <h3 style={textStyles.subtitle}>Informazioni Tavolo</h3>
              <p style={textStyles.normal}><strong>Tavolo:</strong> {ticket.tableName}</p>
              {ticket.tableLocation && <p style={textStyles.normal}><strong>Posizione:</strong> {ticket.tableLocation}</p>}
            </div>
          )}
          
          <div className="ticket-code">
            <p style={textStyles.small}>Codice Biglietto:</p>
            <p style={textStyles.normal}><strong>{ticket.ticketCode}</strong></p>
          </div>
        </div>
        
        <div className="ticket-footer" style={{ padding: deviceConfig.padding.section }}>
          <p style={textStyles.small}>Biglietto acquistato il {formatFirebaseTimestamp(ticket.purchaseDate)}</p>
          <p style={textStyles.small}>Per assistenza: {ticket.eventDetails?.contactEmail || 'support@ticketsystem.com'}</p>
          
          <div className="ticket-verification" style={textStyles.small}>
            <IoCheckmarkCircle size={deviceConfig.iconSize.small} /> Biglietto verificato
          </div>
        </div>
      </div>
    </div>
  );
}

export default TicketPage; 