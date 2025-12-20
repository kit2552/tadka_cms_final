import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminControls = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('scheduler');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schedulerSettings, setSchedulerSettings] = useState({
    is_enabled: false,
    check_frequency_minutes: 5
  });
  const [scheduledArticles, setScheduledArticles] = useState([]);
  const [notification, setNotification] = useState({
    type: '',
    message: ''
  });

  useEffect(() => {
    fetchSchedulerSettings();
    fetchScheduledArticles();
  }, []);

  const fetchSchedulerSettings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/scheduler-settings`);
      if (response.ok) {
        const data = await response.json();
        setSchedulerSettings(data);
      }
    } catch (error) {
      console.error('Error fetching scheduler settings:', error);
      showNotification('error', 'Failed to load scheduler settings');
    }
  };

  const fetchScheduledArticles = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/scheduled-articles`);
      if (response.ok) {
        const data = await response.json();
        setScheduledArticles(data);
      }
    } catch (error) {
      console.error('Error fetching scheduled articles:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: '', message: '' }), 5000);
  };

  const handleSettingsChange = (field, value) => {
    setSchedulerSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveSchedulerSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/scheduler-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(schedulerSettings)
      });

      if (response.ok) {
        showNotification('success', 'Scheduler settings updated successfully');
        await fetchScheduledArticles(); // Refresh scheduled articles list
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating scheduler settings:', error);
      showNotification('error', 'Failed to update scheduler settings');
    } finally {
      setSaving(false);
    }
  };

  const runSchedulerNow = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/scheduler/run-now`, {
        method: 'POST'
      });

      if (response.ok) {
        showNotification('success', 'Scheduler run completed successfully');
        await fetchScheduledArticles(); // Refresh list to show any newly published articles
      } else {
        throw new Error('Failed to run scheduler');
      }
    } catch (error) {
      console.error('Error running scheduler:', error);
      showNotification('error', 'Failed to run scheduler');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const frequencyOptions = [
    { value: 1, label: '1 minute' },
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl-plus mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-6 text-left">
          <h1 className="text-xl font-semibold text-gray-900 text-left">Admin Controls</h1>
        </div>

        {/* Notification */}
        {notification.message && (
          <div className={`mb-6 p-4 rounded-lg ${
            notification.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('scheduler')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'scheduler'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Post Scheduler Settings
              </button>
              <button
                onClick={() => setActiveTab('articles')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'articles'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scheduled Articles
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'scheduler' && (
              <div className="space-y-6">
                <div className="text-left">
                  <div className="space-y-6">
                    {/* Enable Toggle */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900 text-base">Enable Auto-Publishing</h3>
                          <p className="text-sm text-gray-600">Automatically publish scheduled posts at the specified time</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={schedulerSettings.is_enabled}
                            onChange={(e) => handleSettingsChange('is_enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                    </div>

                    {/* Check Frequency */}
                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        Check Frequency
                      </label>
                      <select
                        value={schedulerSettings.check_frequency_minutes}
                        onChange={(e) => handleSettingsChange('check_frequency_minutes', parseInt(e.target.value))}
                        disabled={!schedulerSettings.is_enabled}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {frequencyOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            Every {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-600 mt-2">
                        How often the system should check for scheduled posts to publish
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                      <button
                        onClick={saveSchedulerSettings}
                        disabled={saving}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium text-sm transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save Settings'}
                      </button>

                      <button
                        onClick={runSchedulerNow}
                        disabled={loading || !schedulerSettings.is_enabled}
                        className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium text-sm transition-colors"
                      >
                        {loading ? 'Running...' : 'Run Scheduler Now'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled Articles Tab */}
            {activeTab === 'articles' && (
              <div className="space-y-4">
                <div className="text-left mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 text-left">Scheduled Articles List</h2>
                  <p className="text-sm text-gray-600 mt-1">View all articles scheduled for automatic publishing</p>
                </div>
                
                {scheduledArticles.length === 0 ? (
                  <div className="text-center py-16">
                    <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Articles</h3>
                    <p className="text-gray-600">No articles are currently scheduled for publishing.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Article
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Author
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Scheduled Time (IST)
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {scheduledArticles.map((article) => (
                          <tr 
                            key={article.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="text-left">
                                <h3 className="text-sm font-medium text-gray-900">
                                  {article.title}
                                </h3>
                                {article.short_title && (
                                  <p className="text-xs text-gray-600 mt-1">{article.short_title}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {article.author}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {formatDateTime(article.scheduled_publish_at)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                new Date(article.scheduled_publish_at) <= new Date()
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {new Date(article.scheduled_publish_at) <= new Date() ? 'Ready to Publish' : 'Scheduled'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminControls;