import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PlaceholderImage } from '../utils/imageUtils';
import VideoModal from './VideoModal';
import useTabState from '../hooks/useTabState';

const ViralShorts = ({ viralShortsData = {}, onImageClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useTabState('viral-shorts', 'viral-shorts'); // 'viral-shorts' or 'bollywood'
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Get data from API instead of mock data
  const viralShortsVideos = viralShortsData.viral_shorts || [];
  const bollywoodVideos = viralShortsData.bollywood || [];
  
  // Debug logging in useEffect to avoid re-render loops
  useEffect(() => {
    console.log('🎬 ViralShorts received data:', viralShortsData);
    console.log('🎬 viralShortsVideos:', viralShortsVideos.length, 'videos');
    console.log('🎬 bollywoodVideos:', bollywoodVideos.length, 'videos');
  }, [viralShortsData, viralShortsVideos.length, bollywoodVideos.length]);
  
  const currentData = activeTab === 'bollywood' ? bollywoodVideos : viralShortsVideos;
  const sliderRef = useRef(null);

  // Get YouTube thumbnail from video URL with fallback
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop';
    
    let videoId = null;
    
    // Handle different YouTube URL formats
    if (youtubeUrl.includes('youtube.com/watch?v=')) {
      videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    } else if (youtubeUrl.includes('youtube.com/shorts/')) {
      videoId = youtubeUrl.split('shorts/')[1]?.split('?')[0];
    } else if (youtubeUrl.includes('youtu.be/')) {
      videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    }
    
    // Use hqdefault which is more reliable for shorts (480x360)
    return videoId 
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop';
  };

  // Handle video click - open in modal for viral shorts
  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setIsVideoModalOpen(true);
  };

  const closeVideoModal = () => {
    setIsVideoModalOpen(false);
    setSelectedVideo(null);
  };

  const getCurrentData = () => {
    return currentData; // Return all data since we removed pagination
  };

  return (
    <div className="bg-white pt-1 pb-0">
      {/* Header Container with Normal Width */}
      <div className="max-w-5xl-plus mx-auto px-8">
        {/* Header with Tabs and More Button */}
        <div className={`${getSectionHeaderClasses().containerClass} border rounded-lg flex relative mb-1`}>
        <button
          onClick={() => setActiveTab('viral-shorts')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-l-lg ${
            activeTab === 'viral-shorts'
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}`
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.viral_shorts', 'Viral Shorts')}
        </button>
        <button
          onClick={() => setActiveTab('bollywood')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-r-lg ${
            activeTab === 'bollywood'
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}`
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.bollywood', 'Bollywood')}
        </button>
        <Link 
          to={`/${activeTab === 'bollywood' ? 'bollywood' : 'viral-shorts'}`} 
          className={`absolute top-1/2 transform -translate-y-1/2 right-4 group flex items-center justify-center text-xs ${getSectionHeaderClasses().moreButtonClass} transition-colors duration-200`}
        >
          <svg 
            className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </Link>
      </div>

      {/* Viral Shorts Grid - Vertical like YouTube Shorts */}
      <div className="bg-white pl-0 pr-3 py-0 -mb-2">
        {/* Multiple Videos Grid Container - Vertical Layout */}
        <div 
          className="overflow-x-auto"
          ref={sliderRef}
        >
          <div className={`flex space-x-3 pt-1 pb-0 scrollbar-hide`}>
            {getCurrentData().map((item, index) => (
              <div
                key={item.id}
                className="flex-shrink-0 cursor-pointer"
                style={{ minWidth: '135px' }}
                onClick={() => handleVideoClick(item)}
              >
                <div className="rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group">
                  <div className="relative" style={{ width: '135px', height: '240px', overflow: 'hidden' }}>
                    {/* YouTube Shorts vertical aspect ratio (9:16) */}
                    <img
                      src={item.youtube_url ? getYouTubeThumbnail(item.youtube_url) : (item.image_url || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop')}
                      alt={item.title}
                      className="group-hover:scale-105 transition-transform duration-300"
                      style={{ 
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block'
                      }}
                      onError={(e) => {
                        // Fallback to placeholder if thumbnail fails
                        e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop';
                      }}
                    />
                    
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-70 transition-opacity duration-300">
                      <svg className="w-12 h-12 text-black" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                    
                    {/* Title overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-2 border-t border-gray-700">
                      <p className="text-white text-[10px] font-medium line-clamp-2 text-center leading-tight">
                        {item.title}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Custom Scrollbar Styles */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={closeVideoModal}
        video={selectedVideo}
      />
    </div>
  );
};

export default ViralShorts;