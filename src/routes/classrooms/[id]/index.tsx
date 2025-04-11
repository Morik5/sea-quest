import { component$, useSignal, useVisibleTask$, $, useStyles$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { getUserProfile } from "../../../services/user";
import { 
  getClassroomWithStudents, 
  removeStudentByIds, 
  deleteClassroom,
  getClassroomAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  editAnnouncement,
  getClassroomHomework,
  createHomework,
  deleteHomework,
  editHomework,
  gradeHomeworkSubmission,
  createManualHomeworkSubmission
} from "../../../services/classroom";
import { formatDate } from "../../../utils/helpers";
import { makeSerializable } from "../../../utils/serialization";
import AnnouncementItem from "../../../components/AnnouncementItem";
import TabMenu from '../../../components/classroom/TabMenu';
import TestsView from '../../../components/classroom/tests/TestsView';
import { query, collection, getDocs, where } from "firebase/firestore";
import { db } from "../../../firebase";
import styles from './index.css?inline';



type TabType = 'students' | 'announcements' | 'homework' | 'comments' | 'tests';

function isValidTab(tab: string | null): tab is TabType {
  return tab === 'students' || 
         tab === 'announcements' || 
         tab === 'homework' || 
         tab === 'comments' || 
         tab === 'tests';
}

export default component$(() => {

  useStyles$(styles);

  
  const classroom = useSignal<any>(null);
  const user = useSignal<any>(null);
  const isLoading = useSignal(true);
  const errorMessage = useSignal('');
  const location = useLocation();
  const classroomId = location.params.id;
  const isConfirmDeleteOpen = useSignal(false);
  const isRemoveStudentModalOpen = useSignal(false);
  const selectedStudent = useSignal<any>(null);
  const isProcessing = useSignal(false);
  const tabParam = location.url.searchParams.get('tab');
  const initialTab: TabType = isValidTab(tabParam) ? tabParam : 'announcements';
  const activeTab = useSignal<TabType>(initialTab);
  const announcements = useSignal<any[]>([]);
  const homework = useSignal<any[]>([]);
  
  
  const isAnnouncementModalOpen = useSignal(false);
  const isHomeworkModalOpen = useSignal(false);
  
  
  const announcementTitle = useSignal('');
  const announcementContent = useSignal('');
  const isAnnouncementImportant = useSignal(false);
  
  
  const homeworkTitle = useSignal('');
  const homeworkDescription = useSignal('');
  const homeworkDueDate = useSignal('');
  const homeworkPoints = useSignal<number>(10);

  
  const selectedAnnouncement = useSignal<any>(null);
const selectedHomework = useSignal<any>(null);
  const isEditAnnouncementModalOpen = useSignal(false);
  const isEditHomeworkModalOpen = useSignal(false);
  const isDeleteAnnouncementModalOpen = useSignal(false);
  const isDeleteHomeworkModalOpen = useSignal(false);
  const isViewSubmissionsModalOpen = useSignal(false);
  const homeworkSubmissions = useSignal<any[]>([]);
  const isLoadingSubmissions = useSignal(false);
  
  
  const editAnnouncementTitle = useSignal('');
  const editAnnouncementContent = useSignal('');
  const editAnnouncementImportant = useSignal(false);
  
  const editHomeworkTitle = useSignal('');
  const editHomeworkDescription = useSignal('');
  const editHomeworkDueDate = useSignal('');
  const editHomeworkPoints = useSignal<number>(10);

  
  const selectedSubmission = useSignal<any>(null);
  const isGradingSubmission = useSignal(false);
  const submissionGrade = useSignal<number>(0);
  const submissionFeedback = useSignal('');

  
  const isViewCompletionStatusModalOpen = useSignal(false);

  
const selectedMarkingStudentId = useSignal<string>('');

  
const loadHomeworkCompletionStatus = $(async (homeworkId: string) => {
  if (!classroom.value || !classroom.value.students || isLoadingSubmissions.value) return;
  
  try {
    isLoadingSubmissions.value = true;
    
    
    const submissionsQuery = query(
      collection(db, "homework_submissions"),
      where("homeworkId", "==", homeworkId)
    );
    
    const submissionsSnapshot = await getDocs(submissionsQuery);
    const submissions = submissionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    
    const submissionsByStudentId = new Map();
    submissions.forEach((submission: any) => {
      submissionsByStudentId.set(submission.studentId, submission);
    });
    
    
    const completionStatus = classroom.value.students.map((student: any) => {
      const submission = submissionsByStudentId.get(student.id);
      return {
        student: {
          id: student.id,
          name: student.name || "Neznámý student",
          avatar: student.avatar || null,
        },
        submission: submission || null,
        submitted: !!submission,
        submittedAt: submission ? submission.submittedAt : null,
        grade: submission && submission.status === 'graded' ? submission.grade : null
      };
    });
    
    homeworkSubmissions.value = makeSerializable(completionStatus);
    
  } catch (error: any) {
    console.error("Error loading homework completion status:", error);
    errorMessage.value = `Chyba při načítání stavu úkolu: ${error.message || 'Neznámá chyba'}`;
  } finally {
    isLoadingSubmissions.value = false;
  }
});


const handleMarkAsDone = $(async (studentId: string) => {
  if (isProcessing.value || !user.value?.uid || !selectedHomework.value) return;
  
  try {
    isProcessing.value = true;
    
    
    const submissionData = {
      homeworkId: selectedHomework.value.id,
      studentId: studentId,
      classroomId: classroomId,
      content: "Označeno učitelem jako splněno",
      submittedAt: new Date().toISOString(),
      status: "graded",
      grade: selectedHomework.value.points || 10, 
      feedback: "Úkol označen jako splněný učitelem.",
      manual: true 
    };
    
    
    const submissionId = await createManualHomeworkSubmission(submissionData);
    
    
    if (submissionId) {
      
      const updatedSubmissions = homeworkSubmissions.value.map(item => {
        if (item.student.id === studentId) {
          return {
            ...item,
            submitted: true,
            submittedAt: submissionData.submittedAt,
            grade: submissionData.grade,
            submission: {
              ...submissionData,
              id: submissionId
            }
          };
        }
        return item;
      });
      
      homeworkSubmissions.value = makeSerializable(updatedSubmissions);
    }
  } catch (error: any) {
    console.error("Error marking homework as done:", error);
    errorMessage.value = `Chyba při označování úkolu jako splněný: ${error.message || 'Neznámá chyba'}`;
  } finally {
    isProcessing.value = false;
  }
});


  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      
      const profile = await getUserProfile();
      
      if (!profile || !('role' in profile) || profile.role !== "teacher") {
        
        window.location.href = "/profile";
        return;
      }
      user.value = makeSerializable(profile);
      
      
      const classroomData = await getClassroomWithStudents(classroomId);
      
      if (!classroomData) {
        errorMessage.value = "Třída nebyla nalezena";
        isLoading.value = false;
        return;
      }
      
      
      if (classroomData.teacherId !== profile.uid) {
        errorMessage.value = "Nemáte oprávnění k zobrazení této třídy";
        isLoading.value = false;
        return;
      }
      
      classroom.value = makeSerializable(classroomData);
      
      
      const announcementsData = await getClassroomAnnouncements(classroomId);
      announcements.value = makeSerializable(announcementsData);
      
      
      const homeworkData = await getClassroomHomework(classroomId);
      homework.value = makeSerializable(homeworkData);
    } catch (error: any) {
      console.error("Error loading classroom:", error);
      errorMessage.value = `Chyba při načítání třídy: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isLoading.value = false;
    }
  });

  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const isOpen = track(() => isViewCompletionStatusModalOpen.value);
    const homework = track(() => selectedHomework.value);
    
    if (isOpen && homework) {
      loadHomeworkCompletionStatus(homework.id);
    }
  });

  
  const handleRemoveStudent = $(async () => {
    if (!selectedStudent.value || !classroom.value || isProcessing.value) return;
    
    try {
      isProcessing.value = true;
      
      
      const studentId = selectedStudent.value.id;
      
      
      await removeStudentByIds(classroomId, studentId);
      
      
      classroom.value.students = classroom.value.students.filter(
        (student: any) => student.id !== studentId
      );
      
      
      isRemoveStudentModalOpen.value = false;
      selectedStudent.value = null;
    } catch (error: any) {
      console.error("Error removing student:", error);
      errorMessage.value = `Chyba při odstraňování studenta: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });

  
  const handleDeleteClassroom = $(async () => {
    if (isProcessing.value || !user.value) return;
    
    try {
      isProcessing.value = true;
      await deleteClassroom(classroomId);
      
      window.location.href = "/classrooms";
    } catch (error: any) {
      console.error("Error deleting classroom:", error);
      errorMessage.value = `Chyba při mazání třídy: ${error.message || 'Neznámá chyba'}`;
      isProcessing.value = false;
      isConfirmDeleteOpen.value = false;
    }
  });
  
  
  const handleCreateAnnouncement = $(async () => {
    if (isProcessing.value || !user.value?.uid) return;
    
    try {
      if (!announcementTitle.value.trim()) {
        errorMessage.value = "Prosím vyplňte název oznámení";
        return;
      }
      
      isProcessing.value = true;
      
      const newAnnouncement = await createAnnouncement({
        classroomId: classroomId,
        title: announcementTitle.value.trim(),
        content: announcementContent.value.trim(),
        createdBy: user.value.uid, 
        important: isAnnouncementImportant.value 
        
      });
      
      
      
      const serializedAnnouncement = makeSerializable(newAnnouncement);
      announcements.value = [serializedAnnouncement, ...announcements.value];
      
      
      
      isAnnouncementModalOpen.value = false;
      announcementTitle.value = '';
      announcementContent.value = '';
      isAnnouncementImportant.value = false;
    } catch (error: any) {
      console.error("Error creating announcement:", error);
      errorMessage.value = `Chyba při vytváření oznámení: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });
  
  
  const handleCreateHomework = $(async () => {
    if (isProcessing.value || !user.value?.uid) return;
    
    try {
      if (!homeworkTitle.value.trim()) {
        errorMessage.value = "Prosím vyplňte název úkolu";
        return;
      }
      
      if (!homeworkDueDate.value) {
        errorMessage.value = "Prosím zvolte datum odevzdání";
        return;
      }
      
      isProcessing.value = true;
      
      const dueDate = new Date(homeworkDueDate.value);
      
      const homeworkId = await createHomework({
        classroomId,
        title: homeworkTitle.value.trim(),
        description: homeworkDescription.value.trim(),
        dueDate,
        createdBy: user.value.uid
      });
      
      
      if (homeworkId) {
        const newHomework = {
          id: homeworkId,
          classroomId,
          title: homeworkTitle.value.trim(),
          description: homeworkDescription.value.trim(),
          dueDate: dueDate.toISOString(),
          createdBy: user.value.uid,
          points: homeworkPoints.value,
          createdAt: new Date().toISOString()
        };
        
        homework.value = [makeSerializable(newHomework), ...homework.value];
      }
      
      
      isHomeworkModalOpen.value = false;
      homeworkTitle.value = '';
      homeworkDescription.value = '';
      homeworkDueDate.value = '';
    } catch (error: any) {
      console.error("Error creating homework:", error);
      errorMessage.value = `Chyba při vytváření úkolu: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });

  
  const handleEditAnnouncement = $(async () => {
    if (isProcessing.value || !user.value?.uid || !selectedAnnouncement.value) return;
    
    try {
      if (!editAnnouncementTitle.value.trim()) {
        errorMessage.value = "Prosím vyplňte název oznámení";
        return;
      }
      
      isProcessing.value = true;
      
      const updatedAnnouncement = await editAnnouncement(
        selectedAnnouncement.value.id, 
        user.value.uid,
        {
          title: editAnnouncementTitle.value.trim(),
          content: editAnnouncementContent.value.trim(),
          important: editAnnouncementImportant.value
        }
      );
      
      
      
      const index = announcements.value.findIndex(a => a.id === selectedAnnouncement.value.id);
      if (index !== -1) {
        announcements.value = [
          ...announcements.value.slice(0, index),
          makeSerializable(updatedAnnouncement),
          ...announcements.value.slice(index + 1)
        ];
      }
      
      
      
      isEditAnnouncementModalOpen.value = false;
      selectedAnnouncement.value = null;
    } catch (error: any) {
      console.error("Error updating announcement:", error);
      errorMessage.value = `Chyba při úpravě oznámení: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });
  
  
  const handleDeleteAnnouncement = $(async () => {
    if (isProcessing.value || !user.value?.uid || !selectedAnnouncement.value) return;
    
    try {
      isProcessing.value = true;
      
      await deleteAnnouncement(selectedAnnouncement.value.id, user.value.uid);
      
      
      announcements.value = announcements.value.filter(a => a.id !== selectedAnnouncement.value.id);
      
      
      isDeleteAnnouncementModalOpen.value = false;
      selectedAnnouncement.value = null;
    } catch (error: any) {
      console.error("Error deleting announcement:", error);
      errorMessage.value = `Chyba při mazání oznámení: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });
  
  
  const handleEditHomework = $(async () => {
    if (isProcessing.value || !user.value?.uid || !selectedHomework.value) return;
    
    try {
      if (!editHomeworkTitle.value.trim()) {
        errorMessage.value = "Prosím vyplňte název úkolu";
        return;
      }
      
      if (!editHomeworkDueDate.value) {
        errorMessage.value = "Prosím zvolte datum odevzdání";
        return;
      }
      
      isProcessing.value = true;
      
      const dueDate = new Date(editHomeworkDueDate.value);
      
      const updatedHomework = await editHomework(
        selectedHomework.value.id, 
        user.value.uid,
        {
          title: editHomeworkTitle.value.trim(),
          description: editHomeworkDescription.value.trim(),
          dueDate
        }
      );
      
      
      if (updatedHomework) {
        const index = homework.value.findIndex(h => h.id === selectedHomework.value.id);
        if (index !== -1) {
          homework.value = [
            ...homework.value.slice(0, index),
            makeSerializable(updatedHomework),
            ...homework.value.slice(index + 1)
          ];
        }
      }
      
      
      isEditHomeworkModalOpen.value = false;
      selectedHomework.value = null;
    } catch (error: any) {
      console.error("Error updating homework:", error);
      errorMessage.value = `Chyba při úpravě úkolu: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });
  
  
  const handleDeleteHomework = $(async () => {
    if (isProcessing.value || !user.value?.uid || !selectedHomework.value) return;
    
    try {
      isProcessing.value = true;
      
      await deleteHomework(selectedHomework.value.id, user.value.uid);
      
      
      homework.value = homework.value.filter(h => h.id !== selectedHomework.value.id);
      
      
      isDeleteHomeworkModalOpen.value = false;
      selectedHomework.value = null;
    } catch (error: any) {
      console.error("Error deleting homework:", error);
      errorMessage.value = `Chyba při mazání úkolu: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });
  
    
  
  const handleGradeSubmission = $(async () => {
    if (isProcessing.value || !user.value?.uid || !selectedSubmission.value) return;
    
    try {
      isProcessing.value = true;
      
      const gradeResponse = await gradeHomeworkSubmission(
        selectedSubmission.value.id,
        user.value.uid,
        {
          grade: submissionGrade.value,
          feedback: submissionFeedback.value.trim()
        }
      );
      
      
      
      const index = homeworkSubmissions.value.findIndex(s => s.id === selectedSubmission.value.id);
      if (index !== -1) {
        homeworkSubmissions.value = [
          ...homeworkSubmissions.value.slice(0, index),
          makeSerializable(gradeResponse),
          ...homeworkSubmissions.value.slice(index + 1)
        ];
      }
      
      
      
      isGradingSubmission.value = false;
      selectedSubmission.value = null;
      submissionGrade.value = 0;
      submissionFeedback.value = '';
    } catch (error: any) {
      console.error("Error grading submission:", error);
      errorMessage.value = `Chyba při hodnocení odevzdání: ${error.message || 'Neznámá chyba'}`;
    } finally {
      isProcessing.value = false;
    }
  });

  
  const startGrading = $((submission: any) => {
    selectedSubmission.value = submission;
    submissionGrade.value = submission.grade || 0;
    submissionFeedback.value = submission.feedback || '';
    isGradingSubmission.value = true;
  });

  
  const openEditAnnouncementModal = $((announcement: any) => {
    selectedAnnouncement.value = announcement;
    editAnnouncementTitle.value = announcement.title || '';
    editAnnouncementContent.value = announcement.content || '';
    editAnnouncementImportant.value = announcement.important || false;
    isEditAnnouncementModalOpen.value = true;
  });
  
  
  const openEditHomeworkModal = $((homework: any) => {
    selectedHomework.value = homework;
    editHomeworkTitle.value = homework.title || '';
    editHomeworkDescription.value = homework.description || '';
    
    
    if (homework.dueDate) {
      const date = new Date(homework.dueDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      editHomeworkDueDate.value = `${year}-${month}-${day}`;
    } else {
      editHomeworkDueDate.value = '';
    }
    
    editHomeworkPoints.value = homework.points || 10;
    isEditHomeworkModalOpen.value = true;
  });
  
  
  
  const handleTabChange = $((tab: string) => {
    if (isValidTab(tab)) {
      activeTab.value = tab;
      
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      history.pushState({}, '', url);
    }
  });

  

  return (
    <div class="classroom-detail-container">
      {/* Add decorative bubbles for consistent design */}
      <div class="background-bubbles">
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
        <div class="background-bubble"></div>
      </div>
      
      {isLoading.value ? (
        <div class="loading">Načítání třídy...</div>
      ) : errorMessage.value ? (
        <div class="error-message">{errorMessage.value}</div>
      ) : !classroom.value ? (
        <div class="not-found">Třída nebyla nalezena</div>
      ) : (
        <>
          <div class="classroom-header">
            <div>
              <h1>{classroom.value.name}</h1>
              <p class="grade-level">
                {classroom.value.gradeLevel ? `${classroom.value.gradeLevel}. ročník` : 'Ročník neurčen'}
              </p>
              <p class="join-code">
                Kód pro připojení: <strong>{classroom.value.joinCode}</strong>
              </p>
            </div>
            <div class="classroom-actions">
              <button class="back-btn" onClick$={() => window.location.href = "/classrooms"}>
                Zpět na přehled
              </button>
              <button 
                class="delete-btn" 
                onClick$={() => isConfirmDeleteOpen.value = true}
              >
                Smazat třídu
              </button>
            </div>
          </div>

          {classroom.value.description && (
            <div class="classroom-description">
              <h3>Popis třídy</h3>
              <p>{classroom.value.description}</p>
            </div>
          )}
          
          <TabMenu
            activeTab={activeTab.value}
            isTeacher={user.value?.role === 'teacher'}
            onTabChange$={handleTabChange}
          />

          {/* Conditional rendering based on activeTab */}
          {activeTab.value === 'students' && (
            <div class="students-section">
              <h2>Studenti ({classroom.value.studentCount || 0})</h2>
              
              {classroom.value.students && classroom.value.students.length > 0 ? (
                <div class="students-table-container">
                  <table class="students-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Připojen</th>
                        <th>Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classroom.value.students.map((student: any) => (
                        <tr key={student.id}>
                          <td>
                            <div class="student-name">
                              {student.avatar && (
                                <img 
                                  src={student.avatar} 
                                  alt={student.name} 
                                  width="32" 
                                  height="32" 
                                  class="student-avatar"
                                />
                              )}
                              {student.name || 'Neznámý student'}
                            </div>
                          </td>
                          <td>{student.email || 'N/A'}</td>
                          <td>
                            {student.joinedAt ? formatDate(student.joinedAt) : 'N/A'}
                          </td>
                          <td>
                            <button 
                              class="remove-btn"
                              onClick$={() => {
                                selectedStudent.value = student;
                                isRemoveStudentModalOpen.value = true;
                              }}
                            >
                              Odstranit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div class="no-students">
                  V této třídě zatím nejsou žádní studenti.
                  <p>
                    Studenti se mohou připojit použitím kódu třídy: <strong>{classroom.value.joinCode}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab.value === 'announcements' && (
            <div class="announcements-section">
              <div class="section-header">
                <h2>Oznámení</h2>
                <button 
                  class="create-btn" 
                  onClick$={() => isAnnouncementModalOpen.value = true}
                >
                  <i class="fas fa-plus"></i> Nové oznámení
                </button>
              </div>
              
              {announcements.value.length > 0 ? (
                <div class="announcements-list">
                  {announcements.value.map((announcement) => (
                    <div key={announcement.id} class={`announcement-card ${announcement.important ? 'important' : ''}`}>
                      <h3>{announcement.title}</h3>
                      <p class="announcement-content">{announcement.content}</p>
                      <div class="announcement-meta">
                        <span>Vytvořeno: {formatDate(announcement.createdAt)}</span>
                        {announcement.commentCount > 0 && (
                          <span>Komentáře: {announcement.commentCount}</span>
                        )}
                      </div>
                      <div class="announcement-actions">
                        <button 
                          class="edit-btn"
                          onClick$={() => openEditAnnouncementModal(announcement)}
                        >
                          Upravit
                        </button>
                        <button 
                          class="view-comments-btn"
                          onClick$={() => {
                            
                            selectedAnnouncement.value = announcement;
                            activeTab.value = 'comments';
                          }}
                        >
                          Zobrazit komentáře {announcement.commentCount ? `(${announcement.commentCount})` : ''}
                        </button>
                        <button 
                          class="delete-announcement-btn"
                          onClick$={() => {
                            selectedAnnouncement.value = announcement;
                            isDeleteAnnouncementModalOpen.value = true;
                          }}
                        >
                          Smazat
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div class="no-items">
                  <p>V této třídě zatím nejsou žádná oznámení.</p>
                  <p>Vytvořte první oznámení pomocí tlačítka "Nové oznámení".</p>
                </div>
              )}
            </div>
          )}

          {/* Comments Tab - For viewing announcement comments */}
          {activeTab.value === 'comments' && selectedAnnouncement.value && (
            <div class="comments-view">
              <div class="section-header">
                <button 
                  class="back-btn" 
                  onClick$={() => {
                    activeTab.value = 'announcements';
                    selectedAnnouncement.value = null;
                  }}
                >
                  ← Zpět na oznámení
                </button>
                <h2>Komentáře: {selectedAnnouncement.value.title}</h2>
              </div>
              
              <AnnouncementItem 
                announcement={selectedAnnouncement.value}
                userProfile={user.value}
              />
            </div>
          )}

          {activeTab.value === 'homework' && (
            <div class="homework-section">
              <div class="section-header">
                <h2>Úkoly</h2>
                <button 
                  class="create-btn" 
                  onClick$={() => isHomeworkModalOpen.value = true}
                >
                  <i class="fas fa-plus"></i> Nový úkol
                </button>
              </div>
              
              {homework.value.length > 0 ? (
                <div class="homework-list">
                  {homework.value.map((assignment) => {
                    const dueDate = new Date(assignment.dueDate);
                    const isOverdue = dueDate < new Date();
                    
                    return (
                      <div key={assignment.id} class={`homework-card ${isOverdue ? 'overdue' : ''}`}>
                        <h3>{assignment.title}</h3>
                        <p class="homework-description">{assignment.description}</p>
                        <div class="homework-meta">
                          <span class="due-date">
                            {isOverdue ? 
                              <span>Termín vypršel: {formatDate(assignment.dueDate)}</span> :
                              <span>Termín odevzdání: {formatDate(assignment.dueDate)}</span>
                            }
                          </span>
                        </div>
                        <div class="submission-stats">
                          <span>Odevzdáno: {assignment.submissionCount || 0}/{classroom.value.studentCount || 0}</span>
                        </div>
                        <div class="homework-actions">
                          <button 
                            class="edit-homework-btn"
                            onClick$={() => openEditHomeworkModal(assignment)}
                          >
                            Upravit
                          </button>
                          <button 
                            class="view-submissions-btn"
                            onClick$={() => {
                              selectedHomework.value = assignment;
                              isViewCompletionStatusModalOpen.value = true;
                            }}
                          >
                            Zobrazit stav
                          </button>
                          <button 
                            class="delete-homework-btn"
                            onClick$={() => {
                              selectedHomework.value = assignment;
                              isDeleteHomeworkModalOpen.value = true;
                            }}
                          >
                            Smazat
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div class="no-items">
                  <p>V této třídě zatím nejsou žádné úkoly.</p>
                  <p>Vytvořte první úkol pomocí tlačítka "Nový úkol".</p>
                </div>
              )}
            </div>
          )}

          {activeTab.value === 'tests' && (
            <TestsView
              classroomId={classroomId}
              isTeacher={user.value?.role === 'teacher'}
              userId={user.value?.uid || ''}
              user={user.value}
            />
          )}
        </>
      )}

      {/* Delete Classroom Confirmation Modal */}
      {isConfirmDeleteOpen.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isConfirmDeleteOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Smazat třídu</h2>
            <p>Opravdu chcete smazat tuto třídu? Tato akce je nevratná a odstraní všechny související údaje.</p>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isConfirmDeleteOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="delete-confirm-btn" 
                onClick$={handleDeleteClassroom}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Mazání...' : 'Ano, smazat třídu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Modal */}
      {isRemoveStudentModalOpen.value && selectedStudent.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isRemoveStudentModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Odstranit studenta</h2>
            <p>
              Opravdu chcete odstranit studenta{' '}
              <strong>{selectedStudent.value.name || 'Neznámý student'}</strong>{' '}
              z této třídy?
            </p>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isRemoveStudentModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="delete-confirm-btn" 
                onClick$={handleRemoveStudent}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Odstraňování...' : 'Ano, odstranit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Announcement Modal - styled to match student interface */}
      {isAnnouncementModalOpen.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isAnnouncementModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Nové oznámení</h2>
            
            <div class="form-group">
              <label for="announcementTitle">Nadpis *</label>
              <input 
                type="text" 
                id="announcementTitle" 
                value={announcementTitle.value}
                onInput$={(e) => announcementTitle.value = (e.target as HTMLInputElement).value}
                required
                placeholder="Zadejte nadpis oznámení"
              />
            </div>
            
            <div class="form-group">
              <label for="announcementContent">Obsah *</label>
              <textarea 
                id="announcementContent" 
                rows={5}
                value={announcementContent.value}
                onInput$={(e) => announcementContent.value = (e.target as HTMLTextAreaElement).value}
                required
                placeholder="Zadejte text oznámení"
              ></textarea>
            </div>
            
            <div class="form-group checkbox-group">
              <input 
                type="checkbox" 
                id="isImportant" 
                checked={isAnnouncementImportant.value}
                onChange$={(e) => isAnnouncementImportant.value = (e.target as HTMLInputElement).checked}
              />
              <label for="isImportant">Označit jako důležité</label>
            </div>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isAnnouncementModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="create-confirm-btn" 
                onClick$={handleCreateAnnouncement}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Vytváření...' : 'Vytvořit oznámení'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Homework Modal - styled to match student interface */}
      {isHomeworkModalOpen.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isHomeworkModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Nový úkol</h2>
            
            <div class="form-group">
              <label for="homeworkTitle">Nadpis *</label>
              <input 
                type="text" 
                id="homeworkTitle" 
                value={homeworkTitle.value}
                onInput$={(e) => homeworkTitle.value = (e.target as HTMLInputElement).value}
                required
                placeholder="Zadejte nadpis úkolu"
              />
            </div>
            
            <div class="form-group">
              <label for="homeworkDescription">Popis *</label>
              <textarea 
                id="homeworkDescription" 
                rows={5}
                value={homeworkDescription.value}
                onInput$={(e) => homeworkDescription.value = (e.target as HTMLTextAreaElement).value}
                required
                placeholder="Zadejte popis úkolu a pokyny pro studenty"
              ></textarea>
            </div>
            
            <div class="form-group">
              <label for="homeworkDueDate">Termín odevzdání *</label>
              <input 
                type="datetime-local" 
                id="homeworkDueDate" 
                value={homeworkDueDate.value}
                onInput$={(e) => homeworkDueDate.value = (e.target as HTMLInputElement).value}
                required
              />
            </div>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isHomeworkModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="create-confirm-btn" 
                onClick$={handleCreateHomework}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Vytváření...' : 'Vytvořit úkol'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {isEditAnnouncementModalOpen.value && selectedAnnouncement.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isEditAnnouncementModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Upravit oznámení</h2>
            
            <div class="form-group">
              <label for="editAnnouncementTitle">Nadpis *</label>
              <input 
                type="text" 
                id="editAnnouncementTitle" 
                value={editAnnouncementTitle.value}
                onInput$={(e) => editAnnouncementTitle.value = (e.target as HTMLInputElement).value}
                required
              />
            </div>
            
            <div class="form-group">
              <label for="editAnnouncementContent">Obsah *</label>
              <textarea 
                id="editAnnouncementContent" 
                rows={5}
                value={editAnnouncementContent.value}
                onInput$={(e) => editAnnouncementContent.value = (e.target as HTMLTextAreaElement).value}
                required
              ></textarea>
            </div>
            
            <div class="form-group checkbox-group">
              <input 
                type="checkbox" 
                id="editIsImportant" 
                checked={editAnnouncementImportant.value}
                onChange$={(e) => editAnnouncementImportant.value = (e.target as HTMLInputElement).checked}
              />
              <label for="editIsImportant">Označit jako důležité</label>
            </div>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isEditAnnouncementModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="update-btn" 
                onClick$={handleEditAnnouncement}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Ukládání...' : 'Uložit změny'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Announcement Confirmation Modal */}
      {isDeleteAnnouncementModalOpen.value && selectedAnnouncement.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isDeleteAnnouncementModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Smazat oznámení</h2>
            <p>
              Opravdu chcete smazat oznámení{' '}
              <strong>"{selectedAnnouncement.value.title}"</strong>?
            </p>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isDeleteAnnouncementModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="delete-confirm-btn" 
                onClick$={handleDeleteAnnouncement}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Mazání...' : 'Ano, smazat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Homework Modal */}
      {isEditHomeworkModalOpen.value && selectedHomework.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isEditHomeworkModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Upravit úkol</h2>
            
            <div class="form-group">
              <label for="editHomeworkTitle">Nadpis *</label>
              <input 
                type="text" 
                id="editHomeworkTitle" 
                value={editHomeworkTitle.value}
                onInput$={(e) => editHomeworkTitle.value = (e.target as HTMLInputElement).value}
                required
              />
            </div>
            
            <div class="form-group">
              <label for="editHomeworkDescription">Popis *</label>
              <textarea 
                id="editHomeworkDescription" 
                rows={5}
                value={editHomeworkDescription.value}
                onInput$={(e) => editHomeworkDescription.value = (e.target as HTMLTextAreaElement).value}
                required
              ></textarea>
            </div>
            
            <div class="form-group">
              <label for="editHomeworkDueDate">Termín odevzdání *</label>
              <input 
                type="datetime-local" 
                id="editHomeworkDueDate" 
                value={editHomeworkDueDate.value}
                onInput$={(e) => editHomeworkDueDate.value = (e.target as HTMLInputElement).value}
                required
              />
            </div>
            
            <div class="form-group">
              <label for="editHomeworkPoints">Bodové ohodnocení</label>
              <input 
                type="number" 
                id="editHomeworkPoints" 
                min="0" 
                max="100" 
                value={editHomeworkPoints.value}
                onInput$={(e) => editHomeworkPoints.value = parseInt((e.target as HTMLInputElement).value) || 0}
              />
            </div>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isEditHomeworkModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="update-btn" 
                onClick$={handleEditHomework}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Ukládání...' : 'Uložit změny'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Homework Confirmation Modal */}
      {isDeleteHomeworkModalOpen.value && selectedHomework.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isDeleteHomeworkModalOpen.value = false;
          }
        }}>
          <div class="modal-content">
            <h2>Smazat úkol</h2>
            <p>
              Opravdu chcete smazat úkol{' '}
              <strong>"{selectedHomework.value.title}"</strong>?
            </p>
            
            <div class="modal-actions">
              <button 
                class="cancel-btn" 
                onClick$={() => isDeleteHomeworkModalOpen.value = false}
                disabled={isProcessing.value}
              >
                Zrušit
              </button>
              <button 
                class="delete-confirm-btn" 
                onClick$={handleDeleteHomework}
                disabled={isProcessing.value}
              >
                {isProcessing.value ? 'Mazání...' : 'Ano, smazat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Submissions Modal - Complete version with grading */}
      {isViewSubmissionsModalOpen.value && selectedHomework.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isViewSubmissionsModalOpen.value = false;
            isGradingSubmission.value = false;
            selectedSubmission.value = null;
          }
        }}>
          <div class="modal-content submissions-modal">
            <h2>Odevzdání úkolu: {selectedHomework.value.title}</h2>
            
            {isLoadingSubmissions.value ? (
              <div class="loading">Načítání odevzdání...</div>
            ) : homeworkSubmissions.value.length > 0 ? (
              <div class="submissions-list">
                {homeworkSubmissions.value.map((submission) => (
                  <div key={submission.id} class="submission-card">
                    <div class="submission-header">
                      <div class="student-info">
                        {submission.student?.avatar && (
                          <img 
                            src={submission.student.avatar} 
                            alt={submission.student.name} 
                            width="24" 
                            height="24"
                            class="student-avatar-sm"
                          />
                        )}
                        <strong>{submission.student?.name || 'Neznámý student'}</strong>
                        <span 
                          class={`submission-status ${
                            submission.status === 'graded' 
                              ? 'status-graded' 
                              : (new Date(submission.submittedAt) > new Date(selectedHomework.value.dueDate) 
                                ? 'status-late' 
                                : 'status-submitted')
                          }`}
                        >
                          {submission.status === 'graded' 
                            ? 'Ohodnoceno' 
                            : (new Date(submission.submittedAt) > new Date(selectedHomework.value.dueDate) 
                              ? 'Pozdě odevzdáno' 
                              : 'Odevzdáno')}
                        </span>
                      </div>
                      <div class="submission-date">
                        {formatDate(submission.submittedAt)}
                      </div>
                    </div>
                    
                    <div class="submission-content">{submission.content}</div>
                    
                    {submission.attachments && submission.attachments.length > 0 && (
                      <div class="submission-attachments">
                        {submission.attachments.map((attachment: string, index: number) => (
                          <span key={index} class="attachment-item">
                            {attachment}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {submission.status === 'graded' ? (
                      <div class="submission-grade">
                        <div>
                          <strong>Hodnocení:</strong> <span class="grade-value">{submission.grade} bodů</span>
                          {submission.feedback && (
                            <p class="feedback">
                              <strong>Komentář:</strong> {submission.feedback}
                            </p>
                          )}
                        </div>
                        <button 
                          class="grade-btn"
                          onClick$={() => startGrading(submission)}
                        >
                          Upravit hodnocení
                        </button>
                      </div>
                    ) : (
                      <div class="submission-actions">
                        <button 
                          class="grade-btn"
                          onClick$={() => startGrading(submission)}
                        >
                          Ohodnotit
                        </button>
                      </div>
                    )}
                    
                    {isGradingSubmission.value && selectedSubmission.value?.id === submission.id && (
                      <div class="grade-form">
                        <h4>Hodnocení odevzdání</h4>
                        <div class="form-row">
                          <input 
                            type="number" 
                            class="grade-input" 
                            value={submissionGrade.value} 
                            min="0"
                            max={selectedHomework.value.points || 100}
                            onInput$={(e) => submissionGrade.value = parseInt((e.target as HTMLInputElement).value) || 0}
                          /> 
                          <span>z {selectedHomework.value.points || 10} bodů</span>
                        </div>
                        
                        <div class="form-group">
                          <textarea 
                            class="grade-feedback"
                            rows={3}
                            value={submissionFeedback.value}
                            onInput$={(e) => submissionFeedback.value = (e.target as HTMLTextAreaElement).value}
                            placeholder="Zadejte komentář k hodnocení (volitelné)"
                          ></textarea>
                        </div>
                        
                        <div class="grade-actions">
                          <button 
                            class="cancel-btn"
                            onClick$={() => {
                              isGradingSubmission.value = false;
                              selectedSubmission.value = null;
                            }}
                            disabled={isProcessing.value}
                          >
                            Zrušit
                          </button>
                          <button 
                            class="grade-btn"
                            onClick$={handleGradeSubmission}
                            disabled={isProcessing.value}
                          >
                            {isProcessing.value ? 'Ukládání...' : 'Uložit hodnocení'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div class="no-submissions">
                <p>Zatím žádný student neodevzdal tento úkol.</p>
              </div>
            )}
            
            <div class="modal-actions">
              <button 
                class="close-btn" 
                onClick$={() => {
                  isViewSubmissionsModalOpen.value = false;
                  isGradingSubmission.value = false;
                  selectedSubmission.value = null;
                }}
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Homework Completion Status Modal */}
      {isViewCompletionStatusModalOpen.value && selectedHomework.value && (
        <div class="modal-overlay" onClick$={(e) => {
          if ((e.target as HTMLElement).className === 'modal-overlay') {
            isViewCompletionStatusModalOpen.value = false;
          }
        }}>
          <div class="modal-content submissions-modal">
            <h2>Stav úkolu: {selectedHomework.value.title}</h2>
            
            {isLoadingSubmissions.value ? (
              <div class="loading">Načítání stavu úkolu...</div>
            ) : homeworkSubmissions.value.length > 0 ? (
              <div class="student-completion-list">
                <table class="students-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Stav</th>
                      <th>Datum odevzdání</th>
                      <th>Hodnocení</th>
                      <th>Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeworkSubmissions.value.map((item) => (
                      <tr key={item.student.id} class={item.submitted ? (
                        new Date(item.submittedAt) > new Date(selectedHomework.value.dueDate) 
                          ? 'late-submission-row' 
                          : 'submitted-row'
                      ) : 'not-submitted-row'}>
                        <td>
                          <div class="student-name">
                            {item.student.avatar && (
                              <img 
                                src={item.student.avatar} 
                                alt={item.student.name} 
                                width="32" 
                                height="32" 
                                class="student-avatar"
                              />
                            )}
                            {item.student.name}
                          </div>
                        </td>
                        <td>
                          {item.submitted ? (
                            new Date(item.submittedAt) > new Date(selectedHomework.value.dueDate) 
                              ? <span class="status-late">Odevzdáno pozdě</span> 
                              : <span class="status-submitted">Odevzdáno</span>
                          ) : (
                            <span class="status-missing">Neodevzdáno</span>
                          )}
                        </td>
                        <td>
                          {item.submitted ? formatDate(item.submittedAt) : '-'}
                        </td>
                        <td>
                          {item.grade !== null ? `${item.grade} bodů` : (item.submitted ? 'Nehodnoceno' : '-')}
                        </td>
                        <td>
                          {item.submitted ? (
                            <button 
                              class="view-btn"
                              onClick$={() => {
                                selectedSubmission.value = item.submission;
                                startGrading(item.submission);
                              }}
                            >
                              {item.grade !== null ? 'Upravit hodnocení' : 'Ohodnotit'}
                            </button>
                          ) : (
                            <button 
                              class="mark-done-btn"
                              onClick$={() => handleMarkAsDone(item.student.id)}
                              disabled={isProcessing.value}
                            >
                              {isProcessing.value && selectedMarkingStudentId.value === item.student.id 
                                ? 'Označuji...' 
                                : 'Označit jako splněné'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div class="no-students">
                <p>V této třídě nejsou žádní studenti.</p>
              </div>
            )}
            
            <div class="modal-actions">
              <button 
                class="close-btn" 
                onClick$={() => {
                  isViewCompletionStatusModalOpen.value = false;
                }}
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});