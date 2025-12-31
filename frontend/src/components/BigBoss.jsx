import useTabState from '../hooks/useTabState';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CirclePlay } from 'lucide-react';
import EventVideosModal from './EventVideosModal';
import dataService from '../services/dataService';

const BigBoss = ({ bigBossData = {} }) => {
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

  // Handle article click - navigate based on content type
  const handleVideoClick = (article) => {
    // Navigate to video view page for video content type articles
    if (article.content_type === 'video' || article.youtube_url) {
      navigate(`/video/${article.id}`);
    } else {
      // Navigate to regular article page for non-video articles
      navigate(`/article/${article.id}`);
    }
  };

  const getCurrentData = () => {
    return currentData; // Return all data since we removed pagination
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
        {getCurrentData().map((item, index) => (
          <div
            key={item.id}
            className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
            onClick={() => handleVideoClick(item)}
          >
            <div className="relative">
              <img
                src={item.youtube_url ? getYouTubeThumbnail(item.youtube_url) : (item.image_url || item.image || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop')}
                alt={item.title}
                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=300&fit=crop';
                }}
              />
            </div>
            <div className="p-3 text-left">
              <h2 style={{fontSize: '14px', fontWeight: '600'}} className="text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-300">
                {item.title}
              </h2>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default BigBoss;