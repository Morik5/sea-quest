import { component$, useSignal, $, useVisibleTask$, useStylesScoped$ } from "@builder.io/qwik";
import { getUserProfile } from "../../services/user";
import { getTeacherClassrooms, createClassroom } from "../../services/classroom";
import { formatDate } from "../../utils/helpers";
import { makeSerializable } from "../../utils/serialization";
import styles from './index.css?inline';


interface UserProfile {
  name: string;
  role: string;
  avatar: string;
  quizCompleted: number;
  perfectScores: number;
  experience: number;
  level: number;
  uid?: string; 
}

export default component$(() => {

  useStylesScoped$(styles);

  
  const classrooms = useSignal<any[]>([]);
  const isCreateModalOpen = useSignal(false);
  const user = useSignal<any>(null);
  const userId = useSignal<string | null>(null);
  const isLoading = useSignal(true);
  const errorMessage = useSignal('');
  const debugInfo = useSignal<string>('');

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      debugInfo.value = "Starting to load user profile...";
      
      
      errorMessage.value = '';
      
      
      const profile = await getUserProfile() as UserProfile;
      debugInfo.value += "\nProfile loaded, checking role...";
      
      
      
      if (profile.role !== "teacher") {
        debugInfo.value += "\nUser is not a teacher, redirecting...";
        window.location.href = "/profile";
        return;
      }
      
      
      if (!profile.uid) {
        errorMessage.value = "User profile is incomplete. Please sign in again.";
        isLoading.value = false;
        debugInfo.value += "\nProfile missing UID!";
        return;
      }
      
      
      user.value = profile;
      userId.value = profile.uid;
      debugInfo.value += `\nUser ID set: ${profile.uid}`;
      
      
      debugInfo.value += "\nFetching classrooms...";
      try {
        const teacherClassrooms = await getTeacherClassrooms(profile.uid);
        debugInfo.value += `\nReceived ${teacherClassrooms.length} classrooms`;
        
        
        if (teacherClassrooms.length > 0) {
          const processedClassrooms = makeSerializable(teacherClassrooms);
          classrooms.value = processedClassrooms;
          debugInfo.value += `\nProcessed ${processedClassrooms.length} classrooms`;
        } else {
          classrooms.value = [];
          debugInfo.value += "\nNo classrooms found";
        }
      } catch (classroomError: any) {
        console.error("Error fetching classrooms:", classroomError);
        errorMessage.value = `Failed to load classrooms: ${classroomError?.message || 'Unknown error'}`;
        debugInfo.value += `\nClassroom error: ${classroomError?.message || 'Unknown'}`;
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      errorMessage.value = `Failed to load user profile: ${error?.message || 'Unknown error'}`;
      debugInfo.value += `\nProfile error: ${error?.message || 'Unknown'}`;
    } finally {
      isLoading.value = false;
      debugInfo.value += "\nLoading completed";
    }
  });

  
  const handleCreateClassroom = $(async (formData: any) => {
    try {
      errorMessage.value = '';
      
      
      const profile = await getUserProfile();
      if (!profile || !profile.uid) {
        errorMessage.value = "Missing user ID. Please make sure you're signed in and try again.";
        return;
      }
      
      
      const newClassroom = await createClassroom(profile.uid, {
        name: formData.className,
        gradeLevel: formData.gradeLevel || undefined,
        description: formData.description || undefined
      });
      
      
      const createdClassroom = {
        id: newClassroom.id,
        name: formData.className,
        joinCode: newClassroom.joinCode,
        gradeLevel: formData.gradeLevel || undefined,
        description: formData.description || undefined,
        teacherId: profile.uid,
        studentCount: 0,
        createdAt: new Date().toISOString()
      };
      
      classrooms.value = [...classrooms.value, createdClassroom];
      isCreateModalOpen.value = false;
    } catch (error: any) {
      console.error("Error creating classroom:", error);
      errorMessage.value = `Failed to create classroom: ${error?.message || 'Unknown error'}`;
    }
  });

  return (
    <div class="classrooms-container">
      <h1>Správa tříd</h1>
      

      {userId.value && (
        <p class="debug-info">Přihlášený učitel ID: {userId.value}</p>
      )}
      
      <button 
        class="create-classroom-btn"
        onClick$={() => isCreateModalOpen.value = true}
      >
        Vytvořit novou třídu
      </button>

      {errorMessage.value && <div class="error-message">{errorMessage.value}</div>}

      {isLoading.value ? (
        <div class="loading">Načítání tříd...</div>
      ) : (
        <div class="classrooms-grid">
          {classrooms.value.length > 0 ? (
            classrooms.value.map((classroom) => (
              <div key={classroom.id} class="classroom-card">
                <h3>{classroom.name || "Unnamed Class"}</h3>
                <p class="classroom-grade">{classroom.gradeLevel ? `${classroom.gradeLevel}. ročník` : 'Ročník neurčen'}</p>
                <p class="join-code">Kód pro připojení: <strong>{classroom.joinCode || "N/A"}</strong></p>
                <p class="student-count">Počet studentů: {classroom.studentCount || 0}</p>
                {classroom.createdAt && (
                  <p class="create-date">Vytvořeno: {formatDate(classroom.createdAt)}</p>
                )}
                <div class="classroom-actions">
                  <button 
                    class="manage-btn"
                    onClick$={() => window.location.href = `/classrooms/${classroom.id}`}
                  >
                    <i class="fas fa-cog"></i> Spravovat třídu
                  </button>
                  
               
                  <button 
                    class="tests-btn"
                    onClick$={() => window.location.href = `/classrooms/${classroom.id}?tab=tests`}
                  >
                    <i class="fas fa-tasks"></i> Testy
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p class="no-classrooms">Zatím nemáte žádné třídy. Vytvořte svoji první třídu pomocí tlačítka výše.</p>
          )}
        </div>
      )}


      {isCreateModalOpen.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isCreateModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Vytvořit novou třídu</h2>
            <form preventdefault:submit onSubmit$={async (e) => {
              const formData = new FormData(e.target as HTMLFormElement);
              const formEntries = Object.fromEntries(formData.entries());
              await handleCreateClassroom(formEntries);
            }}>
              <div class="form-group">
                <label for="className">Název třídy *</label>
                <input type="text" id="className" name="className" required />
              </div>
              <div class="form-group">
                <label for="gradeLevel">Ročník *</label>
                <select id="gradeLevel" name="gradeLevel">
                  <option value="">Vyberte ročník</option>
                  <option value="1">1. ročník</option>
                  <option value="2">2. ročník</option>
                  <option value="3">3. ročník</option>
                  <option value="4">4. ročník</option>
                  <option value="5">5. ročník</option>
                  <option value="6">6. ročník</option>
                  <option value="7">7. ročník</option>
                  <option value="8">8. ročník</option>
                  <option value="9">9. ročník</option>
                </select>
              </div>
              <div class="form-group">
                <label for="description">Popis třídy *</label>
                <textarea id="description" name="description" rows={3}></textarea>
              </div>
              <div class="modal-actions">
                <button type="button" class="cancel-btn" onClick$={() => isCreateModalOpen.value = false}>
                  Zrušit
                </button>
                <button type="submit" class="create-btn">Vytvořit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});