import React, { useState, useEffect } from 'react';
import CommentModal from './CommentModal';

const CommentSection = ({ articleId, commentType = 'regular' }) => {
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
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/articles/${articleId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            article_id: articleId,
            name: commentData.name,
            comment: commentData.comment,
            comment_type: commentData.comment_type
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
      } else {
        throw new Error('Failed to submit comment');
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
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors w-full"
        >
          Add Comment
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading comments...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <svg
            className="w-12 h-12 text-gray-400 mx-auto mb-2"
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
          <p className="text-gray-600">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{comment.name}</h4>
                  <p className="text-xs text-gray-500">
                    {formatDate(comment.created_at)}
                  </p>
                </div>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
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
