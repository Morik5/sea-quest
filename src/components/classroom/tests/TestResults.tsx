import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";


interface TestSubmission {
  id: string;
  testId: string;
  studentId: string;
  score: number;
  totalPoints: number;
  submittedAt: any; 
  
}

interface TestSubmissionWithStudent extends TestSubmission {
  studentName: string;
  studentAvatar: string | null;
}


function getRecommendedGrade(percentage: number): string {
  if (percentage >= 85) return "1 (výborně)";
  if (percentage >= 70) return "2 (velmi dobře)";
  if (percentage >= 55) return "3 (dobře)";
  if (percentage >= 40) return "4 (dostatečně)";
  return "5 (nedostatečně)";
}

export default component$((props: {
  testId: string;
  classroomId: string;
  onBack$: () => void;
}) => {
  const { testId } = props;
  
  const test = useSignal<any>(null);
  const submissions = useSignal<TestSubmissionWithStudent[]>([]);
  const isLoading = useSignal(true);
  const errorMessage = useSignal("");
  
  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      isLoading.value = true;
      errorMessage.value = "";
      
      
      let testDoc = await getDoc(doc(db, "tests", testId));
      
      
      if (!testDoc.exists()) {
        testDoc = await getDoc(doc(db, "classroom_tests", testId));
      }
      
      if (!testDoc.exists()) {
        errorMessage.value = "Test nebyl nalezen";
        return;
      }
      
      test.value = {
        id: testDoc.id,
        ...testDoc.data()
      };
      
      
      const submissionsQuery = query(
        collection(db, "test_submissions"),
        where("testId", "==", testId)
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const submissionsData = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TestSubmission[];
      
      
      const submissionsWithStudentInfo = await Promise.all(
        submissionsData.map(async (submission) => {
          try {
            
            const studentDoc = await getDoc(doc(db, "users", submission.studentId));
            
            return {
              ...submission,
              studentName: studentDoc.exists() ? studentDoc.data().name : "Unknown Student",
              studentAvatar: studentDoc.exists() ? studentDoc.data().avatar : null,
            } as TestSubmissionWithStudent;
          } catch (error) {
            console.error("Error fetching student info:", error);
            return {
              ...submission,
              studentName: "Unknown Student",
              studentAvatar: null
            } as TestSubmissionWithStudent;
          }
        })
      );
      
      submissions.value = submissionsWithStudentInfo;
      
    } catch (error) {
      console.error("Error loading test results:", error);
      errorMessage.value = "Nepodařilo se načíst výsledky testu";
    } finally {
      isLoading.value = false;
    }
  });
  
  return (
    <div class="test-results-container">
      <div class="back-button-container">
        <button class="back-btn" onClick$={props.onBack$}>
          <i class="fas fa-arrow-left"></i> Zpět na seznam testů
        </button>
      </div>
      
      {isLoading.value ? (
        <div class="loading">Načítání výsledků...</div>
      ) : errorMessage.value ? (
        <div class="error-message">{errorMessage.value}</div>
      ) : (
        <>
          <h2>Výsledky testu: {test.value?.title}</h2>
          
          {submissions.value.length === 0 ? (
            <div class="no-items">
              <i class="fas fa-clipboard-check empty-icon"></i>
              <p>Zatím nejsou žádné odevzdané testy</p>
            </div>
          ) : (
            <div class="results-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Skóre</th>
                    <th>Úspěšnost</th>
                    <th>Doporučená známka</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.value.map(submission => {
                    const percentage = Math.round((submission.score / submission.totalPoints) * 100);
                    return (
                      <tr key={submission.id}>
                        <td>
                          <div class="student-info">
                            {submission.studentAvatar && (
                              <img 
                                src={submission.studentAvatar} 
                                alt={submission.studentName} 
                                class="student-avatar" 
                                width="30" 
                                height="30" 
                              />
                            )}
                            {submission.studentName}
                          </div>
                        </td>
                        <td>{submission.score} / {submission.totalPoints}</td>
                        <td>{percentage}%</td>
                        <td>{getRecommendedGrade(percentage)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
});