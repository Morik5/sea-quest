import { component$, useStore, useResource$, $, useVisibleTask$, useStylesScoped$ } from '@builder.io/qwik';
import { collection, getDocs, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { addExperience } from '../../../services/levelService';
import { checkAchievements } from '../../../services/achievementService';

import styles from './index.css?inline';


interface VocabularyItem {
  english: string;
  czech: string;
}

interface Level {
  id: string;
  name: string;
  vocabularyItems?: VocabularyItem[];
}

export default component$(() => {

  useStylesScoped$(styles);

  const store = useStore({
    selectedLevelId: null as string | null,
    selectedLevel: null as Level | null,
    showLevelsContainer: true,
    quizMode: false,
    userAnswer: '',
    quizWords: [] as VocabularyItem[],
    currentQuizIndex: 0,
    quizFeedback: '',
    userId: "",
    quizCompleted: false,
    correctAnswers: 0,
    quizResults: [] as boolean[],
    
    totalCompleted: 0,
    totalAttempts: 0,
    mistakesCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    successRate: 0,
    statsLoaded: false,
  });

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User logged in:", user.uid);
        store.userId = user.uid;
        
        
        const storedStreak = localStorage.getItem(`vocabulary_streak_${user.uid}`);
        if (storedStreak) {
          try {
            const streakData = JSON.parse(storedStreak);
            store.currentStreak = streakData.currentStreak || 0;
            store.bestStreak = streakData.bestStreak || 0;
          } catch (e) {
            console.error("Error parsing streak data", e);
          }
        }
      } else {
        console.log("No user logged in.");
        store.userId = "";
        window.location.href = "/login"; 
      }
    });

    return () => unsubscribe(); 
  });

  
  const levelsResource = useResource$<Level[]>(async () => {
    const levelsCol = collection(db, 'sections/vocabulary/levels');
    const levelsSnapshot = await getDocs(levelsCol);

    if (levelsSnapshot.empty) {
      console.log('No levels found in Firestore.');
      return [];
    }

    const levels = levelsSnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || 'Unnamed Level',
      vocabularyItems: doc.data().vocabularyItems || [],
    }));

    return levels;
  });

  const handleLevelSelect = $(async (levelId: string) => {
    store.selectedLevelId = levelId;
    const levels = await levelsResource.value;
    const selectedLevel = levels.find((level) => level.id === levelId);

    
    if (selectedLevel && selectedLevel.vocabularyItems) {
      const shuffledItems = [...selectedLevel.vocabularyItems].sort(() => 0.5 - Math.random());
      selectedLevel.vocabularyItems = shuffledItems.slice(0, Math.min(10, shuffledItems.length));
    }

    store.selectedLevel = selectedLevel || null;
    store.showLevelsContainer = false;
  });

  const handleBackToLevels = $(() => {
    store.showLevelsContainer = true;
    store.selectedLevelId = null;
    store.selectedLevel = null;
    store.quizMode = false;
    store.quizWords = [];
    store.currentQuizIndex = 0;
    store.quizCompleted = false;
    store.correctAnswers = 0;
    store.quizResults = [];
  });


  const handleQuizStart = $(() => {
    store.quizMode = true;
    
    if (store.selectedLevel?.vocabularyItems) {
      
      const selectedWords = [];
      const usedIndices = new Set<number>();
        
      
      const targetCount = Math.min(5, store.selectedLevel.vocabularyItems.length);
        
      while (selectedWords.length < targetCount && usedIndices.size < store.selectedLevel.vocabularyItems.length) {
        const randomIndex = Math.floor(Math.random() * store.selectedLevel.vocabularyItems.length);
        if (!usedIndices.has(randomIndex)) {
          usedIndices.add(randomIndex);
          selectedWords.push(store.selectedLevel.vocabularyItems[randomIndex]);
        }
      }
      
      
      store.quizWords = selectedWords;
      store.userAnswer = '';
      store.quizFeedback = '';
      store.currentQuizIndex = 0;
      store.correctAnswers = 0;
      store.quizResults = Array(selectedWords.length).fill(false);
      store.quizCompleted = false;
    }
  });


  
  const handleQuizSubmit = $(async () => {
    if (!store.userId || store.quizCompleted) return;

    const isCorrect = 
      store.userAnswer.trim().toLowerCase() === 
      store.quizWords[store.currentQuizIndex]?.czech.trim().toLowerCase();
    
    
    store.quizResults[store.currentQuizIndex] = isCorrect;
    
    
    store.totalAttempts++;
    
    if (isCorrect) {
      store.correctAnswers++;
      store.quizFeedback = "Correct!";
      store.currentStreak++;
      store.bestStreak = Math.max(store.bestStreak, store.currentStreak);
      
      
      if (store.userId) {
        localStorage.setItem(`vocabulary_streak_${store.userId}`, JSON.stringify({
          currentStreak: store.currentStreak,
          bestStreak: store.bestStreak
        }));
      }
    } else {
      
      store.quizFeedback = "Incorrect! The answer was: " + store.quizWords[store.currentQuizIndex].czech;
      store.currentStreak = 0;
      store.mistakesCount++;
      
      
      if (store.userId) {
        localStorage.setItem(`vocabulary_streak_${store.userId}`, JSON.stringify({
          currentStreak: 0,
          bestStreak: store.bestStreak
        }));
      }
    }
    
    
    store.successRate = Math.round((store.correctAnswers / store.totalAttempts) * 100);
    
    
    const isLastQuestion = store.currentQuizIndex === store.quizWords.length - 1;
    
    if (isLastQuestion) {
      console.log("Last question detected, completing quiz...");
      await completeQuiz();
      console.log("Quiz completion finished");
    }
  });
  
  
  const completeQuiz = $(async () => {
    if (!store.userId) {
      console.log("No user ID, can't complete quiz");
      return;
    }
    
    console.log("Starting quiz completion...");
    store.quizCompleted = true;
    
    
    store.totalCompleted++;
      
    
    const baseXP = store.correctAnswers * 10;

    
    const cheated = store.correctAnswers > store.quizWords.length;
    if (cheated) {
      console.warn("Cheating detected!", {
        correctAnswers: store.correctAnswers,
        totalQuestions: store.quizWords.length
      });
      
      
      store.quizFeedback = "Cheating detected! No XP awarded.";
      
      
      try {
        const userRef = doc(db, "users", store.userId);
        await updateDoc(userRef, {
          "flags.possibleCheating": increment(1),
          "lastActivity.cheatingDetected": new Date()
        });
      } catch (error) {
        console.error("Error logging cheating incident:", error);
      }
      
      return; 
    }

    
    const isPerfectScore = store.correctAnswers === store.quizWords.length;
    const perfectBonus = isPerfectScore ? Math.round(baseXP * 0.5) : 0;
    
    
    const totalXP = baseXP + perfectBonus;
    console.log(`XP calculation: base=${baseXP}, perfect bonus=${perfectBonus}, total=${totalXP}`);
    
    try {
      
      const userRef = doc(db, "users", store.userId);
      
      
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        console.error("User document not found");
        return;
      }
      
      console.log("User document found:", userSnap.data());
      
      
      const updateData: Record<string, any> = {
        quizCompleted: increment(1)
      };
      
      if (isPerfectScore) {
        updateData.perfectScores = increment(1);
        console.log("Perfect score achieved!");
      } else {
        console.log("Quiz completed, not perfect score");
      }
      
      
      await updateDoc(userRef, updateData);
      
      
      console.log("Adding experience:", totalXP);
      const result = await addExperience(store.userId, totalXP);
      console.log("Experience result:", result);
          
      
      console.log("Checking achievements");
      await checkAchievements(store.userId);
      
    } catch (error) {
      console.error("Error updating user stats:", error);
      store.quizFeedback = "Error saving your progress. Please try again.";
    }
  });
  
  const handleNextQuizWord = $(() => {
    store.currentQuizIndex++;
    store.userAnswer = '';
    store.quizFeedback = '';

    
  });

  return (
    <div class="vocabulary-page">
      <h1>Vocabulary Practice</h1>


      
      <div id="level-up-popup" class="level-up-popup">
        🎉 You leveled up! 🎉
      </div>

      {store.showLevelsContainer && (
        <div class="levels-container">
          <h2>Select a Level:</h2>
          {levelsResource.loading ? (
            <p>Loading levels...</p>
          ) : (
            <ul class="levels-list">
              {levelsResource.value.then((levels) => {
                if (Array.isArray(levels) && levels.length > 0) {
                  return levels.map((level: Level) => (
                    <li key={level.id} class="vocabulary-selection-item">
                      <button onClick$={() => handleLevelSelect(level.id)}>
                        {level.name}
                      </button>
                    </li>
                  ));
                } else {
                  return <p class="no-levels-found">No levels found.</p>;
                }
              })}
            </ul>
          )}
        </div>
      )}

      {store.selectedLevel && !store.showLevelsContainer && !store.quizMode && (
        <div class="vocabulary-container">
          <h2>{store.selectedLevel.name}</h2>

          <div class="cards-grid">
            {store.selectedLevel.vocabularyItems?.map((item, index) => (
              <div
                key={index}
                class="card-container"
                onClick$={() => {
                  const card = document.getElementById(`card-${index}`);
                  if (card) {
                    card.classList.add('flipped');
                    setTimeout(() => {
                      card.classList.remove('flipped');
                    }, 2000);
                  }
                }}
              >
                <div id={`card-${index}`} class="card">
                  <div class="card-front">
                    <p>{item.english}</p>
                  </div>
                  <div class="card-back">
                    <p>{item.czech}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div class="action-buttons">
            <button class="primary-button" onClick$={handleQuizStart}>Start Quiz</button>
            <button class="secondary-button" onClick$={handleBackToLevels}>Back to Levels</button>
          </div>
        </div>
      )}

      {store.quizMode && store.quizWords.length > 0 && (
        <div class="quiz-container">
          <h2>Quiz Time!</h2>
                   
          
          <div class="quiz-progress">
            <div class="progress-text">
              Question {store.currentQuizIndex + 1} of {store.quizWords.length}
            </div>
            <div class="progress-bar-container">
              <div 
                class="progress-bar-fill" 
                style={{ width: `${((store.currentQuizIndex + 1) / store.quizWords.length) * 100}%` }}
              ></div>
            </div>
          </div>

          
          <div class="streak-container">
            <div class="streak">
              <span class="streak-count">{store.currentStreak}</span>
            </div>
            <div class="best-streak">
              Best: {store.bestStreak}
            </div>
          </div>
          
          <div class="quiz-word">
            <p>Translate: <strong>{store.quizWords[store.currentQuizIndex].english}</strong></p>
          </div>
          
          <div class="quiz-input">
          <input
            type="text"
            value={store.userAnswer}
            onInput$={(e) => (store.userAnswer = (e.target as HTMLInputElement).value)}
            placeholder="Enter the Czech translation"
            onKeyUp$={(e) => {
              if (e.key === 'Enter' && store.quizFeedback === '') {
                handleQuizSubmit();
              }
            }}
          />
            <button 
              class="primary-button"
              onClick$={handleQuizSubmit}
              disabled={store.quizFeedback !== ''}
            >
              Submit
            </button>
          </div>
          
          {store.quizFeedback && (
            <div class={`feedback ${store.quizFeedback.includes('Correct') ? 'correct' : 'incorrect'}`}>
              {store.quizFeedback}
            </div>
          )}

          <div class="quiz-navigation">
            
            {!store.quizCompleted && store.quizFeedback && store.currentQuizIndex < store.quizWords.length - 1 && (
              <button class="primary-button" onClick$={handleNextQuizWord}>
                Next Word
              </button>
            )}
            
            
            {!store.quizCompleted && store.quizFeedback && store.currentQuizIndex === store.quizWords.length - 1 && (
              <button class="primary-button" onClick$={completeQuiz}>
                Finish Quiz
              </button>
            )}
            
            
            {store.quizCompleted && (
              <div class="quiz-summary">
                <div class="results-summary">
                  <h3>Quiz Complete!</h3>
                  
                  {store.quizFeedback.includes("Cheating detected") ? (
                    <div class="cheating-detected">
                      <p>⚠️ Suspicious activity detected!</p>
                      <p>You don't get any XP for this attempt.</p>
                    </div>
                  ) : (
                    <>
                      <p>You got {store.correctAnswers} out of {store.quizWords.length} correct!</p>
                      
                      {store.correctAnswers === store.quizWords.length && 
                        <p class="perfect-score-message">🏆 Perfect Score! 🏆</p>
                      }
                      
                      
                      <p class="xp-message">
                        {store.correctAnswers === store.quizWords.length ? 
                          `You earned ${store.correctAnswers * 15} XP (including ${store.quizWords.length * 5} bonus XP)` :
                          `You earned ${store.correctAnswers * 10} XP`
                        }
                        {store.quizFeedback.includes("leveled up") && 
                          <span class="level-up-message"> You leveled up!</span>
                        }
                      </p>
                    </>
                  )}
                </div>
                
                <button class="secondary-button" onClick$={handleBackToLevels}>
                  Back to Levels
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      

    </div>
  );
});