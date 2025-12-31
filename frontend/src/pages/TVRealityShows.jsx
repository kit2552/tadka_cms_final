import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CirclePlay } from 'lucide-react';
import EventVideosModal from '../components/EventVideosModal';

const TVRealityShows = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('reality-shows'); // 'reality-shows' or 'hindi'
  const [realityShowsArticles, setRealityShowsArticles] = useState([]);
  const [hindiArticles, setHindiArticles] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [selectedShow, setSelectedShow] = useState(null);
  const [showModalOpen, setShowModalOpen] = useState(false);

  // Scroll restoration logic
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('tvRealityShowsScrollPosition');
    
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
    const fetchTVRealityShowsData = async () => {
      try {
        setLoading(true);
        
        // Fetch grouped reality shows data
        const groupedResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/sections/reality-shows-grouped?limit=50`);
        console.log('Grouped Reality Shows response status:', groupedResponse.status);
        
        if (groupedResponse.ok) {
          const groupedData = await groupedResponse.json();
          console.log('✅ Grouped Reality Shows data received:', groupedData);
          console.log('✅ Reality shows count:', groupedData.reality_shows?.length || 0);
          console.log('✅ Hindi shows count:', groupedData.hindi?.length || 0);
          
          // Log the actual data being set
          if (groupedData.hindi && groupedData.hindi.length > 0) {
            console.log('✅ Setting hindiArticles with:', groupedData.hindi);
            console.log('✅ First Hindi show:', groupedData.hindi[0].event_name, 'with', groupedData.hindi[0].video_count, 'videos');
          } else {
            console.warn('⚠️ No Hindi shows found in response');
          }
          
          setRealityShowsArticles(groupedData.reality_shows || []);
          setHindiArticles(groupedData.hindi || []);
        } else {
          console.log('Grouped Reality Shows response not ok, falling back to regular articles');
          // Fallback to regular articles if grouped not available
          const realityShowsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/category/tv-reality-shows?limit=20`);
          if (realityShowsResponse.ok) {
            const realityShowsData = await realityShowsResponse.json();
            setRealityShowsArticles(realityShowsData);
          }
          
          const hindiResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/category/tv-reality-shows-hindi?limit=20`);
          if (hindiResponse.ok) {
            const hindiData = await hindiResponse.json();
            setHindiArticles(hindiData);
          }
        }
        
        // Get related articles
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/related-articles/reality-shows`);
          if (response.ok) {
            const configuredRelated = await response.json();
            setRelatedArticles(configuredRelated);
          } else {
            const fallbackResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/articles/category/entertainment?limit=20`);
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
        console.error('Error loading reality shows data:', err);
        setError('Failed to load reality shows. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTVRealityShowsData();
  }, []);

  // Update filtered articles when tab or filter changes
  useEffect(() => {
    const currentArticles = activeTab === 'hindi' ? hindiArticles : realityShowsArticles;
    console.log(`📊 Filtering articles for tab: ${activeTab}`, {
      totalArticles: currentArticles.length,
      filter: selectedFilter
    });
    const filtered = filterArticlesByDate(currentArticles, selectedFilter);
    console.log(`✅ Filtered ${filtered.length} articles`);
    setFilteredArticles(filtered);
  }, [realityShowsArticles, hindiArticles, activeTab, selectedFilter]);

  // Auto scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  // Handle show click - open modal if multiple videos, otherwise navigate directly
  const handleShowClick = (article) => {
    const videoCount = article.video_count || 1;
    
    if (videoCount > 1) {
      // Multiple videos - open modal
      setSelectedShow(article);
      setShowModalOpen(true);
    } else {
      // Single video - navigate directly to video view
      if (article.content_type === 'video' || article.youtube_url) {
        navigate(`/video/${article.id}`);
      } else {
        navigate(`/article/${article.id}`);
      }
    }
  };

  // Sample thumbnail images for related topics
  const getThumbnail = (index) => {
    const thumbnails = [
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1556139943-4bdca53adf1e?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=60&h=45&fit=crop'
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

    // For reality shows, always show latest posts regardless of date
    // Just return all articles sorted by published date (newest first)
    const sorted = [...articles].sort((a, b) => {
      const dateA = new Date(a.published_at || a.publishedAt || 0);
      const dateB = new Date(b.published_at || b.publishedAt || 0);
      return dateB - dateA; // Descending order (newest first)
    });
    
    // Return max 50 articles
    return sorted.slice(0, 50);
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
    sessionStorage.setItem('tvRealityShowsScrollPosition', window.scrollY.toString());
    
    // Route to video page for video content types, otherwise to article page
    if (article.content_type === 'video' || article.content_type === 'video_post' || article.youtube_url) {
      navigate(`/video/${article.id}`, { state: { from: 'reality-shows' } });
    } else {
      const slug = article.slug || article.title.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${article.id}/${slug}`, { state: { from: 'reality-shows' } });
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
          <div className="text-6xl mb-4">🎤</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Unable to Load Reality Shows</h2>
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
          
          {/* Reality Shows Section - 70% width */}
          <div className="lg:col-span-7 -mt-1">
            {/* Reality Shows Section Header - Sticky with filter and bottom border */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  {/* Tabs only */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('reality-shows')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'reality-shows'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      TV Reality Shows
                    </button>
                    <button
                      onClick={() => setActiveTab('hindi')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'hindi'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Hindi
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

            {/* Articles Grid - Horizontal Card Layout like Politics Page */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article) => {
                  const youtubeThumbnail = getYouTubeThumbnail(article.video_url || article.youtube_url);
                  const videoCount = article.video_count || 1;
                  const showName = article.event_name || article.title;
                  
                  return (
                    <div 
                      key={article.id} 
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md cursor-pointer group transition-all duration-200"
                      style={{ padding: '0.5rem' }}
                      onClick={() => handleShowClick(article)}
                    >
                      <div className="flex items-start space-x-3 text-left pr-3">
                        <div className="relative flex-shrink-0">
                          <img
                            src={youtubeThumbnail || article.image_url || article.image || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=300&h=200&fit=crop'}
                            alt={showName}
                            className="w-32 h-24 object-cover rounded group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=300&h=200&fit=crop';
                            }}
                          />
                          {/* Video count badge */}
                          {videoCount > 1 && (
                            <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                              <CirclePlay size={12} />
                              <span>{videoCount}</span>
                            </div>
                          )}
                          {/* Play icon overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-20">
                            <CirclePlay size={32} className="text-white drop-shadow-lg" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="text-sm font-semibold text-gray-900 leading-tight group-hover:text-blue-600 mb-2 transition-colors duration-200 text-left line-clamp-2">
                            {showName}
                          </h3>
                          <div className="text-xs text-gray-500 text-left space-y-1">
                            {videoCount > 1 && (
                              <p className="text-blue-600 font-medium">
                                {videoCount} Videos
                              </p>
                            )}
                            <p>
                              {formatDate(article.published_at || article.publishedAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8">
                  <p className="text-sm text-gray-400 mb-1">No {activeTab === 'hindi' ? 'hindi reality shows' : 'TV reality shows'} found</p>
                  <p className="text-xs text-gray-400">Try selecting a different time period</p>
                </div>
              )}
            </div>
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

      {/* Videos Modal for Grouped Reality Shows */}
      {showModalOpen && selectedShow && (
        <EventVideosModal
          event={selectedShow}
          isOpen={showModalOpen}
          onClose={() => {
            setShowModalOpen(false);
            setSelectedShow(null);
          }}
        />
      )}
    </>
  );
};

export default TVRealityShows;