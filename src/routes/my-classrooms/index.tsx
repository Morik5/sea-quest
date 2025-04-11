import { component$, useSignal, useVisibleTask$, $, useStylesScoped$ } from "@builder.io/qwik";
import { getUserProfile } from "../../services/user";
import { joinClassroom, getClassroom } from "../../services/classroom";
import { makeSerializable } from "../../utils/serialization";
import styles from "./index.css?inline";

export default component$(() => {

  useStylesScoped$(styles);

  
  interface UserProfile {
    name: string;
    role: string;
    avatar: string;
    quizCompleted: number;
    perfectScores: number; 
    experience: number;
    level: number;
    uid: string;
    enrolledClassrooms: string[];
  }

  
  const user = useSignal<UserProfile | null>(null);
  const classrooms = useSignal<any[]>([]);
  const isLoading = useSignal(true);
  const errorMessage = useSignal('');
  const isJoinModalOpen = useSignal(false);
  const joinCode = useSignal('');
  const joinErrorMessage = useSignal('');
  const isJoining = useSignal(false);

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      
      const profileData = await getUserProfile();
      
      if (!profileData) {
        window.location.href = "/login";
        return;
      }
      
      
      const profile = {
        ...profileData,
        enrolledClassrooms: 'enrolledClassrooms' in profileData ? profileData.enrolledClassrooms : []
      } as UserProfile;
      
      if (profile.role === "teacher") {
        
        window.location.href = "/classrooms";
        return;
      }
      
      user.value = makeSerializable(profile);
      
      
      if (profile.enrolledClassrooms.length > 0) {
        
        const classroomDetails = await Promise.all(
          profile.enrolledClassrooms.map(async (id: string) => {
            try {
              const details = await getClassroom(id);
              return makeSerializable({ ...details, id });
            } catch (error) {
              console.error(`Error fetching classroom ${id}:`, error);
              return { id }; 
            }
          })
        );
        classrooms.value = classroomDetails;
      }
    } catch (error) {
      console.error("Error loading student profile:", error);
      errorMessage.value = "Nepodařilo se načíst data. Zkuste to prosím znovu.";
    } finally {
      isLoading.value = false;
    }
  });

  
  const handleJoinClassroom = $(async () => {
    if (!joinCode.value.trim()) {
      joinErrorMessage.value = "Zadejte kód třídy";
      return;
    }
    
    try {
      isJoining.value = true;
      joinErrorMessage.value = '';
      
      if (!user.value?.uid) {
        joinErrorMessage.value = "Nejste přihlášeni";
        return;
      }
      
      const classroom = await joinClassroom(joinCode.value.trim(), user.value.uid);
      
      
      if (!classrooms.value.find(c => c.id === classroom.id)) {
        classrooms.value = [...classrooms.value, makeSerializable(classroom)];
      }
      
      
      isJoinModalOpen.value = false;
      joinCode.value = '';
      
      
      const updatedProfile = await getUserProfile();
      user.value = makeSerializable(updatedProfile);
      
    } catch (error: any) {
      console.error("Error joining classroom:", error);
      joinErrorMessage.value = error.message || "Nepodařilo se připojit ke třídě. Zkontrolujte kód a zkuste to znovu.";
    } finally {
      isJoining.value = false;
    }
  });

  return (
    <div class="student-classrooms-container">
      <h1>Moje třídy</h1>
      
      <div class="actions-bar">
        <button 
          class="join-classroom-btn"
          onClick$={() => isJoinModalOpen.value = true}
        >
          Připojit se ke třídě
        </button>
      </div>

      {errorMessage.value && <div class="error-message">{errorMessage.value}</div>}

      {isLoading.value ? (
        <div class="loading">Načítání tříd...</div>
      ) : (
        <div class="classrooms-grid">
          {classrooms.value.length > 0 ? (
            classrooms.value.map((classroom) => (
              <div key={classroom.id} class="classroom-card">
                <h3>{classroom.name || "Třída " + classroom.id}</h3>
                {classroom.teacherName && <p class="teacher-name">Učitel: {classroom.teacherName}</p>}
                {classroom.gradeLevel && <p class="classroom-grade">{classroom.gradeLevel}. ročník</p>}
                <div class="classroom-actions">
                  <button 
                    class="view-classroom-btn"
                    onClick$={() => window.location.href = `/classroom/${classroom.id}`}
                  >
                    Zobrazit třídu
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div class="no-classrooms">
              <p>Zatím nejste připojeni k žádné třídě.</p>
              <p>Připojte se ke třídě pomocí kódu, který vám poskytne váš učitel.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal for joining a classroom */}
      {isJoinModalOpen.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isJoinModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Připojit se ke třídě</h2>
            <p>Zadejte kód třídy, který vám poskytl váš učitel.</p>
            
            <div class="form-group">
              <label for="joinCode">Kód třídy</label>
              <input 
                type="text" 
                id="joinCode" 
                value={joinCode.value}
                onInput$={(e) => joinCode.value = (e.target as HTMLInputElement).value.toUpperCase()}
                placeholder="Např. ABC123"
              />
            </div>
            
            {joinErrorMessage.value && (
              <div class="join-error">{joinErrorMessage.value}</div>
            )}
            
            <div class="modal-actions">
              <button 
                type="button" 
                class="cancel-btn" 
                onClick$={() => isJoinModalOpen.value = false}
              >
                Zrušit
              </button>
              <button 
                type="button" 
                class="join-btn" 
                onClick$={handleJoinClassroom}
                disabled={isJoining.value}
              >
                {isJoining.value ? 'Připojování...' : 'Připojit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
