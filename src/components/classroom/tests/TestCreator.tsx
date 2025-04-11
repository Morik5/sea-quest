import { component$, useSignal, useStore, $, type QRL, useVisibleTask$ } from "@builder.io/qwik";
import { createTest, type TestQuestion, updateTest } from "../../../services/testService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";

export default component$(function(props: {
  classroomId: string;
  teacherId: string;
  testId?: string;
  onCancel$: QRL<() => void>;
  onSave$: QRL<() => void>;
}) {
  const { classroomId, teacherId, testId, onCancel$, onSave$ } = props;
  
  const test = useStore({
    title: "",
    description: "",
    questions: [] as TestQuestion[],
    timeLimit: 30,
    published: false,
    classroomId,
    teacherId,
  });

  const saving = useSignal(false);
  const error = useSignal("");
  const isEditMode = useSignal(!!testId);

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    if (testId) {
      try {
        const testDoc = await getDoc(doc(db, "tests", testId));
        if (testDoc.exists()) {
          const testData = testDoc.data();
          
          
          test.title = testData.title || "";
          test.description = testData.description || "";
          test.questions = testData.questions || [];
          test.timeLimit = testData.timeLimit || 30;
          test.published = testData.published || false;
          
          console.log("Loaded existing test for editing:", testData);
        } else {
          error.value = "Test nebyl nalezen";
        }
      } catch (err) {
        console.error("Error loading test:", err);
        error.value = "Nepodařilo se načíst test pro úpravy";
      }
    }
  });

  const addQuestion = $(() => {
    test.questions.push({
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      points: 1,
      type: "multiple_choice",
    });
  });

  const updateQuestion = $((index: number, field: string, value: any) => {
    test.questions[index] = { ...test.questions[index], [field]: value };
  });

  const updateOption = $((qIndex: number, oIndex: number, text: string) => {
    test.questions[qIndex].options[oIndex] = text;
  });

  const setCorrectAnswer = $((qIndex: number, oIndex: number) => {
    test.questions[qIndex].correctAnswer = oIndex;
  });

  const removeQuestion = $((index: number) => {
    test.questions.splice(index, 1);
  });

  const handleSave = $(async () => {
    if (!test.title.trim()) {
      error.value = "Test musí mít název";
      return;
    }
    if (test.questions.length === 0) {
      error.value = "Test musí obsahovat alespoň jednu otázku";
      return;
    }
    for (let i = 0; i < test.questions.length; i++) {
      if (!test.questions[i].text.trim() || test.questions[i].options.some(opt => !opt.trim())) {
        error.value = `Otázka ${i + 1} má nevyplněné pole`;
        return;
      }
    }
    
    try {
      saving.value = true;
      
      if (isEditMode.value && testId) {
        
        await updateTest(testId, teacherId, {
          title: test.title,
          description: test.description,
          questions: test.questions,
          timeLimit: test.timeLimit,
          published: test.published
        });
        console.log("Test updated successfully");
      } else {
        
        await createTest(test);
        console.log("New test created successfully");
      }
      
      await onSave$();
    } catch (err) {
      console.error("Error saving test:", err);
      error.value = isEditMode.value 
        ? "Nepodařilo se aktualizovat test" 
        : "Nepodařilo se uložit test";
    } finally {
      saving.value = false;
    }
  });

  return (
    <div class="test-creator">
      <h2>{isEditMode.value ? "Upravit test" : "Vytvořit nový test"}</h2>
      {error.value && <div class="error-message">{error.value}</div>}
      
      <div class="form-group">
        <label>Název testu</label>
        <input type="text" value={test.title} onInput$={(e) => test.title = (e.target as HTMLInputElement).value} />
      </div>
      
      <div class="form-group">
        <label>Popis testu</label>
        <textarea value={test.description} onInput$={(e) => test.description = (e.target as HTMLTextAreaElement).value} />
      </div>
      
      <div class="form-group">
        <label>Časový limit (minut)</label>
        <input 
          type="number" 
          min="1" 
          max="180" 
          value={test.timeLimit} 
          onInput$={(e) => test.timeLimit = +(e.target as HTMLInputElement).value} 
        />
      </div>
      
      <h3>Otázky testu</h3>
      <div class="questions-container">
        {test.questions.map((q, qIndex) => (
          <div key={qIndex} class="question-editor">
            <div class="question-header">
              <span class="question-number">Otázka {qIndex + 1}</span>
              <button 
                onClick$={() => removeQuestion(qIndex)}
                class="remove-question-btn"
              >
                <i class="fas fa-trash"></i>
              </button>
            </div>
            
            <div class="form-group">
              <label>Text otázky</label>
              <input 
                type="text" 
                value={q.text} 
                onInput$={(e) => updateQuestion(qIndex, "text", (e.target as HTMLInputElement).value)} 
                placeholder="Zadejte text otázky..."
              />
            </div>
            
            <div class="options-container">
              <label>Možnosti (vyberte správnou odpověď)</label>
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} class="option-row">
                  <input 
                    type="radio" 
                    name={`q${qIndex}-correct`} 
                    checked={oIndex === q.correctAnswer} 
                    onChange$={() => setCorrectAnswer(qIndex, oIndex)} 
                    id={`q${qIndex}-opt${oIndex}`}
                  />
                  <input 
                    type="text" 
                    value={opt} 
                    onInput$={(e) => updateOption(qIndex, oIndex, (e.target as HTMLInputElement).value)} 
                    placeholder={`Možnost ${oIndex + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div class="form-actions">
        <button 
          class="add-question-btn"
          onClick$={addQuestion}
        >
          <i class="fas fa-plus"></i> Přidat otázku
        </button>
      </div>
      
      <div class="form-submit">
        <button 
          class="cancel-btn"
          onClick$={onCancel$}
        >
          Zrušit
        </button>
        <button 
          class="save-btn"
          onClick$={handleSave} 
          disabled={saving.value}
        >
          {saving.value 
            ? 'Ukládání...' 
            : (isEditMode.value ? 'Aktualizovat test' : 'Uložit test')}
        </button>
      </div>
    </div>
  );
});
