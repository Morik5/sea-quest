import { component$, useSignal, useStore, $, useVisibleTask$, useStylesScoped$ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { getClassroomWithStudents } from '../../../../services/classroom';
import { getUserProfile } from '../../../../services/user';
import styles from './index.css?inline';

export default component$(() => {

  useStylesScoped$(styles);

  const location = useLocation();
  const classroomId = location.params.id;

  
  const isLoading = useSignal(true);
  const errorMessage = useSignal('');
  const user = useSignal<any>(null);
  const classroom = useSignal<any>(null);
  const tests = useSignal<any[]>([]);
  const activeTab = useSignal('tests'); 

  
  const testTitle = useSignal('');
  const testDescription = useSignal('');
  const testDueDate = useSignal('');
  const testTimeLimit = useSignal(30); 
  const isTimeLimited = useSignal(false);
  const isProcessing = useSignal(false);
  const testQuestions = useSignal<any[]>([]);


  
  const currentQuestion = useStore({
    type: 'multiple_choice',
    text: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    points: 1
  });

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      
      const profile = await getUserProfile();
      
      if (!profile || !('role' in profile) || profile.role !== "teacher") {
        window.location.href = "/profile";
        return;
      }
      
      user.value = profile;
      
      
      const classroomData = await getClassroomWithStudents(classroomId);
      
      if (!classroomData) {
        errorMessage.value = "Třída nebyla nalezena";
        return;
      }
      
      
      if (classroomData.teacherId !== profile.uid) {
        errorMessage.value = "Nemáte oprávnění k zobrazení této třídy";
        return;
      }
      
      classroom.value = classroomData;
      
      
      await loadTests();
      
    } catch (error: any) {
      console.error("Error loading classroom data:", error);
      errorMessage.value = `Error: ${error.message || 'Unknown error'}`;
    } finally {
      isLoading.value = false;
    }
  });

  
  const loadTests = $(async () => {
    try {
      const testsQuery = query(
        collection(db, "tests"),
        where("classroomId", "==", classroomId)
      );
      
      const testsSnapshot = await getDocs(testsQuery);
      const testsData = testsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      tests.value = testsData;
    } catch (error: any) {
      console.error("Error loading tests:", error);
      errorMessage.value = `Error loading tests: ${error.message || 'Unknown error'}`;
    }
  });

  
  const addQuestion = $(() => {
    if (currentQuestion.text.trim() === '') return;
    
    testQuestions.value = [...testQuestions.value, { ...currentQuestion }];
    
    
    currentQuestion.text = '';
    currentQuestion.options = ['', '', '', ''];
    currentQuestion.correctAnswer = 0;
    currentQuestion.points = 1;
  });

  
  const createTest = $(async () => {
    if (isProcessing.value) return;
    
    try {
      if (testTitle.value.trim() === '') {
        errorMessage.value = "Please enter a test title";
        return;
      }
      
      if (testQuestions.value.length === 0) {
        errorMessage.value = "Please add at least one question";
        return;
      }
      
      isProcessing.value = true;
      
      const testData = {
        title: testTitle.value.trim(),
        description: testDescription.value.trim(),
        classroomId,
        teacherId: user.value.uid,
        createdAt: serverTimestamp(),
        dueDate: testDueDate.value ? new Date(testDueDate.value) : null,
        timeLimit: isTimeLimited.value ? testTimeLimit.value : null,
        questions: testQuestions.value,
        published: false 
      };
      
      await addDoc(collection(db, "tests"), testData);
      
      
      testTitle.value = '';
      testDescription.value = '';
      testDueDate.value = '';
      testTimeLimit.value = 30;
      testQuestions.value = [];
      
      
      await loadTests();
      
      
      activeTab.value = 'tests';
      
    } catch (error: any) {
      console.error("Error creating test:", error);
      errorMessage.value = `Error creating test: ${error.message || 'Unknown error'}`;
    } finally {
      isProcessing.value = false;
    }
  });

  return (
    <div class="tests-container">
      {isLoading.value ? (
        <div class="loading">Loading tests...</div>
      ) : errorMessage.value ? (
        <div class="error-message">{errorMessage.value}</div>
      ) : (
        <>
          <div class="classroom-header">
            <div>
              <h1>Tests for {classroom.value.name}</h1>
              <p class="grade-level">{classroom.value.gradeLevel}. ročník</p>
            </div>
            <div class="classroom-actions">
              <button class="back-btn" onClick$={() => window.history.back()}>
                Back to Classroom
              </button>
            </div>
          </div>
          
          <div class="tabs">
            <button 
              class={`tab-btn ${activeTab.value === 'tests' ? 'active' : ''}`}
              onClick$={() => activeTab.value = 'tests'}
            >
              All Tests
            </button>
            <button 
              class={`tab-btn ${activeTab.value === 'create' ? 'active' : ''}`}
              onClick$={() => activeTab.value = 'create'}
            >
              Create Test
            </button>
          </div>
          
          {/* All Tests Tab */}
          {activeTab.value === 'tests' && (
            <div class="tests-list-section">
              <div class="section-header">
                <h2>All Tests</h2>
                <button 
                  class="action-button create-btn"
                  onClick$={() => activeTab.value = 'create'}
                >
                  <i class="fas fa-plus"></i> Create New Test
                </button>
              </div>
              
              {tests.value.length > 0 ? (
                <div class="tests-list">
                  {tests.value.map((test) => (
                    <div key={test.id} class="test-card">
                      <div class="test-header">
                        <h3>{test.title}</h3>
                        <div class="test-status">
                          {test.published ? (
                            <span class="status published">Published</span>
                          ) : (
                            <span class="status draft">Draft</span>
                          )}
                        </div>
                      </div>
                      
                      {test.description && (
                        <p class="test-description">{test.description}</p>
                      )}
                      
                      <div class="test-meta">
                        <div>
                          <span class="meta-item">
                            <i class="fas fa-question-circle"></i> 
                            {test.questions?.length || 0} questions
                          </span>
                          {test.timeLimit && (
                            <span class="meta-item">
                              <i class="fas fa-clock"></i> 
                              {test.timeLimit} minutes
                            </span>
                          )}
                        </div>
                        
                        {test.dueDate && (
                          <div class="due-date">
                            <i class="fas fa-calendar"></i>
                            Due: {new Date(test.dueDate.seconds * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      <div class="test-actions">
                        <button class="edit-test-btn">
                          <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="preview-test-btn">
                          <i class="fas fa-eye"></i> Preview
                        </button>
                        {!test.published ? (
                          <button class="publish-test-btn">
                            <i class="fas fa-paper-plane"></i> Publish
                          </button>
                        ) : (
                          <button class="results-btn">
                            <i class="fas fa-chart-bar"></i> Results
                          </button>
                        )}
                        <button class="delete-test-btn">
                          <i class="fas fa-trash"></i> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div class="no-items">
                  <i class="fas fa-file-alt empty-icon"></i>
                  <p>No tests created yet</p>
                  <button 
                    class="action-button"
                    onClick$={() => activeTab.value = 'create'}
                  >
                    Create your first test
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Create Test Tab */}
          {activeTab.value === 'create' && (
            <div class="create-test-section">
              <div class="section-header">
                <h2>Create New Test</h2>
              </div>
              
              <div class="test-form">
                <div class="form-group">
                  <label for="test-title">Test Title</label>
                  <input 
                    type="text" 
                    id="test-title" 
                    value={testTitle.value}
                    onInput$={(e) => testTitle.value = (e.target as HTMLInputElement).value}
                    placeholder="Enter test title..."
                  />
                </div>
                
                <div class="form-group">
                  <label for="test-description">Description (Optional)</label>
                  <textarea 
                    id="test-description" 
                    value={testDescription.value}
                    onInput$={(e) => testDescription.value = (e.target as HTMLTextAreaElement).value}
                    placeholder="Enter test description..."
                    rows={3}
                  />
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="test-due-date">Due Date (Optional)</label>
                    <input 
                      type="datetime-local" 
                      id="test-due-date" 
                      value={testDueDate.value}
                      onInput$={(e) => testDueDate.value = (e.target as HTMLInputElement).value}
                    />
                  </div>
                  
                  <div class="form-group checkbox-group">
                    <input 
                      type="checkbox" 
                      id="time-limited" 
                      checked={isTimeLimited.value}
                      onChange$={(e) => isTimeLimited.value = (e.target as HTMLInputElement).checked}
                    />
                    <label for="time-limited">Time Limited</label>
                  </div>
                  
                  {isTimeLimited.value && (
                    <div class="form-group">
                      <label for="time-limit">Time Limit (minutes)</label>
                      <input 
                        type="number" 
                        id="time-limit" 
                        value={testTimeLimit.value}
                        onInput$={(e) => testTimeLimit.value = parseInt((e.target as HTMLInputElement).value) || 30}
                        min="1"
                        max="180"
                      />
                    </div>
                  )}
                </div>
                
                <div class="questions-section">
                  <h3>Test Questions</h3>
                  
                  {testQuestions.value.length > 0 ? (
                    <div class="questions-list">
                      {testQuestions.value.map((question, index) => (
                        <div key={index} class="question-card">
                          <div class="question-header">
                            <h4>Question {index + 1}</h4>
                            <span class="points-badge">{question.points} {question.points === 1 ? 'point' : 'points'}</span>
                          </div>
                          <p class="question-text">{question.text}</p>
                          
                          {question.type === 'multiple_choice' && (
                            <div class="question-options">
                              {question.options.map((option: string, optIdx: number) => (
                                <div key={optIdx} class={`option ${optIdx === question.correctAnswer ? 'correct' : ''}`}>
                                  {option}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div class="question-actions">
                            <button class="edit-question-btn">Edit</button>
                            <button class="delete-question-btn">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div class="no-questions">
                      <p>No questions added yet</p>
                    </div>
                  )}
                  
                  <div class="add-question-form">
                    <h4>Add New Question</h4>
                    
                    <div class="form-group">
                      <label for="question-type">Question Type</label>
                      <select 
                        id="question-type"
                        value={currentQuestion.type}
                        onChange$={(e) => currentQuestion.type = (e.target as HTMLSelectElement).value}
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="true_false">True/False</option>
                        <option value="text">Text Answer</option>
                      </select>
                    </div>
                    
                    <div class="form-group">
                      <label for="question-text">Question Text</label>
                      <textarea 
                        id="question-text"
                        value={currentQuestion.text}
                        onInput$={(e) => currentQuestion.text = (e.target as HTMLTextAreaElement).value}
                        rows={2}
                        placeholder="Enter your question..."
                      />
                    </div>
                    
                    {currentQuestion.type === 'multiple_choice' && (
                      <div class="multiple-choice-options">
                        <label>Answer Options</label>
                        {currentQuestion.options.map((option: string, index: number) => (
                          <div key={index} class="option-row">
                            <input 
                              type="radio" 
                              name="correct-answer" 
                              checked={currentQuestion.correctAnswer === index}
                              onChange$={() => currentQuestion.correctAnswer = index}
                            />
                            <input 
                              type="text"
                              value={option}
                              onInput$={(e) => {
                                const newOptions = [...currentQuestion.options];
                                newOptions[index] = (e.target as HTMLInputElement).value;
                                currentQuestion.options = newOptions;
                              }}
                              placeholder={`Option ${index + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {currentQuestion.type === 'true_false' && (
                      <div class="true-false-options">
                        <label>Correct Answer</label>
                        <div class="option-row">
                          <input 
                            type="radio" 
                            name="correct-answer-tf" 
                            checked={currentQuestion.correctAnswer === 0}
                            onChange$={() => currentQuestion.correctAnswer = 0}
                          />
                          <label>True</label>
                        </div>
                        <div class="option-row">
                          <input 
                            type="radio" 
                            name="correct-answer-tf" 
                            checked={currentQuestion.correctAnswer === 1}
                            onChange$={() => currentQuestion.correctAnswer = 1}
                          />
                          <label>False</label>
                        </div>
                      </div>
                    )}
                    
                    <div class="form-group">
                      <label for="question-points">Points</label>
                      <input 
                        type="number" 
                        id="question-points" 
                        value={currentQuestion.points}
                        onInput$={(e) => currentQuestion.points = parseInt((e.target as HTMLInputElement).value) || 1}
                        min="1"
                        max="10"
                      />
                    </div>
                    
                    <button 
                      class="add-question-btn"
                      onClick$={addQuestion}
                    >
                      Add Question
                    </button>
                  </div>
                </div>
                
                <div class="form-actions">
                  <button 
                    class="secondary-button"
                    onClick$={() => activeTab.value = 'tests'}
                  >
                    Cancel
                  </button>
                  <button 
                    class="primary-button"
                    onClick$={createTest}
                    disabled={isProcessing.value}
                  >
                    {isProcessing.value ? 'Creating...' : 'Create Test'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});