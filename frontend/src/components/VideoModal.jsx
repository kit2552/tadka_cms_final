import React, { useState, useEffect } from 'react';

const VideoModal = ({ isOpen, onClose, video }) => {
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nameDisabled, setNameDisabled] = useState(false);
  const [planningToWatch, setPlanningToWatch] = useState(null); // 'yes' or 'no'
  const [watchCount, setWatchCount] = useState(0);

  // Fetch comments and watch count when modal opens
  useEffect(() => {
    if (isOpen && video && video.id) {
      fetchComments();
      fetchUserName();
      fetchWatchCount();
    }
  }, [isOpen, video]);

  const fetchUserName = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/videos/${video.id}/user-name`);
      const data = await response.json();
      
      if (data.has_commented && data.name) {
        setCommentName(data.name);
        setNameDisabled(true);
      } else {
        setCommentName('');
        setNameDisabled(false);
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
      setNameDisabled(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/videos/${video.id}/comments`);
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    }
  };

  const handleAddComment = async () => {
    if (commentName.trim() && commentText.trim()) {
      setLoading(true);
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/videos/${video.id}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            video_id: video.id,
            name: commentName.trim(),
            comment: commentText.trim()
          })
        });

        const data = await response.json();
        
        if (data.success) {
          // Add new comment to the list
          setComments([data.comment, ...comments]);
          setCommentName('');
          setCommentText('');
          setShowAddComment(false);
        } else {
          alert('Failed to add comment. Please try again.');
        }
      } catch (error) {
        console.error('Error adding comment:', error);
        alert('Failed to add comment. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen || !video) return null;

  // Extract YouTube video ID and create embed URL
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return '';
    
    let videoId = null;
    
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1]?.split('&')[0];
    } else if (url.includes('youtube.com/shorts/')) {
      videoId = url.split('shorts/')[1]?.split('?')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    }
    
    if (!videoId) return '';
    
    // Add loop=1 parameter to make video loop automatically
    return `https://www.youtube.com/embed/${videoId}?controls=1&rel=0&showinfo=0&autoplay=1&loop=1&playlist=${videoId}`;
  };

  // Handle fullscreen
  const handleFullscreen = () => {
    const iframe = document.querySelector('.viral-shorts-iframe');
    if (iframe) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
      } else if (iframe.mozRequestFullScreen) {
        iframe.mozRequestFullScreen();
      } else if (iframe.msRequestFullscreen) {
        iframe.msRequestFullscreen();
      }
    }
  };

  const handleShare = (platform) => {
    const url = window.location.origin + `/video/${video.id}`;
    const title = video.title;
    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' - ' + url)}`;
        break;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="relative mx-auto rounded-lg overflow-hidden" style={{ width: '95vw', maxWidth: '1100px', maxHeight: '90vh' }}>
        
        {/* Black Header with Close Button */}
        <div className="bg-black text-white px-4 py-2 flex justify-end items-center">
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Video Container - 16:9 aspect ratio for horizontal video */}
        <div className="relative bg-black" style={{ width: '100%', paddingBottom: '56.25%' }}>
          <iframe
            src={getYouTubeEmbedUrl(video.youtube_url)}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ 
              backgroundColor: '#000000'
            }}
          />
        </div>

        {/* Black Footer with Comment Buttons */}
        <div className="bg-black text-white px-4 pt-3 pb-3 flex justify-center items-center space-x-6">
          <button
            onClick={() => setShowAddComment(true)}
            className="px-2.5 py-1 bg-black hover:bg-gray-800 text-white text-[10px] rounded-md transition-colors border border-gray-600"
          >
            Add Comment
          </button>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowComments(!showComments)}
              className="px-2.5 py-1 bg-black hover:bg-gray-800 text-white text-[10px] rounded-md transition-colors border border-gray-600"
            >
              View Comments
            </button>
            <span className="text-white text-[10px]">({comments.length})</span>
          </div>
        </div>

        {/* Comments Slider - slides up from bottom */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 transition-all duration-300 ease-in-out ${
            showComments ? 'h-1/2' : 'h-0'
          }`}
          style={{ zIndex: 10, overflow: 'hidden', pointerEvents: showComments ? 'auto' : 'none' }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center px-3 py-2 border-b border-gray-600 flex-shrink-0">
              <h3 className="text-white font-semibold text-xs">Comments ({comments.length})</h3>
              <button
                onClick={() => setShowComments(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div 
              className="flex-1 overflow-y-scroll px-3 py-2 space-y-2"
              style={{ 
                overflowY: 'scroll',
                WebkitOverflowScrolling: 'touch',
                maxHeight: 'calc(50vh - 40px)'
              }}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {comments.map(comment => (
                <div key={comment.id} className="bg-gray-900 bg-opacity-50 rounded-lg p-2 text-left">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-white font-semibold text-xs">{comment.name}</span>
                    <span className="text-gray-400 text-[10px]">{comment.time}</span>
                  </div>
                  <p className="text-gray-300 text-xs text-left">{comment.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add Comment Popup - slides up from bottom */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 transition-all duration-300 ease-in-out ${
            showAddComment ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ zIndex: 20 }}
        >
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-xs">Add Comment</h3>
              <button
                onClick={() => {
                  setShowAddComment(false);
                  if (!nameDisabled) {
                    setCommentName('');
                  }
                  setCommentText('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Your Name"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                disabled={nameDisabled}
                className="w-full px-2 py-1.5 bg-gray-800 bg-opacity-100 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:border-blue-500 placeholder:text-gray-500 placeholder:text-xs disabled:opacity-70 disabled:cursor-not-allowed"
              />
              <textarea
                placeholder="Your Comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows="2"
                className="w-full px-2 py-1.5 bg-gray-800 bg-opacity-100 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:border-blue-500 placeholder:text-gray-500 placeholder:text-xs resize-none"
              />
              <button
                onClick={handleAddComment}
                disabled={loading}
                className="px-3 py-1 bg-black bg-opacity-100 hover:bg-gray-800 text-white text-xs rounded-md transition-colors border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VideoModal;