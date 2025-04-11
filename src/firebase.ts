import { initializeApp, getApps} from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
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


const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
setPersistence(auth, browserLocalPersistence).catch(console.error)


  .then(() => console.log('Auth persistence enabled'))
  .catch((error) => console.error('Auth persistence error:', error));

let analytics;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
export const ensureUserInFirestore = async () => {
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