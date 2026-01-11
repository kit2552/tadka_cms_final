import useTabState from '../hooks/useTabState';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import VideoModal from './VideoModal';

const OTTReleases = ({ articles, onArticleClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses, getSectionContainerClasses, getSectionBodyClasses, theme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useTabState('ott-releases', 'ott');
  const [releaseData, setReleaseData] = useState({ ott: {}, bollywood: {} });
  const [loading, setLoading] = useState(true);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  useEffect(() => {
    fetchReleaseData();
  }, []);

  const fetchReleaseData = async () => {
    try {
      // Get user's selected states from localStorage (using correct key 'tadka_state')
      const userStateNames = JSON.parse(localStorage.getItem('tadka_state') || '[]');
      console.log('User selected state names:', userStateNames);
      
      // Convert state names to state codes (e.g., "Andhra Pradesh" -> "ap")
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
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/releases/ott-bollywood${statesParam}${cacheBuster}`);
      if (response.ok) {
        const data = await response.json();
        console.log('OTT Releases fetched:', data); // Debug log
        setReleaseData(data);
      }
    } catch (error) {
      console.error('Error fetching OTT release data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = (release) => {
    // If release has a YouTube URL, open video modal
    if (release.youtube_url || release.trailer_url) {
      setSelectedVideo({
        id: release.id,
        title: release.movie_name || release.title,
        youtube_url: release.youtube_url || release.trailer_url
      });
      setIsVideoModalOpen(true);
    } else {
      // Otherwise navigate to the movie content page
      navigate(`/movie/${encodeURIComponent(release.title || release.movie_name)}`);
    }
  };

  // Get current tab releases (combines this week and coming soon)
  const getCurrentTabReleases = () => {
    if (loading) return [];
    
    const currentTabData = releaseData[activeTab];
    console.log('getCurrentTabReleases - activeTab:', activeTab);
    console.log('getCurrentTabReleases - currentTabData:', currentTabData);
    
    if (!currentTabData) return [];
    
    const thisWeek = currentTabData.this_week || [];
    const comingSoon = currentTabData.coming_soon || [];
    
    console.log('getCurrentTabReleases - thisWeek count:', thisWeek.length);
    console.log('getCurrentTabReleases - comingSoon count:', comingSoon.length);
    console.log('getCurrentTabReleases - thisWeek data:', thisWeek);
    
    // Combine and limit to 20 items
    const combined = [...thisWeek, ...comingSoon].slice(0, 20);
    console.log('getCurrentTabReleases - combined releases:', combined);
    return combined;
  };

  const currentReleases = getCurrentTabReleases();

  const formatReleaseDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <div className={`${getSectionContainerClasses()} relative`} style={{ height: '352px' }}>
      {/* Header with Tabs */}
      <div className={`${getSectionHeaderClasses().containerClass} border-b flex`}>
        <button
          onClick={() => setActiveTab('ott')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-tl-lg ${
            activeTab === 'ott'
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}`
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.ott_releases', 'OTT Releases')}
        </button>
        <button
          onClick={() => setActiveTab('bollywood')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-tr-lg ${
            activeTab === 'bollywood' 
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}` 
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.bollywood_ott', 'Bollywood')}
        </button>
      </div>
      
      <div 
        className={`overflow-y-auto relative ${getSectionBodyClasses().backgroundClass}`}
        style={{ 
          height: 'calc(352px - 45px)',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent'
        }}
      >
        
        <div className="p-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-xs text-gray-600">Loading OTT releases...</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {currentReleases.length > 0 ? (
                currentReleases.map((release, index) => (
                  <li
                    key={release.id}
                    className={`group cursor-pointer py-1 px-1 ${getSectionBodyClasses().hoverClass} transition-colors duration-200 border-b ${getSectionBodyClasses().dividerClass} last:border-b-0`}
                    onClick={() => handleArticleClick(release)}
                  >
                    <div className="flex items-start justify-between text-left">
                      <div className="flex items-start space-x-2 flex-1">
                        <div className="relative flex-shrink-0 w-32 h-20 rounded overflow-hidden border border-gray-300">
                          {release.youtube_url ? (
                            <>
                              <img
                                src={`https://img.youtube.com/vi/${release.youtube_url.split('v=')[1]?.split('&')[0] || release.youtube_url.split('/').pop()}/mqdefault.jpg`}
                                alt={release.movie_name || release.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.target.src = `https://img.youtube.com/vi/${release.youtube_url.split('v=')[1]?.split('&')[0] || release.youtube_url.split('/').pop()}/hqdefault.jpg`;
                                }}
                              />
                            </>
                          ) : release.movie_image ? (
                            <>
                              <img
                                src={release.movie_image.startsWith('http') ? release.movie_image : `${process.env.REACT_APP_BACKEND_URL}/${release.movie_image}`}
                                alt={release.movie_name || release.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextElementSibling.style.display = 'flex';
                                }}
                              />
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{display: 'none'}}>
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16l13-8z" />
                                </svg>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16l13-8z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-gray-900 leading-tight group-hover:text-gray-700 transition-colors duration-200" style={{fontSize: '14px', fontWeight: '600'}}>
                            {release.movie_name || release.title}
                          </h4>
                          {release.ott_platforms && (
                            <p className="text-xs text-gray-500 mt-1">
                              {Array.isArray(release.ott_platforms) ? release.ott_platforms.join(', ') : 
                               typeof release.ott_platforms === 'string' && release.ott_platforms.startsWith('[') ? 
                               JSON.parse(release.ott_platforms).join(', ') : release.ott_platforms}
                            </p>
                          )}
                          {release.languages && (
                            <div className="text-xs text-blue-600 mt-1">
                              {(() => {
                                // Parse languages
                                let langs = [];
                                if (Array.isArray(release.languages)) {
                                  langs = release.languages;
                                } else if (typeof release.languages === 'string') {
                                  try {
                                    langs = JSON.parse(release.languages);
                                  } catch {
                                    langs = [release.languages];
                                  }
                                }
                                
                                const originalLang = release.original_language;
                                
                                // In Bollywood tab, only show "Hindi"
                                if (activeTab === 'bollywood') {
                                  return <span>Hindi</span>;
                                }
                                
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
                                
                                // Find if user's preferred language exists in this release's languages
                                const userLangInRelease = userPreferredLangs.find(lang => langs.includes(lang));
                                
                                // If no original language info, just show all languages
                                if (!originalLang) {
                                  return langs.slice(0, 2).map((lang, idx) => (
                                    <span key={idx}>{idx > 0 ? ', ' : ''}{lang}</span>
                                  ));
                                }
                                
                                // Build display string
                                const displayParts = [];
                                
                                // If user has a preferred language in this release
                                if (userLangInRelease) {
                                  if (userLangInRelease === originalLang) {
                                    // User's preferred language IS the original - just show language name
                                    displayParts.push(userLangInRelease);
                                  } else {
                                    // User's preferred language is dubbed - show both
                                    displayParts.push(`${userLangInRelease} (Dubbed)`);
                                    displayParts.push(`${originalLang} (Original)`);
                                  }
                                } else {
                                  // No user preference match - show original language
                                  displayParts.push(`${originalLang} (Original)`);
                                }
                                
                                return <span>{displayParts.join(' ')}</span>;
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
                  </li>
                ))
              ) : (
                <div className="flex justify-center items-center h-full">
                  <div className="text-sm text-gray-500">No OTT releases available</div>
                </div>
              )}
            </ul>
          )}
        </div>
      </div>
      
      {/* More Button Overlay - Square with Rounded Corners - Bottom Right */}
      <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <Link 
            to="/ott-releases" 
            className="group inline-flex items-center justify-center w-8 h-8 bg-white bg-opacity-95 hover:bg-opacity-100 rounded border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-xl"
          >
            <svg 
              className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200 text-gray-600 group-hover:text-gray-800"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </Link>
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        video={selectedVideo}
      />
    </div>
  );
};

export default OTTReleases;