import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { STATE_CODE_MAPPING, parseStoredStates, DEFAULT_SELECTED_STATES } from '../utils/statesConfig';

// Helper function to extract YouTube video ID and get thumbnail
const getYouTubeThumbnail = (url) => {
  if (!url) return null;
  
  let videoId = null;
  
  // Handle different YouTube URL formats
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0];
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1]?.split('?')[0];
  }
  
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
  
  return null;
};

// Helper function to get thumbnail based on content type
const getAdThumbnail = (ad) => {
  // If it's a video or video_post (YouTube), return YouTube thumbnail
  if ((ad.content_type === 'video' || ad.content_type === 'video_post') && ad.youtube_url) {
    return getYouTubeThumbnail(ad.youtube_url);
  }
  
  // If it's a photo gallery, get first image from gallery
  if (ad.content_type === 'photo' && ad.image_gallery) {
    try {
      const gallery = typeof ad.image_gallery === 'string' ? JSON.parse(ad.image_gallery) : ad.image_gallery;
      if (Array.isArray(gallery) && gallery.length > 0) {
        return gallery[0].url || gallery[0].data || null;
      }
    } catch (e) {
      console.error('Error parsing gallery:', e);
    }
  }
  
  // Default: use uploaded image
  return ad.image_url || ad.image || null;
};

const SponsoredAds = ({ 
  movieNews = [], 
  movieGossip = [], 
  andhraNews = [], 
  telanganaNews = [], 
  gossip = [], 
  reviews = [], 
  movieSchedules = [], 
  features = [], 
  mostPopular = [], 
  largeFeatureImage = {}
}) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses, getSectionBodyClasses } = useTheme();
  const navigate = useNavigate();
  const [sponsoredAds, setSponsoredAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleAdClick = (ad) => {
    // Navigate to appropriate page based on content type
    if (ad.content_type === 'video' || ad.content_type === 'video_post') {
      navigate(`/video/${ad.id}`);
    } else {
      navigate(`/article/${ad.id}/${ad.slug || ad.title.toLowerCase().replace(/\s+/g, '-')}`);
    }
  };

  const leftSections = [
    { title: 'Movies', data: movieNews },
    { title: 'Movie Gossip', data: movieGossip },
    { title: 'Andhra News', data: andhraNews },
    { title: 'Telangana News', data: telanganaNews },
    { title: 'Gossip', data: gossip },
    { title: 'Reviews', data: reviews }
  ];

  const rightSections = [
    { title: 'Movie Schedules', data: movieSchedules },
    { title: 'Features', data: features }
  ];

  // Fetch sponsored ads from API with state filtering
  useEffect(() => {
    const fetchSponsoredAds = async () => {
      try {
        // Get user's state preferences from localStorage
        const userStateString = localStorage.getItem('tadka_state') || JSON.stringify(DEFAULT_SELECTED_STATES);
        const userStateNames = parseStoredStates(userStateString);
        
        // Convert state names to state codes
        const stateCodes = userStateNames.map(stateName => STATE_CODE_MAPPING[stateName]).filter(Boolean);
        
        // Build API URL with state codes
        let url = `${process.env.REACT_APP_BACKEND_URL}/api/articles/sections/sponsored-ads?limit=4`;
        if (stateCodes.length > 0) {
          url += `&states=${stateCodes.join(',')}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setSponsoredAds(data);
        }
      } catch (error) {
        console.error('Error fetching sponsored ads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSponsoredAds();
    
    // Listen for state preference changes
    const handleStateChange = () => {
      setLoading(true);
      fetchSponsoredAds();
    };
    
    window.addEventListener('statePreferenceChanged', handleStateChange);
    
    return () => {
      window.removeEventListener('statePreferenceChanged', handleStateChange);
    };
  }, []);

  const ArticleList = ({ articles }) => (
    <ul className="space-y-1 text-left">
      {articles.map((article) => (
        <li key={article.id} className={`group cursor-pointer ${getSectionBodyClasses().hoverClass} transition-colors duration-200 py-1`}>
          <h4 className="text-xs text-gray-900 group-hover:text-gray-700 transition-colors duration-200 leading-tight">
            {article.title}
          </h4>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="py-6 mt-[6px]">
      <div className="max-w-5xl-plus mx-auto px-8">
        
        {/* Sponsored Ads Header - Matching width of other sections */}
        <div className={`${getSectionHeaderClasses().containerClass} px-3 py-2 border rounded-lg text-left mb-[12px]`} style={{ marginTop: '-26px' }}>
          <h3 className={`text-sm font-semibold ${getSectionHeaderClasses().textClass}`}>{t('sections.sponsored_ads', 'Sponsored Ads')}</h3>
        </div>
        
        {/* Sponsored Ads Grid - Matching page width */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading sponsored ads...</p>
          </div>
        ) : sponsoredAds.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {sponsoredAds.map((ad) => {
              const thumbnail = getAdThumbnail(ad);
              const fallbackImage = 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&h=200&fit=crop';
              
              return (
                <div 
                  key={ad.id} 
                  onClick={() => handleAdClick(ad)}
                  className={`${getSectionBodyClasses().backgroundClass} border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm ${getSectionBodyClasses().hoverClass} transition-all duration-300 cursor-pointer group`}
                >
                  <div className="relative">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={ad.title}
                        className="w-full h-32 lg:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = fallbackImage;
                        }}
                      />
                    ) : (
                      <div className="w-full h-32 lg:h-36 bg-gray-200 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Video indicator for YouTube content */}
                    {(ad.content_type === 'video' || ad.content_type === 'video_post') && ad.youtube_url && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black bg-opacity-60 rounded-full p-3">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    )}
                    
                    {/* Gallery indicator for photo gallery content */}
                    {ad.content_type === 'photo' && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-60 rounded px-2 py-1">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="px-3 pb-3 text-left" style={{ paddingTop: '10px' }}>
                    <h2 className="text-sm font-semibold text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-200 mb-1">
                      {ad.title}
                    </h2>
                    {/* Don't show summary text for video content types */}
                    {ad.summary && ad.content_type !== 'video' && ad.content_type !== 'video_post' && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {ad.summary}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No sponsored ads available</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          {/* Economic Growth section removed */}
        </div>
      </div>
    </div>
  );
};

export default SponsoredAds;