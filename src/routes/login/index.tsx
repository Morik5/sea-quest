import { component$, useStore, $, useStylesScoped$ } from "@builder.io/qwik";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { query, collection, where, getDocs, setDoc, doc } from "firebase/firestore";
import { makeSerializable } from "../../utils/serialization";
import styles from './index.css?inline';

const ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "Email už je používán.",
  "auth/invalid-email": "Neplatná emailová adresa.",
  "auth/operation-not-allowed": "Operace není povolena.",
  "auth/weak-password": "Heslo je příliš slabé.",
  "auth/user-disabled": "Uživatelský účet je zablokován.",
  "auth/user-not-found": "Nenalezen žádný uživatel.",
  "auth/wrong-password": "Špatné heslo.",
  "auth/invalid-credential": "Neplatné uživatelské jméno nebo heslo.",
  "auth/missing-email": "Neplatná emailová adresa."
};

const getErrorMessage = (errorCode: string): string => {
  if (!ERROR_MESSAGES[errorCode]) {
    console.warn(`Unhandled error code: ${errorCode}`);
  }
  return ERROR_MESSAGES[errorCode] || "An unknown error occurred.";
};

const generateParentCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let parentCode = '';
  for (let i = 0; i < 6; i++) {
    parentCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return parentCode;
};


