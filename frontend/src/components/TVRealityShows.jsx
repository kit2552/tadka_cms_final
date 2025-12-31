import useTabState from '../hooks/useTabState';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CirclePlay } from 'lucide-react';
import EventVideosModal from './EventVideosModal';
import dataService from '../services/dataService';

const TVRealityShows = ({ bigBossData = {} }) => {
  const { t } = useLanguage();
  const { theme, getSectionHeaderClasses } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useTabState('big-boss', 'big-boss');
  const scrollContainerRef = useRef(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showModalOpen, setShowModalOpen] = useState(false);
  
  // Get data from API - now expects grouped format
  const bigBossVideos = bigBossData.big_boss || [];
  const bollywoodVideos = bigBossData.bollywood || [];
  
  const currentData = activeTab === 'bollywood' ? bollywoodVideos : bigBossVideos;

  // Get YouTube thumbnail from video URL
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop';
    
    const videoId = youtubeUrl.includes('youtube.com/watch?v=') 
      ? youtubeUrl.split('v=')[1]?.split('&')[0]
      : youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    
    return videoId 
      ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      : 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop';
  };

  // Handle show click - open modal if multiple videos, otherwise navigate directly
  const handleShowClick = (show) => {
    const videoCount = show.video_count || 1;
    
    if (videoCount > 1) {
      // Multiple videos - open modal
      setSelectedShow(show);
      setShowModalOpen(true);
    } else {
      // Single video - navigate directly
      const article = show.all_videos?.[0] || show;
      if (article.content_type === 'video' || article.youtube_url) {
        navigate(`/video/${article.id}`);
      } else {
        navigate(`/article/${article.id}`);
      }
    }
  };

  const getCurrentData = () => {
    return currentData;
  };

  return (
    <div className="max-w-5xl-plus mx-auto px-8 pt-0 pb-2 -mb-5">
      {/* Header with tabs matching TopStories style */}
      <div className={`${getSectionHeaderClasses().containerClass} border rounded-lg flex relative mb-1`}>
        <Link 
          to="/tv-reality-shows" 
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
        <button
          onClick={() => setActiveTab('big-boss')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-l-lg ${
            activeTab === 'big-boss' 
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}` 
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.tv_reality_shows', 'TV Reality Shows')}
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
          {t('sections.hindi', 'Hindi')}
        </button>
      </div>
      
      {/* Grid Layout - Same as TopStories */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
        {getCurrentData().map((show, index) => {
          const showName = show.event_name || show.title;
          const videoCount = show.video_count || 1;
          const firstVideo = show.all_videos?.[0] || show;
          const youtubeThumbnail = firstVideo.youtube_url ? getYouTubeThumbnail(firstVideo.youtube_url) : (firstVideo.image_url || firstVideo.image);
          const channelName = show.channel_name || 'TV Show';
          
          return (
            <div
              key={show.id || index}
              className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
              onClick={() => handleShowClick(show)}
            >
              <div className="relative">
                <img
                  src={youtubeThumbnail || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop'}
                  alt={showName}
                  className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop';
                  }}
                />
                
                {/* Channel Name Label */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                  {channelName}
                </div>
                
                {/* Video Count Badge */}
                {videoCount > 1 && (
                  <div className="absolute bottom-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                    <CirclePlay size={14} />
                    <span>{videoCount}</span>
                  </div>
                )}
                
                {/* Play icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-20">
                  <CirclePlay size={40} className="text-white drop-shadow-lg" />
                </div>
              </div>
              <div className="p-3 text-left">
                <h2 style={{fontSize: '14px', fontWeight: '600'}} className="text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-300 line-clamp-2">
                  {showName}
                </h2>
                {videoCount > 1 && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    {videoCount} Episodes
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Videos Modal */}
      {showModalOpen && selectedShow && (
        <EventVideosModal
          event={selectedShow}
          isOpen={showModalOpen}
          onClose={() => {
            setShowModalOpen(false);
            setSelectedShow(null);
          }}
        />
      )}

    </div>
  );
};

export default TVRealityShows;