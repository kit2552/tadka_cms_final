import React, { useState } from 'react';

const VideoModal = ({ isOpen, onClose, video }) => {
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([
    { id: 1, name: 'John Doe', text: 'Great video!', time: '2 hours ago' },
    { id: 2, name: 'Jane Smith', text: 'Love this content', time: '5 hours ago' },
    { id: 3, name: 'Mike Johnson', text: 'Amazing!', time: '1 day ago' }
  ]);

  if (!isOpen || !video) return null;

  const handleAddComment = () => {
    if (commentName.trim() && commentText.trim()) {
      const newComment = {
        id: comments.length + 1,
        name: commentName,
        text: commentText,
        time: 'Just now'
      };
      setComments([newComment, ...comments]);
      setCommentName('');
      setCommentText('');
      setShowAddComment(false);
    }
  };

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
      <div className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden" style={{ height: '90vh' }}>
        
        {/* Black Header with Fullscreen and Close Button */}
        <div className="bg-black text-white px-3 py-2.5 flex justify-between items-center">
          <button
            onClick={handleFullscreen}
            className="text-white hover:text-gray-300 transition-colors"
            title="Fullscreen"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Video Container - Takes remaining height, full width */}
        <div className="relative bg-black flex-1" style={{ height: 'calc(90vh - 96px)' }}>
          <iframe
            src={getYouTubeEmbedUrl(video.youtube_url)}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            className="w-full h-full viral-shorts-iframe"
            style={{ 
              backgroundColor: '#000000'
            }}
          />
        </div>

        {/* Black Footer with Comment Buttons */}
        <div className="bg-black text-white px-3 py-3 flex justify-center items-start space-x-4">
          <div className="flex flex-col items-center">
            <button
              onClick={() => setShowAddComment(true)}
              className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs rounded-md transition-colors border border-gray-600"
            >
              Add Comment
            </button>
            <span className="text-gray-400 text-[10px] mt-0.5">(no account needed)</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowComments(!showComments)}
              className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white text-xs rounded-md transition-colors border border-gray-600"
            >
              View Comments
            </button>
            <span className="text-white text-xs">({comments.length})</span>
          </div>
        </div>

        {/* Comments Slider - slides up from bottom */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 transition-all duration-300 ease-in-out overflow-hidden ${
            showComments ? 'h-1/2' : 'h-0'
          }`}
          style={{ zIndex: 10 }}
        >
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center px-3 py-2 border-b border-gray-600">
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
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
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
          className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 transition-all duration-300 ease-in-out ${
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
                  setCommentName('');
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
                className="w-full px-2 py-1.5 bg-gray-800 bg-opacity-100 text-white text-xs rounded-md border border-gray-600 focus:outline-none focus:border-blue-500 placeholder:text-gray-500 placeholder:text-xs"
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
                className="px-3 py-1 bg-black bg-opacity-100 hover:bg-gray-800 text-white text-xs rounded-md transition-colors border border-gray-600"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VideoModal;