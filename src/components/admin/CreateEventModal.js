import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import './AdminStyles.css';

// Definizione dei tipi di biglietti disponibili
const TICKET_TYPES = [
  { id: 'general', name: 'Generale', description: 'Biglietto standard' },
  { id: 'vip', name: 'VIP', description: 'Accesso a area VIP' },
  { id: 'backstage', name: 'Backstage', description: 'Include accesso backstage' },
  { id: 'early_bird', name: 'Early Bird', description: 'Prezzo scontato prevendita' },
  { id: 'student', name: 'Studenti', description: 'Sconto per studenti' },
  { id: 'group', name: 'Gruppo', description: 'Per gruppi di 5+ persone' }
];

// Definizione dei tipi di tavoli disponibili
const TABLE_TYPES = [
  { id: 'standard', name: 'Standard', description: 'Tavolo standard', defaultSeats: 4 },
  { id: 'vip', name: 'VIP', description: 'Tavolo area VIP', defaultSeats: 6 },
  { id: 'prive', name: 'Privé', description: 'Tavolo area privé', defaultSeats: 8 },
  { id: 'platinum', name: 'Platinum', description: 'Tavolo premium con servizio dedicato', defaultSeats: 10 }
];

function CreateEventModal({ onClose, onEventCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    price: '',
    totalTickets: '',
    description: '',
    isRecurring: false,
    startDate: '',
    endDate: '',
    dates: [],
    ticketTypes: [], // Array per i tipi di biglietti selezionati
    hasTables: false, // Flag per indicare se l'evento ha tavoli
    tableTypes: [] // Array per i tipi di tavoli selezionati
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Gestisce la selezione/deselezione dei tipi di biglietti
  const handleTicketTypeToggle = (ticketType) => {
    setFormData(prev => {
      const currentTypes = [...prev.ticketTypes];
      const index = currentTypes.findIndex(t => t.id === ticketType.id);
      
      if (index === -1) {
        // Aggiungi il tipo con prezzo e quantità default
        currentTypes.push({
          ...ticketType,
          price: 0,
          totalTickets: 0
        });
      } else {
        // Rimuovi il tipo
        currentTypes.splice(index, 1);
      }

      return {
        ...prev,
        ticketTypes: currentTypes
      };
    });
  };

  // Gestisce la selezione/deselezione dei tipi di tavoli
  const handleTableTypeToggle = (tableType) => {
    setFormData(prev => {
      const currentTables = [...prev.tableTypes];
      const index = currentTables.findIndex(t => t.id === tableType.id);
      
      if (index === -1) {
        // Aggiungi il tipo con prezzo, posti e quantità default
        currentTables.push({
          ...tableType,
          price: 0,
          seats: tableType.defaultSeats,
          totalTables: 0
        });
      } else {
        // Rimuovi il tipo
        currentTables.splice(index, 1);
      }

      return {
        ...prev,
        tableTypes: currentTables
      };
    });
  };

  // Aggiorna prezzo e quantità per un tipo di biglietto
  const handleTicketTypeUpdate = (ticketId, field, value) => {
    setFormData(prev => ({
      ...prev,
      ticketTypes: prev.ticketTypes.map(type => {
        if (type.id === ticketId) {
          return {
            ...type,
            [field]: Number(value)
          };
        }
        return type;
      })
    }));
  };

  // Aggiorna prezzo, posti e quantità per un tipo di tavolo
  const handleTableTypeUpdate = (tableId, field, value) => {
    setFormData(prev => ({
      ...prev,
      tableTypes: prev.tableTypes.map(type => {
        if (type.id === tableId) {
          return {
            ...type,
            [field]: Number(value)
          };
        }
        return type;
      })
    }));
  };

  // Genera le date a partire dai dati form
  const generateDates = () => {
    if (!formData.isRecurring || !formData.startDate || !formData.endDate) return [];
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const dates = [];
    
    // Calcola il totale dei biglietti disponibili dai tipi selezionati
    const totalTicketsAvailable = formData.ticketTypes.reduce(
      (acc, type) => acc + Number(type.totalTickets || 0), 0
    );
    
    // Se non ci sono biglietti definiti, non creare le date
    if (totalTicketsAvailable <= 0) {
      setError('Definisci almeno un tipo di biglietto con quantità maggiore di zero');
      return [];
    }
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push({
        date: new Date(d).toISOString(),
        availableTickets: totalTicketsAvailable
      });
    }
    
    // Aggiorna lo stato con le date generate
    setFormData(prev => ({
      ...prev,
      dates
    }));
    
    return dates;
  };

  // Effetto per aggiornare le date quando cambiano startDate o endDate
  useEffect(() => {
    if (formData.isRecurring && formData.startDate && formData.endDate) {
      generateDates();
    }
  }, [formData.startDate, formData.endDate, formData.isRecurring, formData.ticketTypes]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Verifica che almeno un tipo di biglietto sia selezionato
    if (formData.ticketTypes.length === 0) {
      setError('Seleziona almeno un tipo di biglietto');
      setLoading(false);
      return;
    }

    // Verifica che tutti i tipi di biglietto abbiano prezzo e quantità
    const invalidTypes = formData.ticketTypes.filter(type => 
      !type.price || !type.totalTickets
    );

    if (invalidTypes.length > 0) {
      setError('Inserisci prezzo e quantità per tutti i tipi di biglietto selezionati');
      setLoading(false);
      return;
    }

    // Se l'evento ha tavoli, verifica che tutti i tipi di tavolo abbiano prezzo, posti e quantità
    if (formData.hasTables && formData.tableTypes.length > 0) {
      const invalidTables = formData.tableTypes.filter(type => 
        !type.price || !type.seats || !type.totalTables
      );

      if (invalidTables.length > 0) {
        setError('Inserisci prezzo, posti e quantità per tutti i tipi di tavolo selezionati');
        setLoading(false);
        return;
      }
    }

    try {
      // Calcola il totale dei biglietti da tutti i tipi
      const totalTickets = formData.ticketTypes.reduce((acc, type) => acc + Number(type.totalTickets || 0), 0);
      
      // Assicurati che le date siano generate correttamente
      let eventDates = formData.dates;
      if (formData.isRecurring && (!eventDates || eventDates.length === 0)) {
        eventDates = generateDates();
      }
      
      const eventData = {
        ...formData,
        totalTickets,
        status: 'active',
        createdAt: new Date().toISOString(),
        isRecurring: formData.isRecurring,
        dates: formData.isRecurring ? eventDates : [{
          date: formData.date,
          availableTickets: totalTickets
        }],
        hasTables: formData.hasTables,
        tableTypes: formData.hasTables ? formData.tableTypes : []
      };

      await addDoc(collection(db, 'events'), eventData);
      onEventCreated();
      onClose();
    } catch (error) {
      setError('Errore nella creazione dell\'evento: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Crea Nuovo Evento</h2>
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome Evento:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Evento Ricorrente:</label>
            <div className="checkbox-container">
              <input
                type="checkbox"
                name="isRecurring"
                checked={formData.isRecurring}
                onChange={handleChange}
              />
              <span>Questo evento si svolge in più date</span>
            </div>
          </div>

          {formData.isRecurring ? (
            <>
              <div className="form-group">
                <label>Data Inizio:</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={(e) => {
                    handleChange(e);
                    generateDates();
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label>Data Fine:</label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={(e) => {
                    handleChange(e);
                    generateDates();
                  }}
                  required
                />
              </div>

              {formData.dates.length > 0 && (
                <div className="dates-preview">
                  <h3>Date Generate:</h3>
                  <div className="dates-list">
                    {formData.dates.map((date, index) => (
                      <div key={index} className="date-item">
                        {new Date(date.date).toLocaleDateString()} - {date.availableTickets} biglietti
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="form-group">
              <label>Data:</label>
              <input
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Luogo:</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-section">
            <h3>Tipi di Biglietto</h3>
            <div className="ticket-types-grid">
              {TICKET_TYPES.map(type => {
                const isSelected = formData.ticketTypes.some(t => t.id === type.id);
                return (
                  <div key={type.id} className={`ticket-type ${isSelected ? 'selected' : ''}`}>
                    <div className="ticket-type-header">
                      <label>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleTicketTypeToggle(type)}
                        />
                        {type.name}
                      </label>
                      <p>{type.description}</p>
                    </div>
                    {isSelected && (
                      <div className="ticket-type-details">
                        <div className="ticket-type-input">
                          <label>Prezzo (€):</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.ticketTypes.find(t => t.id === type.id)?.price || ''}
                            onChange={(e) => handleTicketTypeUpdate(type.id, 'price', e.target.value)}
                            required
                          />
                        </div>
                        <div className="ticket-type-input">
                          <label>Quantità:</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.ticketTypes.find(t => t.id === type.id)?.totalTickets || ''}
                            onChange={(e) => handleTicketTypeUpdate(type.id, 'totalTickets', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="hasTables"
                  checked={formData.hasTables}
                  onChange={handleChange}
                />
                Questo evento ha tavoli disponibili
              </label>
            </div>

            {formData.hasTables && (
              <>
                <h3>Tipi di Tavolo</h3>
                <div className="table-types-grid">
                  {TABLE_TYPES.map(type => {
                    const isSelected = formData.tableTypes.some(t => t.id === type.id);
                    return (
                      <div key={type.id} className={`table-type ${isSelected ? 'selected' : ''}`}>
                        <div className="table-type-header">
                          <label>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleTableTypeToggle(type)}
                            />
                            {type.name}
                          </label>
                          <p>{type.description}</p>
                        </div>
                        {isSelected && (
                          <div className="table-type-details">
                            <div className="table-type-input">
                              <label>Prezzo (€):</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.tableTypes.find(t => t.id === type.id)?.price || ''}
                                onChange={(e) => handleTableTypeUpdate(type.id, 'price', e.target.value)}
                                required
                              />
                            </div>
                            <div className="table-type-input">
                              <label>Posti per tavolo:</label>
                              <input
                                type="number"
                                min="1"
                                value={formData.tableTypes.find(t => t.id === type.id)?.seats || type.defaultSeats}
                                onChange={(e) => handleTableTypeUpdate(type.id, 'seats', e.target.value)}
                                required
                              />
                            </div>
                            <div className="table-type-input">
                              <label>Numero tavoli:</label>
                              <input
                                type="number"
                                min="1"
                                value={formData.tableTypes.find(t => t.id === type.id)?.totalTables || ''}
                                onChange={(e) => handleTableTypeUpdate(type.id, 'totalTables', e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="form-group">
            <label>Descrizione Evento:</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Inserisci una descrizione dettagliata dell'evento..."
            />
          </div>

          <div className="modal-actions">
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creazione...' : 'Crea Evento'}
            </button>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateEventModal; 