import { initializeApp, getApps} from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyClqzaoiqw_OrTC89U_TIZY0E3a9Ub4Mx8",
  authDomain: "sea-quest.firebaseapp.com",
  projectId: "sea-quest",
  storageBucket: "sea-quest.appspot.com",
  messagingSenderId: "417655952102",
  appId: "1:417655952102:web:9e0e6a372ac81435f56127",
  measurementId: "G-P095Q32X2X"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Initialize Firestore regardless of environment
const db = getFirestore(app);
const storage = getStorage(app);

// Create a non-initialized auth object for server-side environment
// This will be properly initialized only in the browser
const auth: Auth = typeof window !== 'undefined' 
  ? (() => {
      const authInstance = getAuth(app);
      setPersistence(authInstance, inMemoryPersistence)
        .then(() => console.log('Auth persistence enabled'))
        .catch((error) => console.error('Auth persistence error:', error));
      return authInstance;
    })()
  : {} as Auth; // Provide an empty object that matches Auth interface for SSR

// Initialize analytics only in browser environment
let analytics;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export const ensureUserInFirestore = async () => {
  if (typeof window === 'undefined') return; // Skip on server
  
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: user.displayName || "New User",
      email: user.email,
      avatar: "/avatars/default.png",
      role: "student",
      achievements: [],
    });
  }
};

export { db, analytics, auth, storage };
export default app;