import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';






export async function getAllSentences() {
  try {
    const sentenceDocRef = doc(db, 'sections', 'sentence_order');
    const sentenceDoc = await getDoc(sentenceDocRef);
    
    if (!sentenceDoc.exists()) {
      return [];
    }
    
    const data = sentenceDoc.data();
    
    
    if (Array.isArray(data.sentences)) {
      
      return data.sentences.map(text => ({ text }));
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching sentences:", error);
    throw error;
  }
}


export async function addSentence(sentenceText: string) {
  try {
    const sentenceDocRef = doc(db, 'sections', 'sentences');
    const sentenceDoc = await getDoc(sentenceDocRef);
    
    let sentences: string[] = [];
    
    if (sentenceDoc.exists()) {
      const data = sentenceDoc.data();
      sentences = Array.isArray(data.sentences) ? data.sentences : [];
    }
    
    
    sentences.push(sentenceText);
    
    
    await (sentenceDoc.exists() 
      ? updateDoc(sentenceDocRef, { sentences }) 
      : setDoc(sentenceDocRef, { sentences }));
    
    return sentences.length - 1; 
  } catch (error) {
    console.error("Error adding sentence:", error);
    throw error;
  }
}