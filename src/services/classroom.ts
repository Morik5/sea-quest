import { $ } from "@builder.io/qwik";
import { db, auth } from "../firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  increment,
  writeBatch,
  arrayRemove
} from "firebase/firestore";
import type { Classroom, ClassroomEnrollment } from '../types/classroom';


function generateJoinCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  let result = '';
  
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}




export const createClassroom = $(async (teacherId: string, classroomData: {
  name: string;
  gradeLevel?: string;
  description?: string;
}) => {
  try {
    
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    
    
    let joinCode = generateJoinCode();
    let isCodeUnique = false;
    
    
    while (!isCodeUnique) {
      const codeQuery = query(collection(db, "classrooms"), where("joinCode", "==", joinCode));
      const codeSnapshot = await getDocs(codeQuery);
      
      if (codeSnapshot.empty) {
        isCodeUnique = true;
      } else {
        joinCode = generateJoinCode();
      }
    }
    
    const classroomRef = await addDoc(collection(db, "classrooms"), {
      ...classroomData,
      teacherId,
      joinCode,
      studentCount: 0,
      createdAt: serverTimestamp()
    });
    
    
    const userRef = doc(db, "users", teacherId);
    await updateDoc(userRef, {
      classrooms: arrayUnion(classroomRef.id)
    });
    
    return { id: classroomRef.id, joinCode };
  } catch (error) {
    console.error("Error creating classroom: ", error);
    throw error;
  }
});


export const getClassroomWithStudents = $(async (classroomId: string) => {
  try {
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists()) {
      return null;
    }
    
    const classroomData = {
      id: classroomDoc.id,
      ...classroomDoc.data()
    } as { id: string; teacherId: string; [key: string]: any };
    
    
    const enrollmentsQuery = query(
      collection(db, "classroom_students"),
      where("classroomId", "==", classroomId)
    );
    
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    
    if (enrollmentsSnapshot.empty) {
      return {
        ...classroomData,
        students: []
      };
    }
    
    const studentIds: string[] = [];
    
    enrollmentsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.studentId && data.studentId !== classroomData.teacherId) {
        studentIds.push(data.studentId);
      }
    });
    
    
    let students: any[] = [];
    
    if (studentIds.length > 0) {
      const studentsPromises = studentIds.map(async (studentId) => {
        const studentDoc = await getDoc(doc(db, "users", studentId));
        if (studentDoc.exists()) {
          return {
            id: studentDoc.id,
            ...studentDoc.data()
          };
        }
        return null;
      });
      
      students = (await Promise.all(studentsPromises)).filter(Boolean);
    }
    
    return {
      ...classroomData,
      students
    };
  } catch (error) {
    console.error("Error getting classroom with students:", error);
    return null;
  }
});




export const joinClassroom = $(async (joinCode: string, studentId: string) => {
  try {
    
    const q = query(collection(db, "classrooms"), where("joinCode", "==", joinCode));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Invalid classroom code");
    }
    
    const classroom = {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    };
    
    
    const studentCheckQuery = query(
      collection(db, "classroom_students"),
      where("classroomId", "==", classroom.id),
      where("studentId", "==", studentId)
    );
    
    const studentCheck = await getDocs(studentCheckQuery);
    if (!studentCheck.empty) {
      throw new Error("You are already enrolled in this classroom");
    }
    
    
    const studentRef = doc(db, "users", studentId);
    const studentDoc = await getDoc(studentRef);
    
    if (!studentDoc.exists()) {
      throw new Error("Student profile not found");
    }
    
    
    await addDoc(collection(db, "classroom_students"), {
      classroomId: classroom.id,
      studentId,
      joinedAt: serverTimestamp(),
      status: "active"
    }); 
    
    
    const classroomRef = doc(db, "classrooms", classroom.id);
    await updateDoc(classroomRef, {
      studentCount: increment(1)
    });
    
    
    await updateDoc(studentRef, {
      enrolledClassrooms: arrayUnion(classroom.id)
    });
    
    return classroom;
  } catch (error) {
    console.error("Error joining classroom: ", error);
    throw error;
  }
});





