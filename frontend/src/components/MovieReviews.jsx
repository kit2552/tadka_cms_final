import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import ArticleImage from './ArticleImage';
import useTabState from '../hooks/useTabState';

const MovieReviews = ({ movieReviewsData = {}, onImageClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useTabState('movie-reviews', 'general'); // 'general' or 'bollywood'
  const sliderRef = useRef(null);

  // Extract data from props - backend handles all date filtering based on EST timezone
  const movieReviews = movieReviewsData.movie_reviews || [];
  const bollywoodReviews = movieReviewsData.bollywood || [];

  // Get YouTube thumbnail URL from video URL
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return null;
    
    try {
      // Extract video ID from various YouTube URL formats
      let videoId = null;
      
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
      } else if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
      } else if (youtubeUrl.includes('youtube.com/embed/')) {
        videoId = youtubeUrl.split('embed/')[1]?.split('?')[0];
      }
      
      if (videoId) {
        // Use high quality thumbnail (maxresdefault for best quality, mqdefault as fallback)
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } catch (error) {
      console.error('Error extracting YouTube thumbnail:', error);
    }
    
    return null;
  };
  
  const itemsPerSlide = 6; // Show 6 items per slide
  const getCurrentData = () => {
    if (activeTab === 'bollywood') {
      return bollywoodReviews;
    } else {
      return movieReviews;
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

  // Get movie rating from article or return default
  const getMovieRating = (item) => {
    return item.movie_rating || '3.5';
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

  const handleArticleClick = (item) => {
    if (onImageClick) {
      onImageClick(item);
    }
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
            {t('sections.movie_reviews', 'Movie Reviews')}
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
            to="/movie-reviews" 
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
          {currentData.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <p className="text-sm">No movie reviews available at the moment.</p>
            </div>
          ) : (
            <div className="flex space-x-3 pb-2 scrollbar-hide">
              {getDisplayData().map((item, index) => {
                const rating = parseFloat(item.movie_rating || getMovieRating(item));
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
                        {item.youtube_url && getYouTubeThumbnail(item.youtube_url) ? (
                          <img
                            src={getYouTubeThumbnail(item.youtube_url)}
                            alt={item.title || item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ width: '266px', height: '160px' }}
                          />
                        ) : (
                          <ArticleImage
                            src={item.image_url || item.image}
                            alt={item.title || item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ width: '266px', height: '160px' }}
                            contentType={activeTab === 'bollywood' ? 'movie-reviews-bollywood' : 'movie-reviews'}
                          />
                        )}
                        
                        {/* Rating Display - Compact Top Right */}
                        <div className="absolute top-2 right-2 flex flex-col items-center justify-center px-2 py-1.5 bg-black/70 rounded">
                          <div className="flex items-baseline gap-0.5 mb-0.5">
                            <span className="text-xl font-bold text-white leading-none">{formattedRating}</span>
                            <span className="text-[10px] text-gray-300">/5</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-2 h-2 ${i < fullStars ? 'text-yellow-400' : (i === fullStars && hasHalfStar ? 'text-yellow-400' : 'text-gray-400')}`}
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
                            {(item.title || item.name).replace(' Movie Review', '')}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
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

export default MovieReviews;