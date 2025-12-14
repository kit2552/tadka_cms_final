import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const TadkaShorts = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('shorts'); // 'shorts' or 'bollywood'
  const [shortsArticles, setShortsArticles] = useState([]);
  const [bollywoodArticles, setBollywoodArticles] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredArticles, setFilteredArticles] = useState([]);

  // Scroll restoration logic
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('tadkaShortsScrollPosition');
    
    if (savedScrollPosition && location.state?.fromDetail) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition));
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }

    if (location.state?.fromDetail) {
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    const fetchTadkaShortsData = async () => {
      try {
        setLoading(true);
        
        // Fetch articles from the backend API using tadka-shorts category
        const shortsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/articles/category/tadka-shorts?limit=20`);
        console.log('Tadka Shorts response status:', shortsResponse.status);
        
        if (shortsResponse.ok) {
          const shortsData = await shortsResponse.json();
          console.log('Tadka Shorts data received:', shortsData.length);
          setShortsArticles(shortsData);
        } else {
          console.log('Tadka Shorts response not ok');
          setShortsArticles([]);
        }

        const bollywoodResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/articles/category/tadka-shorts-bollywood?limit=20`);
        console.log('Bollywood Tadka Shorts response status:', bollywoodResponse.status);
        
        if (bollywoodResponse.ok) {
          const bollywoodData = await bollywoodResponse.json();
          console.log('Bollywood Tadka Shorts data received:', bollywoodData.length);
          setBollywoodArticles(bollywoodData);
        } else {
          console.log('Bollywood Tadka Shorts response not ok');
          setBollywoodArticles([]);
        }
        
        // Get related articles
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/related-articles/tadka-shorts`);
          if (response.ok) {
            const configuredRelated = await response.json();
            setRelatedArticles(configuredRelated);
          } else {
            // Fallback to trending videos category
            const fallbackResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/articles/category/trending-videos?limit=20`);
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              setRelatedArticles(fallbackData);
            }
          }
        } catch (err) {
          console.warn('Error fetching configured related articles, using fallback:', err);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading Tadka Shorts data:', err);
        setError('Failed to load shorts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTadkaShortsData();
  }, []);

  // Update filtered articles when tab or filter changes
  useEffect(() => {
    const currentArticles = activeTab === 'bollywood' ? bollywoodArticles : shortsArticles;
    const filtered = filterArticlesByDate(currentArticles, selectedFilter);
    setFilteredArticles(filtered);
  }, [shortsArticles, bollywoodArticles, activeTab, selectedFilter]);

  // Get random image from gallery
  const getRandomGalleryImage = (article) => {
    if (article.gallery && article.gallery.images) {
      try {
        let images = article.gallery.images;
        if (typeof images === 'string') {
          images = JSON.parse(images);
        }
        if (Array.isArray(images) && images.length > 0) {
          const randomIndex = Math.floor(Math.random() * images.length);
          const randomImage = images[randomIndex];
          return randomImage.url || randomImage.data || randomImage;
        }
      } catch (error) {
        console.error('Error parsing gallery images:', error);
      }
    }
    return article.image_url || article.image;
  };

  // Check if gallery is vertical
  const isVerticalGallery = (article) => {
    return article.gallery && article.gallery.gallery_type === 'vertical';
  };

  // Filter options for the dropdown
  const filterOptions = [
    { value: 'latest', label: 'Latest' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 3 Months' },
    { value: 'halfYear', label: 'Last 6 Months' },
    { value: 'year', label: 'Last Year' }
  ];

  // Function to filter articles by date
  const filterArticlesByDate = (articles, filter) => {
    if (!articles || articles.length === 0) {
      return [];
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const filtered = articles.filter((article) => {
      let articleDate;
      if (article.published_at || article.publishedAt) {
        articleDate = new Date(article.published_at || article.publishedAt);
      } else {
        return false;
      }
      
      const articleDateOnly = new Date(articleDate.getFullYear(), articleDate.getMonth(), articleDate.getDate());
      const timeDiff = now - articleDate;
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

      switch (filter) {
        case 'latest':
          return true;
        case 'thisWeek':
          const currentWeekStart = new Date(today);
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          currentWeekStart.setDate(today.getDate() - daysToMonday);
          const currentWeekEnd = new Date(currentWeekStart);
          currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
          return articleDateOnly >= currentWeekStart && articleDateOnly <= currentWeekEnd;
        case 'today':
          return articleDateOnly.getTime() === today.getTime();
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return articleDateOnly.getTime() === yesterday.getTime();
        case 'week':
          return daysDiff >= 0 && daysDiff <= 7;
        case 'month':
          return daysDiff >= 0 && daysDiff <= 30;
        case 'quarter':
          return daysDiff >= 0 && daysDiff <= 90;
        case 'halfYear':
          return daysDiff >= 0 && daysDiff <= 180;
        case 'year':
          return daysDiff >= 0 && daysDiff <= 365;
        default:
          return false;
      }
    });
    
    return filtered;
  };

  const handleFilterChange = (filterValue) => {
    setSelectedFilter(filterValue);
    setIsFilterOpen(false);
  };

  const getCurrentFilterLabel = () => {
    const option = filterOptions.find(opt => opt.value === selectedFilter);
    return option ? option.label : 'Latest';
  };

  const handleRelatedArticleClick = (article) => {
    navigate(`/article/${article.id}`);
  };

  const handleArticleClick = (article) => {
    sessionStorage.setItem('tadkaShortsScrollPosition', window.scrollY.toString());
    
    if (article.content_type === 'video' || article.content_type === 'video_post') {
      navigate(`/video/${article.id}`, { state: { from: 'tadka-shorts' } });
    } else {
      const slug = article.slug || article.title.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${article.id}/${slug}`, { state: { from: 'tadka-shorts' } });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently published';
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const lightThemeClasses = {
    pageBackground: 'bg-gray-50',
    cardBackground: 'bg-white',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-200'
  };

  const themeClasses = lightThemeClasses;

  if (error) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBackground} flex items-center justify-center`}>
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">📱</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Unable to Load Shorts</h2>
          <p className={`${themeClasses.textSecondary} mb-6`}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl px-4 py-3">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <p className="text-sm font-medium text-gray-700">Loading...</p>
            </div>
          </div>
        </div>
      )}
      
      <div className={`min-h-screen ${themeClasses.pageBackground}`}>
      {/* Main Container */}
      <div className="max-w-5xl-plus mx-auto px-8 pb-6">
        
        {/* Two Section Layout - 70%/30% split */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          
          {/* Tadka Shorts Section - 70% width */}
          <div className="lg:col-span-7 -mt-1">
            {/* Section Header - Sticky with tabs and filter */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  {/* Tabs */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('shorts')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'shorts'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Tadka Shorts
                    </button>
                    <button
                      onClick={() => setActiveTab('bollywood')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'bollywood'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Bollywood
                    </button>
                  </div>
                </div>
                
                {/* Article count and Filter */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-900 opacity-75">
                    {filteredArticles.length} shorts from {getCurrentFilterLabel().toLowerCase()}
                  </p>

                  {/* Filter Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="flex items-center space-x-2 text-xs font-medium text-gray-900 opacity-75 hover:opacity-100 focus:outline-none"
                    >  
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                      </svg>
                      <span>{getCurrentFilterLabel()}</span>
                      <svg className={`w-3 h-3 ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isFilterOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                        <div className="py-1">
                          {filterOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleFilterChange(option.value)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                                selectedFilter === option.value 
                                  ? 'bg-blue-50 text-blue-700 font-medium' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {option.label}
                              {selectedFilter === option.value && (
                                <svg className="inline-block w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Articles Grid - 4 Column Vertical Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
              {filteredArticles.map((article) => {
                const galleryImage = getRandomGalleryImage(article);
                const isVertical = isVerticalGallery(article);
                
                return (
                  <div
                    key={article.id}
                    className="cursor-pointer group transition-transform duration-300 hover:scale-105"
                    onClick={() => handleArticleClick(article)}
                  >
                    <div className={`relative ${isVertical ? 'w-full h-56' : 'w-full h-48'} rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-gray-300 transition-colors duration-300`}>
                      <img
                        src={galleryImage || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=400&fit=crop'}
                        alt={article.title}
                        className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                        style={{ objectFit: 'cover', objectPosition: 'top' }}
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=400&fit=crop';
                        }}
                      />
                      {/* Gradient overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent h-16"></div>
                      {/* Title overlay */}
                      <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium line-clamp-2">
                        {article.title}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredArticles.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-1">No {activeTab === 'reels' ? 'reels' : 'shorts'} found</p>
                <p className="text-xs text-gray-400">Try selecting a different time period</p>
              </div>
            )}
          </div>

          {/* Related Posts Section - 30% width */}
          <div className="lg:col-span-3 border-t border-gray-300 lg:border-t-0 pt-2 lg:pt-0">
            {/* Related Posts Header */}
            <div className={`sticky top-16 z-30 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  <h2 className="text-base font-bold text-black text-left leading-tight">
                    Related Posts
                  </h2>
                </div>
                <p className="text-xs text-gray-900 opacity-75 text-left">
                  Content you may like
                </p>
              </div>
            </div>

            {/* Related Posts List */}
            <div className="space-y-0">
              {relatedArticles.length > 0 ? (
                relatedArticles.map((article, index) => (
                  <div
                    key={article.id}
                    onClick={() => handleRelatedArticleClick(article)}
                    className={`group cursor-pointer hover:bg-gray-50 transition-colors duration-200 p-2 ${
                      index < relatedArticles.length - 1 ? 'border-b border-gray-200' : ''
                    }`}
                  >
                    <div className="flex space-x-3">
                      <img
                        src={article.image_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=60&h=45&fit=crop'}
                        alt={article.title}
                        className="w-20 h-16 object-cover rounded flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-tight mb-2 text-left line-clamp-2" style={{ fontSize: '0.9rem' }}>
                          {article.title}
                        </h4>
                        <p className="text-xs text-gray-600 text-left">
                          {formatDate(article.published_at || article.publishedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No related posts found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default TadkaShorts;
