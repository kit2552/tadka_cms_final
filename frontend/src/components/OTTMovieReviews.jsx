import useTabState from '../hooks/useTabState';
import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const OTTMovieReviews = ({ ottMovieReviewsData = {}, onImageClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useTabState('ott-movie-reviews', 'general'); // 'general' or 'webseries'
  const sliderRef = useRef(null);

  // Extract data from props or use fallback sample data
  const ottMovieReviews = ottMovieReviewsData.ott_movie_reviews || [];
  const webSeriesReviews = ottMovieReviewsData.web_series || [];
  
  const itemsPerSlide = 6; // Increased from 5 to 6 for more items
  const getCurrentData = () => {
    if (activeTab === 'webseries') {
      return webSeriesReviews;
    } else {
      return ottMovieReviews;
    }
  };
  
  const currentData = getCurrentData();
  const maxIndex = Math.max(0, currentData.length - itemsPerSlide);

  // Touch/swipe functionality
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextSlide();
    }
    if (isRightSwipe) {
      prevSlide();
    }
  };

  // Generate random rating for each movie (between 1.0 and 5.0)
  const getRandomRating = (index) => {
    // Use index to ensure consistent ratings for each movie
    const ratings = [4.2, 3.8, 4.5, 2.9, 3.6, 4.1, 3.3, 4.7, 2.5, 3.9, 4.0, 3.2, 4.4, 2.8, 3.7];
    return ratings[index % ratings.length];
  };

  const nextSlide = () => {
    setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
  };

  const getDisplayData = () => {
    const data = getCurrentData();
    return data.slice(currentIndex, currentIndex + itemsPerSlide);
  };

  return (
    <div className="bg-white pt-0 pb-2 -mt-[10px] -mb-[18px]">
      {/* Header Container with Normal Width */}
      <div className="max-w-5xl-plus mx-auto px-8">
        {/* Header with tabs matching BoxOffice style */}
        <div className={`${getSectionHeaderClasses().containerClass} border rounded-lg flex relative mb-3`}>
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-l-lg ${
              activeTab === 'general' 
                ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}` 
                : getSectionHeaderClasses().unselectedTabClass
            }`}
            style={{fontSize: '14px', fontWeight: '500'}}
          >
            {t('sections.ott_reviews', 'OTT Reviews')}
          </button>
          <button
            onClick={() => setActiveTab('webseries')}
            className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-r-lg ${
              activeTab === 'webseries'
                ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}`
                : getSectionHeaderClasses().unselectedTabClass
            }`}
            style={{fontSize: '14px', fontWeight: '500'}}
          >
            {t('sections.bollywood_reviews', 'Bollywood')}
          </button>
          <Link 
            to="/ott-reviews" 
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
        
        {/* Multiple Videos Horizontal Scroll Container - Matching TrendingVideos Structure */}
        <div 
          className="relative overflow-x-auto"
          ref={sliderRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex space-x-3 pb-2 scrollbar-hide">
            {getDisplayData().map((item, index) => (
              <div
                key={item.id}
                className="flex-shrink-0 cursor-pointer"
                style={{ minWidth: '200px' }} // Reverted back to original 200px
                onClick={() => onImageClick(item, 'ott_review')}
              >
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all duration-300 group">
                  <div className="relative">
                    <img
                      src={item.image_url || item.image || 'https://images.unsplash.com/photo-1574267432644-f610cab6adc4?w=800&h=600&fit=crop'}
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      style={{ width: '200px', height: '120px' }} // Reverted back to original dimensions
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1574267432644-f610cab6adc4?w=800&h=600&fit=crop';
                      }}
                    />
                    
                    {/* Rating Badge - Yellow Square Background */}
                    <div className="absolute top-2 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded shadow-lg">
                      {getRandomRating(currentIndex + index)}
                    </div>
                    
                    {/* Title Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                      <h3 className="text-white font-bold text-xs text-center leading-tight">
                        {item.title || item.name}
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Navigation Arrows */}
          {maxIndex > 0 && (
            <>
              <button 
                onClick={prevSlide}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all duration-200 z-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button 
                onClick={nextSlide}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all duration-200 z-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
        
        {/* Custom Scrollbar Styles */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default OTTMovieReviews;