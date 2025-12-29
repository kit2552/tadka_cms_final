import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const TravelPicsPhotoshoots = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('travel-pics'); // 'travel-pics' or 'photoshoots'
  const [travelPicsArticles, setTravelPicsArticles] = useState([]);
  const [photoshootsArticles, setPhotoshootsArticles] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredArticles, setFilteredArticles] = useState([]);

  // Scroll restoration logic
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('travelPicsPhotoshootsScrollPosition');
    
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
    const fetchTravelPicsPhotoshootsData = async () => {
      try {
        setLoading(true);
        
        // Fetch articles from the backend API using Travel Pics and Photoshoots sections (includes gallery data)
        const travelPicsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/sections/travel-pics?skip=0&limit=20`);
        if (travelPicsResponse.ok) {
          const travelPicsData = await travelPicsResponse.json();
          console.log('Travel Pics API response:', travelPicsData);
          console.log('First article:', travelPicsData[0]);
          if (travelPicsData[0]?.gallery) {
            console.log('First article gallery:', travelPicsData[0].gallery);
            console.log('Gallery images:', travelPicsData[0].gallery.images);
          }
          setTravelPicsArticles(travelPicsData);
        }

        const photoshootsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/sections/photoshoots?skip=0&limit=20`);
        if (photoshootsResponse.ok) {
          const photoshootsData = await photoshootsResponse.json();
          console.log('Photoshoots data with galleries:', photoshootsData);
          setPhotoshootsArticles(photoshootsData);
        } else {
          console.log('Photoshoots response not ok, using fallback');
          // Fallback: use travel pics articles for photoshoots if not available
          setPhotoshootsArticles(travelPicsArticles);
        }
        
        // Get related articles from configured categories for travel-pics-photoshoots page
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/related-articles/travel-pics-photoshoots`);
          if (response.ok) {
            const configuredRelated = await response.json();
            setRelatedArticles(configuredRelated);
          } else {
            // Fallback to fashion category if no configuration found
            const fallbackResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/category/fashion?limit=20`);
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
        console.error('Error loading Travel Pics & Photoshoots data:', err);
        setError('Failed to load galleries. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTravelPicsPhotoshootsData();
  }, []);

  // Update filtered articles when tab or filter changes
  useEffect(() => {
    const currentArticles = activeTab === 'photoshoots' ? photoshootsArticles : travelPicsArticles;
    const filtered = filterArticlesByDate(currentArticles, selectedFilter);
    setFilteredArticles(filtered);
  }, [travelPicsArticles, photoshootsArticles, activeTab, selectedFilter]);

  // Auto scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Helper function to get random image from gallery
  const getRandomGalleryImage = (article) => {
    // Debug: log article structure
    if (!article.gallery) {
      console.log('Article has no gallery:', article.title, 'Using image_url:', article.image_url);
      return article.image_url || article.image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop';
    }

    // Check if article has gallery with images
    if (article.gallery && article.gallery.images) {
      try {
        let images = article.gallery.images;
        
        // Handle different image data formats
        if (typeof images === 'string') {
          images = JSON.parse(images);
        }
        
        // Ensure images is an array
        if (!Array.isArray(images)) {
          console.log('Gallery images is not an array:', typeof images);
          return article.image_url || article.image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop';
        }
        
        if (images.length > 0) {
          const randomIndex = Math.floor(Math.random() * images.length);
          const randomImage = images[randomIndex];
          
          // Handle different image object structures
          let imageUrl;
          if (typeof randomImage === 'string') {
            imageUrl = randomImage;
          } else if (randomImage.url) {
            imageUrl = randomImage.url;
          } else if (randomImage.data) {
            imageUrl = randomImage.data;
          } else {
            console.log('Unknown image format:', randomImage);
            imageUrl = article.image_url || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop';
          }
          
          console.log('Selected random gallery image:', imageUrl, 'from', images.length, 'images');
          return imageUrl;
        } else {
          console.log('Gallery has no images');
        }
      } catch (error) {
        console.error('Error parsing gallery images for', article.title, ':', error);
      }
    }
    
    // Fallback to article image
    const fallbackImage = article.image_url || article.image || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop';
    console.log('Using fallback image for', article.title, ':', fallbackImage);
    return fallbackImage;
  };

  // Check if the gallery is vertical
  const isVerticalGallery = (article) => {
    return article.gallery && article.gallery.gallery_type === 'vertical';
  };

  // Sample thumbnail images for related topics
  const getThumbnail = (index) => {
    const thumbnails = [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1524638431109-93d95c968f03?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=60&h=45&fit=crop'
    ];
    return thumbnails[index % thumbnails.length];
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

    // Use current date for filtering
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const filtered = articles.filter((article) => {
      // Use actual publishedAt date from article data
      let articleDate;
      if (article.published_at || article.publishedAt) {
        articleDate = new Date(article.published_at || article.publishedAt);
      } else {
        return false; // Don't include articles without dates
      }
      
      // Reset time to start of day for accurate comparison
      const articleDateOnly = new Date(articleDate.getFullYear(), articleDate.getMonth(), articleDate.getDate());
      const timeDiff = now - articleDate;
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

      switch (filter) {
        case 'latest':
          return true; // Show all articles for "Latest" filter
        case 'thisWeek':
          // This week means current week (Monday to Sunday)
          const currentWeekStart = new Date(today);
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          currentWeekStart.setDate(today.getDate() - daysToMonday);
          
          // Calculate week end (Sunday)
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

  // Handle filter change
  const handleFilterChange = (filterValue) => {
    setSelectedFilter(filterValue);
    setIsFilterOpen(false);
  };

  // Get current filter label
  const getCurrentFilterLabel = () => {
    const option = filterOptions.find(opt => opt.value === selectedFilter);
    return option ? option.label : 'Latest';
  };

  const handleRelatedArticleClick = (article) => {
    // Navigate to article page
    navigate(`/article/${article.id}`);
  };

  const handleArticleClick = (article) => {
    // Save current scroll position before navigating
    sessionStorage.setItem('travelPicsPhotoshootsScrollPosition', window.scrollY.toString());
    
    // Route to video page for video content types, otherwise to article page
    if (article.content_type === 'video' || article.content_type === 'video_post') {
      navigate(`/video/${article.id}`, { state: { from: 'travel-pics-photoshoots' } });
    } else {
      const slug = article.slug || article.title.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${article.id}/${slug}`, { state: { from: 'travel-pics-photoshoots' } });
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

  // Force light theme for content areas regardless of user's theme selection
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
          <div className="text-6xl mb-4">📸</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Unable to Load Galleries</h2>
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
        
        {/* Two Section Layout with Gap - 70%/30% split */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          
          {/* Travel Pics & Photoshoots Section - 70% width */}
          <div className="lg:col-span-7 -mt-1">
            {/* Section Header - Sticky with filter and bottom border */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  {/* Tabs only */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('travel-pics')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'travel-pics'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Travel Pics
                    </button>
                    <button
                      onClick={() => setActiveTab('photoshoots')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'photoshoots'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Photoshoots
                    </button>
                  </div>
                </div>
                
                {/* Article count and Filter on same line */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-900 opacity-75">
                    {filteredArticles.length} galleries from {getCurrentFilterLabel().toLowerCase()}
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

            {/* Articles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {filteredArticles.map((article) => (
                <div 
                  key={article.id} 
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm cursor-pointer group transition-all duration-200"
                  style={{ padding: '0.5rem' }}
                  onClick={() => handleArticleClick(article)}
                >
                  <div className="flex items-start space-x-3 text-left pr-3">
                    {isVerticalGallery(article) ? (
                      <img
                        src={getRandomGalleryImage(article)}
                        alt={article.title}
                        className="flex-shrink-0 w-24 h-32 object-cover object-top rounded group-hover:scale-105 transition-transform duration-200"
                        style={{ objectFit: 'cover', objectPosition: 'top' }}
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop';
                        }}
                      />
                    ) : (
                      <img
                        src={getRandomGalleryImage(article)}
                        alt={article.title}
                        className="flex-shrink-0 w-32 h-24 object-cover object-top rounded group-hover:scale-105 transition-transform duration-200"
                        style={{ objectFit: 'cover', objectPosition: 'top' }}
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="text-sm font-semibold text-gray-900 leading-tight hover:text-blue-600 mb-2 transition-colors duration-200 text-left">
                        {article.title}
                      </h3>
                      <div className="text-xs text-gray-500 text-left">
                        <p className="mb-1">
                          {formatDate(article.published_at || article.publishedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-1">No {activeTab === 'travel-pics' ? 'travel pics' : 'photoshoots'} found</p>
                <p className="text-xs text-gray-400">Try selecting a different time period</p>
              </div>
            )}
          </div>

          {/* Related Articles Section - 30% width */}
          <div className="lg:col-span-3 border-t border-gray-300 lg:border-t-0 pt-2 lg:pt-0">
            {/* Related Articles Section Header - Sticky */}
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

            {/* Related Articles List */}
            <div className="space-y-0">
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
                          src={getThumbnail(index)}
                          alt={article.title}
                          className="w-20 h-16 object-cover rounded flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className={`font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-tight mb-2 text-left line-clamp-2`} style={{ fontSize: '0.9rem' }}>
                            {article.title}
                          </h4>
                          <p className={`text-xs text-gray-600 text-left`}>
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
    </div>
    </>
  );
};

export default TravelPicsPhotoshoots;
