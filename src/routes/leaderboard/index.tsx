import { component$, useSignal, useResource$, Resource, useStylesScoped$ } from "@builder.io/qwik";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../../firebase";
import { getLevelTier } from "../../services/levelService";
import styles from "./index.css?inline";

interface LeaderboardUser {
  id: string;
  name: string;
  avatar: string;
  experience: number;
  level: number;
  monthlyXP?: number;
  tier: string;
}


function getStartOfMonth(date: Date): string {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfMonth.toISOString().split('T')[0];
}


export default component$(() => {

  useStylesScoped$(styles);

  const timeFilter = useSignal<'monthly' | 'all-time'>('all-time');
  const limitCount = useSignal(10);

  const leaderboardData = useResource$(async ({ track }) => {
    track(timeFilter);
    track(limitCount);
    
    try {
      const usersRef = collection(db, "users");
      let q;
      const currentDate = new Date();
      const monthStart = getStartOfMonth(currentDate);

      console.log("Date calculations:", {
        currentDate: currentDate.toISOString(),
        calculatedMonthStart: monthStart,
        dayOfWeek: currentDate.getDay()
      });

      
      if (timeFilter.value === 'monthly') {
        
        q = query(
          usersRef,
          where(`monthlyXP.${monthStart}`, '>', 0),
          orderBy(`monthlyXP.${monthStart}`, "desc"),
          limit(limitCount.value)
        );
      } else {
        
        q = query(
          usersRef,
          orderBy("experience", "desc"),
          limit(limitCount.value)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const users: LeaderboardUser[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        
        
        const user: LeaderboardUser = {
          id: doc.id,
          name: userData.name || 'Anonymous',
          avatar: userData.avatar || '/avatars/default.png',
          experience: userData.experience || 0,
          level: userData.level || 1,
          tier: getLevelTier(userData.level || 1)
        };
        
        
        if (timeFilter.value === 'monthly' && userData.monthlyXP && userData.monthlyXP[monthStart]) {
          user.monthlyXP = userData.monthlyXP[monthStart];
        }
        
        users.push(user);
      });
      
      return users;
    } catch (error) {
      console.error("Error fetching leaderboard data:", error);
      return [];
    }
  });

  return (
    <div class="leaderboard-container">
      <h1>Leaderboard</h1>
      
      <div class="leaderboard-filters">
        <div class="filter-options">
          <button 
            class={{ active: timeFilter.value === 'all-time' }} 
            onClick$={() => timeFilter.value = 'all-time'}>
            All Time
          </button>
          <button 
            class={{ active: timeFilter.value === 'monthly' }} 
            onClick$={() => timeFilter.value = 'monthly'}>
            Monthly
          </button>
        </div>
        
        <select 
          value={limitCount.value} 
          onChange$={(event) => {
            limitCount.value = parseInt((event.target as HTMLSelectElement).value);
          }}>
          <option value="10">Top 10</option>
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
        </select>
      </div>
      
      <div class="leaderboard-table-container">
        <Resource
          value={leaderboardData}
          onPending={() => <div class="loading">Loading leaderboard data...</div>}
          onRejected={(error) => <div class="error">{error.message}</div>}
          onResolved={(users) => (
            <>
              {users.length > 0 ? (
                <table class="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>User</th>
                      <th>Level</th>
                      <th>Tier</th>
                      <th>XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <tr key={user.id} class={{ 
                        "top-three": index < 3,
                        "first-place": index === 0,
                        "second-place": index === 1,
                        "third-place": index === 2
                      }}>
                        <td class="rank">{index + 1}</td>
                        <td class="user-info">
                          <img src={user.avatar} alt="Avatar" class="avatar" width="40" height="40" />
                          <span>{user.name}</span>
                        </td>
                        <td class="level">{user.level}</td>
                        <td class={`tier ${getLevelTier(user.level)}`}>
                          {getLevelTier(user.level)}
                        </td>
                        <td class="xp">
                          {timeFilter.value === 'monthly' && user.monthlyXP !== undefined
                            ? `${user.monthlyXP} XP`
                            : `${user.experience} XP`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div class="no-data">No data available</div>
              )}
            </>
          )}
        />
      </div>
    </div>
  );
});