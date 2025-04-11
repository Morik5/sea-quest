import { component$, useSignal, useVisibleTask$, useStylesScoped$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getUserProfile } from '../../services/user';
import styles from './index.css?inline';

function processObject(obj: any): any {
  if (!obj) return obj;
  
  if (typeof obj !== 'object') return obj;
  
  
  if (Array.isArray(obj)) {
    return obj.map(item => processObject(item));
  }
  
  
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = processObject(obj[key]);
    }
  }
  return result;
}


function getRarityFromReward(reward: number): string {
  if (!reward) return 'common';
  if (reward >= 500) return 'legendary';
  if (reward >= 300) return 'epic';
  if (reward >= 200) return 'rare';
  if (reward >= 100) return 'uncommon';
  return 'common';
}


function getIconForType(type: string): string {
  switch(type) {
    case 'level': return '📚';
    case 'streak': return '🔥';
    case 'practice': return '✏️';
    case 'vocabulary': return '📝';
    case 'perfect': return '💯';
    case 'social': return '👥';
    case 'quiz': return '❓';
    case 'exercises': return '🧩';
    case 'secret': return '🎁';
    default: return '🏆';
  }
}

export default component$(() => {
  
  useStylesScoped$(styles);
  
  

  const isLoading = useSignal(true);
  const user = useSignal<any>(null);
  const userAchievements = useSignal<any[]>([]);
  const allAchievements = useSignal<any[]>([]);
  const activeCategory = useSignal('all');
  const error = useSignal('');

  
  
  
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      
      const userProfile = await getUserProfile();
      
      if (!userProfile) {
        window.location.href = "/login";
        return;
      }
      
      
      user.value = processObject(userProfile);

      
      const userAchievementIds = 'achievements' in userProfile && Array.isArray(userProfile.achievements) 
        ? userProfile.achievements 
        : [];
      
      console.log("User achievement IDs:", userAchievementIds); 
      
      
      const achievementsRef = collection(db, "achievements");
      const achievementsSnapshot = await getDocs(achievementsRef);
      
      
      console.log("Achievement document IDs:", achievementsSnapshot.docs.map(doc => doc.id));
      
      const achievementsData = achievementsSnapshot.docs.map(doc => {
        const achievementData = doc.data();
        const processedData = processObject(achievementData);
        
        
        
        const achievementId = processedData.uniqueId || processedData.id || doc.id;
        const unlocked = userAchievementIds.includes(achievementId);
        
        
        console.log(`Checking achievement ${doc.id} (unique ID: ${achievementId}): exists in user array? ${unlocked}`);
        
        
        if (unlocked) {
          console.log("Found unlocked achievement:", doc.id, processedData.name, "with ID:", achievementId);
        }
        
        return {
          id: doc.id,
          uniqueId: achievementId,
          ...processedData,
          title: processedData.name,
          category: processedData.type || 'general',
          description: processedData.description || '',
          rarity: getRarityFromReward(processedData.reward),
          icon: getIconForType(processedData.type),
          unlocked: unlocked, 
          isSecret: processedData.isSecret || false,
          secretDescription: processedData.secretDescription || 'Tajný odznak čeká na odkrytí!',
          requirement: processedData.description || 'Splň požadovaný cíl'
        };
      });
      
      
      console.log("All achievements loaded:", achievementsData.length);
      console.log("Unlocked achievements:", achievementsData.filter(a => a.unlocked).length);
      
      allAchievements.value = achievementsData;
      userAchievements.value = achievementsData.filter(a => a.unlocked);
      
    } catch (error: any) {
      console.error("Error loading achievements:", error);
      error.value = error.message;
    } finally {
      isLoading.value = false;
    }
  });

  
  const categories = allAchievements.value.length > 0 
    ? ['all', ...new Set(allAchievements.value.map(a => a.category))]
    : ['all'];

  
  const filteredAchievements = activeCategory.value === 'all'
    ? allAchievements.value
    : allAchievements.value.filter(a => a.category === activeCategory.value);

  
  return (
    <div class="achievements-container">
      
      <div class="page-header">
        <h1>My achievements</h1>
        <div class="achievement-stats">
          <div class="stat">
            <span class="stat-value">{userAchievements.value.length}</span>
            <span class="stat-label">Earned achievements</span>
          </div>
          <div class="stat">
            <span class="stat-value">
              {Math.round((userAchievements.value.length / (allAchievements.value.length || 1)) * 100)}%
            </span>
            <span class="stat-label">Completed</span>
          </div>
        </div>
      </div>

      {isLoading.value ? (
        <div class="loading-container">
          <div class="spinner"></div>
          <p>Loading achievements...</p>
        </div>
      ) : error.value ? (
        <div class="error-message">{error.value}</div>
      ) : (
        <>
          
          <div class="category-filter">
            {categories.map(category => (
              <button
                key={category}
                class={`category-btn ${activeCategory.value === category ? 'active' : ''}`}
                onClick$={() => activeCategory.value = category}
              >
                {category === 'all' ? 'All' : 
                  category === 'general' ? 'General' :
                  category === 'level' ? 'Level' :
                  category === 'streak' ? 'Streak' :
                  category === 'practice' ? 'Practice' :
                  category === 'vocabulary' ? 'Vocabulary' :
                  category === 'perfect' ? 'Perfect' :
                  category === 'social' ? 'Social' :
                  category === 'quiz' ? 'Quiz' :
                  category === 'exercises' ? 'Exercises' :
                  category === 'leaderboard_position' ? 'Leadeboard' :
                  category === 'quiz_complete' ? 'Quiz Completion' :
                  category === 'secret' ? 'Secret' : category}
              </button>
            ))}
          </div>

          
          <div class="achievements-grid">
            {filteredAchievements.map(achievement => (
              <div key={achievement.id} 
                class={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'} ${achievement.rarity || 'common'}`}
              >
                <div class="achievement-icon">
                  {achievement.unlocked ? (
                    <span class="icon">{achievement.icon || '🏆'}</span>
                  ) : (
                    <span class="locked-icon">?</span>
                  )}
                </div>
                <div class="achievement-content">
                  <h3>{achievement.unlocked ? achievement.title : achievement.isSecret ? '???' : achievement.title}</h3>
                  {achievement.unlocked && (
                    <div class="unlocked-date">
                      Získáno
                    </div>
                  )}
                </div>
                <div class="achievement-rarity">
                  {achievement.rarity === 'common' && 'Common'}
                  {achievement.rarity === 'uncommon' && 'Uncommon'}
                  {achievement.rarity === 'rare' && 'Rare'}
                  {achievement.rarity === 'epic' && 'Epic'}
                  {achievement.rarity === 'legendary' && 'Legendary'}
                </div>
              </div>
            ))}
          </div>

          
          {filteredAchievements.length === 0 && (
            <div class="no-achievements">
              <p>V této kategorii nejsou žádné odznaky.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: 'My Achievements',
  meta: [
    {
      name: 'description',
      content: 'Your achievements and badges in the Sea Quest.',
    },
  ],
};