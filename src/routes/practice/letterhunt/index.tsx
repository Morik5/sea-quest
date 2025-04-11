import { component$, useStore, $, useTask$, useVisibleTask$, useStylesScoped$ } from '@builder.io/qwik';
import axios from 'axios';
import { db } from '../../../firebase';
import { getDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { addExperience } from '../../../services/levelService';
import { checkAchievements } from '../../../services/achievementService';
import styles from './index.css?inline'

export default component$(() => {

  useStylesScoped$(styles);

  const state = useStore({
    word: '',
    guesses: Array.from({ length: 6 }, () => ({
      guess: '',
      result: new Array(5).fill(''),
    })),
    input: '',
    attempts: 6,
    gameOver: false,
    correct: false,
    isValidWord: true,
    difficulty: 'A1', 
    loading: false, 
    xp: 0, 
    totalXp: 0, 
    xpGained: 0, 
    showXpAnimation: false, 
    
    userId: '',
    totalCompleted: 0,
    totalAttempts: 0,
    correctAnswers: 0,
    mistakesCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    successRate: 0,
    statsLoaded: false,
    showLevelUpAnimation: false,
    newLevel: 0,
  });

  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User logged in:", user.uid);
        state.userId = user.uid;
        
        
        const storedStreak = localStorage.getItem(`letterhunt_streak_${user.uid}`);
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
        state.userId = '';
      }
    });

    return () => unsubscribe(); 
  });

  const fetchWord = $(async () => {
    state.loading = true;
    const docRef = doc(db, 'sections', 'letter_hunt');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const words = data[state.difficulty] as string[];
      state.word = words[Math.floor(Math.random() * words.length)];
      
      
      state.xp = 0;
      
      
      try {
        if (state.userId) {
          const userXpRef = doc(db, 'users', state.userId);
          const userXpSnap = await getDoc(userXpRef);
          if (userXpSnap.exists()) {
            state.totalXp = userXpSnap.data().xp || 0;
          }
        }
      } catch (error) {
        console.error('Error fetching user XP:', error);
      }
    } else {
      console.error('No such document!');
    }
    state.loading = false;
  });

  useTask$(() => {
    fetchWord();
  });

  const startGame = $(() => {
    state.guesses = Array.from({ length: 6 }, () => ({
      guess: '',
      result: new Array(state.word.length).fill(''),
    }));
    state.input = '';
    state.attempts = 6;
    state.gameOver = false;
    state.correct = false;
    state.isValidWord = true;
    state.xp = 0;
    fetchWord(); 
  });

  const checkIfValidWord = $(async (word: string) => {
    if (!word) return false;

    if (word.length < 2 || word.length > 15) {
      return false;
    }

    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
    try {
      const response = await axios.get(url);
      return response.data.length > 0;
    } catch (error) {
      return false;
    }
  });

  const analyzeGuess = $(async (guess: string, word: string) => {
    const result = new Array(word.length).fill('wrong');
    guess.split('').forEach((letter, index) => {
      if (letter === word[index]) {
        result[index] = 'correct';
      } else if (word.includes(letter)) {
        result[index] = 'wrong-place';
      }
    });
    return result;
  });

  const awardXp = $(async (xpAmount: number) => {
    if (!state.userId) return;
    
    state.xpGained = xpAmount;
    state.xp += xpAmount;
    state.totalXp += xpAmount;
    state.showXpAnimation = true;

    try {
      
      const result = await addExperience(state.userId, xpAmount);
      
      
      await checkAchievements(state.userId);
      
      
      if (result && result.levelUp) {
        state.showLevelUpAnimation = true;
        state.newLevel = result.newLevel;
        
        
        setTimeout(() => {
          state.showLevelUpAnimation = false;
        }, 3000);
      }
    } catch (error) {
      console.error('Error updating XP:', error);
    }

    
    setTimeout(() => {
      state.showXpAnimation = false;
    }, 2000);
  });

  const checkGuess = $(async () => {
    if (!state.userId) return; 
    if (state.input.length !== state.word.length) {
      return; 
    }

    
    state.totalAttempts++;

    const isValid = await checkIfValidWord(state.input);
    if (!isValid) {
      state.isValidWord = false;
      return;
    } else {
      state.isValidWord = true;
    }

    const guessResult = await analyzeGuess(state.input, state.word);
    const currentGuessIndex = state.guesses.findIndex(entry => entry.guess === '');
    if (currentGuessIndex !== -1) {
      state.guesses[currentGuessIndex] = { guess: state.input, result: guessResult };
    }

    state.input = '';
    state.attempts--;

    if (guessResult.every(res => res === 'correct')) {
      state.correct = true;
      state.gameOver = true;
      
      
      state.currentStreak++;
      state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
      state.correctAnswers++;
      state.totalCompleted++; 
      
      
      if (state.userId) {
        localStorage.setItem(`letterhunt_streak_${state.userId}`, JSON.stringify({
          currentStreak: state.currentStreak,
          bestStreak: state.bestStreak
        }));
        
        
        try {
          const userRef = doc(db, "users", state.userId);
          await updateDoc(userRef, {
            quizCompleted: increment(1)
          });
        } catch (error) {
          console.error("Error updating quiz completion count:", error);
        }
      }
      
      
      state.successRate = Math.round((state.correctAnswers / state.totalAttempts) * 100);
      
      
      
      const baseXp = 200;
      const unsuccessfulAttempts = 6 - state.attempts - 1; 
      const attemptPenalty = unsuccessfulAttempts * 25;
      const difficultyMultiplier = {
        'A1': 1,
        'A2': 1.5,
        'B1': 2,
      }[state.difficulty] || 1;
      
      
      const finalXp = Math.max(50, Math.round((baseXp - attemptPenalty) * difficultyMultiplier));
      await awardXp(finalXp);
    } else if (state.attempts === 0) {
      state.gameOver = true;
      
      
      state.currentStreak = 0;
      state.mistakesCount++;
      
      
      if (state.userId) {
        localStorage.setItem(`letterhunt_streak_${state.userId}`, JSON.stringify({
          currentStreak: 0,
          bestStreak: state.bestStreak
        }));
      }
      
      
      state.successRate = Math.round((state.correctAnswers / state.totalAttempts) * 100);
      
      
    }
  });

  const handleInput = $((event: InputEvent) => {
    const target = event.target as HTMLInputElement;
    state.input = target.value.toLowerCase();
  });

  const handleKeyPress = $(async (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      await checkGuess(); 
    }
  });

  const resetGame = $(() => {
    startGame();
  });

  const handleDifficultyChange = $((event: Event) => {
    const target = event.target as HTMLSelectElement;
    state.difficulty = target.value;
    startGame(); 
  });

  return (
    <div class="letterhunt-container">
      <h1>Letter Hunt</h1>
      
      <div class="difficulty-selector">
        <label for="difficulty">Select Difficulty: </label>
        <select id="difficulty" onChange$={handleDifficultyChange}>
          <option value="A1">Level 1</option>
          <option value="A2">Level 2</option>
          <option value="B1">Level 3</option>
        </select>
      </div>
      
      <div class="xp-display">
        {state.showXpAnimation && (
          <div class="xp-animation">+{state.xpGained} XP</div>
        )}
      </div>
      
      <div class="level-up-container">
        {state.showLevelUpAnimation && (
          <div class="level-up-animation">
            <div class="level-up-text">LEVEL UP!</div>
            <div class="new-level">Level {state.newLevel}</div>
          </div>
        )}
      </div>
      
      <div class="main-content">
        <div class="game-content">
          {state.loading ? (
            <div class="loading">Loading...</div>
          ) : (
            <>
              <div class="guesses-container">
                {state.guesses.map((entry, guessIndex) => (
                  <div key={guessIndex} class="guess-row">
                    {new Array(state.word.length).fill('').map((_, letterIndex) => (
                      <span key={letterIndex} class={`letter-box ${entry.result[letterIndex]}`}>
                        {entry.guess[letterIndex]}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              {!state.gameOver ? (
                <div class="input-container">
                  <input
                    type="text"
                    value={state.input}
                    maxLength={state.word.length}
                    onInput$={handleInput}
                    onKeyPress$={handleKeyPress}
                    class="word-input"
                    placeholder="Guess the word"
                  />
                  <button onClick$={checkGuess} class="guess-btn">Guess</button>
                  {!state.isValidWord && <p class="error-msg">Invalid word, try again!</p>}
                </div>
              ) : (
                <div class="game-over">
                  <p>{state.correct ? 'Congratulations! You guessed the word!' : `Game Over! The word was: ${state.word}`}</p>
                  <p class="session-xp">You gained {state.xp} XP this round!</p>
                  <button onClick$={resetGame} class="reset-btn">Play Again</button>
                </div>
              )}
            </>
          )}
        </div>
        <div class="legend">
          <h2>Legend</h2>
          <p><span class="legend-box correct"></span> Correct letter in the correct position</p>
          <p><span class="legend-box wrong-place"></span> Correct letter in the wrong position</p>
          <p><span class="legend-box wrong"></span> Incorrect letter</p>
        </div>
        <div class="streak-container">
          <div class="streak">
            <span class="streak-count">{state.currentStreak}</span>
          </div>
          <div class="best-streak">
            Best: {state.bestStreak}
          </div>
        </div>
      </div>
    </div>
  );
});
