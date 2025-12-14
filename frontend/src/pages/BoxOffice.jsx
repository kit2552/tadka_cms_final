import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const BoxOffice = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('box-office'); // 'box-office' or 'bollywood'
  const [boxOfficeArticles, setBoxOfficeArticles] = useState([]);
  const [bollywoodArticles, setBollywoodArticles] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true); // Start with true to show loading state
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredArticles, setFilteredArticles] = useState([]);

  // Scroll restoration logic
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('boxOfficeScrollPosition');
    
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
    const fetchBoxOfficeData = async () => {
      try {
        setLoading(true);
        console.log('Fetching box office data...');
        
        // Fetch articles from the backend API using box office categories
        const boxOfficeResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/articles/category/box-office?limit=20`);
        console.log('Box Office response status:', boxOfficeResponse.status);
        
        if (boxOfficeResponse.ok) {
          const boxOfficeData = await boxOfficeResponse.json();
          console.log('Box Office data received:', boxOfficeData.length);
          setBoxOfficeArticles(boxOfficeData);
        } else {
          console.log('Box Office response not ok');
          setBoxOfficeArticles([]);
        }

        const bollywoodResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/articles/category/bollywood-box-office?limit=20`);
        console.log('Bollywood response status:', bollywoodResponse.status);
        
        if (bollywoodResponse.ok) {
          const bollywoodData = await bollywoodResponse.json();
          console.log('Bollywood data received:', bollywoodData.length);
          setBollywoodArticles(bollywoodData);
        } else {
          console.log('Bollywood response not ok');
          setBollywoodArticles([]);
        }
        
        // Get related articles from configured categories for box office page
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/related-articles/box-office`);
          if (response.ok) {
            const configuredRelated = await response.json();
            setRelatedArticles(configuredRelated);
          } else {
            // Fallback to movies reviews if box office related articles not configured
            const fallbackResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/related-articles/movies`);
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              setRelatedArticles(fallbackData);
            } else {
              console.log('No related articles found');
              setRelatedArticles([]);
            }
          }
        } catch (relatedError) {
          console.error('Error fetching related articles:', relatedError);
          setRelatedArticles([]);
        }

        setError(null);
        console.log('Data fetching completed successfully');
      } catch (error) {
        console.error('Error fetching box office data:', error);
        setError('Failed to load box office data. Please try again later.');
        // Set empty arrays on error
        setBoxOfficeArticles([]);
        setBollywoodArticles([]);
        setRelatedArticles([]);
      } finally {
        setLoading(false);
        console.log('Loading state set to false');
      }
    };

    fetchBoxOfficeData();
  }, []);

  // Filter articles based on date
  const filterArticlesByDate = (articles, filter) => {
    if (!articles || articles.length === 0) {
      return [];
    }

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

  // Get current articles based on active tab
  const getCurrentTabArticles = () => {
    if (activeTab === 'box-office') {
      return boxOfficeArticles;
    } else {
      return bollywoodArticles;
    }
  };

  // Filter articles based on selected time filter
  useEffect(() => {
    const currentArticles = getCurrentTabArticles();
    const filtered = filterArticlesByDate(currentArticles, selectedFilter);
    setFilteredArticles(filtered);
  }, [activeTab, boxOfficeArticles, bollywoodArticles, selectedFilter]);

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

  const getCurrentFilterLabel = () => {
    const option = filterOptions.find(opt => opt.value === selectedFilter);
    return option ? option.label : 'Latest';
  };

  const handleFilterChange = (filterValue) => {
    setSelectedFilter(filterValue);
    setIsFilterOpen(false);
  };

  const handleArticleClick = (article) => {
    // Save current scroll position before navigating
    sessionStorage.setItem('boxOfficeScrollPosition', window.scrollY.toString());
    
    // Route to video page for video content types, otherwise to article page
    if (article.content_type === 'video' || article.content_type === 'video_post') {
      navigate(`/video/${article.id}`, { state: { from: 'box-office' } });
    } else {
      const slug = article.slug || article.title.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${article.id}/${slug}`, { state: { from: 'box-office' } });
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
        <div className="text-center">
          <p className={`text-lg ${themeClasses.textPrimary} mb-4`}>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
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
          
          {/* Box Office Section - 70% width */}
          <div className="lg:col-span-7 -mt-1">
            {/* Section Header - Sticky with tabs and filter */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  {/* Tabs only */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('box-office')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'box-office'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Box Office
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
                
                {/* Article count and Filter on same line */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-900 opacity-75">
                    {filteredArticles.length} {activeTab === 'box-office' ? 'box office reports' : 'bollywood collections'} from {getCurrentFilterLabel().toLowerCase()}
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
                    <img
                      src={article.image_url || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=300&h=200&fit=crop'}
                      alt={article.title}
                      className="flex-shrink-0 w-32 h-24 object-cover rounded group-hover:scale-105 transition-transform duration-200"
                    />
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
              <div className="text-center py-12">
                <p className={`text-lg ${themeClasses.textPrimary} mb-2`}>No {activeTab === 'box-office' ? 'box office reports' : 'bollywood collections'} found</p>
                <p className={`${themeClasses.textSecondary}`}>Try selecting a different time period</p>
              </div>
            )}
          </div>
          
          {/* Related Posts Section - 30% width */}
          <div className="lg:col-span-3">
            {/* Related Posts Header - Sticky with header and subtitle */}
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
              <div className="space-y-0">
                {relatedArticles.length > 0 ? (
                  relatedArticles.map((article, index) => (
                    <div
                      key={article.id || index}
                      onClick={() => handleArticleClick(article)}
                      className={`group cursor-pointer hover:bg-gray-50 transition-colors duration-200 p-4 border-b border-gray-200 last:border-b-0`}
                    >
                      <div className="flex space-x-3">
                        <div className="w-16 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded flex-shrink-0 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className={`font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-tight mb-2 text-left line-clamp-2`} style={{ fontSize: '0.9rem' }}>
                            {article.title}
                          </h4>
                          <p className={`text-xs text-gray-600 text-left`}>
                            {formatDate(article.publishedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`text-gray-600 text-sm text-left p-4`}>
                    No related posts found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoxOffice;