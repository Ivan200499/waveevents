import { useState } from 'react';
import { db } from '../../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { uploadImage } from '../../services/ImageService';
import './CreateEvent.css';
import { FaCalendarAlt, FaMapMarkerAlt, FaEuroSign, FaTicketAlt } from 'react-icons/fa';

function CreateEvent({ onEventCreated }) {
  console.log("SONO IL FILE GIUSTO - CreateEvent.js");
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    totalTickets: '',
    ticketPrice: '',
    description: '',
    isRecurring: false,
    startDate: '',
    endDate: '',
    dates: []
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5000000) { // 5MB limit
        setError('L\'immagine non può superare i 5MB');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateDates = () => {
    if (!formData.isRecurring || !formData.startDate || !formData.endDate) return;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const dates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString());
    }
    
    setFormData(prev => ({
      ...prev,
      dates
    }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let imageUrl = null;
      if (image) {
        imageUrl = await uploadImage(image);
      }

      const eventData = {
        ...formData,
        totalTickets: parseInt(formData.totalTickets),
        availableTickets: parseInt(formData.totalTickets),
        ticketPrice: parseFloat(formData.ticketPrice),
        imageUrl,
        status: 'active',
        createdAt: new Date().toISOString(),
        isRecurring: formData.isRecurring,
        dates: formData.isRecurring ? formData.dates : [formData.startDate],
        soldTickets: 0
      };

      await addDoc(collection(db, 'events'), eventData);
      
      // Reset form
      setFormData({
        name: '',
        location: '',
        totalTickets: '',
        ticketPrice: '',
        description: '',
        isRecurring: false,
        startDate: '',
        endDate: '',
        dates: []
      });
      setImage(null);
      setImagePreview(null);
      
      onEventCreated();
    } catch (error) {
      setError('Errore nella creazione dell\'evento: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="create-event-container">
      <h2>Crea Nuovo Evento</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Locandina Evento:</label>
          <div className="image-upload-container">
            {imagePreview ? (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button 
                  type="button" 
                  className="remove-image"
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  id="event-image"
                  className="hidden-input"
                />
                <label htmlFor="event-image" className="upload-label">
                  Carica Locandina
                </label>
              </div>
            )}
          </div>
        </div>

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
                onChange={handleChange}
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
                      {new Date(date).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="form-group">
            <label>Data Evento:</label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
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

        <div className="form-group">
          <label>Numero Totale Biglietti:</label>
          <input
            type="number"
            name="totalTickets"
            value={formData.totalTickets}
            onChange={handleChange}
            required
            min="1"
          />
        </div>

        <div className="form-group">
          <label>Prezzo Biglietto (€):</label>
          <input
            type="number"
            name="ticketPrice"
            value={formData.ticketPrice}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
          />
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

        <button 
          type="submit" 
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Creazione in corso...' : 'Crea Evento'}
        </button>
      </form>
    </div>
  );
}

export default CreateEvent;