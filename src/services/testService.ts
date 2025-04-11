import { $ } from "@builder.io/qwik";
import { db } from "../firebase";
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
  serverTimestamp,
  arrayUnion 
} from "firebase/firestore";



export interface TestQuestion {
  id?: string;
  text: string;
  options: string[];
  correctAnswer: number;
  points: number;
  type: 'multiple_choice';
}


export interface Test {
  id?: string;
  title: string;
  description?: string;
  classroomId: string;
  teacherId: string;
  questions: TestQuestion[];
  timeLimit?: number;
  dueDate?: Date;
  published: boolean;
  sharedWithTeachers?: string[];
  isTemplate?: boolean;
}


export interface TestSubmission {
  id?: string;
  testId: string;
  studentId: string;
  classroomId: string;
  answers: number[];
  submittedAt: any;
  startedAt: any;
  timeSpent?: number;
  score?: number;
  graded: boolean;
  gradedBy?: string;
  gradedAt?: any;
}


export const createTest = $(async (testData: Omit<Test, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, "tests"), {
      ...testData,
    });
    
    return {
      id: docRef.id,
      ...testData
    };
  } catch (error) {
    console.error("Error creating test:", error);
    throw error;
  }
});


export const getClassroomTests = $(async (classroomId: string) => {
  try {
    const testsQuery = query(
      collection(db, "tests"),
      where("classroomId", "==", classroomId)
    );
    
    const testsSnapshot = await getDocs(testsQuery);
    const tests: Test[] = [];
    
    testsSnapshot.forEach(doc => {
      tests.push({
        id: doc.id,
        ...doc.data()
      } as Test);
    });
    
    return tests;
  } catch (error) {
    console.error("Error getting classroom tests:", error);
    throw error;
  }
});


