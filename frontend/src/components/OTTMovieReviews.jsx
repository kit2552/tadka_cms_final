import useTabState from '../hooks/useTabState';
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const OTTMovieReviews = ({ ottMovieReviewsData = {}, onImageClick, onArticleClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useTabState('ott-movie-reviews', 'general'); // 'general' or 'bollywood'
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  // Extract data from props
  // ott_reviews = state-language specific OTT reviews
  // bollywood = Hindi + English OTT reviews
  const ottReviews = ottMovieReviewsData.ott_reviews || [];
  const bollywoodReviews = ottMovieReviewsData.bollywood || [];

  // Get YouTube thumbnail from video URL
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return null;
    
    try {
      let videoId = null;
      
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
      } else if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
      } else if (youtubeUrl.includes('youtube.com/embed/')) {
        videoId = youtubeUrl.split('embed/')[1]?.split('?')[0];
      }
      
      return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
    } catch (error) {
      console.error('Error extracting YouTube thumbnail:', error);
      return null;
    }
  };

  // Handle article click - navigate to article page
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else if (onImageClick) {
      onImageClick(article);
    } else {
      // Direct navigation fallback
      const slug = article.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      navigate(`/article/${article.id}/${slug}`);
    }
  };
  
  const itemsPerSlide = 5;
  const getCurrentData = () => {
    if (activeTab === 'bollywood') {
      return bollywoodReviews;
    } else {
      return ottReviews;
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

  // Get language display string (similar to OTT Releases)
  const getLanguageDisplay = (item) => {
    // In Bollywood tab, just show "Hindi/English"
    if (activeTab === 'bollywood') {
      return null; // Don't show language badge for Bollywood tab
    }
    
    // Parse languages
    let langs = [];
    if (item.languages) {
      if (Array.isArray(item.languages)) {
        langs = item.languages;
      } else if (typeof item.languages === 'string') {
        try {
          langs = JSON.parse(item.languages);
        } catch {
          langs = [item.languages];
        }
      }
    } else if (item.movie_language) {
      if (Array.isArray(item.movie_language)) {
        langs = item.movie_language;
      } else if (typeof item.movie_language === 'string') {
        try {
          langs = JSON.parse(item.movie_language);
        } catch {
          langs = [item.movie_language];
        }
      }
    }
    
    if (langs.length === 0) return null;
    
    const originalLang = item.original_language;
    
    // Get user's preferred language based on selected states
    const userStateNames = JSON.parse(localStorage.getItem('tadka_state') || '[]');
    const stateToLanguage = {
      'Andhra Pradesh': 'Telugu',
      'Telangana': 'Telugu',
      'Tamil Nadu': 'Tamil',
      'Karnataka': 'Kannada',
      'Kerala': 'Malayalam',
      'Maharashtra': 'Marathi',
      'West Bengal': 'Bengali',
      'Gujarat': 'Gujarati',
      'Punjab': 'Punjabi',
      'Odisha': 'Odia'
    };
    
    // Get user's preferred languages from their states
    const userPreferredLangs = [...new Set(userStateNames.map(state => stateToLanguage[state]).filter(Boolean))];
    
    // Find if user's preferred language exists in this item's languages
    const userLangInItem = userPreferredLangs.find(lang => langs.includes(lang));
    
    // If no original language info, just show primary language
    if (!originalLang) {
      return langs[0];
    }
    
    // If user has a preferred language in this release
    if (userLangInItem) {
      if (userLangInItem === originalLang) {
        // User's preferred language IS the original - just show language name
        return userLangInItem;
      } else {
        // User's preferred language is dubbed - show both
        return `${userLangInItem} (Dubbed)`;
      }
    }
    
    // No user preference match - show original language
    return `${originalLang}`;
  };

  // Get platform display
  const getPlatformDisplay = (item) => {
    let platforms = [];
    if (item.ott_platforms) {
      if (Array.isArray(item.ott_platforms)) {
        platforms = item.ott_platforms;
      } else if (typeof item.ott_platforms === 'string') {
        try {
          platforms = JSON.parse(item.ott_platforms);
        } catch {
          platforms = [item.ott_platforms];
        }
      }
    } else if (item.platform) {
      platforms = [item.platform];
    }
    
    return platforms.length > 0 ? platforms[0] : '';
  };

  return (
    <div className="bg-white pt-1 pb-0 -mb-2">
      {/* Header Container with Normal Width */}
      <div className="max-w-5xl-plus mx-auto px-8">
        {/* Header with tabs matching BoxOffice style */}
        <div className={`${getSectionHeaderClasses().containerClass} border rounded-lg flex relative mb-1`}>
          <button
            onClick={() => { setActiveTab('general'); setCurrentIndex(0); }}
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
            onClick={() => { setActiveTab('bollywood'); setCurrentIndex(0); }}
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
        
        {/* Multiple Videos Horizontal Scroll Container */}
        <div 
          className="relative overflow-x-auto"
          ref={sliderRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {currentData.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <p className="text-sm">No OTT reviews available at the moment.</p>
            </div>
          ) : (
            <div className="flex space-x-3 pt-1 pb-0 scrollbar-hide">
              {getDisplayData().map((item, index) => {
                const rating = parseFloat(item.movie_rating || '3.5');
                const formattedRating = rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1);
                const fullStars = Math.floor(rating);
                const hasHalfStar = rating % 1 >= 0.5;
                const languageDisplay = getLanguageDisplay(item);
                const platformDisplay = getPlatformDisplay(item);
                
                return (
                  <div
                    key={item.id || index}
                    className="flex-shrink-0"
                    style={{ minWidth: '266px' }}
                  >
                    <div className="bg-white border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-400 transition-all duration-300 group cursor-pointer"
                         onClick={() => handleArticleClick(item)}>
                      <div className="relative">
                        <img
                          src={getYouTubeThumbnail(item.youtube_url) || item.image_url || item.image || item.main_image_url || 'https://images.unsplash.com/photo-1574267432644-f610cab6adc4?w=800&h=600&fit=crop'}
                          alt={item.title || item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          style={{ width: '266px', height: '160px' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1574267432644-f610cab6adc4?w=800&h=600&fit=crop';
                          }}
                        />
                        
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
                        
                        {/* Language Badge - Top Left (only for non-Bollywood tab) */}
                        {languageDisplay && (
                          <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                            {languageDisplay}
                          </div>
                        )}
                        
                        {/* Title Overlay with Black Transparent Banner */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                          <h3 className="text-white font-bold text-xs text-center leading-tight">
                            {(item.title || item.name).replace(' Review', '')}
                          </h3>
                          {/* Platform name */}
                          {platformDisplay && (
                            <p className="text-gray-300 text-[10px] text-center mt-0.5">
                              {platformDisplay}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Navigation Arrows */}
          {maxIndex > 0 && currentData.length > 0 && (
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
