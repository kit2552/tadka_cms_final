import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

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
  const [sponsoredAds, setSponsoredAds] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch sponsored ads from API
  useEffect(() => {
    const fetchSponsoredAds = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles/sections/sponsored-ads?limit=4`);
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
        <div className={`${getSectionHeaderClasses().containerClass} px-3 py-2 border rounded-lg text-left mb-[14px] -mt-6`}>
          <h3 className={`text-sm font-semibold ${getSectionHeaderClasses().textClass}`}>{t('sections.sponsored_ads', 'Sponsored Ads')}</h3>
        </div>
        
        {/* Sponsored Ads Grid - Matching page width */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading sponsored ads...</p>
          </div>
        ) : sponsoredAds.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {sponsoredAds.map((ad) => (
              <div key={ad.id} className={`${getSectionBodyClasses().backgroundClass} border border-gray-300 rounded-lg overflow-hidden hover:shadow-sm ${getSectionBodyClasses().hoverClass} transition-all duration-300 cursor-pointer group`}>
                <div className="relative">
                  <img
                    src={ad.image_url || ad.image || 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&h=200&fit=crop'}
                    alt={ad.title}
                    className="w-full h-32 lg:h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&h=200&fit=crop';
                    }}
                  />
                </div>
                <div className="p-3 text-left">
                  <h2 className="text-sm font-semibold text-gray-900 leading-tight hover:text-gray-700 transition-colors duration-200 mb-1">
                    {ad.title}
                  </h2>
                  {ad.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {ad.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
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