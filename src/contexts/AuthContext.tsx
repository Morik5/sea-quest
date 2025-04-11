import {
  component$,
  useStore,
  useContextProvider,
  useVisibleTask$,
  Slot,
} from "@builder.io/qwik";
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { auth } from "../firebase";
import { createContextId } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";


interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

export const AuthContext = createContextId<AuthState>("auth-context");

export const AuthProvider = component$(() => {
  const state = useStore<AuthState>({ user: null, loading: true });
  const nav = useNavigate();

  useContextProvider(AuthContext, state);

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    console.log("⚡ Setting authentication persistence...");

    queueMicrotask(() => {
      setPersistence(auth, browserLocalPersistence)
        .then(() => {
          console.log("✅ Persistence set to LOCAL.");

          
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("🔥 Auth state changed:", user);
            if (user) {
              console.log("✅ User authenticated, updating state...");
              state.user = { uid: user.uid, email: user.email ?? null };
            } else {
              console.log("❌ No user authenticated, setting state to null");
              state.user = null;
              nav("/login"); 
            }
            state.loading = false;
            console.log("🎯 Final state:", JSON.stringify(state));
          });

          return () => {
            console.log("🔄 Unsubscribing from auth state changes");
            unsubscribe();
          };
        })
        .catch((error) => {
          console.error("🚨 Error setting persistence:", error);
          state.loading = false;
        });
    });
  });

  
  if (state.loading) {
    console.log("⏳ Loading state is true");
    return <div>Loading...</div>;
  }

  
  console.log("✅ User authenticated, showing main content");
  return <Slot />;
});