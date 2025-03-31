import React, { useState, useEffect, useContext } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc, updateDoc, doc, getDoc, onSnapshot, increment, arrayUnion, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { sendTicketEmail } from '../../services/EmailService';
import DateSelector from './DateSelector';
import './SellTicketModal.css';
import { generateTicketCode } from '../../utils/ticketUtils';
import { FaCalendarAlt, FaTicketAlt, FaUser, FaEnvelope, FaTable, FaEuroSign, FaWhatsapp } from 'react-icons/fa';

function SellTicketModal({ isOpen, onClose, event, onSell }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  
  // Aggiungiamo un controllo iniziale per event
  if (!event) {
    return null;
  }

  // Filtra le date disponibili
  useEffect(() => {
    if (!event) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (event.isRecurring && event.dates && event.dates.length > 0) {
      const datesArray = Array.isArray(event.dates) ? event.dates : [event.dates];
      
      const filteredDates = datesArray.filter(date => {
        if (!date || !date.date) return false;
        
        const eventDate = new Date(date.date);
        if (isNaN(eventDate.getTime())) return false;
        
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= now;
      }).map(date => ({
        id: date.date,
        date: new Date(date.date),
        availableTickets: date.availableTickets || 0
      }));
      
      setAvailableDates(filteredDates);
      
      if (filteredDates.length > 0) {
        setFormData(prev => ({
          ...prev,
          selectedDate: filteredDates[0].id
        }));
      }
    } else {
      const eventDate = new Date(event.date);
      
      if (!isNaN(eventDate.getTime())) {
        setAvailableDates([{
          id: event.date,
          date: eventDate,
          availableTickets: event.availableTickets || 0
        }]);
        
        setFormData(prev => ({
          ...prev,
          selectedDate: event.date
        }));
      }
    }
  }, [event]);

  const initialTicketType = event.ticketTypes && event.ticketTypes.length > 0 
    ? event.ticketTypes[0] 
    : { id: 'general', name: 'Generale', price: event.price || 0 };

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    quantity: 1,
    selectedDate: null,
    selectedTicketType: initialTicketType,
    includeTable: false,
    selectedTableType: null,
    totalPrice: Number(initialTicketType.price || 0)
  });

  const formatPrice = (price) => {
    const numPrice = Number(price || 0);
    return numPrice.toFixed(2);
  };

  const calculateTotalPrice = (ticketType, quantity, tableType) => {
    const ticketPrice = Number(ticketType.price || 0) * quantity;
    const tablePrice = tableType ? Number(tableType.price || 0) : 0;
    return ticketPrice + tablePrice;
  };

  const handleTicketTypeChange = (e) => {
    const selectedType = event.ticketTypes.find(type => type.id === e.target.value) || 
                        { id: 'general', name: 'Generale', price: event.price || 0 };
    
    // Verifica se il tipo di biglietto selezionato permette l'opzione tavolo
    const isVipOrHigher = selectedType.id === 'vip' || selectedType.id === 'backstage' || 
                         ['vip', 'backstage', 'prive', 'platinum'].includes(selectedType.id);
    
    // Se non è un biglietto VIP o superiore, deseleziona l'opzione tavolo
    const includeTable = isVipOrHigher ? formData.includeTable : false;
    const selectedTableType = includeTable ? formData.selectedTableType : null;
    
    setFormData(prev => ({
      ...prev,
      selectedTicketType: selectedType,
      includeTable: includeTable,
      selectedTableType: selectedTableType,
      totalPrice: calculateTotalPrice(selectedType, prev.quantity, selectedTableType)
    }));
  };

  const handleTableTypeChange = (e) => {
    const selectedType = event.tableTypes.find(type => type.id === e.target.value);
    setFormData(prev => ({
      ...prev,
      selectedTableType: selectedType,
      totalPrice: calculateTotalPrice(prev.selectedTicketType, prev.quantity, selectedType)
    }));
  };

  const handleQuantityChange = (e) => {
    const newValue = e.target.value === '' ? '' : parseInt(e.target.value);
    
    if (newValue === '' || (!isNaN(newValue) && newValue >= 0)) {
      setFormData(prev => ({
        ...prev,
        quantity: newValue,
        totalPrice: newValue === '' ? 0 : calculateTotalPrice(
          prev.selectedTicketType, 
          newValue, 
          prev.selectedTableType
        )
      }));
    }
  };

  const handleDateChange = (dateId) => {
    setFormData(prev => ({
      ...prev,
      selectedDate: dateId
    }));
  };

  const handleIncludeTableChange = (e) => {
    const includeTable = e.target.checked;
    setFormData(prev => ({
      ...prev,
      includeTable,
      selectedTableType: includeTable ? event.tableTypes[0] : null,
      totalPrice: calculateTotalPrice(
        prev.selectedTicketType, 
        prev.quantity, 
        includeTable ? event.tableTypes[0] : null
      )
    }));
  };

  const getCurrentAvailableTickets = () => {
    if (!event.isRecurring) {
      if (formData.selectedTicketType.id === 'general') {
        return event.availableTickets || 0;
      }
      return formData.selectedTicketType.totalTickets || 0;
    }

    if (!formData.selectedDate) return 0;

    const dates = Array.isArray(event.dates) ? event.dates : [];
    
    const selectedDate = dates.find(d => {
      if (!d || !d.date) return false;
      return d.date === formData.selectedDate || new Date(d.date).toISOString() === formData.selectedDate;
    });

    if (!selectedDate) return 0;

    if (formData.selectedTicketType.id === 'general') {
      return selectedDate.availableTickets || 0;
    }

    return formData.selectedTicketType.totalTickets || 0;
  };

  if (availableDates.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Evento non disponibile</h2>
          <p>Non ci sono date future per questo evento.</p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const generateWhatsAppMessage = (ticketData) => {
    const eventDate = new Date(ticketData.eventDate);
    const formattedDate = eventDate.toLocaleDateString();
    const formattedTime = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // ID del biglietto in formato più leggibile, come mostrato nell'immagine
    const ticketId = `MT${Math.floor(Math.random() * 90000000) + 10000000}`;
    
    // Messaggio formattato in modo simile all'immagine di esempio
    let message = `${ticketId}\n\n`;  // Codice in alto come nell'immagine
    message += `${event.name.toUpperCase()}\n`;  // Nome evento in maiuscolo
    message += `${event.location}\n`;  // Luogo
    message += `${formattedDate} ${formattedTime}\n`;  // Data e ora
    message += `Quantity: ${ticketData.quantity}\n`;  // Quantità
    message += `Total Order: € ${ticketData.totalPrice.toFixed(2)}\n`;  // Prezzo totale
    message += `ID: ${ticketData.ticketCode}\n`;  // ID biglietto
    
    // Aggiungi informazioni del tavolo se presenti
    if (formData.includeTable && formData.selectedTableType) {
      message += `\n🪑 Dettagli Tavolo:\n`;
      message += `Tipo: ${formData.selectedTableType.name}\n`;
      message += `Posti: ${formData.selectedTableType.seats || 4}\n`;
    }
    
    return message;
  };

  const openWhatsApp = (phoneNumber, message, ticketCode) => {
    // Rimuovi eventuali caratteri non numerici dal numero
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Crea un link alla pagina del biglietto usando l'URL appropriato
    const ticketPageUrl = `https://waveevents.app/ticket/${ticketCode}`;
    
    // Aggiungi il link alla pagina del biglietto al messaggio
    const completeMessage = `${message}\n\nVisualizza il tuo biglietto qui: ${ticketPageUrl}`;
    
    // Apri WhatsApp con il messaggio
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(completeMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Inizio vendita biglietto:', formData);

      // Validazione dei dati
      if (!formData.customerName || !formData.customerEmail || !formData.selectedTicketType || formData.quantity <= 0) {
        throw new Error('Compila tutti i campi richiesti');
      }

      // Validazione email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.customerEmail)) {
        throw new Error('Inserisci un indirizzo email valido');
      }

      // Controllo disponibilità biglietti
      const availableTickets = getCurrentAvailableTickets();
      console.log('Biglietti disponibili:', availableTickets);
      
      if (formData.quantity > availableTickets) {
        throw new Error(`Solo ${availableTickets} biglietti disponibili per questa data e tipo`);
      }

      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('Utente non trovato');
      }

      const userData = userSnap.data();
      const ticketCode = generateTicketCode();
      console.log('Ticket code generato:', ticketCode);

      // Calcola il prezzo totale prima della transazione
      const ticketPrice = formData.selectedTicketType.price || event.price;
      const totalPrice = ticketPrice * formData.quantity;

      // Start a transaction
      await runTransaction(db, async (transaction) => {
        // Update event tickets
        const eventRef = doc(db, 'events', event.id);
        const eventSnap = await transaction.get(eventRef);
        
        if (!eventSnap.exists()) {
          throw new Error('Evento non trovato');
        }

        const eventData = eventSnap.data();
        console.log('Dati evento:', eventData);
        console.log('Prezzo biglietto:', ticketPrice);
        console.log('Prezzo totale:', totalPrice);

        // Aggiorna la disponibilità dei biglietti
        if (event.isRecurring) {
          const dates = Array.isArray(eventData.dates) ? eventData.dates : [];
          const updatedDates = dates.map(date => {
            if (date.date === formData.selectedDate) {
              return {
                ...date,
                availableTickets: (date.availableTickets || 0) - formData.quantity
              };
            }
            return date;
          });

          transaction.update(eventRef, {
            dates: updatedDates
          });
        } else {
          transaction.update(eventRef, {
            availableTickets: increment(-formData.quantity)
          });
        }

        // Create ticket document
        const ticketRef = doc(collection(db, 'tickets'));
        const ticketData = {
          ticketCode: ticketCode,
          code: ticketCode,
          eventName: event.name,
          eventDate: formData.selectedDate,
          eventLocation: event.location,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          quantity: formData.quantity,
          ticketType: formData.selectedTicketType,
          price: ticketPrice,
          totalPrice,
          status: 'active',
          saleDate: serverTimestamp(),
          sellerId: currentUser.uid,
          sellerName: userData.name,
          eventId: event.id
        };

        console.log('Dati biglietto da salvare:', ticketData);

        // Usa transaction.set per creare il documento
        transaction.set(ticketRef, ticketData);

        // Aggiorna le statistiche del venditore
        transaction.update(userRef, {
          totalTicketsSold: increment(formData.quantity),
          totalRevenue: increment(totalPrice)
        });

        // Aggiorna l'evento con il nuovo biglietto
        transaction.update(eventRef, {
          tickets: arrayUnion(ticketRef.id)
        });
      });

      console.log('Transazione completata con successo');

      // Prova a inviare l'email dopo la transazione completata
      try {
        console.log('Preparazione dati per l\'email...');
        const emailData = {
          customerName: formData.customerName,
          eventName: event.name,
          eventDescription: event.description,
          eventLocation: event.location,
          eventDate: formData.selectedDate,
          eventId: event.id,
          ticketType: formData.selectedTicketType.name,
          price: ticketPrice,
          quantity: formData.quantity,
          ticketCode: ticketCode,
          totalPrice: totalPrice,
          tableInfo: formData.includeTable && formData.selectedTableType ? {
            type: formData.selectedTableType,
            seats: formData.selectedTableType.seats,
            price: formData.selectedTableType.price
          } : null
        };
        console.log('Dati preparati per l\'email:', emailData);

        const emailSent = await sendTicketEmail(formData.customerEmail, emailData);

        if (!emailSent) {
          console.warn('L\'email di conferma non è stata inviata, ma il biglietto è stato venduto con successo');
        } else {
          console.log('Email di conferma inviata con successo');
        }
      } catch (emailError) {
        console.error('Errore dettagliato nell\'invio dell\'email di conferma:', emailError);
      }

      // Dopo la transazione completata con successo
      if (formData.customerPhone) {
        const message = generateWhatsAppMessage({
          eventDate: formData.selectedDate,
          ticketType: formData.selectedTicketType,
          quantity: formData.quantity,
          price: formData.selectedTicketType.price || event.price,
          totalPrice: formData.totalPrice,
          ticketCode: ticketCode
        });
        
        // Apri WhatsApp con il messaggio precompilato
        openWhatsApp(formData.customerPhone, message, ticketCode);
      }

      // Notifica il componente padre
      onSell && onSell();
      onClose();
    } catch (error) {
      console.error('Errore dettagliato nella vendita del biglietto:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Vendi Biglietti</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="event-info">
          <h3>{event.name}</h3>
          <p>{event.location}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h3><FaCalendarAlt /> Seleziona Data</h3>
            <DateSelector
              dates={availableDates}
              selectedDate={formData.selectedDate}
              onDateSelect={handleDateChange}
            />
          </div>

          <div className="form-section">
            <h3><FaTicketAlt /> Tipo di Biglietto</h3>
            <div className="form-group">
              <select
                value={formData.selectedTicketType.id}
                onChange={handleTicketTypeChange}
                required
              >
                {event.ticketTypes && event.ticketTypes.length > 0 ? (
                  event.ticketTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name} - €{formatPrice(type.price)}
                    </option>
                  ))
                ) : (
                  <option value="general">
                    Generale - €{formatPrice(event.price)}
                  </option>
                )}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3><FaUser /> Informazioni Cliente</h3>
            <div className="form-group">
              <label>Nome Cliente</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Cliente</label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Telefono Cliente
              <FaWhatsapp className="whatsapp-icon" title="Il biglietto verrà inviato anche su WhatsApp" />
            </label>
            <input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
              placeholder="+39 123 456 7890"
              pattern="[+]?[0-9\s-()]+"
            />
          </div>

          <div className="form-section">
            <h3><FaTicketAlt /> Quantità</h3>
          <div className="form-group">
            <input
              type="number"
              min="1"
                max={getCurrentAvailableTickets()}
                value={formData.quantity}
                onChange={handleQuantityChange}
              required
            />
              <span className="available-tickets">
                Disponibili: {getCurrentAvailableTickets()}
              </span>
            </div>
          </div>

          {event.tableTypes && event.tableTypes.length > 0 && 
           (formData.selectedTicketType.id === 'vip' || 
            formData.selectedTicketType.id === 'backstage' || 
            ['vip', 'backstage', 'prive', 'platinum'].includes(formData.selectedTicketType.id)) && (
            <div className="form-section">
              <h3><FaTable /> Opzioni Tavolo</h3>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.includeTable}
                    onChange={handleIncludeTableChange}
                  />
                  Includi Tavolo
                </label>
              </div>
              {formData.includeTable && (
                <div className="form-group">
                  <select
                    value={formData.selectedTableType?.id || ''}
                    onChange={handleTableTypeChange}
                    required
                  >
                    <option value="">Seleziona tipo di tavolo</option>
                    {event.tableTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name} - €{formatPrice(type.price)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="price-summary">
            <div className="total-price">
              <FaEuroSign className="price-icon" />
              <span>Totale: €{formatPrice(formData.totalPrice)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Vendita in corso...' : 'Vendi Biglietti'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SellTicketModal; 