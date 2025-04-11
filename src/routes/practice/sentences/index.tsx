import { component$, useStore, $, useTask$, useSignal, useVisibleTask$, useStylesScoped$ } from '@builder.io/qwik';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { addExperience } from '../../../services/levelService';
import { checkAchievements } from '../../../services/achievementService';
import { getAllSentences } from '../../../services/sentences';
import { doc, updateDoc, increment } from 'firebase/firestore'; 
import { db } from '../../../firebase'; 
import styles from './index.css?inline';

interface Sentence {
  text: string;
}

export default component$(() => {

  useStylesScoped$(styles);

  const sentences = useSignal<Sentence[]>([]);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const completedCount = useSignal(0);
  const showCelebration = useSignal(false);
  const userId = useSignal<string | null>(null);
  const showXpAnimation = useSignal(false);
  const xpGained = useSignal(0);
  const streakBonus = useSignal(0);
  const levelUp = useSignal<number | null>(null);
  const selectedWordIndex = useSignal<number | null>(null); 
  
  const state = useStore({
    sentence: "",
    shuffledWords: [] as string[],
    userOrder: [] as string[],
    correctOrder: [] as string[],
    draggedIndex: -1,
    overIndex: -1,
    dragging: false,
    gameOver: false,
    correct: false,
    currentStreak: 0,
    bestStreak: 0,
    totalCompleted: 0,
  });

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User logged in:", user.uid);
        userId.value = user.uid;
        
        
        const storedStreak = localStorage.getItem(`sentences_streak_${user.uid}`);
        if (storedStreak) {
          try {
            const streakData = JSON.parse(storedStreak);
            state.currentStreak = streakData.currentStreak || 0;
            state.bestStreak = streakData.bestStreak || 0;
          } catch (e) {
            console.error("Error parsing streak data", e);
          }
        }
        
        
        
      } else {
        console.log("No user logged in.");
        userId.value = null;
        
        
      }
    });

    return () => unsubscribe(); 
  });

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!document.getElementById('poppins-font')) {
      const link = document.createElement('link');
      link.id = 'poppins-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  });

  const shuffleArray = $((array: string[]) => {
    return [...array].sort(() => Math.random() - 0.5);
  });

  const fetchSentences = $(async () => {
    try {
      isLoading.value = true;
      error.value = null;
      
      const sentencesData = await getAllSentences();
      sentences.value = sentencesData;
      
      if (sentencesData.length === 0) {
        error.value = "No sentences found in database";
      }
    } catch (err) {
      error.value = "Failed to load sentences";
      console.error("Error fetching sentences:", err);
    } finally {
      isLoading.value = false;
    }
  });

  const getRandomSentence = $(() => {
    if (sentences.value.length > 0) {
      const randomIndex = Math.floor(Math.random() * sentences.value.length);
      return sentences.value[randomIndex].text;
    }
    return "Learning languages is fun"; 
  });

  const setupNewSentence = $(async () => {
    const newSentence = await getRandomSentence();
    state.sentence = newSentence;
    state.correctOrder = state.sentence.split(' ');
    state.shuffledWords = await shuffleArray([...state.correctOrder]);
    state.userOrder = Array(state.correctOrder.length).fill('');
    state.gameOver = false;
    state.correct = false;
    selectedWordIndex.value = null; 
  });

  useTask$(async () => {
    await fetchSentences();
    await setupNewSentence();
  });

  const handleDragStart = $((event: DragEvent, index: number) => {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', state.shuffledWords[index]);
      event.dataTransfer.effectAllowed = 'move';
    }
    state.draggedIndex = index;
    state.dragging = true;
  });

  const handleDrop = $((event: DragEvent, dropIndex: number) => {
    event.preventDefault();
    
    if (state.draggedIndex !== -1) {
      const draggedWord = state.shuffledWords[state.draggedIndex];
      const targetWord = state.userOrder[dropIndex];
      
      
      state.userOrder[dropIndex] = draggedWord;
      state.shuffledWords[state.draggedIndex] = targetWord;
      
      
      state.draggedIndex = -1;
      state.dragging = false;
      state.overIndex = -1;
    }
  });

  const handleDragOver = $((event: DragEvent, overIndex: number) => {
    event.preventDefault();
    state.overIndex = overIndex;
  });

  const handleDragEnd = $(() => {
    state.dragging = false;
    state.overIndex = -1;
  });

  const handleWordReturn = $((index: number) => {
    const word = state.userOrder[index];
    if (word) {
      state.userOrder[index] = '';
      const emptyIndex = state.shuffledWords.findIndex(w => w === '');
      if (emptyIndex !== -1) {
        state.shuffledWords[emptyIndex] = word;
      } else {
        state.shuffledWords.push(word);
      }
    }
  });

  const awardXp = $(async (isCorrect: boolean) => {
    if (!userId.value) return; 
    
    
    const baseXP = isCorrect ? 15 : 0;
    
    
    streakBonus.value = isCorrect ? Math.min(Math.floor(state.currentStreak / 2) * 5, 10) : 0;
    
    
    const totalXP = baseXP + streakBonus.value;
    xpGained.value = totalXP;
    
    if (totalXP > 0) {
      try {
        
        const result = await addExperience(userId.value, totalXP);
        
        
        showXpAnimation.value = true;
        
        
        setTimeout(() => {
          const randomRotation = Math.random() * 10 - 5; 
          const xpElement = document.querySelector('.xp-animation') as HTMLElement;
          
          xpElement.style.setProperty('--random-rotate', `${randomRotation}deg`);
          
        }, 0);
        
        setTimeout(() => {
          showXpAnimation.value = false;
        }, 3000);
        
        
        if (result && result.levelUp) {
          levelUp.value = result.newLevel;
          setTimeout(() => {
            levelUp.value = null;
          }, 3000);
        }
        
        
        await checkAchievements(userId.value);
        
      } catch (error) {
        console.error("Error updating experience:", error);
      }
    }
  });

  const checkOrder = $(async () => {
    state.gameOver = true;
    const isCorrect = state.userOrder.join(' ') === state.sentence;
    state.correct = isCorrect;
    
    if (isCorrect) {
      
      state.currentStreak++;
      state.totalCompleted++;
      state.bestStreak = Math.max(state.currentStreak, state.bestStreak);
      completedCount.value++;
      showCelebration.value = true;
      
      
      if (userId.value) {
        localStorage.setItem(`sentences_streak_${userId.value}`, JSON.stringify({
          currentStreak: state.currentStreak,
          bestStreak: state.bestStreak
        }));
        
        
        try {
          const userRef = doc(db, "users", userId.value);
          await updateDoc(userRef, {
            quizCompleted: increment(1)
          });
        } catch (error) {
          console.error("Error updating quiz completion count:", error);
        }
      }
      
      
      await awardXp(true);
      
      setTimeout(() => {
        showCelebration.value = false;
      }, 2000);
    } else {
      
      state.currentStreak = 0;
      
      
      if (userId.value) {
        localStorage.setItem(`sentences_streak_${userId.value}`, JSON.stringify({
          currentStreak: 0,
          bestStreak: state.bestStreak
        }));
      }
      
      
      await awardXp(false);
    }
  });

  const resetGame = $(async () => {
    await setupNewSentence();
  });

  
  const handleWordSelect = $((index: number) => {
    
    if (selectedWordIndex.value === index) {
      selectedWordIndex.value = null;
    } else {
      selectedWordIndex.value = index;
    }
  });

  
  const handleWordPlace = $((targetIndex: number) => {
    
    if (selectedWordIndex.value !== null) {
      const draggedWord = state.shuffledWords[selectedWordIndex.value];
      const targetWord = state.userOrder[targetIndex];
      
      
      state.userOrder[targetIndex] = draggedWord;
      state.shuffledWords[selectedWordIndex.value] = targetWord;
      
      
      selectedWordIndex.value = null;
    } else if (state.userOrder[targetIndex]) {
      
      handleWordReturn(targetIndex);
    }
  });

  return (
    <div class="reorder-container">
      <h1>Reorder the Sentence</h1>
      
      
      <div class="streak-container">
        <div class="streak">
          <span class="streak-count">{state.currentStreak}</span>
        </div>
        <div class="best-streak">
          Best: {state.bestStreak}
        </div>
      </div>
      
      
      
      
      {showXpAnimation.value && (
        <div class="xp-animation">
          +{xpGained.value}
          {streakBonus.value > 0 && <span class="streak-bonus">+{streakBonus.value}</span>}
        </div>
      )}
      
      
      {levelUp.value !== null && (
        <div class="level-up-popup show">
          🎉 You leveled up to level {levelUp.value}! 🎉
        </div>
      )}

      {isLoading.value ? (
        <div class="loading">Loading your sentences...</div>
      ) : error.value ? (
        <div class="error">Error: {error.value}</div>
      ) : (
        <>
          
          <div class="sentence-progress">
            <div class="progress-label">Sentence Progress</div>
            <div class="scrollbar-container">
              <div 
                class="scrollbar-progress" 
                style={{ 
                  width: `${Math.max(5, (state.userOrder.filter(w => w).length / state.userOrder.length) * 100)}%` 
                }}
              ></div>
              <div class="scrollbar-steps">
                {state.userOrder.map((_, index) => (
                  <div 
                    key={index} 
                    class={`step ${state.userOrder[index] ? 'filled' : ''}`}
                    style={{ left: `${(index / (state.userOrder.length - 1)) * 100}%` }}
                  >
                    {index + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>

          
          <div class="target-boxes">
            {state.userOrder.map((word, index) => (
              <div
                key={index}
                class={`target-box ${state.dragging && state.overIndex === index ? 'drag-over' : ''} box-${index}`}
                onDrop$={(event) => handleDrop(event, index)}
                onDragOver$={(event) => handleDragOver(event, index)}
                onDragLeave$={handleDragEnd}
                onClick$={() => handleWordPlace(index)}
              >
                <span class="box-number">{index + 1}</span>
                <span class="box-content">{word || ""}</span>
                {index < state.userOrder.length - 1 && <span class="direction-arrow">→</span>}
              </div>
            ))}
          </div>

          
            <div class="mobile-hint">
            Tap a word to select it, then tap a numbered box to place it in the sentence
            </div>

          
          <div class="sentence-container">
            {state.shuffledWords.map((word, index) => (
              word && (
                <span
                  key={index}
                  class={`word-box 
                    ${state.dragging && state.draggedIndex === index ? 'hidden' : ''}
                    ${selectedWordIndex.value === index ? 'selected' : ''}`}
                  draggable={true}
                  onDragStart$={(event) => handleDragStart(event, index)}
                  onDragEnd$={handleDragEnd}
                  onClick$={() => handleWordSelect(index)}
                >
                  {word}
                </span>
              )
            ))}
          </div>

          <div class="action-buttons">
            <button 
              onClick$={checkOrder} 
              class="check-btn" 
              disabled={state.gameOver || state.correct}
            >
              Check Answer
            </button>
            <button onClick$={resetGame} class="reset-btn">Next Sentence</button>
          </div>

          {state.gameOver && (
            <div class={`result ${state.correct ? 'correct' : 'incorrect'} ${showCelebration.value ? 'correct-animation' : ''}`}>
              {state.correct ? (
                <>
                  <span>Correct! Well done! 🎉</span>
                  {state.currentStreak > 1 && (
                    <div class="streak">Streak: {state.currentStreak}</div>
                  )}
                </>
              ) : (
                <span>Try again. You can do it! 💪</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});