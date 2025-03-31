import { db } from '../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Rileva se il dispositivo è iOS
 * @returns {boolean}
 */
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Rileva se il dispositivo è Android
 * @returns {boolean}
 */
const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};

/**
 * Rileva se l'app è in esecuzione in una WebView
 * @returns {boolean}
 */
const isInWebView = () => {
  const userAgent = navigator.userAgent || '';
  return (
    userAgent.includes('wv') || 
    userAgent.includes('WebView') ||
    (userAgent.includes('Safari') && !userAgent.includes('Chrome')) ||
    userAgent.includes('FB_IAB') ||
    userAgent.includes('FBAV') ||
    userAgent.includes('Instagram') ||
    userAgent.includes('WKWebView')
  );
};

/**
 * Formatta correttamente un numero di telefono per WhatsApp
 * @param {string} phoneNumber - Numero di telefono da formattare
 * @returns {string} - Numero formattato correttamente
 */
const formatPhoneForWhatsApp = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Rimuovi tutti i caratteri non numerici
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Se inizia con il prefisso internazionale dell'Italia (39), rimuovilo
  // WhatsApp richiede il prefisso nel formato "39" senza il + iniziale
  if (cleaned.startsWith('39')) {
    return cleaned; // Già nel formato corretto
  }

  // Se inizia con il prefisso internazionale dell'Italia (+39), rimuovilo
  if (cleaned.startsWith('039')) {
    cleaned = cleaned.substring(3);
    return '39' + cleaned;
  }
  
  // Se non ha alcun prefisso, aggiungi il prefisso italiano
  return '39' + cleaned;
};

/**
 * Invia un biglietto tramite WhatsApp
 * @param {Object} ticket - Oggetto con i dati del biglietto
 * @param {string} phoneNumber - Numero di telefono del destinatario
 * @returns {Promise<boolean>} - True se l'operazione è riuscita
 */
export const sendTicketViaWhatsApp = async (ticket, phoneNumber) => {
  try {
    // Validazione del ticket
    if (!ticket || typeof ticket !== 'object') {
      throw new Error('Ticket non valido');
    }

    // Formatta il numero di telefono
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    if (!formattedPhone) {
      throw new Error('Numero di telefono non valido');
    }

    // Usa sempre ticketCode come identificatore principale
    const ticketCode = ticket.ticketCode;
    if (!ticketCode) {
      throw new Error('Codice biglietto non valido');
    }

    console.log('Codice biglietto per il link:', ticketCode);
    
    // Genera il link del biglietto usando l'URL di Vercel
    const ticketLink = `https://gestione-pr-ultimata.vercel.app/ticket/${ticketCode}`;
    console.log('Link generato:', ticketLink);

    // Costruisci il messaggio
    const message = `Ecco il tuo biglietto per ${ticket.eventName || 'l\'evento'}!\n\n` +
      `📅 Data: ${formatDate(ticket.eventDate)}\n` +
      `📍 Luogo: ${ticket.eventLocation || 'Non specificato'}\n` +
      `👤 Nome: ${ticket.customerName || 'Non specificato'}\n` +
      `🎫 Codice: ${ticketCode}\n\n` +
      `Visualizza il biglietto qui: ${ticketLink}`;

    // Costruisci l'URL di WhatsApp
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    console.log('URL WhatsApp generato:', whatsappUrl);

    // Apri WhatsApp
    window.open(whatsappUrl, '_blank');

    // Aggiorna il documento del biglietto
    const ticketRef = doc(db, 'tickets', ticket.id);
    await updateDoc(ticketRef, {
      customerPhone: phoneNumber,
      whatsappSentAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Errore nell\'invio del biglietto via WhatsApp:', error);
    throw error;
  }
}; 