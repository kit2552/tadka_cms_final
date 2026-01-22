import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar, Clock } from 'lucide-react';

const SportsSchedules = ({ sportsData, onArticleClick }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { getSectionHeaderClasses, getSectionContainerClasses, getSectionBodyClasses, theme } = useTheme();
  const [activeTab, setActiveTab] = useState('cricket');
  const [schedules, setSchedules] = useState({ today: [], tomorrow: [] });
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  // Fetch cricket schedules for today and tomorrow
  useEffect(() => {
    const fetchSchedules = async () => {
      setLoadingSchedules(true);
      try {
        const response = await fetch(`${API_URL}/api/cricket-schedules/today-tomorrow`);
        if (response.ok) {
          const data = await response.json();
          setSchedules({
            today: data.today || [],
            tomorrow: data.tomorrow || []
          });
        }
      } catch (error) {
        console.error('Error fetching schedules:', error);
      } finally {
        setLoadingSchedules(false);
      }
    };
    
    fetchSchedules();
  }, [API_URL]);
  
  const handleArticleClick = (article) => {
    if (onArticleClick) {
      onArticleClick(article, 'sports_schedules');
    }
  };

  const formatMatchTime = (dateString) => {
    if (!dateString) return 'TBD';
    
    let utcDateString = dateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      utcDateString = dateString + 'Z';
    }
    
    const date = new Date(utcDateString);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const timePart = date.toLocaleString('en-US', {
      timeZone: userTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
    
    let tzAbbr = date.toLocaleString('en-US', {
      timeZone: userTimezone,
      timeZoneName: 'short'
    }).split(' ').pop();
    
    if (tzAbbr === 'GMT+5:30') tzAbbr = 'IST';
    
    return `${timePart} ${tzAbbr}`;
  };

  // Get articles from sportsData prop or fallback to mock data
  const cricketArticles = sportsData?.cricket || [
    { id: 101, title: "World Cup Final Creates Historic Sporting Moment" },
    { id: 102, title: "Young Talent Shines in International Cricket Championship" },
    { id: 103, title: "Record-Breaking Performance Stuns Cricket Fans Worldwide" },
    { id: 111, title: "Elite Cricket Academy Produces Next Generation Stars" }
  ];

  // Combine today and tomorrow schedules
  const allSchedules = [...schedules.today, ...schedules.tomorrow];

  const getTabContent = () => {
    if (activeTab === 'cricket') {
      return cricketArticles;
    }
    return null; // Schedules tab uses different rendering
  };

  return (
    <div className={`${getSectionContainerClasses()} relative`} style={{ minHeight: '355px' }}>
      {/* Header with Tabs */}
      <div className={`${getSectionHeaderClasses().containerClass} border-b flex`}>
        <button
          onClick={() => setActiveTab('cricket')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-tl-lg ${
            activeTab === 'cricket' 
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}` 
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.cricket', 'Cricket')}
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex-1 px-3 py-2 transition-colors duration-200 text-left rounded-tr-lg ${
            activeTab === 'schedules'
              ? `${getSectionHeaderClasses().containerClass} ${getSectionHeaderClasses().selectedTabTextClass} ${getSectionHeaderClasses().selectedTabBorderClass}`
              : getSectionHeaderClasses().unselectedTabClass
          }`}
          style={{fontSize: '14px', fontWeight: '500'}}
        >
          {t('sections.schedules', 'Schedules')}
        </button>
      </div>
      
      <div 
        className={`overflow-y-hidden h-[calc(355px-45px)] md:h-[calc(277px-45px)] lg:h-[calc(355px-45px)] ${getSectionBodyClasses().backgroundClass}`}
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="p-2">
          <ul className="space-y-1">
            {currentArticles.slice(0, 4).map((article, index) => (
              <li
                key={article.id}
                className={`group cursor-pointer py-1 ${getSectionBodyClasses().hoverClass} transition-colors duration-200 border-b ${getSectionBodyClasses().dividerClass} last:border-b-0`}
                onClick={() => handleArticleClick(article)}
              >
                <div className="flex items-start space-x-2 text-left">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-gray-900 leading-tight group-hover:text-gray-700 transition-colors duration-200" style={{fontSize: '14px', fontWeight: '600'}}>
                      {article.title}
                    </h4>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* More Button Overlay - Square with Rounded Corners */}
      <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <button 
            onClick={() => {
              sessionStorage.setItem('homeScrollPosition', window.pageYOffset.toString());
              window.location.href = '/sports';
            }}
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
          </button>
        </div>
      </div>
    </div>
  );
};

export default SportsSchedules;