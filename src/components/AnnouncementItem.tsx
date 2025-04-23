import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { formatDate } from "../utils/helpers";
import { getAnnouncementComments, createComment } from "../services/classroom";
import { makeSerializable } from "../utils/serialization";


interface AnnouncementItemProps {
  announcement: any;
  userProfile: any;
}

export default component$<AnnouncementItemProps>(({ announcement, userProfile }) => {

  

  const comments = useSignal<any[]>([]);
  const showComments = useSignal(false);
  const newComment = useSignal("");
  const isSubmittingComment = useSignal(false);
  const errorMessage = useSignal("");
  const isLoading = useSignal(false);

  
  useTask$(async ({ track }) => {
    track(() => showComments.value);
    
    if (showComments.value) {
      try {
        isLoading.value = true;
        errorMessage.value = "";
        const commentData = await getAnnouncementComments(announcement.id);
        comments.value = makeSerializable(commentData);
      } catch (error: any) {
        console.error("Error loading comments:", error);
        errorMessage.value = `Chyba při načítání komentářů: ${error.message || "Neznámá chyba"}`;
      } finally {
        isLoading.value = false;
      }
    }
  });

  
  const submitComment = $(async () => {
    console.log("Submit comment function called");
    console.log("Current newComment value:", newComment.value);
    console.log("Announcement ID:", announcement.id);
    
    
    if (!newComment.value || newComment.value.trim() === '') {
      errorMessage.value = "Komentář nemůže být prázdný";
      return;
    }
    
    if (!announcement || !announcement.id) {
      errorMessage.value = "Chyba: Chybí ID oznámení";
      return;
    }
    
    if (!userProfile?.uid) {
      errorMessage.value = "Pro přidání komentáře je nutné být přihlášen";
      return;
    }
    
    if (isSubmittingComment.value) {
      return;
    }
    
    try {
      isSubmittingComment.value = true;
      errorMessage.value = "";
      
      
      const createdComment = await createComment(
        announcement.id,
        newComment.value.trim(),
        userProfile.uid,
        userProfile.name || "Anonymní uživatel",
        userProfile.avatar || undefined
      );
      
      
      if (createdComment && createdComment.id) {
        comments.value = [...comments.value, makeSerializable(createdComment)];
        newComment.value = ""; 
        
        
        if (typeof announcement.commentCount === 'number') {
          announcement.commentCount++;
        } else {
          announcement.commentCount = 1;
        }
      } else {
        throw new Error("Failed to create comment - invalid response");
      }
    } catch (error: any) {
      console.error("Error submitting comment:", error);
      errorMessage.value = `Chyba při odesílání komentáře: ${error.message || "Neznámá chyba"}`;
    } finally {
      isSubmittingComment.value = false;
    }
  });

  return (
    <div class={`announcement-item ${announcement.important ? 'important' : ''}`}>
      <h3 class="announcement-title">{announcement.title}</h3>
      <div class="announcement-content">{announcement.content}</div>
      
      <div class="announcement-meta">
        <span class="announcement-date">
          {formatDate(announcement.createdAt)}
        </span>
        <button 
          class="comments-toggle"
          onClick$={() => showComments.value = !showComments.value}
        >
          {showComments.value ? "Skrýt komentáře" : `Komentáře (${announcement.commentCount || 0})`}
        </button>
      </div>
      
      {showComments.value && (
        <div class="comments-section">
          <h4>Komentáře</h4>
          
          {isLoading.value ? (
            <div class="loading-comments">Načítání komentářů...</div>
          ) : errorMessage.value ? (
            <div class="error-message">{errorMessage.value}</div>
          ) : comments.value.length > 0 ? (
            <div class="comments-list">
              {comments.value.map((comment) => (
                <div key={comment.id} class="comment-item">
                  <div class="comment-header">
                    <div class="comment-author">
                      {comment.userAvatar && (
                        <img 
                          src={comment.userAvatar} 
                          alt={comment.userName}
                          class="comment-avatar"
                          width={32}
                          height={32}
                        />
                      )}
                      <span class="comment-username">{comment.userName}</span>
                    </div>
                    <span class="comment-date">
                      {comment.createdAt ? formatDate(comment.createdAt) : ""}
                    </span>
                  </div>
                  <div class="comment-content">{comment.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <p class="no-comments">Zatím nejsou žádné komentáře.</p>
          )}
          
          {/* Comment Form */}
          <div class="comment-form">
            <textarea
              id="commentTextarea"
              value={newComment.value}
              onInput$={(e) => {
                const input = e.target as HTMLTextAreaElement;
                newComment.value = input.value;
                
                
                if (errorMessage.value && input.value.trim()) {
                  errorMessage.value = "";
                }
                
                console.log("Input event - new value:", input.value);
              }}
              placeholder="Napište komentář..."
              rows={2}
            ></textarea>
            <div class="comment-form-actions">
              {errorMessage.value && (
                <span class="comment-error">{errorMessage.value}</span>
              )}
              <button 
                type="button"
                class="submit-comment" 
                onClick$={submitComment}
                disabled={isSubmittingComment.value || !newComment.value.trim()}
              >
                {isSubmittingComment.value ? "Odesílání..." : "Přidat komentář"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