export const getClassroomAnnouncements = $(async (classroomId: string) => {
  try {
    const announcementsQuery = query(
      collection(db, "announcements"),
      where("classroomId", "==", classroomId),
      orderBy("createdAt", "desc")
    );
    
    const announcementsSnapshot = await getDocs(announcementsQuery);
    const announcements: any[] = [];
    
    announcementsSnapshot.forEach(doc => {
      announcements.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return announcements;
  } catch (error) {
    console.error("Error getting classroom announcements:", error);
    return [];
  }
});


export const createAnnouncement = $(async (announcement: {
  classroomId: string,
  title: string,
  content: string,
  createdBy: string,
  important?: boolean
}) => {
  try {
    const docRef = await addDoc(collection(db, "announcements"), {
      ...announcement,
      commentCount: 0, 
      createdAt: serverTimestamp()
    });
    return {
      id: docRef.id,
      ...announcement,
      commentCount: 0
    };
  } catch (error) {
    console.error("Error creating announcement:", error);
    throw new Error("Failed to create announcement");
  }
});


export const deleteAnnouncement = $(async (announcementId: string, teacherId: string) => {
  try {
    
    const announcementDoc = await getDoc(doc(db, "announcements", announcementId));
    
    if (!announcementDoc.exists()) {
      throw new Error("Announcement not found");
    }
    
    const announcementData = announcementDoc.data();
    const classroomId = announcementData.classroomId;
    
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists() || classroomDoc.data().teacherId !== teacherId) {
      throw new Error("Not authorized to delete this announcement");
    }
    
    
    await deleteDoc(doc(db, "announcements", announcementId));
    
    return true;
  } catch (error) {
    console.error("Error deleting announcement:", error);
    throw error;
  }
});


export const editAnnouncement = $(async (
  announcementId: string, 
  teacherId: string,
  updateData: {
    title?: string;
    content?: string;
    important?: boolean;
  }
) => {
  try {
    
    const announcementDoc = await getDoc(doc(db, "announcements", announcementId));
    
    if (!announcementDoc.exists()) {
      throw new Error("Announcement not found");
    }
    
    const announcementData = announcementDoc.data();
    const classroomId = announcementData.classroomId;
    
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists() || classroomDoc.data().teacherId !== teacherId) {
      throw new Error("Not authorized to edit this announcement");
    }
    
    
    await updateDoc(doc(db, "announcements", announcementId), updateData);
    
    
    return {
      id: announcementId,
      ...announcementData,
      ...updateData
    };
  } catch (error) {
    console.error("Error editing announcement:", error);
    throw error;
  }
});


export const getAnnouncementComments = async (announcementId: string): Promise<any[]> => {
  try {
    
    const commentsRef = collection(db, "announcements", announcementId, "comments");
    
    const q = query(commentsRef, orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    
    const comments = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      
      const createdAt = data.createdAt ? 
        (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : 
        new Date();
      
      return {
        id: doc.id,
        announcementId,
        ...data,
        createdAt, 
        content: data.content || ""
      };
    });
    
    return comments;
  } catch (error) {
    console.error("Error getting announcement comments:", error);
    throw error;
  }
};


export const createComment = $(async (
  announcementId: string,
  content: string, 
  userId: string,
  userName: string,
  userAvatar?: string
): Promise<any> => {
  console.log("==== COMMENT CREATION ====");
  console.log("Parameters received:", { announcementId, content, userId, userName });
  
  try {
    
    if (!announcementId) throw new Error("Announcement ID is required");
    if (!content || content.trim() === '') throw new Error("Comment content cannot be empty");
    if (!userId) throw new Error("User ID is required");
    
    
    const commentData = {
      content: content.trim(),
      userId,
      userName: userName || "Anonymous User",
      userAvatar: userAvatar || "default.png",
      createdAt: serverTimestamp()
    };
    
    
    const commentsRef = collection(db, "announcements", announcementId, "comments");
    const docRef = await addDoc(commentsRef, commentData);
    
    
    const announcementRef = doc(db, "announcements", announcementId);
    await updateDoc(announcementRef, {
      commentCount: increment(1)
    });
    
    
    return {
      id: docRef.id,
      announcementId,
      ...commentData,
      createdAt: new Date()
    };
  } catch (error) {
    console.error("Error creating comment:", error);
    throw error;
  }
});


