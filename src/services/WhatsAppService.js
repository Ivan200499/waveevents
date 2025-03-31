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
    // Verifica che ticket sia un oggetto valido
    if (!ticket || typeof ticket !== 'object') {
      console.error('Ticket non valido:', ticket);
      throw new Error('Formato ticket non valido');
    }
    
    // Formatta il numero di telefono (rimuovi spazi e caratteri speciali)
    const formattedPhone = (phoneNumber || '').replace(/\D/g, '');
    
    // Valori di fallback per i campi del biglietto
    const eventName = ticket.eventName || 'Evento';
    const eventDate = ticket.eventDate ? new Date(ticket.eventDate) : new Date();
    const eventLocation = ticket.eventLocation || 'Luogo non specificato';
    const customerName = ticket.customerName || 'Cliente';
    const ticketCode = ticket.code || ticket.ticketCode || 'N/A';
    
    // ID sicuro per il link del biglietto
    const ticketLinkId = ticket.id || ticket.ticketCode || ticket.code || '';
    
    // Costruisci il messaggio con controlli per valori undefined
    const message = `🎫 Il tuo biglietto per ${eventName}\n\n` +
      `📅 Data: ${eventDate.toLocaleDateString('it-IT')}\n` +
      `📍 Luogo: ${eventLocation}\n` +
      `👤 Nome: ${customerName}\n` +
      `🎫 Codice: ${ticketCode}\n\n` +
      (ticketLinkId ? 
        `Per visualizzare il QR code e i dettagli del biglietto, clicca qui:\n` +
        `${window.location.origin}/ticket/${ticketLinkId}` : 
        `Per ulteriori informazioni, contatta l'organizzatore dell'evento.`);

    // Determina l'URL di WhatsApp in base al dispositivo
    let whatsappUrl;
    
    // Il prefisso del numero può cambiare in base al paese - 39 è per l'Italia
    const countryPrefix = '39';
    
    // Usa un URL generico se il telefono non è specificato
    if (!formattedPhone) {
      whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    } else if (isIOS()) {
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

    // Aggiorna il biglietto con il numero di telefono solo se abbiamo un ID valido e un telefono
    if (ticket.id && formattedPhone) {
      try {
        const ticketRef = doc(db, 'tickets', ticket.id);
        await updateDoc(ticketRef, {
          customerPhone: phoneNumber,
          whatsappSent: true,
          whatsappSentAt: new Date()
        });
      } catch (dbError) {
        console.error('Errore nell\'aggiornamento del biglietto:', dbError);
        // Non interrompe il flusso se fallisce solo l'aggiornamento su DB
      }
    }

    return true;
  } catch (error) {
    console.error('Errore nell\'invio del biglietto via WhatsApp:', error);
    // Non rilanciare l'errore, per permettere di usare il metodo di fallback
    return false;
  }
}; 