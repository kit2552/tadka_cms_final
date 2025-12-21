import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ManageVideosModal = ({ onClose }) => {
  // Main tab state
  const [activeTab, setActiveTab] = useState('reports'); // 'reports', 'channel-videos', 'logs'
  
  const [config, setConfig] = useState({
    enabled: false,
    frequency_hours: 1,
    last_fetch: null,
    next_fetch: null
  });
  const [stats, setStats] = useState({
    total: 0,
    unused: 0,
    used: 0,
    by_type: {}
  });
  const [channelVideos, setChannelVideos] = useState([]);
  const [totalChannels, setTotalChannels] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [deleteOption, setDeleteOption] = useState(30);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'channel_name', direction: 'asc' });
  
  // Video list popup state
  const [showVideoList, setShowVideoList] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelVideosList, setChannelVideosList] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosCategoryFilter, setVideosCategoryFilter] = useState('all');
  const [videosTab, setVideosTab] = useState('available'); // 'available' or 'used'
  
  // Language identification state
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [videosNeedingId, setVideosNeedingId] = useState([]);
  const [identifyLoading, setIdentifyLoading] = useState(false);
  const [identifyCount, setIdentifyCount] = useState(0);
  const [languageSelections, setLanguageSelections] = useState({});
  
  // Logs state
  const [rssLogs, setRssLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogDetails, setShowLogDetails] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const configRes = await fetch(`${BACKEND_URL}/api/youtube-rss/config`);
      const configData = await configRes.json();
      setConfig(configData);

      const statsRes = await fetch(`${BACKEND_URL}/api/youtube-rss/stats`);
      const statsData = await statsRes.json();
      setStats(statsData);

      const channelsRes = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/by-channel`);
      const channelsData = await channelsRes.json();
      setChannelVideos(channelsData.channels || []);

      // Fetch total registered channels count
      const totalChannelsRes = await fetch(`${BACKEND_URL}/api/youtube-channels`);
      const totalChannelsData = await totalChannelsRes.json();
      setTotalChannels(Array.isArray(totalChannelsData) ? totalChannelsData.length : 0);
      
      // Fetch count of videos needing language identification
      const identifyCountRes = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/needs-identification/count`);
      const identifyCountData = await identifyCountRes.json();
      setIdentifyCount(identifyCountData.count || 0);
      
      // Fetch RSS logs
      const logsRes = await fetch(`${BACKEND_URL}/api/youtube-rss/logs`);
      const logsData = await logsRes.json();
      setRssLogs(logsData.logs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchVideosNeedingIdentification = async () => {
    setIdentifyLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/needs-identification`);
      const data = await res.json();
      setVideosNeedingId(data.videos || []);
      setLanguageSelections({});
    } catch (error) {
      console.error('Error fetching videos:', error);
      setMessage({ type: 'error', text: 'Failed to load videos' });
    } finally {
      setIdentifyLoading(false);
    }
  };
  
  const handleOpenIdentifyModal = () => {
    setShowIdentifyModal(true);
    fetchVideosNeedingIdentification();
  };
  
  const handleLanguageSelect = (videoId, language) => {
    setLanguageSelections(prev => ({
      ...prev,
      [videoId]: language
    }));
  };
  
  const handleSaveLanguages = async () => {
    const updates = Object.entries(languageSelections)
      .filter(([_, lang]) => lang)
      .map(([videoId, language]) => ({ video_id: videoId, language }));
    
    if (updates.length === 0) {
      setMessage({ type: 'error', text: 'Please select languages for at least one video' });
      return;
    }
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/update-language/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const data = await res.json();
      setMessage({ type: 'success', text: `Updated ${data.updated_count} videos` });
      
      // Refresh the list
      fetchVideosNeedingIdentification();
      fetchData();
    } catch (error) {
      console.error('Error updating languages:', error);
      setMessage({ type: 'error', text: 'Failed to update languages' });
    }
  };

  const handleToggleScheduler = async () => {
    try {
      const newEnabled = !config.enabled;
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: newEnabled,
          frequency_hours: config.frequency_hours
        })
      });
      
      if (res.ok) {
        setConfig(prev => ({ ...prev, enabled: newEnabled }));
        setMessage({ 
          type: 'success', 
          text: `RSS Scheduler ${newEnabled ? 'enabled' : 'disabled'}` 
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update scheduler' });
    }
  };

  const handleFrequencyChange = async (hours) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          frequency_hours: hours
        })
      });
      
      if (res.ok) {
        setConfig(prev => ({ ...prev, frequency_hours: hours }));
        setMessage({ type: 'success', text: `Frequency updated to ${hours} hour(s)` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update frequency' });
    }
  };

  const handleManualFetch = async () => {
    setFetching(true);
    setMessage({ type: 'info', text: 'Fetching videos from RSS feeds...' });
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/fetch-sync`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Fetched ${data.new_videos} new videos from ${data.channels_fetched} channels` 
        });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.message || 'Fetch failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to fetch videos' });
    } finally {
      setFetching(false);
    }
  };

  const handleDeleteOldVideos = async () => {
    if (!window.confirm(`Delete videos older than ${deleteOption} days? This cannot be undone.`)) {
      return;
    }
    
    setDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/old`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_to_keep: deleteOption })
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Deleted ${data.deleted_count} old videos` 
        });
        fetchData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete videos' });
    } finally {
      setDeleting(false);
    }
  };

  const handleShowVideos = async (channel, tab = 'available') => {
    setSelectedChannel(channel);
    setShowVideoList(true);
    setVideosLoading(true);
    setVideosCategoryFilter('all');
    setVideosTab(tab);
    
    try {
      const isUsed = tab === 'used' ? 'true' : 'false';
      const res = await fetch(
        `${BACKEND_URL}/api/youtube-rss/videos?channel_id=${channel.channel_id}&is_used=${isUsed}&limit=100`
      );
      const data = await res.json();
      setChannelVideosList(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setChannelVideosList([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const switchVideosTab = async (tab) => {
    if (!selectedChannel || tab === videosTab) return;
    setVideosTab(tab);
    setVideosLoading(true);
    setVideosCategoryFilter('all');
    
    try {
      const isUsed = tab === 'used' ? 'true' : 'false';
      const res = await fetch(
        `${BACKEND_URL}/api/youtube-rss/videos?channel_id=${selectedChannel.channel_id}&is_used=${isUsed}&limit=100`
      );
      const data = await res.json();
      setChannelVideosList(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setChannelVideosList([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const handleSkipVideo = async (videoId, skipped) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId, skipped })
      });
      
      if (res.ok) {
        // Update local state
        setChannelVideosList(prev => 
          prev.map(v => v.video_id === videoId ? { ...v, is_skipped: skipped } : v)
        );
      }
    } catch (error) {
      console.error('Error skipping video:', error);
    }
  };

  const handleMakeAvailable = async (videoId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/mark-available`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId })
      });
      
      if (res.ok) {
        // Remove from used list since it's now available
        setChannelVideosList(prev => prev.filter(v => v.video_id !== videoId));
      }
    } catch (error) {
      console.error('Error marking video as available:', error);
    }
  };

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Filter and sort channels
  const filteredChannels = channelVideos
    .filter(ch => {
      // Type filter
      if (filterType !== 'all' && ch.channel_type !== filterType) return false;
      // Search filter
      if (searchQuery && !ch.channel_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .map(ch => ({
      ...ch,
      used_count: ch.video_count - ch.unused_count // Add computed used_count for sorting
    }))
    .sort((a, b) => {
      const { key, direction } = sortConfig;
      let aVal = a[key];
      let bVal = b[key];
      
      // Handle string vs number sorting
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const videoCategories = [...new Set(channelVideosList.map(v => v.detected_category || 'Other'))].sort();
  
  const filteredVideosList = videosCategoryFilter === 'all'
    ? channelVideosList
    : channelVideosList.filter(v => (v.detected_category || 'Other') === videosCategoryFilter);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTypeLabel = (type) => {
    const labels = {
      production_house: 'Production House',
      music_label: 'Music Label',
      popular_channel: 'Popular Channel',
      movie_channel: 'Movie Channel',
      news_channel: 'News Channel',
      tv_channel: 'TV Channel',
      reality_show: 'Reality Show'
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      production_house: 'bg-blue-100 text-blue-700',
      music_label: 'bg-purple-100 text-purple-700',
      popular_channel: 'bg-green-100 text-green-700',
      movie_channel: 'bg-red-100 text-red-700',
      news_channel: 'bg-orange-100 text-orange-700',
      tv_channel: 'bg-cyan-100 text-cyan-700',
      reality_show: 'bg-pink-100 text-pink-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      'Trailer': 'bg-red-100 text-red-700',
      'Teaser': 'bg-orange-100 text-orange-700',
      'First Look': 'bg-amber-100 text-amber-700',
      'Glimpse or Promos': 'bg-yellow-100 text-yellow-700',
      'Song': 'bg-pink-100 text-pink-700',
      'Interview': 'bg-blue-100 text-blue-700',
      'Press Meet': 'bg-indigo-100 text-indigo-700',
      'Events': 'bg-purple-100 text-purple-700',
      'Speech': 'bg-violet-100 text-violet-700',
      'Making Videos': 'bg-cyan-100 text-cyan-700',
      'Review': 'bg-teal-100 text-teal-700',
      'Shorts': 'bg-rose-100 text-rose-700',
      'Full Movie': 'bg-slate-100 text-slate-700',
      'Other': 'bg-gray-100 text-gray-600'
    };
    return colors[category] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-900">Manage YouTube Videos</h2>
            <p className="text-sm text-gray-600 mt-1">Configure RSS scheduler and manage video collection</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mx-6 mt-4 px-4 py-2 rounded-lg text-sm text-left ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reports
            </button>
            <button
              onClick={() => setActiveTab('channel-videos')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'channel-videos'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Channel Videos
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Logs
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ minHeight: '500px' }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <>
              {/* REPORTS TAB */}
              {activeTab === 'reports' && (
                <>
              {/* RSS Scheduler Config */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4 text-left">
                <h3 className="font-semibold text-gray-900">RSS Feed Scheduler</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700">Enable automatic RSS fetching</p>
                    <p className="text-xs text-gray-500">Fetches videos from all channels without using YouTube API quota</p>
                  </div>
                  <button
                    onClick={handleToggleScheduler}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.enabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {config.enabled && (
                  <div className="space-y-3 pt-2 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Fetch Frequency</label>
                      <select
                        value={config.frequency_hours}
                        onChange={(e) => handleFrequencyChange(parseInt(e.target.value))}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value={1}>Every 1 hour</option>
                        <option value={2}>Every 2 hours</option>
                        <option value={3}>Every 3 hours</option>
                        <option value={4}>Every 4 hours</option>
                        <option value={6}>Every 6 hours</option>
                        <option value={12}>Every 12 hours</option>
                        <option value={24}>Every 24 hours</option>
                      </select>
                    </div>
                    
                    <div className="flex gap-4 text-xs text-gray-600">
                      <span>Last Fetch: <strong>{formatDate(config.last_fetch)}</strong></span>
                      <span>Next Fetch: <strong>{formatDate(config.next_fetch)}</strong></span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleManualFetch}
                  disabled={fetching}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    fetching
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {fetching ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Fetching...
                    </>
                  ) : (
                    'Fetch Now'
                  )}
                </button>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-left">
                  <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                  <div className="text-xs text-blue-600">Total Videos</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-left">
                  <div className="text-2xl font-bold text-green-600">{stats.unused}</div>
                  <div className="text-xs text-green-600">Available</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-left">
                  <div className="text-2xl font-bold text-purple-600">{stats.used}</div>
                  <div className="text-xs text-purple-600">Used</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-left">
                  <div className="text-2xl font-bold text-orange-600">{channelVideos.length}<span className="text-sm font-normal text-orange-400">/{totalChannels}</span></div>
                  <div className="text-xs text-orange-600">Channels with Videos</div>
                </div>
              </div>

              {/* Delete Old Videos */}
              <div className="bg-red-50 rounded-lg p-4 space-y-3 text-left">
                <h3 className="font-semibold text-red-900">Cleanup Old Videos</h3>
                <p className="text-xs text-red-700">
                  Delete videos older than the selected period. This only removes from the staging collection, 
                  not published articles.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={deleteOption}
                    onChange={(e) => setDeleteOption(parseInt(e.target.value))}
                    className="px-3 py-2 border border-red-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value={30}>Keep last 30 days</option>
                    <option value={60}>Keep last 60 days</option>
                    <option value={90}>Keep last 90 days</option>
                    <option value={180}>Keep last 180 days</option>
                    <option value={365}>Keep last 1 year</option>
                  </select>
                  <button
                    onClick={handleDeleteOldVideos}
                    disabled={deleting}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      deleting
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {deleting ? 'Deleting...' : 'Delete Old Videos'}
                  </button>
                </div>
              </div>

              {/* Identify Language Section */}
              {identifyCount > 0 && (
                <div className="bg-yellow-50 rounded-lg p-4 space-y-3 text-left">
                  <h3 className="font-semibold text-yellow-900">Videos Needing Language Identification</h3>
                  <p className="text-xs text-yellow-700">
                    {identifyCount} videos from multi-language channels need manual language assignment.
                    These videos don't have language tags in their titles.
                  </p>
                  <button
                    onClick={handleOpenIdentifyModal}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 transition-colors"
                  >
                    Identify Videos ({identifyCount})
                  </button>
                </div>
              )}
                </>
              )}

              {/* CHANNEL VIDEOS TAB */}
              {activeTab === 'channel-videos' && (
              <div className="space-y-3 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Search channels..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 w-48"
                    />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="all">All Types</option>
                      <option value="production_house">Production Houses</option>
                      <option value="music_label">Music Labels</option>
                      <option value="popular_channel">Popular Channels</option>
                      <option value="movie_channel">Movie Channels</option>
                      <option value="news_channel">News Channels</option>
                      <option value="tv_channel">TV Channels</option>
                      <option value="reality_show">Reality Shows</option>
                      <option value="ott_channel">OTT Channels</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {filteredChannels.length === 0 ? (
                      <div className="p-4 text-left text-gray-500 text-sm">
                        {searchQuery ? `No channels matching "${searchQuery}"` : 'No videos in collection. Click "Fetch Now" to load videos from RSS feeds.'}
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th 
                              className="text-left px-4 py-2 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('channel_name')}
                            >
                              Channel {getSortIcon('channel_name')}
                            </th>
                            <th 
                              className="text-left px-4 py-2 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('channel_type')}
                            >
                              Type {getSortIcon('channel_type')}
                            </th>
                            <th 
                              className="text-left px-4 py-2 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('video_count')}
                            >
                              Total {getSortIcon('video_count')}
                            </th>
                            <th 
                              className="text-left px-4 py-2 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('unused_count')}
                            >
                              Available {getSortIcon('unused_count')}
                            </th>
                            <th 
                              className="text-left px-4 py-2 font-medium text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                              onClick={() => handleSort('used_count')}
                            >
                              Used {getSortIcon('used_count')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredChannels.map((channel, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-left">
                                <div className="font-medium text-gray-900">{channel.channel_name}</div>
                              </td>
                              <td className="px-4 py-2 text-left">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(channel.channel_type)}`}>
                                  {getTypeLabel(channel.channel_type)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-left font-medium text-gray-900">
                                {channel.video_count}
                              </td>
                              <td className="px-4 py-2 text-left">
                                <button
                                  onClick={() => handleShowVideos(channel, 'available')}
                                  className="text-green-600 font-medium hover:text-green-800 hover:underline cursor-pointer"
                                  title="Click to view available videos"
                                >
                                  {channel.unused_count}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-left">
                                <button
                                  onClick={() => handleShowVideos(channel, 'used')}
                                  className="text-purple-600 font-medium hover:text-purple-800 hover:underline cursor-pointer"
                                  title="Click to view used videos"
                                >
                                  {channel.video_count - channel.unused_count}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* LOGS TAB */}
              {activeTab === 'logs' && (
                <div className="space-y-4 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">RSS Fetch Logs</h3>
                    <p className="text-sm text-gray-500">{rssLogs.length} recorded runs</p>
                  </div>
                  
                  {rssLogs.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p>No RSS fetch logs yet</p>
                      <p className="text-xs mt-1">Logs will appear here after each RSS fetch run</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-gray-700">Date & Time</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-700">Channels</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-700">New Videos</th>
                              <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {rssLogs.map((log, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-900">
                                  {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-700">
                                  {log.channels_processed || 0}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => {
                                      setSelectedLog(log);
                                      setShowLogDetails(true);
                                    }}
                                    className="text-blue-600 font-medium hover:text-blue-800 hover:underline"
                                  >
                                    {log.new_videos_count || 0}
                                  </button>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    log.status === 'success' 
                                      ? 'bg-green-100 text-green-700'
                                      : log.status === 'partial'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {log.status || 'unknown'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500 text-left">
              Videos are fetched via RSS feeds (no API quota used). Enable scheduler for automatic updates.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Log Details Popup */}
      {showLogDetails && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">RSS Fetch Details</h3>
                <p className="text-sm text-gray-600">{new Date(selectedLog.timestamp).toLocaleString()}</p>
              </div>
              <button
                onClick={() => {
                  setShowLogDetails(false);
                  setSelectedLog(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-blue-50 p-3 rounded-lg text-left">
                  <p className="text-blue-600 font-medium">{selectedLog.channels_processed || 0}</p>
                  <p className="text-blue-500 text-xs">Channels Processed</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-left">
                  <p className="text-green-600 font-medium">{selectedLog.new_videos_count || 0}</p>
                  <p className="text-green-500 text-xs">New Videos Added</p>
                </div>
              </div>
              
              <h4 className="font-medium text-gray-900 mb-2 text-left">Videos by Channel</h4>
              {selectedLog.channel_breakdown && selectedLog.channel_breakdown.length > 0 ? (
                <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                  {selectedLog.channel_breakdown.map((ch, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="text-gray-700 text-left">{ch.channel_name}</span>
                      <span className="font-medium text-gray-900">{ch.new_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-left">No channel breakdown available</p>
              )}
            </div>
            
            <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setShowLogDetails(false);
                  setSelectedLog(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video List Popup */}
      {showVideoList && selectedChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Popup Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-lg font-bold text-gray-900">{selectedChannel.channel_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredVideosList.length} {videosTab === 'used' ? 'used' : 'available'} videos
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowVideoList(false);
                    setSelectedChannel(null);
                    setChannelVideosList([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Tabs for Available/Used */}
              <div className="mt-3 flex items-center gap-2 border-b border-gray-200">
                <button
                  onClick={() => switchVideosTab('available')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    videosTab === 'available'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Available
                </button>
                <button
                  onClick={() => switchVideosTab('used')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    videosTab === 'used'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Used
                </button>
              </div>
              
              {/* Category Filter */}
              {videoCategories.length > 1 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap text-left">
                  <span className="text-xs text-gray-500">Filter:</span>
                  <button
                    onClick={() => setVideosCategoryFilter('all')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      videosCategoryFilter === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All ({channelVideosList.length})
                  </button>
                  {videoCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setVideosCategoryFilter(cat)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        videosCategoryFilter === cat
                          ? getCategoryBadgeColor(cat)
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat} ({channelVideosList.filter(v => (v.detected_category || 'Other') === cat).length})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Popup Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {videosLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : filteredVideosList.length === 0 ? (
                <div className="text-left py-12 text-gray-500">
                  No available videos in this channel
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredVideosList.map((video, idx) => (
                    <div
                      key={video.video_id || idx}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex gap-3">
                        {/* Thumbnail */}
                        {video.thumbnail && (
                          <a
                            href={video.video_url || `https://www.youtube.com/watch?v=${video.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <img
                              src={video.thumbnail}
                              alt=""
                              className="w-32 h-20 object-cover rounded"
                            />
                          </a>
                        )}
                        
                        {/* Video Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <a
                            href={video.video_url || `https://www.youtube.com/watch?v=${video.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-sm font-medium hover:text-red-600 line-clamp-2 ${video.is_skipped ? 'text-gray-400 line-through' : 'text-gray-900'}`}
                          >
                            {video.title}
                          </a>
                          
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Category Badge */}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeColor(video.detected_category || 'Other')}`}>
                              {video.detected_category || 'Other'}
                            </span>
                            
                            {/* Language Badge */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {video.detected_language || (video.languages && video.languages[0]) || 'Unknown'}
                            </span>
                            
                            {/* Date */}
                            <span className="text-xs text-gray-500">
                              {formatShortDate(video.published_at)}
                            </span>
                            
                            {/* Skip/Unskip Button - only show for available videos */}
                            {videosTab === 'available' && (
                              <button
                                onClick={() => handleSkipVideo(video.video_id, !video.is_skipped)}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  video.is_skipped 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                }`}
                              >
                                {video.is_skipped ? 'Unskip' : 'Skip'}
                              </button>
                            )}
                            
                            {/* Make Available Button - only show for used videos */}
                            {videosTab === 'used' && (
                              <button
                                onClick={() => handleMakeAvailable(video.video_id)}
                                className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                              >
                                Make Available
                              </button>
                            )}
                            
                            {/* Skipped Badge */}
                            {video.is_skipped && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                                Skipped
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex justify-end">
              <button
                onClick={() => {
                  setShowVideoList(false);
                  setSelectedChannel(null);
                  setChannelVideosList([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Identify Language Modal */}
      {showIdentifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-yellow-50">
              <div className="text-left">
                <h3 className="text-lg font-bold text-gray-900">Identify Video Languages</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Assign languages to videos from multi-language channels
                </p>
              </div>
              <button
                onClick={() => setShowIdentifyModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {identifyLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-600"></div>
                </div>
              ) : videosNeedingId.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No videos need language identification</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {videosNeedingId.map((video) => (
                    <div key={video.video_id} className="bg-gray-50 rounded-lg p-4 flex items-start gap-4">
                      <img
                        src={video.thumbnail || 'https://via.placeholder.com/120x90'}
                        alt={video.title}
                        className="w-28 h-20 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <a
                          href={`https://www.youtube.com/watch?v=${video.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-gray-900 text-sm line-clamp-2 mb-1 hover:text-red-600 hover:underline cursor-pointer block"
                        >
                          {video.title}
                        </a>
                        <p className="text-xs text-gray-500 mb-2">
                          {video.channel_name}
                        </p>
                        <select
                          value={languageSelections[video.video_id] || ''}
                          onChange={(e) => handleLanguageSelect(video.video_id, e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                        >
                          <option value="">Select Language</option>
                          <option value="Telugu">Telugu</option>
                          <option value="Tamil">Tamil</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Kannada">Kannada</option>
                          <option value="Malayalam">Malayalam</option>
                          <option value="Bengali">Bengali</option>
                          <option value="Marathi">Marathi</option>
                          <option value="Punjabi">Punjabi</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {Object.values(languageSelections).filter(Boolean).length} of {videosNeedingId.length} selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowIdentifyModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLanguages}
                  disabled={Object.values(languageSelections).filter(Boolean).length === 0}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    Object.values(languageSelections).filter(Boolean).length > 0
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save Languages
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageVideosModal;
