import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Safe placeholder so getAuth() does not throw auth/invalid-api-key during local dev
// when no real key is configured. Auth calls simply fail instead of crashing boot.
const PLACEHOLDER_API_KEY = 'AIzaSyPlaceholderLocalDevFallback';

// Initialize Firebase
const app = initializeApp({
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || PLACEHOLDER_API_KEY,
});
export const auth = getAuth(app);

// persistentLocalCache provides reliable offline support across tabs.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

// Connection test as specified in firebase-skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established.");
  } catch (error: any) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || (error as any).code === 'unavailable') {
        console.info("Firestore connection: Offline or connecting in background.", error.message);
      }
    }
  }
}

testConnection();

export { signInWithPopup, onAuthStateChanged };
export type { User };