export const getTestById = $(async (testId: string) => {
  try {
    const testDoc = await getDoc(doc(db, "tests", testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    return {
      id: testDoc.id,
      ...testDoc.data()
    } as Test;
  } catch (error) {
    console.error("Error getting test:", error);
    throw error;
  }
});


export const updateTest = $(async (
  testId: string, 
  teacherId: string,
  updateData: Partial<Omit<Test, 'id' | 'teacherId' | 'classroomId'>>
) => {
  try {
    
    const testDoc = await getDoc(doc(db, "tests", testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    const testData = testDoc.data();
    if (testData.teacherId !== teacherId) {
      throw new Error("Not authorized to update this test");
    }
    
    await updateDoc(doc(db, "tests", testId), updateData);
    
    return {
      id: testId,
      ...testDoc.data(),
      ...updateData
    };
  } catch (error) {
    console.error("Error updating test:", error);
    throw error;
  }
});


export const deleteTest = $(async (testId: string, teacherId: string) => {
  try {
    
    const testDoc = await getDoc(doc(db, "tests", testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    const testData = testDoc.data();
    if (testData.teacherId !== teacherId) {
      throw new Error("Not authorized to delete this test");
    }
    
    await deleteDoc(doc(db, "tests", testId));
    
    return true;
  } catch (error) {
    console.error("Error deleting test:", error);
    throw error;
  }
});


export const publishTest = $(async (testId: string, teacherId: string) => {
  try {
    return await updateTest(testId, teacherId, { published: true });
  } catch (error) {
    console.error("Error publishing test:", error);
    throw error;
  }
});


export const submitTestAnswers = $(async (submission: Omit<TestSubmission, 'id' | 'submittedAt' | 'graded'>) => {
  try {
    
    const testDoc = await getDoc(doc(db, "tests", submission.testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    const test = testDoc.data() as Test;
    let score = 0;
    
    
    
  test.questions.forEach((question, index) => {
    if (submission.answers[index] === question.correctAnswer) {
      score += question.points || 1;
    }
  });
    
    
    
    const totalPoints = test.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    
    
    const submissionData = {
      ...submission,
      submittedAt: serverTimestamp(),
      score,
      totalPoints,
      graded: true,
      gradedAt: serverTimestamp(),
      autoGraded: true
    };
    
    const submissionRef = await addDoc(collection(db, "test_submissions"), submissionData);
    
    return {
      id: submissionRef.id,
      ...submissionData
    };
  } catch (error) {
    console.error("Error submitting test:", error);
    throw error;
  }
});


export const getTestSubmissions = $(async (testId: string, teacherId: string) => {
  try {
    
    const testDoc = await getDoc(doc(db, "tests", testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    const testData = testDoc.data();
    if (testData.teacherId !== teacherId && !testData.sharedWithTeachers?.includes(teacherId)) {
      throw new Error("Not authorized to view these submissions");
    }
    
    const submissionsQuery = query(
      collection(db, "test_submissions"),
      where("testId", "==", testId)
    );
    
    const submissionsSnapshot = await getDocs(submissionsQuery);
    
    
    const submissionPromises = submissionsSnapshot.docs.map(async (submission) => {
      const submissionData = submission.data();
      
      
      try {
        const studentDoc = await getDoc(doc(db, "users", submissionData.studentId));
        const studentData = studentDoc.exists() ? studentDoc.data() as Record<string, any> : null;
        
        return {
          id: submission.id,
          ...submissionData,
          student: studentData ? {
            id: studentData.uid || submissionData.studentId,
            name: studentData.name || "Unknown Student",
            avatar: studentData.avatar || null
          } : {
            id: submissionData.studentId,
            name: "Unknown Student",
            avatar: null
          }
        };
      } catch (err) {
        console.error("Error fetching student for submission:", err);
        return {
          id: submission.id,
          ...submissionData,
          student: {
            id: submissionData.studentId,
            name: "Unknown Student",
            avatar: null
          }
        };
      }
    });
    
    const results = await Promise.all(submissionPromises);
    return results;
  } catch (error) {
    console.error("Error getting test submissions:", error);
    throw error;
  }
});


export const shareTestWithTeacher = $(async (testId: string, ownerTeacherId: string, targetTeacherId: string) => {
  try {
    
    const testDoc = await getDoc(doc(db, "tests", testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    const testData = testDoc.data();
    if (testData.teacherId !== ownerTeacherId) {
      throw new Error("Not authorized to share this test");
    }
    
    
    await updateDoc(doc(db, "tests", testId), {
      sharedWithTeachers: arrayUnion(targetTeacherId)
    });
    
    return true;
  } catch (error) {
    console.error("Error sharing test:", error);
    throw error;
  }
});


export const copyTestToClassroom = $(async (testId: string, teacherId: string, targetClassroomId: string) => {
  try {
    
    const testDoc = await getDoc(doc(db, "tests", testId));
    
    if (!testDoc.exists()) {
      throw new Error("Test not found");
    }
    
    const originalTest = testDoc.data();
    
    
    if (originalTest.teacherId !== teacherId && 
        !originalTest.sharedWithTeachers?.includes(teacherId)) {
      throw new Error("Not authorized to copy this test");
    }
    
    
    const newTestData = {
      title: originalTest.title,
      description: originalTest.description,
      classroomId: targetClassroomId,
      teacherId: teacherId,
      questions: originalTest.questions,
      timeLimit: originalTest.timeLimit,
      published: false, 
      isTemplate: false,
    };
    
    const newTestRef = await addDoc(collection(db, "tests"), newTestData);
    
    return {
      id: newTestRef.id,
      ...newTestData
    };
  } catch (error) {
    console.error("Error copying test:", error);
    throw error;
  }
});


export const markTestAsTemplate = $(async (testId: string, teacherId: string) => {
  try {
    return await updateTest(testId, teacherId, { isTemplate: true });
  } catch (error) {
    console.error("Error marking test as template:", error);
    throw error;
  }
});


export const getTestTemplates = $(async () => {
  try {
    const templatesQuery = query(
      collection(db, "tests"),
      where("isTemplate", "==", true)
    );
    
    const templatesSnapshot = await getDocs(templatesQuery);
    const templates: Test[] = [];
    
    templatesSnapshot.forEach(doc => {
      templates.push({
        id: doc.id,
        ...doc.data()
      } as Test);
    });
    
    return templates;
  } catch (error) {
    console.error("Error getting test templates:", error);
    throw error;
  }
});