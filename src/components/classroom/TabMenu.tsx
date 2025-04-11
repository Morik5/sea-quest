import { component$ } from "@builder.io/qwik";
import type { PropFunction } from "@builder.io/qwik";

export default component$((props: { 
  activeTab: string;
  isTeacher: boolean;
  onTabChange$: PropFunction<(tab: string) => void>;
}) => {
  const { activeTab, onTabChange$ } = props;
  
  return (
    <div class="tabs">
      <button 
        onClick$={() => onTabChange$('announcements')}
        class={`tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
      >
        <i class="fas fa-bullhorn"></i> Oznámení
      </button>
      <button 
        onClick$={() => onTabChange$('homework')}
        class={`tab-btn ${activeTab === 'homework' ? 'active' : ''}`}
      >
        <i class="fas fa-book"></i> Úkoly
      </button>
      <button 
        onClick$={() => onTabChange$('tests')}
        class={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
      >
        <i class="fas fa-tasks"></i> Testy
      </button>
      <button 
        onClick$={() => onTabChange$('students')}
        class={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
      >
        <i class="fas fa-users"></i> Studenti
      </button>
    </div>
  );
});