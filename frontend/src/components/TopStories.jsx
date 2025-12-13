import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PlaceholderImage } from '../utils/imageUtils';

const TopStories = ({ bigStory, entertainmentStory, featuredReview, fourthStory, onArticleClick }) => {
  const { getSectionBodyClasses } = useTheme();
  const handleArticleClick = (article, section) => {
    if (onArticleClick) {
      onArticleClick(article, section);
    }
  };

  // Generate star rating display
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <span key={`full-${i}`} className="text-yellow-400">★</span>
      );
    }
    
    if (hasHalfStar) {
      stars.push(
        <span key="half" className="text-yellow-400">☆</span>
      );
    }
    
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <span key={`empty-${i}`} className="text-gray-300">☆</span>
      );
    }
    
    return stars;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 -mt-0.5 -mb-2.5">
      
      {/* Big Story Block */}
      {bigStory && (
        <div 
          className={`${getSectionBodyClasses().backgroundClass} border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm ${getSectionBodyClasses().hoverClass} transition-all duration-300 cursor-pointer`}
          onClick={() => handleArticleClick(bigStory, 'top_story_main')}
        >
          <div className="relative">
            {bigStory?.image || bigStory?.image_url ? (
              <img
                src={bigStory?.image || bigStory?.image_url}
                alt={bigStory?.title || 'Main Story'}
                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'w-full h-40 bg-gray-500 flex items-center justify-center';
                  placeholder.innerHTML = '<span class="text-white font-bold text-3xl">A</span>';
                  e.target.parentNode.replaceChild(placeholder, e.target);
                }}
              />
            ) : (
              <PlaceholderImage 
                contentType="post" 
                className="w-full h-40"
              />
            )}
          </div>
          <div className="p-3 text-left">
            <h2 style={{fontSize: '14px', fontWeight: '600'}} className="text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-300">
              {bigStory?.title}
            </h2>
          </div>
        </div>
      )}

      {/* Entertainment Story Block */}
      {entertainmentStory && (
        <div 
          className={`${getSectionBodyClasses().backgroundClass} border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm ${getSectionBodyClasses().hoverClass} transition-all duration-300 cursor-pointer`}
          onClick={() => handleArticleClick(entertainmentStory, 'top_story_entertainment')}
        >
          <div className="relative">
            {entertainmentStory?.image || entertainmentStory?.image_url ? (
              <img
                src={entertainmentStory?.image || entertainmentStory?.image_url}
                alt={entertainmentStory?.title}
                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'w-full h-40 bg-gray-500 flex items-center justify-center';
                  placeholder.innerHTML = '<span class="text-white font-bold text-3xl">A</span>';
                  e.target.parentNode.replaceChild(placeholder, e.target);
                }}
              />
            ) : (
              <PlaceholderImage 
                contentType="post" 
                className="w-full h-40"
              />
            )}
          </div>
          <div className="p-3 text-left">
            <h2 style={{fontSize: '14px', fontWeight: '600'}} className="text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-300">
              {entertainmentStory?.title}
            </h2>
          </div>
        </div>
      )}

      {/* Fourth Story Block - News/Sports */}
      {fourthStory && (
        <div 
          className={`${getSectionBodyClasses().backgroundClass} border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm ${getSectionBodyClasses().hoverClass} transition-all duration-300 cursor-pointer`}
          onClick={() => handleArticleClick(fourthStory, 'top_story_fourth')}
        >
          <div className="relative">
            {fourthStory?.image || fourthStory?.image_url ? (
              <img
                src={fourthStory?.image || fourthStory?.image_url}
                alt={fourthStory?.title}
                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'w-full h-40 bg-gray-500 flex items-center justify-center';
                  placeholder.innerHTML = '<span class="text-white font-bold text-3xl">A</span>';
                  e.target.parentNode.replaceChild(placeholder, e.target);
                }}
              />
            ) : (
              <PlaceholderImage 
                contentType="post" 
                className="w-full h-40"
              />
            )}
          </div>
          <div className="p-3 text-left">
            <h2 style={{fontSize: '14px', fontWeight: '600'}} className="text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-300">
              {fourthStory?.title}
            </h2>
          </div>
        </div>
      )}

      {/* Featured Movie Review Block */}
      {featuredReview && (
        <div 
          className={`${getSectionBodyClasses().backgroundClass} border-2 border-yellow-400 rounded-lg overflow-hidden hover:shadow-lg ${getSectionBodyClasses().hoverClass} transition-all duration-300 cursor-pointer relative`}
          onClick={() => handleArticleClick(featuredReview, 'top_story_review')}
        >
          {/* Featured Review Badge */}
          <div className="absolute top-2 left-2 z-10">
            <span className="inline-flex items-center px-2 py-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded shadow-md">
              ⭐ FEATURED REVIEW
            </span>
          </div>
          
          <div className="relative">
            {featuredReview?.image || featuredReview?.image_url ? (
              <img
                src={featuredReview?.image || featuredReview?.image_url}
                alt={featuredReview?.title}
                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'w-full h-40 bg-gray-500 flex items-center justify-center';
                  placeholder.innerHTML = '<span class="text-white font-bold text-3xl">M</span>';
                  e.target.parentNode.replaceChild(placeholder, e.target);
                }}
              />
            ) : (
              <PlaceholderImage 
                contentType="movie_review" 
                className="w-full h-40"
              />
            )}
            
            {/* Rating Box - Bottom Right */}
            <div className="absolute bottom-2 right-2">
              <div className="bg-gray-900 bg-opacity-90 px-3 py-1.5 rounded flex items-center gap-2">
                <span className="text-yellow-400 text-lg font-bold">
                  {(featuredReview?.rating || featuredReview?.movie_rating || 4.5)}
                </span>
                <div className="flex items-center text-xs">
                  {renderStars(featuredReview?.rating || featuredReview?.movie_rating || 4.5)}
                </div>
              </div>
            </div>
          </div>
          <div className="p-3 text-left bg-gradient-to-b from-yellow-50 to-white">
            <h2 style={{fontSize: '14px', fontWeight: '600'}} className="text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-300">
              {featuredReview?.title}
            </h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopStories;