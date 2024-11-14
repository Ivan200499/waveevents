import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import Navbar from '../shared/Navbar';
import ManagerDashboard from './ManagerDashboard';
import TeamLeaderDashboard from './TeamLeaderDashboard';
import PromoterDashboard from './PromoterDashboard';

function Dashboard() {
  const { currentUser } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUserRole() {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
        setLoading(false);
      } catch (error) {
        console.error('Errore nel recupero del ruolo:', error);
        setLoading(false);
      }
    }

    getUserRole();
  }, [currentUser]);

  if (loading) {
    return <div>Caricamento...</div>;
  }

  const getDashboardByRole = () => {
    switch (userRole) {
      case 'manager':
        return <ManagerDashboard />;
      case 'teamLeader':
        return <TeamLeaderDashboard />;
      case 'promoter':
        return <PromoterDashboard />;
      default:
        return <div>Ruolo non riconosciuto</div>;
    }
  };

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        {getDashboardByRole()}
      </div>
    </div>
  );
}

export default Dashboard; 