import React, { useState, useEffect } from 'react';

const AdManagement = () => {
  const [activeAdTab, setActiveAdTab] = useState('google-ads');
  const [adSettings, setAdSettings] = useState({
    article_content_mid: false,
    article_sidebar_comments: false,
    homepage_banner: false,
    homepage_sidebar: false,
    category_page_top: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleToggle = (key) => {
    setAdSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ad-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adSettings)
      });

      if (response.ok) {
        showNotification('success', 'Ad settings saved successfully!');
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving ad settings:', error);
      showNotification('error', 'Failed to save ad settings');
    } finally {
      setSaving(false);
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
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Ads Management</h1>
        <p className="text-gray-600">Control where advertisements appear on your website</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
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
        <div className={`mb-6 p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Google Ads Tab Content */}
      {activeAdTab === 'google-ads' && (
        <>
          {/* Ad Placements Grid */}
          <div className="space-y-4 mb-6">
        {adPlacements.map((placement) => (
          <div
            key={placement.key}
            className={`bg-white rounded-lg border-2 ${
              adSettings[placement.key] ? 'border-green-500 bg-green-50' : 'border-gray-200'
            } p-6 transition-all duration-200`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{placement.title}</h3>
                  {placement.status !== 'Active' && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded">
                      {placement.status}
                    </span>
                  )}
                  {adSettings[placement.key] && placement.status === 'Active' && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded">
                      Enabled
                    </span>
                  )}
                </div>
                <p className="text-gray-600 mb-2">{placement.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {placement.location}
                  </span>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center ml-4">
                <button
                  onClick={() => placement.status === 'Active' && handleToggle(placement.key)}
                  disabled={placement.status !== 'Active'}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    placement.status !== 'Active'
                      ? 'bg-gray-300 cursor-not-allowed'
                      : adSettings[placement.key]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
                      adSettings[placement.key] ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">How it works</h4>
                <p className="text-sm text-blue-800">
                  Enable or disable Google Ad placements across your website. When disabled, the ad placeholder will not be shown to visitors. 
                  Changes take effect immediately after saving.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sponsored Ads Tab Content */}
      {activeAdTab === 'sponsored-ads' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sponsored Ads</h3>
            <p className="text-gray-600 mb-6">
              Manage sponsored content and promotional ads for your website. This feature allows you to create and manage custom sponsored ad placements.
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Coming Soon
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdManagement;
