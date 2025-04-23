import { component$, useSignal, useStylesScoped$ } from '@builder.io/qwik';
import styles from './HomeworkItem.css?inline';


//smazat formatDate a nahradit
function formatDate(dateInput: any): string {
  if (!dateInput) return 'Datum není k dispozici';
  
  try {
    
    let date;
    
    
    if (dateInput && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } 
    
    else if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
      date = new Date(dateInput.seconds * 1000); 
    }
    
    else if (dateInput instanceof Date) {
      date = dateInput;
    }
    
    else {
      date = new Date(dateInput);
    }
    
    
    if (isNaN(date.getTime())) {
      console.log("Invalid date value:", dateInput);
      return 'Neplatné datum';
    }
    
    
    const options = { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric'
    };
    
    return date.toLocaleString('cs-CZ', options);
  } catch (error) {
    console.error("Error formatting date:", error, dateInput);
    return 'Neplatné datum';
  }
}

export interface Homework {
  id: string;
  classroomId: string;
  title: string;
  description: string;
  dueDate: Date | string;
  createdAt: Date | string;
  teacherId: string;
  attachments?: string[];
  completed?: boolean;
}

export const HomeworkItem = component$<{
  homework: any;
  isStudent?: boolean;
  isInformativeOnly?: boolean;
}>(({ homework, isStudent = false}) => {

  useStylesScoped$(styles);

  const isExpanded = useSignal(false);
  
  console.log('Homework dueDate:', homework.dueDate);
  if (homework.submission) {
    console.log('Submission date:', homework.submission.submittedAt);
  }
  
  const dueDate = (() => {
    if (homework.dueDate && typeof homework.dueDate.toDate === 'function') {
      return homework.dueDate.toDate();
    } 
    return new Date(homework.dueDate);
  })();
  
  const isPastDue = dueDate < new Date();
  
  return (
    <div class={`homework-item ${isPastDue ? 'past-due' : ''}`}>
      <div class="homework-header" onClick$={() => isExpanded.value = !isExpanded.value}>
        <div class="homework-title-row">
          <h3 class="homework-title">{homework.title}</h3>
          <div class="homework-status">
            {homework.completed && (
              <span class="completed-badge">
                <i class="fas fa-check-circle"></i> Odevzdáno
              </span>
            )}
            {homework.completed && homework.markedByTeacher && (
              <span class="marked-by-teacher-badge">
                <i class="fas fa-user-check"></i> Označeno učitelem
              </span>
            )}
            {isStudent && !homework.completed && !isPastDue && (
              <span class="pending-badge">
                <i class="fas fa-clock"></i> K odevzdání
              </span>
            )}
            {isStudent && !homework.completed && isPastDue && (
              <span class="late-badge">
                <i class="fas fa-exclamation-circle"></i> Po termínu
              </span>
            )}
          </div>
        </div>
        <div class="homework-meta">
          <span class="due-date">Termín odevzdání: {formatDate(homework.dueDate)}</span>
          <span class="expand-icon">
            <i class={`fas fa-chevron-${isExpanded.value ? 'up' : 'down'}`}></i>
          </span>
        </div>
      </div>
      
      {isExpanded.value && (
        <div class="homework-details">
          <p class="homework-description">{homework.description}</p>
        </div>
      )}
    </div>
  );
});