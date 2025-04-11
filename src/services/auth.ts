import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const auth = getAuth();

export async function signUpWithEmail(email: string, password: string, role: string) {
  const auth = getAuth();
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDocRef = doc(db, 'users', user.uid);
    
    const userData: any = {
      email: user.email,
      role: role,
    };

    if (role === 'teacher') {
      userData.classrooms = [];
    }

    await setDoc(userDocRef, userData);

    return { success: true, user };
  } catch (error) {
    console.error('Sign up error:', error);
    return { error: (error as Error).message };
  }
}


export async function signInWithEmail(email: string, password: string) {
  try {
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user };
  } catch (error) {
    return { error: (error as Error).message };
  }
}


export function subscribeToAuthChanges(callback: (user: any) => void) {
  const auth = getAuth();
  return onAuthStateChanged(auth, callback);
}