export const createAnnouncementComment = $(async (
  param1: string | {
    announcementId: string;
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
  },
  param2?: string | {
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
  },
  param3?: {
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
  }
): Promise<any> => {
  console.log("DEPRECATED: createAnnouncementComment called, use createComment instead");
  
  try {
    
    let announcementId: string;
    let content: string;
    let userId: string;
    let userName: string;
    let userAvatar: string | undefined;
    
    
    if (typeof param1 === 'object' && !param2 && !param3) {
      if ('announcementId' in param1 && typeof param1.announcementId === 'string') {
        announcementId = param1.announcementId;
        content = param1.content;
        userId = param1.userId;
        userName = param1.userName || "Anonymous User";
        userAvatar = param1.userAvatar || "default.png";
      } else {
        throw new Error("Missing required properties in parameter object");
      }
    }
    
    else if (typeof param1 === 'string' && typeof param2 === 'object' && !param3) {
      announcementId = param1;
      content = param2.content;
      userId = param2.userId;
      userName = param2.userName || "Anonymous User";
      userAvatar = param2.userAvatar || "default.png";
    }
    
    else if (typeof param1 === 'string' && typeof param2 === 'string' && typeof param3 === 'object') {
      
      announcementId = param2;
      content = param3.content;
      userId = param3.userId;
      userName = param3.userName || "Anonymous User";
      userAvatar = param3.userAvatar || "default.png";
    }
    
    else {
      throw new Error("Invalid parameters for comment creation");
    }
    
    
    return await createComment(announcementId, content, userId, userName, userAvatar);
  } catch (error) {
    console.error("Error in createAnnouncementComment wrapper:", error);
    throw error;
  }
});


export const addComment = createComment;

