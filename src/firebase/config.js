import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBNDZ5EAN6rVbe1S6iVLL4TiZBK-kCDKZI",
  authDomain: "wave-gestionale.firebaseapp.com",
  projectId: "wave-gestionale",
  storageBucket: "wave-gestionale.firebasestorage.app",
  messagingSenderId: "233147470292",
  appId: "1:233147470292:web:a9151fc3979137b71a8641"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); 