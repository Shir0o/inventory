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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use experimentalForceLongPolling to avoid 10-second WebChannel stream buffering timeouts in sandbox/proxy environments,
// paired with persistentLocalCache for reliable offline support across tabs.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
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