export const getClassroomHomework = $(async (classroomId: string) => {
  try {
    const homeworkQuery = query(
      collection(db, "homework"),
      where("classroomId", "==", classroomId),
      orderBy("dueDate", "asc")
    );
    
    const homeworkSnapshot = await getDocs(homeworkQuery);
    const homework: any[] = [];
    
    homeworkSnapshot.forEach(doc => {
      homework.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return homework;
  } catch (error) {
    console.error("Error getting classroom homework:", error);
    return [];
  }
});


export const createHomework = $(async (homework: {
  classroomId: string,
  title: string,
  description: string,
  dueDate: Date,
  createdBy: string,
}) => {
  try {
    const docRef = await addDoc(collection(db, "homework"), {
      ...homework,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating homework:", error);
    return null;
  }
});


export const deleteHomework = $(async (homeworkId: string, teacherId: string) => {
  try {
    
    const homeworkDoc = await getDoc(doc(db, "homework", homeworkId));
    
    if (!homeworkDoc.exists()) {
      throw new Error("Homework not found");
    }
    
    const homeworkData = homeworkDoc.data();
    const classroomId = homeworkData.classroomId;
    
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists() || classroomDoc.data().teacherId !== teacherId) {
      throw new Error("Not authorized to delete this homework");
    }
    
    
    await deleteDoc(doc(db, "homework", homeworkId));
    
    return true;
  } catch (error) {
    console.error("Error deleting homework:", error);
    throw error;
  }
});


export const editHomework = $(async (
  homeworkId: string, 
  teacherId: string,
  updateData: {
    title?: string;
    description?: string;
    dueDate?: Date;
  }
) => {
  try {
    
    const homeworkDoc = await getDoc(doc(db, "homework", homeworkId));
    
    if (!homeworkDoc.exists()) {
      throw new Error("Homework not found");
    }
    
    const homeworkData = homeworkDoc.data();
    const classroomId = homeworkData.classroomId;
    
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists() || classroomDoc.data().teacherId !== teacherId) {
      throw new Error("Not authorized to edit this homework");
    }
    
    const updates: any = {};
    
    
    if (updateData.title) updates.title = updateData.title;
    if (updateData.description) updates.description = updateData.description;
    if (updateData.dueDate) updates.dueDate = updateData.dueDate;
    
    
    await updateDoc(doc(db, "homework", homeworkId), updates);
    
    
    return {
      id: homeworkId,
      ...homeworkData,
      ...updates
    };
  } catch (error) {
    console.error("Error editing homework:", error);
    throw error;
  }
});


export const gradeHomeworkSubmission = $(async (
  submissionId: string, 
  teacherId: string, 
  gradeData: {
    grade: number;
    feedback?: string;
  }
) => {
  try {
    
    const submissionDoc = await getDoc(doc(db, "homework_submissions", submissionId));
    
    if (!submissionDoc.exists()) {
      throw new Error("Submission not found");
    }
    
    const submissionData = submissionDoc.data();
    const homeworkId = submissionData.homeworkId;
    
    
    const homeworkDoc = await getDoc(doc(db, "homework", homeworkId));
    
    if (!homeworkDoc.exists()) {
      throw new Error("Homework not found");
    }
    
    const homeworkData = homeworkDoc.data();
    const classroomId = homeworkData.classroomId;
    
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists() || classroomDoc.data().teacherId !== teacherId) {
      throw new Error("Not authorized to grade this submission");
    }
    
    
    await updateDoc(doc(db, "homework_submissions", submissionId), {
      grade: gradeData.grade,
      feedback: gradeData.feedback || null,
      gradedAt: serverTimestamp(),
      status: "graded"
    });
    
    
    return {
      id: submissionId,
      ...submissionData,
      grade: gradeData.grade,
      feedback: gradeData.feedback,
      gradedAt: new Date(),
      status: "graded"
    };
  } catch (error) {
    console.error("Error grading homework submission:", error);
    throw error;
  }
});

export const getClassroom = async (classroomId: string) => {
  try {
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    
    if (!classroomDoc.exists()) {
      return null;
    }
    
    const classroomData = {
      id: classroomDoc.id,
      ...classroomDoc.data()
    } as { id: string; teacherId?: string; [key: string]: any };
    
    
    if (classroomData.teacherId) {
      try {
        const teacherDoc = await getDoc(doc(db, "users", classroomData.teacherId));
        if (teacherDoc.exists()) {
          classroomData.teacherName = teacherDoc.data().name || "Unknown Teacher";
        }
      } catch (error) {
        console.error("Error fetching teacher details:", error);
        classroomData.teacherName = "Unknown Teacher";
      }
    }
    
    return classroomData;
  } catch (error) {
    console.error(`Error fetching classroom ${classroomId}:`, error);
    throw error;
  }
};


export const ensureStudentEnrollment = async (classroomId: string, studentId: string) => {
  try {
    
    const enrollmentsQuery = query(
      collection(db, "classroom_enrollments"), 
      where("classroomId", "==", classroomId),
      where("studentId", "==", studentId)
    );
    
    const enrollmentSnapshot = await getDocs(enrollmentsQuery);
    
    
    if (!enrollmentSnapshot.empty) {
      return enrollmentSnapshot.docs[0].id;
    }
    
    
    const enrollmentData = {
      classroomId,
      studentId,
      enrolledAt: new Date().toISOString(),
      status: "active"
    };
    
    const enrollmentRef = await addDoc(collection(db, "classroom_enrollments"), enrollmentData);
    
    
    const classroomRef = doc(db, "classrooms", classroomId);
    await updateDoc(classroomRef, {
      enrolledStudentIds: arrayUnion(studentId)
    });
    
    
    const userRef = doc(db, "users", studentId);
    await updateDoc(userRef, {
      enrolledClassrooms: arrayUnion(classroomId)
    });
    
    return enrollmentRef.id;
  } catch (error) {
    console.error("Error ensuring student enrollment:", error);
    throw error;
  }
};


export const repairClassroomEnrollments = async (classroomId: string) => {
  try {
    
    const classroomDoc = await getDoc(doc(db, "classrooms", classroomId));
    if (!classroomDoc.exists()) {
      throw new Error("Classroom not found");
    }
    
    const classroomData = classroomDoc.data();
    const enrolledStudentIds = classroomData.enrolledStudentIds || [];
    
    
    const enrollmentPromises = enrolledStudentIds.map((studentId: string) => 
      ensureStudentEnrollment(classroomId, studentId)
    );
    
    await Promise.all(enrollmentPromises);
    
    return {
      success: true,
      enrolledCount: enrolledStudentIds.length
    };
  } catch (error) {
    console.error("Error repairing classroom enrollments:", error);
    throw error;
  }
};




export async function getClassroomById(classroomId: string): Promise<Classroom | null> {
  try {
    const classroomDoc = await getDoc(doc(db, 'classrooms', classroomId));
    if (classroomDoc.exists()) {
      const data = classroomDoc.data();
      return {
        id: classroomDoc.id,
        ...data,
        createdAt: data.createdAt.toDate()
      } as Classroom;
    }
    return null;
  } catch (error) {
    console.error('Error getting classroom:', error);
    throw error;
  }
}


export async function getTeacherClassrooms(teacherId: string): Promise<Classroom[]> {
  try {
    const q = query(
      collection(db, 'classrooms'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate()
      } as Classroom;
    });
  } catch (error) {
    console.error('Error getting teacher classrooms:', error);
    throw error;
  }
}


