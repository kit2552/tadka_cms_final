import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ArticleImage from '../components/ArticleImage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PlaceholderImage } from '../utils/imageUtils';

const MovieNews = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('movie-news'); // 'movie-news' or 'movie-news-bollywood'
  const [movieNewsArticles, setMovieNewsArticles] = useState([]);
  const [bollywoodArticles, setBollywoodArticles] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredArticles, setFilteredArticles] = useState([]);

  const lightThemeClasses = {
    pageBackground: 'bg-gray-50',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-200',
  };

  // Fetch articles on component mount
  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL;
        
        // Fetch movie news articles
        const movieNewsResponse = await fetch(`${backendUrl}/api/articles/category/movie-news?limit=20`);
        const movieNewsData = await movieNewsResponse.json();
        
        // Fetch bollywood movie news articles
        const bollywoodResponse = await fetch(`${backendUrl}/api/articles/category/movie-news-bollywood?limit=20`);
        const bollywoodData = await bollywoodResponse.json();

        setMovieNewsArticles(movieNewsData || []);
        setBollywoodArticles(bollywoodData || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching articles:', err);
        setError('Failed to load articles. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // Scroll restoration logic
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('movieNewsScrollPosition');
    
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

  // Update filtered articles when tab or filter changes
  useEffect(() => {
    const currentArticles = activeTab === 'movie-news-bollywood' ? bollywoodArticles : movieNewsArticles;
    const filtered = filterArticlesByDate(currentArticles, selectedFilter);
    setFilteredArticles(filtered);
  }, [movieNewsArticles, bollywoodArticles, activeTab, selectedFilter]);

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

    return articles.filter(article => {
      const publishedAt = new Date(article.published_at || article.publishedAt);
      const articleDate = new Date(publishedAt.getFullYear(), publishedAt.getMonth(), publishedAt.getDate());
      const diffTime = today - articleDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      switch (filter) {
        case 'latest':
          return true; // Show all articles for "Latest" filter
        case 'thisWeek':
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          return articleDate >= startOfWeek;
        case 'today':
          return diffDays === 0;
        case 'yesterday':
          return diffDays === 1;
        case 'week':
          return diffDays <= 7;
        case 'month':
          return diffDays <= 30;
        case 'quarter':
          return diffDays <= 90;
        case 'halfYear':
          return diffDays <= 180;
        case 'year':
          return diffDays <= 365;
        default:
          return true;
      }
    });
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
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
    sessionStorage.setItem('movieNewsScrollPosition', window.scrollY.toString());
    
    // Route to video page for video content types, otherwise to article page
    if (article.content_type === 'video' || article.content_type === 'video_post') {
      navigate(`/video/${article.id}`, { state: { from: 'movie-news' } });
    } else {
      const slug = article.slug || article.title.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${article.id}/${slug}`, { state: { from: 'movie-news' } });
    }
  };

  const themeClasses = lightThemeClasses;

  if (error) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBackground} flex items-center justify-center`}>
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Unable to Load Movie News</h2>
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
          
          {/* Movie News Section - 70% width */}
          <div className="lg:col-span-7">
            {/* Movie News Section Header - Sticky with filter and bottom border */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  {/* Tabs only */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('movie-news')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'movie-news'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Movie News
                    </button>
                    <button
                      onClick={() => setActiveTab('movie-news-bollywood')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'movie-news-bollywood'
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
                    {filteredArticles.length} articles from {getCurrentFilterLabel().toLowerCase()}
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
                      <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                        {filterOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSelectedFilter(option.value);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition-colors duration-150 ${
                              selectedFilter === option.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
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
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 mb-1">No {activeTab === 'movie-news' ? 'movie news' : 'bollywood movie news'} articles found</p>
                <p className="text-xs text-gray-400">Try selecting a different time period</p>
              </div>
            )}
          </div>

          {/* Related Posts Sidebar - 30% width */}
          <div className="lg:col-span-3">
            {/* Related Posts Sticky Header */}
            <div className="sticky top-16 z-30 border-b-2 border-gray-300 mb-3" style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <h2 className="text-base font-bold text-black text-left">Related Posts</h2>
                <p className="text-xs text-gray-600 mt-1 text-left">Content you may like</p>
              </div>
            </div>

            {/* Related Posts Content */}
            <div className="space-y-4 text-left">
              {relatedArticles.length > 0 ? (
                relatedArticles.map((article) => (
                  <div
                    key={article.id}
                    className="flex space-x-3 cursor-pointer group text-left"
                    onClick={() => handleRelatedArticleClick(article)}
                  >
                    <img
                      src={article.image || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=100&h=100&fit=crop'}
                      alt={article.title}
                      className="w-20 h-20 object-cover rounded group-hover:opacity-80 transition-opacity duration-200"
                    />
                    <div className="flex-1 text-left">
                      <h3 className="text-sm font-medium text-gray-900 leading-tight group-hover:text-blue-600 transition-colors duration-200 line-clamp-2 text-left">
                        {article.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 text-left">
                        {formatDate(article.publishedAt)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-left">No related posts found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default MovieNews;
