import React, { useState, useEffect } from 'react';
import CommentModal from './CommentModal';

const CommentSection = ({ articleId, commentType = 'regular', headerTitle = 'Comments' }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [articleId, commentType]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/articles/${articleId}/comments?comment_type=${commentType}`
      );
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (commentData) => {
    try {
      setSubmitting(true);
      const payload = {
        article_id: String(articleId),
        name: commentData.name,
        comment: commentData.comment,
        comment_type: commentData.comment_type
      };
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/articles/${articleId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
      } else {
        const errorData = await response.text();
        console.error('Error response:', errorData);
        throw new Error(`Failed to submit comment: ${response.status}`);
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    const formattedDate = date.toLocaleString('en-US', options);
    const timezoneName = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();
    
    return `${formattedDate} ${timezoneName}`;
  };

  return (
    <div>
      {/* Sticky Header with Add Comment Button */}
      <div className={`sticky top-0 z-30 border-b-2 border-gray-300 mb-4`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
        <div className="pl-0 pr-4 py-4 flex items-center justify-between gap-2">
          <div className="flex-1">
            <h2 className="text-base font-bold text-black text-left leading-tight mb-1">
              {headerTitle}
            </h2>
            <p className="text-xs text-gray-900 opacity-75 text-left">
              Share your thoughts (no account required)
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 h-[22px] flex items-center bg-gray-700 text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Add Comment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2 text-sm">Loading...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <svg
            className="w-10 h-10 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-gray-600 text-sm">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-left"
            >
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 text-sm">{comment.name}</h4>
                <p className="text-[10px] text-gray-500 text-right">
                  {formatDate(comment.created_at)}
                </p>
              </div>
              <p className="text-gray-700 text-sm whitespace-pre-wrap text-left">{comment.comment}</p>
            </div>
          ))}
        </div>
      )}

      <CommentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddComment}
        commentType={commentType}
      />
    </div>
  );
};

export default CommentSection;