export default component$(() => {

  useStylesScoped$(styles);

  const state = useStore({ 
    email: "", 
    password: "", 
    name: "", 
    surname: "", 
    role: "student", 
    error: "", 
    isRegistering: false, 
    parentCode: "", 
    resetEmail: "", 
    isResettingPassword: false, 
    isParentLogin: false, 
    childStats: { 
      correctAnswers: 0, 
      completedHomeworks: 0,
      totalHomeworks: 0, 
      level: 0, 
      experience: 0, 
      perfectScores: 0, 
      quizCompleted: 0, 
      achievements: [] 
    }, 
    parentLoggedIn: false 
  });

  const handleAuth = $(async () => {
    try {
      if (state.isParentLogin) {
        console.log("Parent login using parent code...");
        const childQuery = query(collection(db, "users"), where("parentCode", "==", state.parentCode));
        const childSnap = await getDocs(childQuery);

        if (childSnap.empty) {
          state.error = "Invalid parent code.";
          console.error("Invalid parent code:", state.parentCode);
          return;
        }

        const childDoc = childSnap.docs[0];
        const childData = childDoc.data();
        
        
        const enrolledClassrooms = childData.enrolledClassrooms || [];
        let totalHomeworks = 0;
        let completedHomeworks = 0;

        
        if (enrolledClassrooms.length > 0) {
          
          for (const classroomId of enrolledClassrooms) {
            
            const homeworkQuery = query(
              collection(db, "homework"),
              where("classroomId", "==", classroomId)
            );
            const homeworkSnap = await getDocs(homeworkQuery);
            totalHomeworks += homeworkSnap.size;

            
            if (homeworkSnap.size > 0) {
              const homeworkIds = homeworkSnap.docs.map(doc => doc.id);
              const submissionsQuery = query(
                collection(db, "homework_submissions"),
                where("studentId", "==", childDoc.id),
                where("homeworkId", "in", homeworkIds)
              );
              
              const submissionsSnap = await getDocs(submissionsQuery);
              completedHomeworks += submissionsSnap.size;
            }
          }
        }

        
        const serializedData = makeSerializable(childData);
        state.childStats = serializedData as typeof state.childStats;

        
        state.childStats.completedHomeworks = childData.homework_completed || completedHomeworks;
        state.childStats.totalHomeworks = totalHomeworks;
        state.parentLoggedIn = true;
        console.log("Parent logged in, viewing child with ID:", childDoc.id, 
                    "Homeworks:", completedHomeworks, "/", totalHomeworks);
      } else {
        if (state.isRegistering) {
          
          const userCredential = await createUserWithEmailAndPassword(auth, state.email, state.password);
          const user = userCredential.user;
          console.log("User registered:", user.uid);

          
          const parentCode = generateParentCode();

          
          await setDoc(doc(db, "users", user.uid), makeSerializable({
            userId: user.uid,
            name: state.name,
            role: state.role,
            parentCode: parentCode,
            avatar: "/avatars/default.png",
            createdAt: new Date(),
            experience: 0,
            level: 1,
            perfectScores: 0,
            quizCompleted: 0,
            achievements: [],
            enrolledClassrooms: [],
            homework_completed: 0
          }));

          window.location.href = "/";
        } else {
          
          const userCredential = await signInWithEmailAndPassword(auth, state.email, state.password);
          const user = userCredential.user;
          console.log("User logged in:", user.uid);
          window.location.href = "/";
        }
      }
    } catch (error: any) {
      state.error = getErrorMessage(error.code);
      console.error("Authentication error:", error);
    }
  });

  const handlePasswordReset = $(async () => {
    try {
      await sendPasswordResetEmail(auth, state.resetEmail);
      state.error = "Password reset email sent.";
    } catch (error: any) {
      state.error = getErrorMessage(error.code);
      console.error("Password reset error:", error);
    }
  });

  const closeStats = $(() => {
    state.parentLoggedIn = false;
  });

  return (
    <div class="login-container">
      <div class={`login-box ${state.parentLoggedIn ? 'shift-right' : ''}`}>
        <h2>{state.isRegistering ? "Registrace" : "Přihlášení"}</h2>
        {state.error && <p class="error">{state.error}</p>}

        {state.isParentLogin ? (
          <>
            <input
              type="text"
              onInput$={(e) => (state.parentCode = (e.target as HTMLInputElement).value || "")}
              placeholder="Rodičovský kód"
            />
          </>
        ) : (
          <>
            {state.isRegistering && (
              <>
              <input
                type="text"
                onInput$={(e) => (state.name = (e.target as HTMLInputElement).value || "")}
                placeholder="Jméno"
              />
              </>
            )}

            <input
              type="email"
              onInput$={(e) => (state.email = (e.target as HTMLInputElement).value || "")}
              placeholder="Email"
            />

            <input
              type="password"
              onInput$={(e) => (state.password = (e.target as HTMLInputElement).value || "")}
              placeholder="Heslo"
            />
          </>
        )}

        <button class="login-register" onClick$={handleAuth}>
          {state.isRegistering ? "Registrovat" : "Přihlásit se"}
        </button>

        <p>
          <button class="parent-student" onClick$={() => (state.isParentLogin = !state.isParentLogin)}>
            {state.isParentLogin ? "Přihlásit se jako student" : "Přihlásit se jako rodič"}
          </button>
        </p>

        <p>
          {state.isRegistering ? "Už máte vytvořený účet? " : "Ještě nemáte vytvořený účet? "}
          <a href="#" onClick$={() => (state.isRegistering = !state.isRegistering)}>
            {state.isRegistering ? "Přihlásit se" : "Registrovat se"}
          </a>
        </p>

        {!state.isRegistering && !state.isParentLogin && (
          <p>
            Zapomněli jste heslo?{" "}
            <a href="#" onClick$={() => (state.isResettingPassword = !state.isResettingPassword)}>
              Obnovit heslo
            </a>
          </p>
        )}

        {state.isResettingPassword && (
          <>
            <input
              type="email"
              class="reset-email"
              onInput$={(e) => (state.resetEmail = (e.target as HTMLInputElement).value || "")}
              placeholder="Zadejte email pro obnovení hesla"
            />
            <button class="password-reset" onClick$={handlePasswordReset}>Odeslat email pro obnovení hesla</button>
          </>
        )}
      </div>

      {state.parentLoggedIn && (
        <div class="child-stats visible">
          <button class="close-stats" onClick$={closeStats}>X</button>
          <h3>Statistiky žáka</h3>
          
          <div class="stats-card">
            <div class="stats-icon">📚</div>
            <div class="stats-content">
              <h4>Studijní pokrok</h4>
              <div class="progress-bar">
                <div class="progress-fill" style={{ width: `${state.childStats.level * 10}%` }}></div>
              </div>
              <p>Úroveň: <span class="highlight">{state.childStats.level}</span></p>
              <p>Zkušenosti: <span class="highlight">{state.childStats.experience} XP</span></p>
            </div>
          </div>

          <div class="stats-card">
            <div class="stats-icon">✅</div>
            <div class="stats-content">
              <h4>Domácí úkoly</h4>
              <div class="progress-bar">
                <div class="progress-fill" style={{ width: `${state.childStats.totalHomeworks ? (state.childStats.completedHomeworks / state.childStats.totalHomeworks) * 100 : 0}%` }}></div>
              </div>
              <p>Splněno: <span class="highlight">{state.childStats.completedHomeworks}/{state.childStats.totalHomeworks || 0}</span></p>
              <p>Úspěšnost: <span class="highlight">{state.childStats.totalHomeworks ? Math.round((state.childStats.completedHomeworks / state.childStats.totalHomeworks) * 100) : 0}%</span></p>
            </div>
          </div>

          <div class="stats-card">
            <div class="stats-icon">🏆</div>
            <div class="stats-content">
              <h4>Kvízy a úspěchy</h4>
              <p>Dokončené kvízy: <span class="highlight">{state.childStats.quizCompleted}</span></p>
              <p>Perfektní skóre: <span class="highlight">{state.childStats.perfectScores}</span></p>
              
            </div>
          </div>

          
          
        </div>
      )}
    </div>
  );
});