import { $ } from "@builder.io/qwik";
import { doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";


export const getUserProfile = $(async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      return {
        uid: currentUser.uid,
        email: currentUser.email,
        ...userData
      };
    } else {
      
      const newProfile = {
        name: currentUser.displayName || "User",
        email: currentUser.email,
        avatar: currentUser.photoURL || "/avatars/default.png",
        role: "student",
        quizCompleted: 0,
        perfectScores: 0,
        experience: 0,
        level: 1,
        createdAt: new Date()
      };
      
      await setDoc(userRef, newProfile);
      
      return {
        uid: currentUser.uid,
        ...newProfile
      };
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
});


export const updateUserAvatar = $(async (avatar: string) => {
  const user = auth.currentUser;
  if (!user) return false;

  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, { avatar });

  return true;
});


export const updateUserExperience = $(async (experience: number) => {
  const user = auth.currentUser;
  if (!user) return false;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const userData = userSnap.data();
    const newExperience = userData.experience + experience;
    let newLevel = userData.level;

    
    if (newExperience >= 1000) newLevel = 10;
    else if (newExperience >= 800) newLevel = 9;
    else if (newExperience >= 650) newLevel = 8;
    else if (newExperience >= 500) newLevel = 7;
    else if (newExperience >= 350) newLevel = 6;
    else if (newExperience >= 250) newLevel = 5;
    else if (newExperience >= 150) newLevel = 4;
    else if (newExperience >= 80) newLevel = 3;
    else if (newExperience >= 30) newLevel = 2;
    else newLevel = 1;

    await updateDoc(userRef, { experience: newExperience, level: newLevel });
    return { newExperience, newLevel };
  }

  return false;
});


export const handleQuizCompletion = $(async (earnedXP: number, userSignal: any) => {
  const result = await updateUserExperience(earnedXP);
  if (result) {
    const updatedUserProfile = await getUserProfile();
    if (updatedUserProfile) {
      userSignal.value = updatedUserProfile;
    }
  }
});


export const handleAchievementGain = $(async (earnedXP: number, userSignal: any) => {
  const result = await updateUserExperience(earnedXP);
  if (result) {
    const updatedUserProfile = await getUserProfile();
    if (updatedUserProfile) {
      userSignal.value = updatedUserProfile;
    }
  }
});


export const signOutUser = $(async () => {
  await signOut(auth);
});


export const updateUserProfile = $(async (userId: string, profileData: any) => {
  try {
    await updateDoc(doc(db, "users", userId), profileData);
    return true;
  } catch (error) {
    console.error("Error updating user profile:", error);
    return false;
  }
});


export const enrollUserInClassroom = $(async (userId: string, classroomId: string) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      enrolledClassrooms: arrayUnion(classroomId)
    });
    return true;
  } catch (error) {
    console.error("Error enrolling in classroom:", error);
    return false;
  }
});


export const removeUserFromClassroom = $(async (userId: string, classroomId: string) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      enrolledClassrooms: arrayRemove(classroomId)
    });
    return true;
  } catch (error) {
    console.error("Error removing from classroom:", error);
    return false;
  }
});


export async function getUserById(userId: string) {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userDocRef);
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      return { 
        uid: userId,
        role: userData.role || 'student'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}