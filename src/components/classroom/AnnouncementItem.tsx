import { component$, useSignal, $ } from '@builder.io/qwik';
import { getAnnouncementComments, createComment } from '../../services/classroom';
import { makeSerializable } from '../../utils/serialization';
import { formatDate } from '../../utils/helpers';


export interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: Date | string;
}

export interface Announcement {
  id: string;
  classroomId: string;
  title: string;
  content: string;
  teacherId: string;
  createdAt: Date | string;
  commentCount: number;
}

export interface User {
  uid: string;
  name: string;
  avatar?: string;
}

function ensureString(date: Date | string): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  return String(date);
}

export const AnnouncementItem = component$<{
  announcement: Announcement;
  teacherName?: string;
  currentUser: User;
}>(({ announcement, teacherName, currentUser }) => {
  const showComments = useSignal(false);
  const comments = useSignal<Comment[]>([]);
  const isLoadingComments = useSignal(false);
  const commentText = useSignal('');
  const isSubmittingComment = useSignal(false);
  const commentCount = useSignal(announcement.commentCount || 0);
  
  
  const loadComments = $(async () => {
    if (!showComments.value) {
      showComments.value = true;
      if (comments.value.length === 0) {
        try {
          isLoadingComments.value = true;
          const announcementComments = await getAnnouncementComments(announcement.id);
          comments.value = makeSerializable(announcementComments);
        } catch (error) {
          console.error("Error loading comments:", error);
        } finally {
          isLoadingComments.value = false;
        }
      }
    } else {
      showComments.value = false;
    }
  });
  
  
  const submitComment = $(async () => {
    if (!commentText.value.trim()) return;
    
    try {
      isSubmittingComment.value = true;
      await createComment(
        announcement.id,
        commentText.value.trim(),
        currentUser.uid,
        currentUser.name,
        currentUser.avatar
      );
      
      
      const updatedComments = await getAnnouncementComments(announcement.id);
      comments.value = makeSerializable(updatedComments);
      
      
      commentCount.value = comments.value.length;
      
      
      commentText.value = '';
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      isSubmittingComment.value = false;
    }
  });
  
  return (
    <div class="announcement-item">
      <div class="announcement-header">
        <h3>{announcement.title}</h3>
        <span class="date">{formatDate(ensureString(announcement.createdAt))}</span>
      </div>
      <div class="announcement-content">{announcement.content}</div>
      <div class="announcement-footer">
        <div class="author">Posted by: {teacherName || "Teacher"}</div>
        <button class="comments-toggle" onClick$={loadComments}>
          {showComments.value ? 'Skrýt komentáře' : 'Zobrazit komentáře'} 
          <span class="comment-count">({commentCount.value})</span>
        </button>
      </div>
      
      {/* Comments section */}
      {showComments.value && (
        <div class="comments-section">
          <h4>Komentáře</h4>
          
          {isLoadingComments.value ? (
            <div class="loading-comments">Načítání komentářů...</div>
          ) : (
            <>
              {comments.value.length > 0 ? (
                <div class="comments-list">
                  {comments.value.map((comment) => (
                    <div key={comment.id} class="comment-item">
                      <div class="comment-header">
                        <div class="comment-user">
                          <img src={comment.userAvatar || "/avatars/default.png"} alt={comment.userName} width={24} height={24} />
                          <span>{comment.userName}</span>
                        </div>
                        <span class="comment-date">{formatDate(ensureString(comment.createdAt))}</span>
                      </div>
                      <div class="comment-content">{comment.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div class="no-comments">Zatím žádné komentáře.</div>
              )}
              
              {/* Add comment form */}
              <div class="add-comment-form">
                <textarea
                  placeholder="Napište komentář..."
                  value={commentText.value}
                  onInput$={(e) => commentText.value = (e.target as HTMLTextAreaElement).value}
                  rows={2}
                ></textarea>
                <button 
                  onClick$={submitComment} 
                  disabled={isSubmittingComment.value || !commentText.value.trim()}
                  class="comment-submit-btn"
                >
                  {isSubmittingComment.value ? 'Odesílání...' : 'Odeslat'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});