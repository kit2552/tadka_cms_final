import useTabState from '../hooks/useTabState';
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const OTTMovieReviews = ({ ottMovieReviewsData = {}, onImageClick, onArticleClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useTabState('ott-movie-reviews', 'general'); // 'general' or 'webseries'
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  // Extract data from props or use fallback sample data
  const ottMovieReviews = ottMovieReviewsData.ott_movie_reviews || [];
  const webSeriesReviews = ottMovieReviewsData.web_series || [];

  // Get YouTube thumbnail from video URL
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return null;
    
    const videoId = youtubeUrl.includes('youtube.com/watch?v=') 
      ? youtubeUrl.split('v=')[1]?.split('&')[0]
      : youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  };

  // Handle article click - navigate to article page
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else {
      // Direct navigation fallback
      const slug = article.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      navigate(`/article/${article.id}/${slug}`);
    }
  };
  
  const itemsPerSlide = 5; // Match Movie Reviews section
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
            {getDisplayData().map((item, index) => {
              const rating = parseFloat(item.movie_rating || getRandomRating(currentIndex + index));
              const formattedRating = rating % 1 === 0 ? rating.toFixed(0) : rating.toString();
              const fullStars = Math.floor(rating);
              const hasHalfStar = rating % 1 >= 0.5;
              
              return (
                <div
                  key={item.id}
                  className="flex-shrink-0"
                  style={{ minWidth: '266px' }}
                >
                  <div className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all duration-300 group cursor-pointer"
                       onClick={() => handleArticleClick(item)}>
                    <div className="relative">
                      <img
                        src={getYouTubeThumbnail(item.youtube_url) || item.image_url || item.image || 'https://images.unsplash.com/photo-1574267432644-f610cab6adc4?w=800&h=600&fit=crop'}
                        alt={item.title || item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        style={{ width: '266px', height: '160px' }}
                        onError={(e) => {
                          e.target.src = item.image_url || 'https://images.unsplash.com/photo-1574267432644-f610cab6adc4?w=800&h=600&fit=crop';
                        }}
                      />
                      
                      {/* Rating Display - Centered at Top with Black Square Background */}
                      <div className="absolute top-3 left-1/2 transform -translate-x-1/2 flex flex-col items-center justify-center px-3 py-2 bg-black/60 rounded">
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl font-bold text-white leading-none">{formattedRating}</span>
                          <span className="text-sm text-gray-300">/5</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-3 h-3 ${i < fullStars ? 'text-yellow-400' : (i === fullStars && hasHalfStar ? 'text-yellow-400' : 'text-gray-400')}`}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      
                      {/* Title Overlay with Black Transparent Banner */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                        <h3 className="text-white font-bold text-xs text-center leading-tight">
                          {(item.title || item.name).replace(' Review', '')}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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