export async function getStudentClassrooms(studentId: string): Promise<Classroom[]> {
  try {
    
    const enrollmentsQuery = query(
      collection(db, 'classroom_enrollments'),
      where('studentId', '==', studentId),
      where('status', '==', 'active')
    );
    
    const enrollmentSnapshot = await getDocs(enrollmentsQuery);
    const classroomIds = enrollmentSnapshot.docs.map(doc => doc.data().classroomId);
    
    if (classroomIds.length === 0) {
      return [];
    }
    
    
    const classrooms: Classroom[] = [];
    
    
    
    const batchSize = 10;
    for (let i = 0; i < classroomIds.length; i += batchSize) {
      const batch = classroomIds.slice(i, i + batchSize);
      
      const classroomsQuery = query(
        collection(db, 'classrooms'),
        where('id', 'in', batch),
        where('isActive', '==', true)
      );
      
      const classroomSnapshot = await getDocs(classroomsQuery);
      classroomSnapshot.forEach(doc => {
        const data = doc.data();
        classrooms.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate()
        } as Classroom);
      });
    }
    
    return classrooms;
  } catch (error) {
    console.error('Error getting student classrooms:', error);
    throw error;
  }
}


export async function updateClassroom(classroomId: string, updates: Partial<Classroom>): Promise<void> {
  try {
    await updateDoc(doc(db, 'classrooms', classroomId), updates);
  } catch (error) {
    console.error('Error updating classroom:', error);
    throw error;
  }
}


export async function deleteClassroom(classroomId: string): Promise<void> {
  try {
    const classroomRef = doc(db, 'classrooms', classroomId);
    const classroomDoc = await getDoc(classroomRef);
    
    if (!classroomDoc.exists()) {
      throw new Error('Classroom not found');
    }
    
    
    const enrollmentsQuery = query(
      collection(db, 'classroom_enrollments'),
      where('classroomId', '==', classroomId)
    );
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    
    
    const batch = writeBatch(db);
    
    
    const studentUpdatePromises: Promise<void>[] = [];
    
    enrollmentsSnapshot.forEach(enrollmentDoc => {
      const data = enrollmentDoc.data();
      
      batch.delete(enrollmentDoc.ref);
      
      if (data.studentId) {
        
        const studentRef = doc(db, 'users', data.studentId);
        studentUpdatePromises.push(
          updateDoc(studentRef, {
            enrolledClassrooms: arrayRemove(classroomId)
          })
        );
      }
    });
    
    
    batch.delete(classroomRef);
    
    
    await batch.commit();
    
    
    await Promise.all(studentUpdatePromises);
    
  } catch (error) {
    console.error('Error deleting classroom:', error);
    throw error;
  }
}


