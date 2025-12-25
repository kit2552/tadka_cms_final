import React, { useState } from 'react';
import VideoModal from './VideoModal';

const EventVideosModal = ({ isOpen, onClose, event }) => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  if (!isOpen || !event) return null;

  const videos = event.all_videos || [];
  const eventName = event.event_name || event.title;

  // Get YouTube thumbnail from video URL
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return null;
    
    let videoId = null;
    if (youtubeUrl.includes('youtube.com/watch?v=')) {
      videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    } else if (youtubeUrl.includes('youtube.com/shorts/')) {
      videoId = youtubeUrl.split('shorts/')[1]?.split('?')[0];
    } else if (youtubeUrl.includes('youtu.be/')) {
      videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    } else if (youtubeUrl.includes('youtube.com/embed/')) {
      videoId = youtubeUrl.split('embed/')[1]?.split('?')[0];
    }
    
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  const handleVideoClick = (video) => {
    setSelectedVideo({
      id: video.id,
      title: video.title,
      youtube_url: video.youtube_url
    });
    setVideoModalOpen(true);
  };

  const handleVideoModalClose = () => {
    setVideoModalOpen(false);
    setSelectedVideo(null);
  };

  return (
    <>
      {/* Event Videos List Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={onClose}>
        <div 
          className="relative mx-auto rounded-lg overflow-hidden bg-gray-900" 
          style={{ width: '95vw', maxWidth: '900px', maxHeight: '90vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Header */}
          <div className="bg-black text-white px-6 py-2 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-semibold">{eventName}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Videos Grid */}
          <div 
            className="overflow-y-auto px-6 pt-2 pb-4 bg-black"
            style={{ maxHeight: 'calc(90vh - 80px)' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videos.map((video, index) => (
                <div
                  key={video.id || index}
                  className="bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-800 transition-all duration-200 group"
                  onClick={() => handleVideoClick(video)}
                >
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <img
                      src={getYouTubeThumbnail(video.youtube_url) || video.image || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop'}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop';
                      }}
                    />
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-12 h-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-900">
                    <h3 className="text-white text-xs font-semibold line-clamp-2 leading-snug">
                      {video.title}
                    </h3>
                    {video.channel_name && (
                      <p className="text-gray-400 text-xs mt-1">{video.channel_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-black px-6 py-2">
          </div>

        </div>
      </div>

      {/* Video Player Modal */}
      {videoModalOpen && selectedVideo && (
        <VideoModal
          isOpen={videoModalOpen}
          onClose={handleVideoModalClose}
          video={selectedVideo}
        />
      )}
    </>
  );
};

export default EventVideosModal;

