export interface Classroom {
    id: string;
    name: string;
    teacherId: string;
    joinCode: string;
    description?: string;
    gradeLevel?: string;
    studentCount: number;
    createdAt: Date;
    isActive?: boolean;
    enrolledStudentIds?: string[];
  }
  

  export interface ClassroomEnrollment {
    id: string;
    classroomId: string;
    studentId: string;
    joinedAt: Date;
    status: string; // active or removed
  }