export async function enrollStudentInClassroom(
  classroomId: string, 
  studentId: string
): Promise<string> {
  try {
    
    const q = query(
      collection(db, 'classroom_enrollments'),
      where('classroomId', '==', classroomId),
      where('studentId', '==', studentId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      
      const enrollmentDoc = querySnapshot.docs[0];
      const enrollmentData = enrollmentDoc.data();
      
      if (enrollmentData.status !== 'active') {
        await updateDoc(enrollmentDoc.ref, { status: 'active' });
      }
      
      return enrollmentDoc.id;
    }
    
    
    const enrollmentData = {
      classroomId,
      studentId,
      joinedAt: serverTimestamp(),
      status: 'active'
    };
    
    const docRef = await addDoc(collection(db, 'classroom_enrollments'), enrollmentData);
    return docRef.id;
  } catch (error) {
    console.error('Error enrolling student:', error);
    throw error;
  }
}


export async function removeStudentFromClassroom(
  enrollmentId: string,
  classroomId: string
): Promise<void> {
  try {
    if (!enrollmentId) {
      throw new Error('Enrollment ID is required');
    }
    
    
    const enrollmentRef = doc(db, 'classroom_enrollments', enrollmentId);
    const enrollmentDoc = await getDoc(enrollmentRef);
    
    if (!enrollmentDoc.exists()) {
      throw new Error('Enrollment record not found');
    }
    
    const studentId = enrollmentDoc.data().studentId;
    
    
    const batch = writeBatch(db);
    
    
    batch.delete(enrollmentRef);
    
    
    const classroomRef = doc(db, 'classrooms', classroomId);
    batch.update(classroomRef, {
      enrolledStudentIds: arrayRemove(studentId),
      studentCount: increment(-1)
    });
    
    
    const studentRef = doc(db, 'users', studentId);
    batch.update(studentRef, {
      enrolledClassrooms: arrayRemove(classroomId)
    });
    
    
    await batch.commit();
    
  } catch (error) {
    console.error('Error removing student:', error);
    throw error;
  }
}


export async function getClassroomStudents(classroomId: string): Promise<ClassroomEnrollment[]> {
  try {
    const q = query(
      collection(db, 'classroom_enrollments'),
      where('classroomId', '==', classroomId),
      where('status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        joinedAt: data.joinedAt.toDate()
      } as ClassroomEnrollment;
    });
  } catch (error) {
    console.error('Error getting classroom students:', error);
    throw error;
  }
}


export async function joinClassroomByCode(studentId: string, joinCode: string): Promise<string> {
  try {
    
    const classroomQuery = query(
      collection(db, 'classrooms'),
      where('joinCode', '==', joinCode)
    );
    const classroomsSnapshot = await getDocs(classroomQuery);
    
    if (classroomsSnapshot.empty) {
      throw new Error('Invalid classroom code');
    }
    
    const classroomDoc = classroomsSnapshot.docs[0];
    const classroomId = classroomDoc.id;
    
    
    const isEnrolled = await isStudentEnrolledInClassroom(classroomId, studentId);
    
    if (isEnrolled) {
      throw new Error('You are already enrolled in this classroom');
    }
    
    
    return await enrollStudentInClassroom(classroomId, studentId);
    
  } catch (error: any) {
    console.error('Error joining classroom:', error);
    throw error;
  }
}

export async function createManualHomeworkSubmission(submissionData: any) {
  try {
    const submissionRef = await addDoc(collection(db, "homework_submissions"), {
      ...submissionData,
      createdAt: serverTimestamp()
    });
    
    
    const homeworkRef = doc(db, "homework", submissionData.homeworkId);
    await updateDoc(homeworkRef, {
      submissionCount: increment(1)
    });
    
    return submissionRef.id;
  } catch (error) {
    console.error("Error creating manual homework submission:", error);
    throw error;
  }
}


