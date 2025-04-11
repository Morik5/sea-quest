import { component$, useSignal, useVisibleTask$, $, useStylesScoped$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { getUserProfile } from "../../../services/user";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import { makeSerializable } from "../../../utils/serialization";
import { 
  getClassroomWithStudents, 
  getClassroomAnnouncements, 
  getClassroomHomework, 
  createAnnouncement,
  repairClassroomEnrollments
} from "../../../services/classroom";
import { AnnouncementItem } from "../../../components/classroom/AnnouncementItem";
import { HomeworkItem } from "../../../components/classroom/HomeworkItem";
import { StudentsList } from "../../../components/classroom/StudentsList";
import TestsView from "../../../components/classroom/tests/TestsView";
import styles from './index.css?inline'


export default component$(() => {

  useStylesScoped$(styles);

  

  const location = useLocation();
  const classroomId = location.params.id;
  const classroom = useSignal<any>(null);
  const user = useSignal<any>(null);
  const teacher = useSignal<any>(null);
  const isLoading = useSignal(true);
  const errorMessage = useSignal('');
  const activeTab = useSignal('announcements');
  const students = useSignal<any[]>([]);
  const announcements = useSignal<any[]>([]);
  const homeworks = useSignal<any[]>([]);

  
  const isAnnouncementModalOpen = useSignal(false);
  const announcementTitle = useSignal('');
  const announcementContent = useSignal('');
  const isSubmittingAnnouncement = useSignal(false);
  const announcementError = useSignal('');
    
  const isRepairing = useSignal(false);
  const repairMessage = useSignal('');
  
  
  const setActiveTab = $((tab: string) => {
    activeTab.value = tab;
  });
  
  
  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      
      const profile = await getUserProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      
      console.log("User profile:", profile); 
      user.value = makeSerializable(profile);
      
      
      const classroomData = await getClassroomWithStudents(classroomId);
      if (!classroomData) {
        errorMessage.value = "Třída nebyla nalezena.";
        return;
      }
      
      console.log("Classroom data:", classroomData); 
      
      
      const isTeacher = classroomData.teacherId === profile.uid;
      const isStudent = 'enrolledClassrooms' in profile && 
                        Array.isArray(profile.enrolledClassrooms) && 
                        profile.enrolledClassrooms.includes(classroomId);
      
      console.log("Access check:", { 
        isTeacher, 
        isStudent,
        teacherId: classroomData.teacherId,
        userId: profile.uid
      });
      
      if (!isTeacher && !isStudent) {
        errorMessage.value = "Nemáte přístup k této třídě.";
        return;
      }
      
      
      classroom.value = makeSerializable(classroomData);
      
      
      console.log("Raw students data:", classroomData.students); 
      
      
      let studentsList = Array.isArray(classroomData.students) 
        ? classroomData.students.filter(student => student !== null && student !== undefined)
        : [];
        
      console.log("Filtered students from classroom data:", studentsList);
      
      
      const studentIds = (classroomData as any).enrolledStudentIds || (classroomData as any).studentIds || [];
      console.log("Found student IDs in classroom:", studentIds);
      
      
      try {
        console.log("Trying to fetch enrollments directly...");
        const enrollmentsQuery = query(
          collection(db, "classroom_enrollments"),
          where("classroomId", "==", classroomId)
        );
        
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        if (!enrollmentsSnapshot.empty) {
          console.log(`Found ${enrollmentsSnapshot.size} enrollments`);
          
          
          const enrolledIds = enrollmentsSnapshot.docs.map(doc => doc.data().studentId);
          console.log("Enrollment student IDs:", enrolledIds);
          
          
          if (enrolledIds.length > 0) {
            const studentsPromises = enrolledIds.map(async (studentId) => {
              try {
                const userDoc = await getDoc(doc(db, "users", studentId));
                if (userDoc.exists()) {
                  return {
                    id: userDoc.id,
                    ...userDoc.data()
                  };
                }
                return null;
              } catch (e) {
                console.error(`Error fetching student ${studentId}:`, e);
                return null;
              }
            });
            
            const enrolledStudents = (await Promise.all(studentsPromises)).filter(Boolean);
            console.log("Fetched student details:", enrolledStudents);
            
            if (enrolledStudents.length > 0) {
              studentsList = enrolledStudents;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching enrollments:", error);
      }
      
      
      students.value = makeSerializable(studentsList);
      console.log("Final students array:", students.value);
      
      
      const teacherDoc = await getDoc(doc(db, "users", classroomData.teacherId));
      if (teacherDoc.exists()) {
        teacher.value = {
          id: teacherDoc.id,
          ...makeSerializable(teacherDoc.data())
        };
      }
      
      
      try {
        const announcementsData = await getClassroomAnnouncements(classroomId);
        announcements.value = makeSerializable(announcementsData);
      } catch (error) {
        console.error("Error loading announcements:", error);
        
      }
      
      
      try {
        const homeworkData = await getClassroomHomework(classroomId);
        
        
        if (user.value?.role === 'student') {
          
          const submissionsQuery = query(
            collection(db, "homework_submissions"),
            where("studentId", "==", user.value.uid),
            where("homeworkId", "in", homeworkData.map(hw => hw.id))
          );
          
          const submissionsSnapshot = await getDocs(submissionsQuery);
          const studentSubmissions: { id: string; homeworkId: string; [key: string]: any }[] = submissionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              homeworkId: data.homeworkId,
              ...data
            };
          });
          
          
          homeworkData.forEach((homework) => {
            const submission = studentSubmissions.find(sub => sub.homeworkId === homework.id);
            if (submission) {
              homework.completed = true;
              homework.submission = submission;
              
              
              if (submission.manual) {
                homework.markedByTeacher = true;
              }
            }
          });
        }
        
        homeworks.value = makeSerializable(homeworkData);
      } catch (error) {
        console.error("Error loading homework:", error);
        
      }
      
    } catch (error) {
      console.error("Error loading classroom:", error);
      errorMessage.value = "Nepodařilo se načíst data třídy.";
    } finally {
      isLoading.value = false;
    }
  });

  const handleCreateAnnouncement = $(async () => {
    if (!announcementTitle.value.trim() || !announcementContent.value.trim()) {
      announcementError.value = "Vyplňte prosím nadpis a obsah oznámení";
      return;
    }
    
    try {
      isSubmittingAnnouncement.value = true;
      announcementError.value = '';
      
      await createAnnouncement({  
        classroomId: classroomId,
        title: announcementTitle.value.trim(),
        content: announcementContent.value.trim(),
        createdBy: user.value?.uid,
        important: false
      });
      
      isAnnouncementModalOpen.value = false;
      announcementTitle.value = '';
      announcementContent.value = '';
      
      
      const newAnnouncements = await getClassroomAnnouncements(classroomId);
      announcements.value = makeSerializable(newAnnouncements);
      
    } catch (error: any) {
      console.error("Error creating announcement:", error);
      announcementError.value = error.message || "Nepodařilo se vytvořit oznámení.";
    } finally {
      isSubmittingAnnouncement.value = false;
    }
  });

  
  const handleRepairEnrollments = $(async () => {
    try {
      isRepairing.value = true;
      isRepairing.value = true;
      repairMessage.value = "Opravuji zápisy studentů...";
      
      
      const result = await repairClassroomEnrollments(classroomId);
      
      const classroomData = await getClassroomWithStudents(classroomId);
      if (classroomData) {
        classroom.value = makeSerializable(classroomData);
        
        
        try {
          console.log("Trying to fetch enrollments after repair...");
          const enrollmentsQuery = query(
            collection(db, "classroom_enrollments"),
            where("classroomId", "==", classroomId)
          );
          
          const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
          if (!enrollmentsSnapshot.empty) {
            console.log(`Found ${enrollmentsSnapshot.size} enrollments after repair`);
            
            
            const enrolledIds = enrollmentsSnapshot.docs.map(doc => doc.data().studentId);
            console.log("Enrollment student IDs after repair:", enrolledIds);
            
            
            if (enrolledIds.length > 0) {
              const studentsPromises = enrolledIds.map(async (studentId) => {
                try {
                  const userDoc = await getDoc(doc(db, "users", studentId));
                  if (userDoc.exists()) {
                    return {
                      id: userDoc.id,
                      ...userDoc.data()
                    };
                  }
                  return null;
                } catch (e) {
                  console.error(`Error fetching student ${studentId}:`, e);
                  return null;
                }
              });
              
              const enrolledStudents = (await Promise.all(studentsPromises)).filter(Boolean);
              console.log("Fetched student details after repair:", enrolledStudents);
              students.value = makeSerializable(enrolledStudents);
            }
          }
        } catch (error) {
          console.error("Error fetching enrollments after repair:", error);
        }
      }
      
      repairMessage.value = `Oprava dokončena. Zpracováno ${result.enrolledCount} studentů.`;
      
      
      setTimeout(() => {
        repairMessage.value = '';
      }, 3000);
      
    } catch (error: any) {
      console.error("Error repairing enrollments:", error);
      repairMessage.value = `Chyba: ${error.message || "Nepodařilo se opravit zápisy studentů."}`;
    } finally {
      isRepairing.value = false;
    }
  });
  
  return (
    <div class="classroom-page">
      <div class="background-bubbles">
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
      </div>
      
      <div class="classroom-detail-container">
        {isLoading.value ? (
          <div class="loading">Načítání třídy...</div>
        ) : errorMessage.value ? (
          <div class="error-message">{errorMessage.value}</div>
        ) : !classroom.value ? (
          <div class="not-found">Třída nebyla nalezena</div>
        ) : (
          <>
            
            <div class="background-bubbles">
              <div class="background-bubble"></div>
              <div class="background-bubble"></div>
              <div class="background-bubble"></div>
              <div class="background-bubble"></div>
              <div class="background-bubble"></div>
            </div>
              
            
            <div class="classroom-header">
              <div>
                <h1>{classroom.value.name}</h1>
                {classroom.value.gradeLevel && (
                  <p class="grade-level">{classroom.value.gradeLevel}. ročník</p>
                )}
                <p class="join-code">
                  Kód pro připojení: <strong>{classroom.value.joinCode}</strong>
                </p>
              </div>
              <div class="classroom-actions">
                <button class="back-btn" onClick$={() => window.history.back()}>
                  Zpět
                </button>
              </div>
            </div>
            
            
            {classroom.value.description && (
              <div class="classroom-description">
                <h3>Popis třídy</h3>
                <p>{classroom.value.description}</p>
              </div>
            )}
            
            
            <div class="classroom-tabs">
              <button 
                class={`tab-btn ${activeTab.value === 'announcements' ? 'active' : ''}`}
                onClick$={() => setActiveTab('announcements')}
              >
                Oznámení ({announcements.value.length})
              </button>
              <button 
                class={`tab-btn ${activeTab.value === 'homework' ? 'active' : ''}`}
                onClick$={() => setActiveTab('homework')}
              >
                Úkoly ({homeworks.value.length})
              </button>
              <button 
                class={`tab-btn ${activeTab.value === 'members' ? 'active' : ''}`}
                onClick$={() => setActiveTab('members')}
              >
                Studenti ({students.value.length || 0})
              </button>
              <button 
                class={`tab-btn ${activeTab.value === 'tests' ? 'active' : ''}`}
                onClick$={() => setActiveTab('tests')}
              >
                Testy
              </button>
            </div>
                
            
            {activeTab.value === 'announcements' && (
              <div class="announcements-section">
                <div class="section-header">
                  <h2>Oznámení</h2>
                  
                  {user.value?.role === 'teacher' && user.value?.uid === classroom.value.teacherId && (
                    <button 
                      class="create-btn"
                      onClick$={() => isAnnouncementModalOpen.value = true}
                    >
                      <i class="fas fa-plus"></i> Nové oznámení
                    </button>
                  )}
                </div>
                
                <div class="announcements-list">
                  {announcements.value.length > 0 ? (
                    announcements.value.map((announcement) => (
                      <AnnouncementItem 
                        key={announcement.id} 
                        announcement={announcement} 
                        teacherName={teacher.value?.name}
                        currentUser={user.value}
                      />
                    ))
                  ) : (
                    <div class="no-items">
                      <i class="fas fa-bullhorn empty-icon"></i>
                      <p>Žádná oznámení</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            
            {activeTab.value === 'homework' && (
              <div class="homework-section">
                <div class="section-header">
                  <h2>Úkoly</h2>
                  
                  {user.value?.role === 'teacher' && user.value?.uid === classroom.value.teacherId && (
                    <button class="create-btn">
                      <i class="fas fa-plus"></i> Nový úkol
                    </button>
                  )}
                </div>
                
                <div class="homework-list">
                  {homeworks.value.length > 0 ? (
                    homeworks.value.map((homework) => (
                      <HomeworkItem 
                        key={homework.id} 
                        homework={homework} 
                        isStudent={user.value?.role === 'student'}
                      />
                    ))
                  ) : (
                    <div class="no-items">
                      <i class="fas fa-book empty-icon"></i>
                      <p>Žádné úkoly</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            
            {activeTab.value === 'members' && (
              <div class="students-section">
                <div class="section-header">
                  <h2>Studenti ({students.value.length || 0})</h2>
                  
                  
                  {user.value?.role === 'teacher' && user.value?.uid === classroom.value?.teacherId && (
                    <button 
                      class="action-button repair-btn"
                      onClick$={handleRepairEnrollments}
                      disabled={isRepairing.value}
                    >
                      <i class="fas fa-sync"></i> {isRepairing.value ? 'Opravuji...' : 'Opravit zápisy'}
                    </button>
                  )}
                </div>
                
                {repairMessage.value && (
                  <div class={`repair-message ${repairMessage.value.includes('Chyba') ? 'error' : 'success'}`}>
                    {repairMessage.value}
                  </div>
                )}
                
                <StudentsList students={students.value} />
              </div>
            )}

            
            {activeTab.value === 'tests' && (
              <div class="tests-section">
                <div class="section-header">
                  <h2>Testy</h2>
                </div>
                
                <TestsView
                  classroomId={classroomId}
                  isTeacher={user.value?.role === 'teacher'}
                  userId={user.value?.uid || ''}
                  user={user.value}
                />
              </div>
            )}
          </>
        )}
        
        
        {isAnnouncementModalOpen.value && (
          <div class="modal-overlay" onClick$={(e) => {
            if ((e.target as HTMLElement).className === 'modal-overlay') {
              isAnnouncementModalOpen.value = false;
            }
          }}>
            <div class="modal-content announcement-form">
              <h2>Nové oznámení</h2>
              
              <div class="form-group">
                <label for="announcementTitle">Nadpis</label>
                <input 
                  type="text" 
                  id="announcementTitle" 
                  value={announcementTitle.value}
                  onInput$={(e) => announcementTitle.value = (e.target as HTMLInputElement).value}
                  placeholder="Nadpis oznámení"
                />
              </div>
              
              <div class="form-group">
                <label for="announcementContent">Obsah</label>
                <textarea 
                  id="announcementContent" 
                  value={announcementContent.value}
                  onInput$={(e) => announcementContent.value = (e.target as HTMLInputElement).value}
                  placeholder="Text oznámení..."
                  rows={6}
                />
              </div>
              
              {announcementError.value && (
                <div class="error-message">{announcementError.value}</div>
              )}
              
              <div class="modal-actions">
                <button 
                  type="button" 
                  class="cancel-btn" 
                  onClick$={() => isAnnouncementModalOpen.value = false}
                >
                  Zrušit
                </button>
                <button 
                  type="button" 
                  class="submit-btn" 
                  onClick$={handleCreateAnnouncement}
                  disabled={isSubmittingAnnouncement.value}
                >
                  {isSubmittingAnnouncement.value ? 'Ukládání...' : 'Zveřejnit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});