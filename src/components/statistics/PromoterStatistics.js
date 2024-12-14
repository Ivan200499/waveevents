import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

function PromoterStatistics({ promoter, onClose }) {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
  }, [promoter.id]);

  async function fetchStatistics() {
    try {
      const salesQuery = query(
        collection(db, 'sales'),
        where('promoterId', '==', promoter.id)
      );
      const salesSnapshot = await getDocs(salesQuery);
      const sales = salesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calcola statistiche
      const totalSales = sales.length;
      const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalPrice, 0);
      
      // Raggruppa vendite per evento
      const salesByEvent = sales.reduce((acc, sale) => {
        if (!acc[sale.eventId]) {
          acc[sale.eventId] = {
            count: 0,
            revenue: 0,
            eventName: sale.eventName
          };
        }
        acc[sale.eventId].count += sale.quantity;
        acc[sale.eventId].revenue += sale.totalPrice;
        return acc;
      }, {});

      // Raggruppa vendite per mese
      const salesByMonth = sales.reduce((acc, sale) => {
        const month = new Date(sale.date).toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        if (!acc[month]) {
          acc[month] = {
            count: 0,
            revenue: 0
          };
        }
        acc[month].count += sale.quantity;
        acc[month].revenue += sale.totalPrice;
        return acc;
      }, {});

      setStatistics({
        totalSales,
        totalRevenue,
        salesByEvent,
        salesByMonth,
        recentSales: sales.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
      });

      setLoading(false);
    } catch (error) {
      console.error('Errore nel recupero delle statistiche:', error);
      setLoading(false);
    }
  }

  if (loading) return <div>Caricamento statistiche...</div>;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '800px',
      width: '90%',
      maxHeight: '90vh',
      overflow: 'auto'
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'none',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer'
        }}
      >
        ×
      </button>

      <h3>Statistiche di {promoter.name}</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <h4>Riepilogo</h4>
        <p>Vendite totali: {statistics.totalSales}</p>
        <p>Ricavo totale: €{statistics.totalRevenue}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Vendite per Evento</h4>
        {Object.entries(statistics.salesByEvent).map(([eventId, data]) => (
          <div key={eventId} style={{ marginBottom: '10px' }}>
            <p>
              {data.eventName}: {data.count} biglietti (€{data.revenue})
            </p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Vendite per Mese</h4>
        {Object.entries(statistics.salesByMonth).map(([month, data]) => (
          <div key={month} style={{ marginBottom: '10px' }}>
            <p>
              {month}: {data.count} biglietti (€{data.revenue})
            </p>
          </div>
        ))}
      </div>

      <div>
        <h4>Ultime Vendite</h4>
        {statistics.recentSales.map(sale => (
          <div key={sale.id} style={{
            padding: '10px',
            borderBottom: '1px solid #eee'
          }}>
            <p>Data: {new Date(sale.date).toLocaleString()}</p>
            <p>Evento: {sale.eventName}</p>
            <p>Quantità: {sale.quantity}</p>
            <p>Totale: €{sale.totalPrice}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PromoterStatistics; 