import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const OTTReleases = () => {
  const navigate = useNavigate();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('ott'); // 'ott' or 'bollywood'
  const [ottReleases, setOttReleases] = useState([]);
  const [bollywoodReleases, setBollywoodReleases] = useState([]);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const filterDropdownRef = useRef(null);

  useEffect(() => {
    const fetchOTTReleaseData = async () => {
      try {
        setLoading(true);
        
        // Get user's selected states from localStorage (using correct key 'tadka_state')
        const userStateNames = JSON.parse(localStorage.getItem('tadka_state') || '[]');
        console.log('User selected state names:', userStateNames);
        
        // Convert state names to state codes
        const stateNameToCode = {
          'Andhra Pradesh': 'ap',
          'Telangana': 'ts',
          'Tamil Nadu': 'tn',
          'Karnataka': 'ka',
          'Kerala': 'kl',
          'Maharashtra': 'mh',
          'Gujarat': 'gj',
          'Rajasthan': 'rj',
          'Punjab': 'pb',
          'Haryana': 'hr',
          'Delhi': 'dl',
          'Uttar Pradesh': 'up',
          'Bihar': 'br',
          'West Bengal': 'wb',
          'Odisha': 'or',
          'Madhya Pradesh': 'mp',
          'Chhattisgarh': 'cg',
          'Jharkhand': 'jh',
          'Assam': 'as',
          'Uttarakhand': 'uk',
          'Himachal Pradesh': 'hp',
          'Jammu and Kashmir': 'jk',
          'Goa': 'ga',
          'Manipur': 'mn',
          'Meghalaya': 'ml',
          'Tripura': 'tr',
          'Mizoram': 'mz',
          'Nagaland': 'nl',
          'Arunachal Pradesh': 'ar',
          'Sikkim': 'sk',
          'Ladakh': 'ld'
        };
        
        const userStateCodes = userStateNames.map(name => stateNameToCode[name]).filter(code => code);
        console.log('User state codes:', userStateCodes);
        
        const statesParam = userStateCodes.length > 0 ? `?user_states=${userStateCodes.join(',')}` : '';
        console.log('API request with states:', statesParam);
        
        // Add timestamp to prevent caching
        const cacheBuster = `${statesParam ? '&' : '?'}t=${Date.now()}`;
        
        // Fetch from ott-bollywood API endpoint with state filtering
        const ottBollywoodResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/releases/ott-bollywood${statesParam}${cacheBuster}`);
        if (ottBollywoodResponse.ok) {
          const ottBollywoodData = await ottBollywoodResponse.json();
          console.log('OTT Releases fetched:', ottBollywoodData);
          
          // Extract OTT releases (combine this_week and coming_soon)
          const ottData = ottBollywoodData.ott || {};
          const ottThisWeek = ottData.this_week || [];
          const ottComingSoon = ottData.coming_soon || [];
          setOttReleases([...ottThisWeek, ...ottComingSoon]);
          
          // Extract Bollywood releases (combine this_week and coming_soon)
          const bollywoodData = ottBollywoodData.bollywood || {};
          const bollywoodThisWeek = bollywoodData.this_week || [];
          const bollywoodComingSoon = bollywoodData.coming_soon || [];
          setBollywoodReleases([...bollywoodThisWeek, ...bollywoodComingSoon]);
        } else {
          // Fallback: try individual endpoints
          const ottResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/releases/theater-ott/page?release_type=ott&filter_type=${selectedFilter}&limit=50`);
          if (ottResponse.ok) {
            const ottData = await ottResponse.json();
            setOttReleases(ottData);
          }

          const bollywoodResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles/category/bollywood?limit=50`);
          if (bollywoodResponse.ok) {
            const bollywoodData = await bollywoodResponse.json();
            setBollywoodReleases(bollywoodData);
          }
        }
        
        // Get related articles for ott-releases page
        try {
          const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/related-articles/ott-releases`);
          if (response.ok) {
            const configuredRelated = await response.json();
            setRelatedArticles(configuredRelated);
          } else {
            // Fallback to entertainment category if no configuration found
            const fallbackResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles/category/entertainment?limit=20`);
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
        console.error('Error loading OTT releases data:', err);
        setError('Failed to load OTT releases. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchOTTReleaseData();
  }, [selectedFilter]);

  // Filter releases by date
  const filterReleasesByDate = (releases, filter) => {
    if (!releases || releases.length === 0) return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return releases.filter((release) => {
      if (!release.release_date) return filter === 'latest'; // Include releases without date only in latest
      
      const releaseDate = new Date(release.release_date);
      const releaseDateOnly = new Date(releaseDate.getFullYear(), releaseDate.getMonth(), releaseDate.getDate());
      
      switch (filter) {
        case 'upcoming':
          // Show only movies NOT released yet (future dates)
          return releaseDateOnly > today;
          
        case 'latest':
          // Show all latest added 20 posts (released or not)
          return true;
          
        case 'this_month':
          // Show releases in current month (upcoming or released)
          return releaseDate.getMonth() === now.getMonth() && 
                 releaseDate.getFullYear() === now.getFullYear();
          
        case 'last_6_months':
          // Show releases from last 6 months
          const sixMonthsAgo = new Date(now);
          sixMonthsAgo.setMonth(now.getMonth() - 6);
          return releaseDate >= sixMonthsAgo && releaseDate <= now;
          
        case 'last_year':
          // Show releases from last 1 year
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(now.getFullYear() - 1);
          return releaseDate >= oneYearAgo && releaseDate <= now;
          
        default:
          return true;
      }
    });
  };

  // Update filtered releases when tab or filter changes
  useEffect(() => {
    const currentReleases = activeTab === 'bollywood' ? bollywoodReleases : ottReleases;
    let filtered = filterReleasesByDate(currentReleases, selectedFilter);
    
    // Limit to 20 for 'latest' filter
    if (selectedFilter === 'latest') {
      filtered = filtered.slice(0, 20);
    }
    
    setFilteredReleases(filtered);
  }, [ottReleases, bollywoodReleases, activeTab, selectedFilter]);

  // Auto scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Filter options for the dropdown
  const filterOptions = [
    { value: 'latest', label: 'Latest' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'last_year', label: 'Last 1 Year' }
  ];

  // Handle filter change
  const handleFilterChange = (filterValue) => {
    setSelectedFilter(filterValue);
    setIsFilterOpen(false);
    // Scroll to top when filter changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  // Get current filter label
  const getCurrentFilterLabel = () => {
    const option = filterOptions.find(opt => opt.value === selectedFilter);
    return option ? option.label : 'Upcoming Releases';
  };

  const handleRelatedArticleClick = (article) => {
    // Navigate to article page
    navigate(`/article/${article.id}`);
  };

  const handleReleaseClick = (release) => {
    // Navigate to the movie content page
    navigate(`/movie/${encodeURIComponent(release.movie_name || release.title)}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Release date TBA';
    return new Date(dateString).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatReleaseDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Get YouTube thumbnail from video URL
  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return null;
    
    let videoId = null;
    if (youtubeUrl.includes('youtube.com/watch?v=')) {
      videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    } else if (youtubeUrl.includes('youtube.com/shorts/')) {
      videoId = youtubeUrl.split('shorts/')[1]?.split('?')[0];
    } else if (youtubeUrl.includes('youtu.be/')) {
      videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    } else if (youtubeUrl.includes('youtube.com/embed/')) {
      videoId = youtubeUrl.split('embed/')[1]?.split('?')[0];
    }
    
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  };

  // Sample thumbnail images for related articles
  const getThumbnail = (index) => {
    const thumbnails = [
      'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1489599511804-b5e70a09c787?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1533895328261-4524dd57665a?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1594736797933-d0c1372bbf52?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=45&fit=crop',
      'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=60&h=45&fit=crop'
    ];
    return thumbnails[index % thumbnails.length];
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
          <div className="text-6xl mb-4">📺</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Unable to Load OTT Releases</h2>
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
      {/* Compact Loading Modal */}
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
          
          {/* OTT Releases Section - 70% width */}
          <div className="lg:col-span-7 -mt-1">
            {/* OTT Releases Section Header - Sticky with filter and bottom border */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="mb-2">
                  {/* Tabs only */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setActiveTab('ott')}
                      className={`text-base font-bold transition-colors duration-200 ${
                        activeTab === 'ott'
                          ? 'text-black'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      OTT Releases
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
                
                {/* Release count and Filter on same line */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-900 opacity-75 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    {filteredReleases.length} releases from {getCurrentFilterLabel().toLowerCase()}
                  </p>

                  {/* Filter Dropdown */}
                  <div className="relative" ref={filterDropdownRef}>
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

            {/* Releases Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {filteredReleases.length > 0 ? (
                filteredReleases.map((release) => (
                  <div 
                    key={release.id} 
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-sm cursor-pointer group transition-all duration-200"
                    style={{ padding: '0.75rem' }}
                    onClick={() => handleReleaseClick(release)}
                  >
                    <div className="flex items-start justify-between text-left">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="relative flex-shrink-0 rounded overflow-hidden border border-gray-300" style={{ width: '160px', height: '90px' }}>
                        {(() => {
                          // Try to get YouTube thumbnail first
                          const youtubeThumbnail = getYouTubeThumbnail(release.youtube_url || release.trailer_url);
                          const imageUrl = youtubeThumbnail || (release.movie_image ? `${process.env.REACT_APP_BACKEND_URL}/${release.movie_image}` : null) || release.image_url;
                          
                          return imageUrl ? (
                            <>
                              <img
                                src={imageUrl}
                                alt={release.movie_name || release.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{display: 'none'}}>
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16l13-8z" />
                                </svg>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16l13-8z" />
                              </svg>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-gray-900 leading-tight hover:text-gray-700 mb-1 transition-colors duration-200 text-left" style={{fontSize: '14px', fontWeight: '600'}}>
                          {release.movie_name || release.title}
                        </h3>
                        {release.ott_platforms && (
                          <p className="text-xs text-gray-500 mb-1">
                            {Array.isArray(release.ott_platforms) ? release.ott_platforms.join(', ') : 
                             typeof release.ott_platforms === 'string' && release.ott_platforms.startsWith('[') ? 
                             JSON.parse(release.ott_platforms).join(', ') : release.ott_platforms}
                          </p>
                        )}
                        {release.languages && (
                          <div className="text-xs text-blue-600 mt-1">
                            {(() => {
                              const langs = Array.isArray(release.languages) ? release.languages : [release.languages];
                              const originalLang = release.original_language;
                              
                              // In Bollywood tab, only show "Hindi" in single line
                              if (activeTab === 'bollywood') {
                                return <div>Hindi</div>;
                              }
                              
                              // In OTT tab, show languages vertically with dubbed first, then original
                              if (!originalLang) {
                                return langs.map((lang, index) => (
                                  <div key={index}>{lang}</div>
                                ));
                              }
                              
                              // Separate dubbed and original languages
                              const dubbedLangs = langs.filter(lang => lang !== originalLang);
                              const originalLangs = langs.filter(lang => lang === originalLang);
                              
                              return (
                                <>
                                  {dubbedLangs.map((lang, index) => (
                                    <div key={`dubbed-${index}`}>{lang} (Dubbed)</div>
                                  ))}
                                  {originalLangs.map((lang, index) => (
                                    <div key={`original-${index}`}>{lang} (Original)</div>
                                  ))}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        <div className="bg-gray-800 text-white px-2 py-1 rounded text-xs font-medium">
                          {formatReleaseDate(release.release_date || release.published_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8">
                  <p className="text-sm text-gray-500">
                    No releases found for the selected dates
                  </p>
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
                            {new Date(article.published_at || article.publishedAt || new Date()).toLocaleDateString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`text-gray-600 text-sm text-left`}>
                    No related posts found
                  </p>
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

export default OTTReleases;