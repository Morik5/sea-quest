import { component$, useSignal, useStore, $, useVisibleTask$, useStylesScoped$ } from "@builder.io/qwik";
import type { PropFunction } from "@builder.io/qwik";
import { doc, getDoc, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import styles from "./tests.css?inline";

export default component$((props: {
  testId: string;
  classroomId: string;
  studentId: string;
  user: any;
  onComplete$: PropFunction<(result: any) => void>;
}) => {
  useStylesScoped$(styles);
  const { testId, classroomId, studentId } = props;
  
  console.log("TestTaker component rendering with props:", props);

  const test = useStore<any>({
    id: "",
    title: "",
    description: "",
    timeLimit: 0,
    questions: [],
    isLoading: true,
    error: "",
    alreadySubmitted: false,
    previousSubmission: null
  });
  
  const currentQuestionIndex = useSignal(0);
  const answers = useStore<Record<string, string>>({});
  const timeRemaining = useSignal(0);
  const isSubmitting = useSignal(false);
  const hasSubmitted = useSignal(false);
  const timerExpired = useSignal(false);
  
  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    console.log("🔍 TestTaker component mounted");
    console.log("🔍 Props received:", { testId, classroomId, studentId });
  
    try {
      test.isLoading = true;
      test.error = "";
      
      
      const submissionsQuery = query(
        collection(db, "test_submissions"),
        where("testId", "==", testId),
        where("studentId", "==", studentId)
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      if (!submissionsSnapshot.empty) {
        console.log("⚠️ Student has already submitted this test");
        test.alreadySubmitted = true;
        test.previousSubmission = submissionsSnapshot.docs[0].data();
        
        
        return;
      }
      
      console.log("🔄 Starting to load test with ID:", testId);
      
      if (!testId) {
        console.error("❌ No testId provided!");
        test.error = "Test ID není poskytnuté";
        test.isLoading = false;
        return;
      }

      
      let testDocRef = doc(db, "classroom_tests", testId);
      let testDoc = await getDoc(testDocRef);
      
      
      if (!testDoc.exists()) {
        console.log("Test not found in classroom_tests, trying tests collection");
        testDocRef = doc(db, "tests", testId);
        testDoc = await getDoc(testDocRef);
      }
      
      console.log("🔥 Document exists?", testDoc.exists());
      
      if (!testDoc.exists()) {
        console.error("❌ Test document not found in any collection");
        test.error = "Test nebyl nalezen";
        return;
      }
      
      console.log("✅ Test document found:", testDoc.id);
      
      const testData = testDoc.data();
      console.log("📋 Raw test data:", JSON.stringify(testData, null, 2));
      
      
      if (!testData.title) console.warn("⚠️ Test is missing title");
      if (!testData.timeLimit) console.warn("⚠️ Test is missing timeLimit");
      if (!testData.questions || !Array.isArray(testData.questions)) {
        console.error("❌ Test is missing questions array");
        test.error = "Test nemá otázky";
        return;
      }
      
      test.id = testDoc.id;
      test.title = testData.title || "Nepojmenovaný test";
      test.description = testData.description || "";
      test.timeLimit = testData.timeLimit || 30; 
      test.questions = testData.questions.map((q: any, index: number) => {
        
        return {
          ...q,
          id: q.id || `q-${index}`, 
        };
      });
      
      console.log("📋 Processed test data:", {
        id: test.id,
        title: test.title,
        description: test.description,
        timeLimit: test.timeLimit,
        questionCount: test.questions.length
      });
      
      
      test.questions.forEach((q: any, idx: number) => {
        console.log(`📝 Question ${idx + 1}:`, {
          id: q.id,
          text: q.text,
          optionsCount: q.options?.length || 0,
          correctOption: q.correctOption
        });
        
        if (!q.id) console.warn(`⚠️ Question ${idx} is missing id`);
        if (!q.text) console.warn(`⚠️ Question ${idx} is missing text`);
        if (!q.options || !Array.isArray(q.options)) {
          console.warn(`⚠️ Question ${idx} has invalid options`);
        }
      });
      
      
      timeRemaining.value = test.timeLimit * 60; 
      console.log("⏱️ Time limit set to", test.timeLimit, "minutes (", timeRemaining.value, "seconds)");
      
      
      test.questions.forEach((q: any) => {
        answers[q.id] = "";
      });
      
      
      console.log("⏱️ Starting timer");
      const timer = setInterval(() => {
        if (timeRemaining.value > 0) {
          timeRemaining.value--;
        } else {
          console.log("⏱️ Time up! Auto-submitting test");
          clearInterval(timer);
          
          timerExpired.value = true;
        }
      }, 1000);
      
      
      return () => clearInterval(timer);
      
    } catch (error) {
      console.error("❌ Error loading test:", error);
      if (error instanceof Error) {
        console.error("❌ Error details:", error.message);
        console.error("❌ Stack trace:", error.stack);
      }
      test.error = "Nepodařilo se načíst test: " + (error instanceof Error ? error.message : String(error));
    } finally {
      test.isLoading = false;
      console.log("🔄 Test loading complete. Success:", !test.error);
    }
  });

  
  
  const formattedTimeRemaining = $(() => {
    const minutes = Math.floor(timeRemaining.value / 60);
    const seconds = timeRemaining.value % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  });
  
  
  const selectOption = $((questionId: string, optionValue: string) => {
    answers[questionId] = optionValue;
  });
  
  
  const nextQuestion = $(() => {
    if (currentQuestionIndex.value < test.questions.length - 1) {
      currentQuestionIndex.value++;
    }
  });
  
  const prevQuestion = $(() => {
    if (currentQuestionIndex.value > 0) {
      currentQuestionIndex.value--;
    }
  });
  
  
  const submitTest = $(async () => {
    if (hasSubmitted.value) return;
    
    try {
      isSubmitting.value = true;
      
      
      let score = 0;
      let totalPoints = 0;
      
      
      const processedAnswers: Record<string, string> = {};

      test.questions.forEach((question: any, index: number) => {
        const questionPoints = question.points || 1;
        totalPoints += questionPoints;
        
        const questionId = question.id || `q-${index}`;
        
        
        if (answers[questionId]) {
          processedAnswers[questionId] = answers[questionId];
          
          
          if (answers[questionId] === question.correctAnswer?.toString()) {
            score += questionPoints;
          }
        } else {
          
          processedAnswers[questionId] = "";
        }
      });
      
      
      const submission = {
        testId,
        classroomId,
        studentId,
        answers: processedAnswers,
        score,
        totalPoints,
        timeSpentSeconds: test.timeLimit * 60 - timeRemaining.value
      };
      
      const submissionRef = await addDoc(collection(db, "test_submissions"), submission);
      
      hasSubmitted.value = true;
      
      
      await props.onComplete$({
        id: submissionRef.id,
        ...submission
      });
      
    } catch (error) {
      console.error("Error submitting test:", error);
      alert("Nepodařilo se odeslat test.");
    } finally {
      isSubmitting.value = false;
    }
  });

  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    
    const expired = track(() => timerExpired.value);
    
    
    if (expired && !hasSubmitted.value && !isSubmitting.value) {
      submitTest();
    }
  });
  
  return (
    <div class="test-taking-container">
      {test.isLoading ? (
        <div class="loading">Načítání testu...</div>
      ) : test.error ? (
        <div class="error-message">{test.error}</div>
      ) : test.alreadySubmitted ? (
        <div class="already-submitted">
          <h3>Tento test jste již absolvovali</h3>
          <div class="submission-details">
            <p>Získané body: {test.previousSubmission?.score} z {test.previousSubmission?.totalPoints}</p>
            <p>Odesláno: {new Date(test.previousSubmission?.submittedAt || Date.now()).toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <>
          <div class="test-taking-header">
            <h2>{test.title}</h2>
            <div class={`timer ${timeRemaining.value < 60 ? 'danger' : timeRemaining.value < 180 ? 'warning' : ''}`}>
              Zbývající čas: {formattedTimeRemaining()}
            </div>
          </div>
          
          <div class="test-progress">
            <div class="progress-text">
              Otázka {currentQuestionIndex.value + 1} z {test.questions.length}
            </div>
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                style={{ width: `${((currentQuestionIndex.value + 1) / test.questions.length) * 100}%` }}
              ></div>
            </div>
          </div>
          
          {test.questions.length > 0 && (
            <div class="question-container">
              <h3 class="question-title">
                {currentQuestionIndex.value + 1}. {test.questions[currentQuestionIndex.value].text}
              </h3>
              
              <div class="options-list">
                {test.questions[currentQuestionIndex.value]?.options.map((option: string, optionIndex: number) => {
                  const questionId = test.questions[currentQuestionIndex.value].id;
                  const isSelected = answers[questionId] === optionIndex.toString();
                  
                  return (
                    <div 
                      key={optionIndex}
                      class={`option-item ${isSelected ? 'selected' : ''}`}
                      onClick$={$(() => selectOption(questionId, optionIndex.toString()))}
                    >
                      <div class="option-selector">
                        <div class="option-marker">{String.fromCharCode(65 + optionIndex)}</div>
                      </div>
                      <div class="option-text">{option}</div>
                    </div>
                  );
                })}
              </div>
              
              <div class="question-navigation">
                <button 
                  class="prev-btn"
                  onClick$={prevQuestion}
                  disabled={currentQuestionIndex.value === 0}
                >
                  <i class="fas fa-arrow-left"></i> Předchozí
                </button>
                
                {currentQuestionIndex.value < test.questions.length - 1 ? (
                  <button 
                    class="next-btn"
                    onClick$={nextQuestion}
                  >
                    Další <i class="fas fa-arrow-right"></i>
                  </button>
                ) : (
                  <button 
                    class="submit-test-btn"
                    onClick$={submitTest}
                    disabled={isSubmitting.value || hasSubmitted.value}
                  >
                    <i class="fas fa-paper-plane"></i> {isSubmitting.value ? 'Odesílání...' : 'Odeslat test'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});