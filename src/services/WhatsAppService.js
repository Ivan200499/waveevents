import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

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
 * Invia un biglietto tramite WhatsApp
 * @param {Object} ticket - Oggetto con i dati del biglietto
 * @param {string} phoneNumber - Numero di telefono del destinatario
 * @returns {Promise<boolean>} - True se l'operazione è riuscita
 */
export const sendTicketViaWhatsApp = async (ticket, phoneNumber) => {
  try {
    // Formatta il numero di telefono (rimuovi spazi e caratteri speciali)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Costruisci il messaggio
    const message = `🎫 Il tuo biglietto per ${ticket.eventName}\n\n` +
      `📅 Data: ${new Date(ticket.eventDate).toLocaleDateString('it-IT')}\n` +
      `📍 Luogo: ${ticket.eventLocation}\n` +
      `👤 Nome: ${ticket.customerName}\n` +
      `🎫 Codice: ${ticket.code || ticket.ticketCode}\n\n` +
      `Per visualizzare il QR code e i dettagli del biglietto, clicca qui:\n` +
      `${window.location.origin}/ticket/${ticket.id || ticket.ticketCode}`;

    // Determina l'URL di WhatsApp in base al dispositivo
    let whatsappUrl;
    
    // Il prefisso del numero può cambiare in base al paese - 39 è per l'Italia
    const countryPrefix = '39';
    
    if (isIOS()) {
      // Su iOS, usa l'URL semplice per WhatsApp
      whatsappUrl = `https://api.whatsapp.com/send?phone=${countryPrefix}${formattedPhone}&text=${encodeURIComponent(message)}`;
    } else {
      // Per Android e altri dispositivi, usa l'URL standard
      whatsappUrl = `https://wa.me/${countryPrefix}${formattedPhone}?text=${encodeURIComponent(message)}`;
    }
    
    // Per iOS e WebView, usa window.location.href che è più efficace nelle WebView
    const isIOSWebView = isIOS() && isInWebView();
    
    if (isIOSWebView) {
      // Per iOS WebView, usa href invece di window.open
      setTimeout(() => {
        // Prima salva lo stato corrente per permettere all'utente di tornare indietro
        const currentUrl = window.location.href;
        sessionStorage.setItem('lastPage', currentUrl);
        
        // Usa location.href che ha maggiore compatibilità con WebView iOS
        window.location.href = whatsappUrl;
      }, 100);
    } else {
      // Per altre piattaforme, usa window.open
      setTimeout(() => {
        const newWindow = window.open(whatsappUrl, '_blank');
        
        // Fallback per alcune WebView che bloccano window.open
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Se window.open fallisce, tenta con location.href
          window.location.href = whatsappUrl;
        }
      }, 100);
    }

    // Aggiorna il biglietto con il numero di telefono
    if (ticket.id) {
      const ticketRef = doc(db, 'tickets', ticket.id);
      await updateDoc(ticketRef, {
        customerPhone: phoneNumber,
        whatsappSent: true,
        whatsappSentAt: new Date()
      });
    }

    return true;
  } catch (error) {
    console.error('Errore nell\'invio del biglietto via WhatsApp:', error);
    throw error;
  }
}; 