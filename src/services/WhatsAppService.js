import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

export const sendTicketViaWhatsApp = async (ticket, phoneNumber) => {
  try {
    // Formatta il numero di telefono (rimuovi spazi e caratteri speciali)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    // Costruisci il messaggio
    const message = `🎫 Il tuo biglietto per ${ticket.eventName}\n\n` +
      `📅 Data: ${new Date(ticket.eventDate).toLocaleDateString('it-IT')}\n` +
      `📍 Luogo: ${ticket.eventLocation}\n` +
      `👤 Nome: ${ticket.customerName}\n` +
      `🎫 Codice: ${ticket.code}\n\n` +
      `Per visualizzare il QR code e i dettagli del biglietto, clicca qui:\n` +
      `${window.location.origin}/ticket/${ticket.id}`;

    // Costruisci l'URL di WhatsApp
    const whatsappUrl = `https://wa.me/39${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    // Apri WhatsApp in una nuova finestra
    window.open(whatsappUrl, '_blank');

    // Aggiorna il biglietto con il numero di telefono
    const ticketRef = doc(db, 'tickets', ticket.id);
    await updateDoc(ticketRef, {
      customerPhone: phoneNumber,
      whatsappSent: true,
      whatsappSentAt: new Date()
    });

    return true;
  } catch (error) {
    console.error('Errore nell\'invio del biglietto via WhatsApp:', error);
    throw error;
  }
}; 