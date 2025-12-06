import React, { useState } from 'react';

const CommentModal = ({ isOpen, onClose, onSubmit, commentType = 'regular' }) => {
  const [formData, setFormData] = useState({
    name: '',
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!formData.comment.trim()) {
      setError('Please enter your comment');
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        comment: formData.comment.trim(),
        comment_type: commentType
      });
      setFormData({ name: '', comment: '' });
      setError('');
      onClose();
    } catch (err) {
      console.error('Modal error:', err);
      setError(err.message || 'Failed to submit comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full flex flex-col max-h-[90vh]">
        {/* Sticky Header - Compact */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600 flex-shrink-0 bg-gray-700">
          <h3 className="text-base font-semibold text-white text-left">
            {commentType === 'review' ? 'Add Movie Review Comment' : 'Add Comment'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto px-4 py-4 flex-1">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 text-left">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                Your Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 text-left"
                disabled={loading}
                maxLength={100}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                Your Comment *
              </label>
              <textarea
                name="comment"
                value={formData.comment}
                onChange={handleChange}
                placeholder="Write your comment here..."
                rows="5"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 text-left"
                disabled={loading}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1 text-left">
                {formData.comment.length}/1000 characters
              </p>
            </div>
          </div>

          {/* Sticky Footer - Compact */}
          <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-gray-400 text-white rounded-md text-sm font-medium hover:bg-gray-500 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommentModal;
