import React, { useState, useEffect } from 'react';
import CreateSponsoredAd from './CreateSponsoredAd';

const AdManagement = ({ showCreateAdForm, setShowCreateAdForm }) => {
  const [activeAdTab, setActiveAdTab] = useState('google-ads');
  const [adSettings, setAdSettings] = useState({
    article_content_mid: false,
    article_sidebar_comments: false,
    homepage_banner: false,
    homepage_sidebar: false,
    category_page_top: false,
    homepage_sponsored_ads: false
  });
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchAdSettings();
  }, []);

  const fetchAdSettings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ad-settings`);
      if (response.ok) {
        const data = await response.json();
        setAdSettings(data);
      }
    } catch (error) {
      console.error('Error fetching ad settings:', error);
      showNotification('error', 'Failed to load ad settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key) => {
    const newValue = !adSettings[key];
    
    // Optimistically update UI
    setAdSettings(prev => ({
      ...prev,
      [key]: newValue
    }));

    // Auto-save immediately
    try {
      const updatedSettings = {
        ...adSettings,
        [key]: newValue
      };
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ad-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings)
      });

      if (response.ok) {
        showNotification('success', 'Setting saved automatically');
      } else {
        // Revert on failure
        setAdSettings(prev => ({
          ...prev,
          [key]: !newValue
        }));
        showNotification('error', 'Failed to save setting');
      }
    } catch (error) {
      console.error('Error saving ad settings:', error);
      // Revert on failure
      setAdSettings(prev => ({
        ...prev,
        [key]: !newValue
      }));
      showNotification('error', 'An error occurred while saving');
    }
  };

  const showNotification = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: '', message: '' });
    }, 3000);
  };

  const adPlacements = [
    {
      key: 'article_content_mid',
      title: 'Article Content - Mid Article',
      description: 'Ad space between main content and secondary content',
      location: 'Article Pages',
      status: 'Active'
    },
    {
      key: 'article_sidebar_comments',
      title: 'Article Sidebar - Comments Section',
      description: 'Ad space between comments and related posts in right sidebar',
      location: 'Article Pages',
      status: 'Active'
    },
    {
      key: 'homepage_banner',
      title: 'Homepage - Top Banner',
      description: 'Full-width banner ad at the top of homepage',
      location: 'Homepage',
      status: 'Coming Soon'
    },
    {
      key: 'homepage_sidebar',
      title: 'Homepage - Sidebar',
      description: 'Sidebar ad on homepage',
      location: 'Homepage',
      status: 'Coming Soon'
    },
    {
      key: 'category_page_top',
      title: 'Category Pages - Top Banner',
      description: 'Banner ad at the top of category pages',
      location: 'Category Pages',
      status: 'Coming Soon'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading ad settings...</div>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${showCreateAdForm ? 'p-0' : ''}`}>
      {/* Tabs with Create Ad Button - Hide when form is open */}
      {!showCreateAdForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-4">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveAdTab('google-ads')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm ${
                    activeAdTab === 'google-ads'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Google Ads
                </button>
                <button
                  onClick={() => setActiveAdTab('sponsored-ads')}
                  className={`py-3 px-1 border-b-2 font-medium text-sm ${
                    activeAdTab === 'sponsored-ads'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Sponsored Ads
                </button>
              </nav>
            </div>
          </div>

          {/* Notification */}
          {notification.show && (
            <div className={`m-4 p-3 rounded-lg ${
              notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {notification.message}
            </div>
          )}

          {/* Google Ads Tab Content */}
          {activeAdTab === 'google-ads' && (
            <div className="p-4">
              {/* Ad Placements Grid */}
              <div className="space-y-2 mb-4">
        {adPlacements.map((placement) => (
          <div
            key={placement.key}
            className={`bg-white rounded border ${
              adSettings[placement.key] ? 'border-green-500 bg-green-50' : 'border-gray-200'
            } p-3 transition-all duration-200`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">{placement.title}</h3>
                  {placement.status !== 'Active' && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded">
                      {placement.status}
                    </span>
                  )}
                  {adSettings[placement.key] && placement.status === 'Active' && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500 text-white rounded">
                      Enabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-1">{placement.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {placement.location}
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center ml-3">
                <button
                  onClick={() => placement.status === 'Active' && handleToggle(placement.key)}
                  disabled={placement.status !== 'Active'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    placement.status !== 'Active'
                      ? 'bg-gray-300 cursor-not-allowed'
                      : adSettings[placement.key]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      adSettings[placement.key] ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
          </div>

            </div>
          )}

          {/* Sponsored Ads Tab Content */}
          {activeAdTab === 'sponsored-ads' && !showCreateAdForm && (
            <div className="p-4">
              {/* Sponsored Ads Placement */}
              <div className="space-y-2 mb-4">
            <div
              className={`bg-white rounded border ${
                adSettings.homepage_sponsored_ads ? 'border-green-500 bg-green-50' : 'border-gray-200'
              } p-3 transition-all duration-200`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">Homepage - Sponsored Ads Section</h3>
                    {adSettings.homepage_sponsored_ads && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-green-500 text-white rounded">
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mb-1">Display the Sponsored Ads section on the homepage</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Homepage
                    </span>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center ml-3">
                  <button
                    onClick={() => handleToggle('homepage_sponsored_ads')}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      adSettings.homepage_sponsored_ads ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                        adSettings.homepage_sponsored_ads ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

            </div>
          )}
        </div>
      )}

      {/* Create Sponsored Ad - Renders inline */}
      {showCreateAdForm && (
        <CreateSponsoredAd onClose={() => setShowCreateAdForm(false)} />
      )}
    </div>
  );
};

export default AdManagement;