export async function submitHomework(submissionData: any) {
  try {
    
    const submissionRef = await addDoc(collection(db, "homework_submissions"), {
      ...submissionData,
      createdAt: serverTimestamp()
    });
    
    
    const userRef = doc(db, "users", submissionData.studentId);
    await updateDoc(userRef, {
      homework_completed: increment(1)
    });
    
    return submissionRef.id;
  } catch (error) {
    console.error("Error submitting homework:", error);
    throw error;
  }
}


export async function removeStudentByIds(
  classroomId: string,
  studentId: string
): Promise<void> {
  try {
    if (!classroomId || !studentId) {
      throw new Error('Classroom ID and student ID are required');
    }
    
    
    const batch = writeBatch(db);
    
    
    const classroomRef = doc(db, 'classrooms', classroomId);
    batch.update(classroomRef, {
      enrolledStudentIds: arrayRemove(studentId),
      studentCount: increment(-1)
    });
    
    
    const studentRef = doc(db, 'users', studentId);
    batch.update(studentRef, {
      enrolledClassrooms: arrayRemove(classroomId)
    });
    
    
    const enrollmentsQuery = query(
      collection(db, 'classroom_enrollments'),
      where('classroomId', '==', classroomId),
      where('studentId', '==', studentId)
    );
    
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    enrollmentsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    
    const studentRecordsQuery = query(
      collection(db, 'classroom_students'),
      where('classroomId', '==', classroomId),
      where('studentId', '==', studentId)
    );
    
    const studentRecordsSnapshot = await getDocs(studentRecordsQuery);
    studentRecordsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    
    const updatedClassroomDoc = await getDoc(classroomRef);
    if (updatedClassroomDoc.exists()) {
      const data = updatedClassroomDoc.data();
      const enrolledIds = data.enrolledStudentIds || [];
      
      
      if (data.studentCount !== enrolledIds.length) {
        batch.update(classroomRef, {
          studentCount: enrolledIds.length
        });
      }
    }
    
    
    await batch.commit();
    
    console.log(`Successfully removed student ${studentId} from classroom ${classroomId}`);
    
  } catch (error) {
    console.error('Error removing student:', error);
    throw error;
  }
}


export async function isStudentEnrolledInClassroom(
  classroomId: string, 
  studentId: string
): Promise<boolean> {
  try {
    
    const enrollmentsQuery = query(
      collection(db, 'classroom_enrollments'),
      where('classroomId', '==', classroomId),
      where('studentId', '==', studentId)
    );
    
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    const hasEnrollmentRecord = !enrollmentsSnapshot.empty;
    
    
    const classroomRef = doc(db, 'classrooms', classroomId);
    const classroomDoc = await getDoc(classroomRef);
    
    if (!classroomDoc.exists()) {
      return false;
    }
    
    const classroomData = classroomDoc.data();
    const enrolledStudentIds = classroomData.enrolledStudentIds || [];
    const isInClassroomList = enrolledStudentIds.includes(studentId);
    
    
    const studentRef = doc(db, 'users', studentId);
    const studentDoc = await getDoc(studentRef);
    
    if (!studentDoc.exists()) {
      return false;
    }
    
    const studentData = studentDoc.data();
    const enrolledClassrooms = studentData.enrolledClassrooms || [];
    const isInStudentList = enrolledClassrooms.includes(classroomId);
    
    
    if (hasEnrollmentRecord || isInClassroomList || isInStudentList) {
      
      if (!(hasEnrollmentRecord && isInClassroomList && isInStudentList)) {
        console.log("Fixing inconsistent enrollment state for student", studentId, "in classroom", classroomId);
        
        
        const batch = writeBatch(db);
        
        
        if (isInClassroomList) {
          batch.update(classroomRef, {
            enrolledStudentIds: arrayRemove(studentId)
          });
        }
        
        
        if (isInStudentList) {
          batch.update(studentRef, {
            enrolledClassrooms: arrayRemove(classroomId)
          });
        }
        
        
        if (hasEnrollmentRecord) {
          enrollmentsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
          });
        }
        
        
        await batch.commit();
        
        return false; 
      }
      
      return true; 
    }
    
    return false; 
    
  } catch (error) {
    console.error('Error checking student enrollment:', error);
    return false;
  }
}
