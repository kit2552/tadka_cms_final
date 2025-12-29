import useTabState from '../hooks/useTabState';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import dataService from '../services/dataService';
import { CirclePlay } from 'lucide-react';
import EventVideosModal from './EventVideosModal';

const EventsInterviews = ({ 
  eventsInterviewsData = {}, 
  firstTabLabel = 'Filmy Focus Today',
  secondTabLabel = 'Bollywood',
  firstTabKey = 'events',
  secondTabKey = 'bollywood'
}) => {
  const { t } = useLanguage();
  const { theme, getSectionHeaderClasses } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useTabState('events-interviews', firstTabKey);
  const scrollContainerRef = useRef(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  
  // Get data from API instead of mock data
  const eventsVideos = eventsInterviewsData.events_interviews || eventsInterviewsData.tv_today || eventsInterviewsData.news_today || [];
  const bollywoodVideos = eventsInterviewsData.bollywood || eventsInterviewsData.hindi || [];
  
  const currentData = activeTab === secondTabKey ? bollywoodVideos : eventsVideos;

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

  // Handle article click - open event modal if multiple videos, otherwise play directly
  const handleVideoClick = (article) => {
    const videoCount = article.video_count || 1;
    
    if (videoCount > 1) {
      // Multiple videos - open event modal
      setSelectedEvent(article);
      setEventModalOpen(true);
    } else {
      // Single video - navigate directly to video view
      if (article.content_type === 'video' || article.youtube_url) {
        navigate(`/video/${article.id}`);
      } else {
        navigate(`/article/${article.id}`);
      }
    }
  };

  const handleEventModalClose = () => {
    setEventModalOpen(false);
    setSelectedEvent(null);
  };

  const getCurrentData = () => {
    return currentData; // Return all data since we removed pagination
  };

  return (
    <div className="bg-white pt-1 pb-0">
      {/* Header Container with Normal Width */}
      <div className="max-w-5xl-plus mx-auto px-8">
        {/* Header with tabs matching TrendingVideos style */}
        <div className={`${getSectionHeaderClasses().containerClass} border rounded-lg flex relative mb-1`}>
          <button
            onClick={() => setActiveTab(firstTabKey)}
            className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-l-lg ${
              activeTab === firstTabKey 
                ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}` 
                : getSectionHeaderClasses().unselectedTabClass
            }`}
            style={{fontSize: '14px', fontWeight: '500'}}
          >
            {firstTabLabel}
          </button>
          <button
            onClick={() => setActiveTab(secondTabKey)}
            className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-r-lg ${
              activeTab === secondTabKey
                ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}`
                : getSectionHeaderClasses().unselectedTabClass
            }`}
            style={{fontSize: '14px', fontWeight: '500'}}
          >
            {secondTabLabel}
          </button>
          <Link 
            to="/events-interviews" 
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
        
        {/* Multiple Videos Horizontal Scroll Container - Same as TrendingVideos */}
        <div 
          className="relative overflow-x-auto"
          ref={scrollContainerRef}
        >
          <div className="flex space-x-3 pt-1 pb-0 scrollbar-hide">
            {getCurrentData().map((item, index) => (
              <div
                key={item.id}
                className="flex-shrink-0 cursor-pointer"
                style={{ width: '240px' }}
                onClick={() => handleVideoClick(item)}
              >
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 group relative">
                  <div className="relative">
                    <img
                      src={item.youtube_url ? getYouTubeThumbnail(item.youtube_url) : (item.image_url || item.image || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop')}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      style={{ width: '240px', height: '135px' }}
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop';
                      }}
                    />
                    {/* Video count badge - show if more than 1 video */}
                    {item.video_count && item.video_count > 1 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-80 text-white px-2 py-1 rounded text-xs font-bold">
                        {item.video_count} videos
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-left" style={{ width: '240px' }}>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="2" fill="none"/>
                        <path d="M10 8l6 4-6 4V8z" fill="#000000"/>
                      </svg>
                      <h3 style={{fontSize: '13px', fontWeight: '600', lineHeight: '1.4', wordWrap: 'break-word'}} className="text-gray-900 hover:text-gray-700 transition-colors duration-300">
                        {item.event_name || item.title}
                      </h3>
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

      {/* Event Videos Modal */}
      <EventVideosModal
        isOpen={eventModalOpen}
        onClose={handleEventModalClose}
        event={selectedEvent}
      />
    </div>
  );
};

export default EventsInterviews;