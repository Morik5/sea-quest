import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { levels } from "../levels";
import { checkAchievements } from "./achievementService"; 


export async function addExperience(userId: string, amount: number) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data();
    
    
    const newExperience = (userData.experience || 0) + amount;
    let newLevel = userData.level || 1;
    
    
    for (let i = newLevel; i < levels.length; i++) {
      if (newExperience >= levels[i].requiredExperience) {
        newLevel = levels[i].id;
      } else {
        break;
      }
    }
    
    
    const now = new Date();
    const updates: any = { 
      experience: newExperience, 
      level: newLevel,
      lastUpdated: now,
    };
    
    
    
    const monthStart = getStartOfMonth(now);
    
    
    updates[`monthlyXP.${monthStart}`] = increment(amount);
    
    await updateDoc(userRef, updates);
    
    
    await checkAchievements(userId);
    
    return { newExperience, newLevel, levelUp: newLevel > userData.level };
  } catch (error) {
    console.error("Error adding experience:", error);
    return false;
  }

  
}


function getStartOfMonth(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1); 
  return d.toISOString().split('T')[0];
}


export function calculateLevelProgress(experience: number, level: number): number {
    const currentLevelData = levels.find(l => l.id === level);
    const nextLevelData = levels.find(l => l.id === level + 1);
    
    const currentLevelExp = currentLevelData?.requiredExperience || 0;
    const nextLevelExp = nextLevelData?.requiredExperience || (currentLevelExp + 100);
    
    
    return ((experience - currentLevelExp) / (nextLevelExp - currentLevelExp)) * 100;
  }
  
export function getRemainingXP(experience: number, level: number): number {
  const nextLevelData = levels.find(l => l.id === level + 1);
  const nextLevelExp = nextLevelData?.requiredExperience || (experience + 100);
  return nextLevelExp - experience;
}
  

export function getLevelTier(level: number): string {
  if (level <= 5) return "Beginner";
  if (level <= 10) return "Novice";
  if (level <= 15) return "Intermediate";
  if (level <= 20) return "Advanced";
  if (level <= 25) return "Expert";
  if (level <= 30) return "Master";
  return "Grandmaster";
}