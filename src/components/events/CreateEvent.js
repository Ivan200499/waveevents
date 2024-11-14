import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../../firebase/config';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('promoter');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [error, setError] = useState('');
  const { signup } = useAuth();
  const navigate = useNavigate();

  // Carica la lista dei team leader
  useEffect(() => {
    async function loadTeamLeaders() {
      if (role === 'promoter') {
        try {
          const teamLeadersQuery = query(
            collection(db, 'users'),
            where('role', '==', 'teamLeader')
          );
          const snapshot = await getDocs(teamLeadersQuery);
          const teamLeadersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setTeamLeaders(teamLeadersData);
        } catch (error) {
          console.error('Errore nel caricamento dei team leader:', error);
        }
      }
    }
    loadTeamLeaders();
  }, [role]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      const { user } = await signup(email, password);
      
      const userData = {
        email,
        name,
        role,
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      // Aggiungi il teamLeaderId solo se è un promoter
      if (role === 'promoter' && teamLeaderId) {
        userData.teamLeaderId = teamLeaderId;
      }

      await setDoc(doc(db, 'users', user.uid), userData);
      navigate('/');
    } catch (error) {
      setError('Errore durante la registrazione: ' + error.message);
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>Registrazione</h2>
      {error && <div style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Nome:</label>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Ruolo:</label>
          <select 
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="promoter">Promoter</option>
            <option value="teamLeader">Team Leader</option>
            <option value="manager">Manager</option>
          </select>
        </div>

        {/* Mostra la selezione del team leader solo se il ruolo è promoter */}
        {role === 'promoter' && (
          <div style={{ marginBottom: '15px' }}>
            <label>Team Leader:</label>
            <select
              value={teamLeaderId}
              onChange={(e) => setTeamLeaderId(e.target.value)}
              required
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">Seleziona un Team Leader</option>
              {teamLeaders.map(tl => (
                <option key={tl.id} value={tl.id}>
                  {tl.name} ({tl.email})
                </option>
              ))}
            </select>
          </div>
        )}

        <button 
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Registrati
        </button>
        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          Hai già un account? <Link to="/login">Accedi</Link>
        </div>
      </form>
    </div>
  );
}

export default Register;