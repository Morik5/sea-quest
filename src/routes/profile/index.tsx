
import { component$, useSignal, useTask$, $, useStylesScoped$ } from "@builder.io/qwik";
import { getUserProfile, updateUserAvatar, signOutUser } from "../../services/user"; 
import { levels } from "../../services/levels";
import { calculateLevelProgress, getRemainingXP, getLevelTier } from "../../services/levelService";
import { makeSerializable } from "../../utils/serialization";
import styles from "./index.css?inline"; 


export default component$(() => {

  useStylesScoped$(styles);

  const user = useSignal<{ name: string; role: string; avatar: string; quizCompleted: number; perfectScores: number; parentCode?: string; uid: string; experience: number; level: number } | null>(null);
  const availableAvatars = useSignal<string[]>([
    "/avatars/default.png",
    "/avatars/avatar1.png",
    "/avatars/avatar2.png",
    "/avatars/avatar3.png",
  ]);
  const showAvatars = useSignal(false);

  
  useTask$(async () => {
    const rawProfile = await getUserProfile();
    
    
    const profile = rawProfile ? makeSerializable(rawProfile) : null;
    
    if (profile) {
      user.value = profile as any;
    } else {
      console.warn("No authenticated user found.");
    }
  });

  const handleAvatarChange = $(async (newAvatar: string) => {
    if (!user.value) return;

    const oldAvatar = user.value.avatar;
    availableAvatars.value = availableAvatars.value.filter(a => a !== newAvatar);
    
    if (!availableAvatars.value.includes(oldAvatar)) {
      availableAvatars.value.push(oldAvatar);
    }

    await updateUserAvatar(newAvatar);

    
    const rawProfile = await getUserProfile();
    
    const updatedProfile = makeSerializable(rawProfile);
    user.value = updatedProfile as any;
  });

  const toggleAvatarSelection = $(() => {
    if (user.value) {
      availableAvatars.value = availableAvatars.value.filter(
        (avatar) => avatar !== user.value?.avatar
      );
    }
    showAvatars.value = !showAvatars.value;
  });

  
  const handleSignOut = $(async () => {
    try {
      await signOutUser();
      user.value = null;
      window.location.href = "/login"; 
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  });

  return (
    <div class="profile-container">
      <div class="profile-layout">
        <div class="profile-left-column">
          {user.value && (
            <div class="profile-card">
              <img src={user.value.avatar} alt="Avatar" class="profile-avatar" width="100" height="100" />
              <h1>{user.value.name}</h1>
              <p class="role">{user.value.role.toUpperCase()}</p>
              
              {/* Add classroom management button for teachers */}
              {user.value.role === "teacher" && (
                <button 
                  class="manage-classrooms-btn" 
                  onClick$={() => window.location.href = "/classrooms"}
                >
                  Spravovat třídy
                </button>
              )}
              
              {user.value.role === "student" && (
                <div>
                  <p class="quiz-completed">✅ Completed Quizzes: {user.value.quizCompleted}</p>
                  <p class="perfect-scores">🏆 Perfect Scores: {user.value.perfectScores}</p>
                  {/* Experience Progress Bar */}
                  <div class="experience-bar-container">
                    <p>🌟 Experience: {user.value.experience} XP</p>

                    <div class="progress-bar">
                      <div 
                        class="progress-fill" 
                        style={{
                          width: `${calculateLevelProgress(user.value.experience, user.value.level)}%`
                        }}>
                      </div>
                    </div>

                    <div class="level-info">
                      <p>📈 Level: {user.value.level} - {levels.find(l => l.id === user.value?.level)?.name || "Unknown"}</p>
                        <p class={`tier ${getLevelTier(user.value.level || 0)}`}>🏅 Tier: {getLevelTier(user.value.level || 0)}</p>
                      <p class="remaining-xp">✨ Next level: {getRemainingXP(user.value.experience || 0, user.value.level || 0)} XP remaining</p>
                    </div>
                  </div>

                </div>
              )}
                            
              {/* Avatar Selection Button */}
              <button class="avatar-toggle-btn" onClick$={toggleAvatarSelection}>
                Choose a profile picture
              </button>

              {/* Avatar Selection Dropdown */}
              <div class={`avatar-selection ${showAvatars.value ? "open" : ""}`}>
                {availableAvatars.value.map((avatar) => (
                  <img
                    key={avatar}
                    src={avatar}
                    alt="Avatar"
                    width="50"
                    height="50"
                    class={`avatar-option ${user.value?.avatar === avatar ? "selected" : ""}`}
                    onClick$={() => handleAvatarChange(avatar)}
                  />
                ))}
              </div>

              {/* Sign Out Button */}
              <button class="sign-out-btn" onClick$={handleSignOut}>
                Logout
              </button>
            </div>
          )}
        </div>

        <div class="profile-right-column">
          

          <div class="parent-login">
            <h3>Přihlášení pro rodiče</h3>
            <p>
              Kód pro přihlášení: <strong>{user.value?.parentCode || "Generating..."}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});