import { component$ } from '@builder.io/qwik';

export interface Student {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  level?: number;
  joinedAt?: Date | string;
}

export const StudentsList = component$<{ students: Student[] }>(({ students }) => {
  return (
    <div class="students-list">
      {students.length > 0 ? (
        <div class="students-grid">
          {students.map((student) => (
            <div key={student.id} class="student-card">
              <div class="student-avatar">
                <img 
                  src={student.avatar || "/avatars/default.png"} 
                  alt={student.name} 
                  width={40} 
                  height={40} 
                />
                {student.level && (
                  <div class="student-level">Lvl {student.level}</div>
                )}
              </div>
              <div class="student-info">
                <div class="student-name">{student.name}</div>
                {student.email && <div class="student-email">{student.email}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div class="empty-state">
          <i class="fas fa-users empty-icon"></i>
          <p>Žádní studenti</p>
        </div>
      )}
    </div>
  );
});