import { component$, useSignal, $, useVisibleTask$, useStyles$ } from "@builder.io/qwik";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import TestCreator from "./TestCreator";
import TestTaker from "./TestTaker";
import TestResults from "./TestResults";
import styles from "./tests.css?inline";


export default component$((props: {
  classroomId: string;
  userId: string;
  isTeacher: boolean;
  user: any;
}) => {

  useStyles$(styles);

  const { classroomId, userId, isTeacher } = props;


  
  
  const activeView = useSignal<"list" | "create" | "edit" | "take" | "results">("list");
  const selectedTestId = useSignal<string>("");
  const tests = useSignal<any[]>([]);
  const isLoading = useSignal(true);
  const errorMessage = useSignal("");
  
  
  
  const loadTests = $(async () => {
    try {
      console.log("Loading tests for classroom:", classroomId);
      isLoading.value = true;
      errorMessage.value = "";
      
      
      const testsQuery = query(
        collection(db, "tests"),
        where("classroomId", "==", classroomId)
      );
      
      const testsSnapshot = await getDocs(testsQuery);
      console.log("Tests snapshot:", testsSnapshot.size, "documents found");
      
      const testsData = testsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log("Tests data:", testsData);
      
      
      const filteredTests = isTeacher 
        ? testsData 
        : testsData.filter((test: any) => test.published);
      
      console.log("Filtered tests:", filteredTests.length, "tests after filtering");
      tests.value = filteredTests;
    } catch (error) {
      console.error("Error loading tests:", error);
      errorMessage.value = "Nepodařilo se načíst testy";
    } finally {
      isLoading.value = false;
    }
  });
  
  
  const togglePublishTest = $(async (testId: string, currentlyPublished: boolean) => {
    try {
      console.log(`${currentlyPublished ? 'Unpublishing' : 'Publishing'} test:`, testId);
      
      
      const testRef = doc(db, "tests", testId);
      await updateDoc(testRef, {
        published: !currentlyPublished
      });
      
      
      await loadTests();
      
    } catch (error) {
      console.error("Error updating test publish status:", error);
      errorMessage.value = `Nepodařilo se ${currentlyPublished ? 'zrušit publikování' : 'publikovat'} test`;
    }
  });
  

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    console.log("TestsView mounted, isTeacher:", isTeacher);
    await loadTests();
  });
  
  
  const changeView = $((view: "list" | "create" | "edit" | "take" | "results", testId?: string) => {
    activeView.value = view;
    if (testId) {
      selectedTestId.value = testId;
    }
  });

  
  const handleTestCompletion = $(async (result: any) => {
    
    if (result) {
      alert(`Test dokončen! Skóre: ${result.score}/${result.totalPoints}`);
    }
    changeView("list");
  });
  
  return (
    <div class="tests-container">
      {activeView.value === "list" && (
        <div class="tests-list-view">
          {isTeacher && (
            <div class="tests-actions">
              <button 
                class="create-test-btn" 
                onClick$={() => changeView("create")}
              >
                <i class="fas fa-plus"></i> Vytvořit test
              </button>
            </div>
          )}
          
          {isLoading.value ? (
            <div class="loading">Načítání testů...</div>
          ) : errorMessage.value ? (
            <div class="error-message">{errorMessage.value}</div>
          ) : tests.value.length === 0 ? (
            <div class="no-items">
              <i class="fas fa-clipboard-list empty-icon"></i>
              <p>Žádné testy nejsou k dispozici</p>
            </div>
          ) : (
            <div class="tests-grid">
              {tests.value.map((test: any) => (
                <div key={test.id} class="test-card">
                  <h3>{test.title}</h3>
                  <p class="test-description">{test.description}</p>
                  <div class="test-meta">
                    <span class="test-questions-count">{test.questions?.length || 0} otázek</span>
                    <span class="test-duration">{test.timeLimit} minut</span>
                    {isTeacher && (
                      <span class={`test-status ${test.published ? 'published' : 'draft'}`}>
                        {test.published ? 'Publikováno' : 'Koncept'}
                      </span>
                    )}
                  </div>
                  <div class="test-actions">
                    {isTeacher ? (
                      <>
                        <button 
                          class="edit-btn"
                          onClick$={() => changeView("edit", test.id)}
                        >
                           Upravit
                        </button>
                        <button 
                          class={`publish-btn ${test.published ? 'unpublish' : 'publish'}`}
                          onClick$={() => togglePublishTest(test.id, test.published)}
                        >
                          <i class={`fas ${test.published ? 'fa-eye-slash' : 'fa-eye'}`}></i> 
                          {test.published ? 'Zrušit publikování' : 'Publikovat'}
                        </button>
                        <button 
                          class="results-btn"
                          onClick$={() => changeView("results", test.id)}
                        >
                          <i class="fas fa-chart-bar"></i> Výsledky
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          class="take-test-btn"
                          onClick$={() => changeView("take", test.id)}
                        >
                          <i class="fas fa-pencil-alt"></i> Vyplnit test
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeView.value === "create" && (
        <TestCreator 
          classroomId={classroomId}
          teacherId={userId}
          onCancel$={() => changeView("list")}
          onSave$={() => {
            loadTests();
            changeView("list");
          }}
        />
      )}
      
      {activeView.value === "edit" && (
        <TestCreator 
          classroomId={classroomId}
          teacherId={userId}
          testId={selectedTestId.value}
          onCancel$={() => changeView("list")}
          onSave$={() => {
            loadTests();
            changeView("list");
          }}
        />  
      )}
      
      {activeView.value === "take" && (
        <TestTaker
          testId={selectedTestId.value}
          classroomId={classroomId}
          studentId={userId}
          user={props.user}
          onComplete$={handleTestCompletion}
        />
      )}
      
      {activeView.value === "results" && (
        <TestResults 
          testId={selectedTestId.value}
          classroomId={classroomId}
          onBack$={() => changeView("list")}
        />
      )}
    </div>
  );
});