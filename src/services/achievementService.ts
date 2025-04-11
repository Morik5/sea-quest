import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { addExperience } from "./levelService";


export async function checkAchievements(userId: string) {
    if (!userId) return;
    
    console.log("Checking achievements for user:", userId);
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log("User not found");
      return;
    }
    
    const userData = userSnap.data();
    console.log("User data:", userData);
    const unlockedAchievements = userData.achievements || [];
    
    
    const achievementsRef = collection(db, "achievements");
    const achievementsSnap = await getDocs(achievementsRef);
    
    console.log("Found achievements in Firestore:", achievementsSnap.size);
    
    const newlyUnlockedAchievements: any[] = [];
    
    achievementsSnap.forEach(doc => {
      const achievement = doc.data();
      console.log("Checking achievement:", achievement);
      const { id, type, goal } = achievement;
      
      
      if (unlockedAchievements.includes(id)) {
        console.log(`Achievement ${id} already unlocked`);
        return;
      }
      
      
      let meetsCondition = false;
      
      switch (type) {
        case "quiz_complete":
          meetsCondition = parseInt(userData.quizCompleted) >= parseInt(goal);
          console.log(`Quiz complete check: ${userData.quizCompleted} >= ${goal} = ${meetsCondition}`);
          break;
        case "perfect_score":
          meetsCondition = parseInt(userData.perfectScores) >= parseInt(goal);
          console.log(`Perfect score check: ${userData.perfectScores} >= ${goal} = ${meetsCondition}`);
          break;
        case "level":
          meetsCondition = parseInt(userData.level) >= parseInt(goal);
          console.log(`Level check: ${userData.level} >= ${goal} = ${meetsCondition}`);
          break;
        case "streak":
          
          const streakType = id.split('_')[0]; 
          const streakData = JSON.parse(localStorage.getItem(`${streakType}_streak_${userId}`) || '{"bestStreak":0}');
          meetsCondition = (streakData.bestStreak || 0) >= parseInt(goal);
          console.log(`Streak check (${streakType}): ${streakData.bestStreak} >= ${goal} = ${meetsCondition}`);
          break;
        
      }
      
      
      if (meetsCondition) {
        unlockedAchievements.push(id);
        newlyUnlockedAchievements.push(achievement); 
        console.log(`Achievement ${id} unlocked!`);
      }
    });
    
    
    if (newlyUnlockedAchievements.length > 0) {
      console.log("Updating user with new achievements");
      await updateDoc(userRef, {
        achievements: unlockedAchievements
      });
      
      
      for (const achievement of newlyUnlockedAchievements) {
        if (achievement.reward) {
          await addExperience(userId, parseInt(achievement.reward));
        }
      }
    } else {
      console.log("No new achievements unlocked");
    }
    
    return newlyUnlockedAchievements;
  }


export async function awardAchievement(userId: string, achievementId: string) {
  if (!userId) return;
  
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return;
  
  const userData = userSnap.data();
  const achievements = userData.achievements || [];
  
  
  if (achievements.includes(achievementId)) return;
  
  
  const achievementRef = doc(db, "achievements", achievementId);
  const achievementSnap = await getDoc(achievementRef);
  
  if (!achievementSnap.exists()) return;
  
  const achievementData = achievementSnap.data();
  
  
  achievements.push(achievementId);
  await updateDoc(userRef, {
    achievements
  });
  
  
  if (achievementData.reward) {
    await addExperience(userId, parseInt(achievementData.reward));
  }
}