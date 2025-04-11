import { component$, useResource$ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase'; 

interface VocabularyItem {
  english: string;
  czech: string;
}

export default component$(() => {
  const location = useLocation();
  const levelId = location.params.id; 

  const vocabularyResource = useResource$<VocabularyItem[]>(async () => {
    if (levelId) {
      const levelDocRef = doc(db, `sections/vocabulary/levels/${levelId}`);
      const levelSnapshot = await getDoc(levelDocRef);

      if (levelSnapshot.exists()) {
        return levelSnapshot.data().vocabularyItems || [];
      } else {
        console.error('No such level!');
        return [];
      }
    }
    return [];
  });

  return (
    <div>
      <h2>Vocabulary for Level: {levelId}</h2>
      {vocabularyResource.loading ? (
        <p>Loading vocabulary...</p>
      ) : (
        <>
          {Array.isArray(vocabularyResource.value) && vocabularyResource.value.length > 0 ? (
            <ul>
              {vocabularyResource.value.map((item: VocabularyItem, index: number) => (
                <li key={index}>
                  <strong>{item.english}</strong>: {item.czech}
                </li>
              ))}
            </ul>
          ) : (
            <p>No vocabulary items found or an error occurred.</p>
          )}
        </>
      )}
    </div>
  );
});
