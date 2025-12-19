import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ManageVideosModal = ({ onClose }) => {
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
  const [filterType, setFilterType] = useState('all');
  const [deleteOption, setDeleteOption] = useState(30);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Video list popup state
  const [showVideoList, setShowVideoList] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelVideosList, setChannelVideosList] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosCategoryFilter, setVideosCategoryFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch config
      const configRes = await fetch(`${BACKEND_URL}/api/youtube-rss/config`);
      const configData = await configRes.json();
      setConfig(configData);

      // Fetch stats
      const statsRes = await fetch(`${BACKEND_URL}/api/youtube-rss/stats`);
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch channel video counts
      const channelsRes = await fetch(`${BACKEND_URL}/api/youtube-rss/videos/by-channel`);
      const channelsData = await channelsRes.json();
      setChannelVideos(channelsData.channels || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
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
        fetchData(); // Refresh stats
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
        fetchData(); // Refresh stats
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete videos' });
    } finally {
      setDeleting(false);
    }
  };

  // Handle clicking on available count to show video list
  const handleShowVideos = async (channel) => {
    setSelectedChannel(channel);
    setShowVideoList(true);
    setVideosLoading(true);
    setVideosCategoryFilter('all');
    
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/youtube-rss/videos?channel_id=${channel.channel_id}&is_used=false&limit=100`
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

  const filteredChannels = filterType === 'all' 
    ? channelVideos 
    : channelVideos.filter(ch => ch.channel_type === filterType);

  // Get unique categories from video list
  const videoCategories = [...new Set(channelVideosList.map(v => v.detected_category || 'Other'))].sort();
  
  // Filter videos by category
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
      production_house: '🎬 Production House',
      music_label: '🎵 Music Label',
      popular_channel: '📺 Popular Channel'
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      production_house: 'bg-blue-100 text-blue-700',
      music_label: 'bg-purple-100 text-purple-700',
      popular_channel: 'bg-green-100 text-green-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      'Trailer': 'bg-red-100 text-red-700',
      'Teaser': 'bg-orange-100 text-orange-700',
      'First Look': 'bg-amber-100 text-amber-700',
      'Glimpse': 'bg-yellow-100 text-yellow-700',
      'Motion Poster': 'bg-lime-100 text-lime-700',
      'Song': 'bg-pink-100 text-pink-700',
      'Interview': 'bg-blue-100 text-blue-700',
      'Press Meet': 'bg-indigo-100 text-indigo-700',
      'Event': 'bg-purple-100 text-purple-700',
      'Speech': 'bg-violet-100 text-violet-700',
      'Behind The Scenes': 'bg-cyan-100 text-cyan-700',
      'Review': 'bg-teal-100 text-teal-700',
      'Promo': 'bg-emerald-100 text-emerald-700',
      'Short': 'bg-rose-100 text-rose-700',
      'Full Movie': 'bg-slate-100 text-slate-700',
      'Other': 'bg-gray-100 text-gray-600'
    };
    return colors[category] || 'bg-gray-100 text-gray-600';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Trailer': '🎬',
      'Teaser': '🎥',
      'First Look': '👀',
      'Glimpse': '✨',
      'Motion Poster': '🖼️',
      'Song': '🎵',
      'Interview': '🎤',
      'Press Meet': '📰',
      'Event': '🎉',
      'Speech': '🎙️',
      'Behind The Scenes': '🎞️',
      'Review': '⭐',
      'Promo': '📢',
      'Short': '📱',
      'Full Movie': '🎦',
      'Other': '📹'
    };
    return icons[category] || '📹';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">📺</span>
              Manage YouTube Videos
            </h2>
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
          <div className={`mx-6 mt-4 px-4 py-2 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-100 text-green-700' :
            message.type === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          ) : (
            <>
              {/* RSS Scheduler Config */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>⏰</span> RSS Feed Scheduler
                </h3>
                
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fetch Frequency
                      </label>
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
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Fetch Now
                    </>
                  )}
                </button>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                  <div className="text-xs text-blue-600">Total Videos</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.unused}</div>
                  <div className="text-xs text-green-600">Available</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.used}</div>
                  <div className="text-xs text-purple-600">Used</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{channelVideos.length}</div>
                  <div className="text-xs text-orange-600">Channels</div>
                </div>
              </div>

              {/* Delete Old Videos */}
              <div className="bg-red-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-red-900 flex items-center gap-2">
                  <span>🗑️</span> Cleanup Old Videos
                </h3>
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

              {/* Channel Video Counts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Videos by Channel</h3>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="all">All Types</option>
                    <option value="production_house">🎬 Production Houses</option>
                    <option value="music_label">🎵 Music Labels</option>
                    <option value="popular_channel">📺 Popular Channels</option>
                  </select>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto">
                    {filteredChannels.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No videos in collection. Click "Fetch Now" to load videos from RSS feeds.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-700">Channel</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-700">Type</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-700">Videos</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-700">Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredChannels.map((channel, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="font-medium text-gray-900">{channel.channel_name}</div>
                                <div className="text-xs text-gray-500 font-mono">{channel.channel_id}</div>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(channel.channel_type)}`}>
                                  {getTypeLabel(channel.channel_type)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-gray-900">
                                {channel.video_count}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={() => handleShowVideos(channel)}
                                  className="text-green-600 font-medium hover:text-green-800 hover:underline cursor-pointer"
                                  title="Click to view available videos"
                                >
                                  {channel.unused_count}
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
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

      {/* Video List Popup */}
      {showVideoList && selectedChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Popup Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>📹</span>
                    Available Videos
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedChannel.channel_name} • {filteredVideosList.length} videos
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
              
              {/* Category Filter */}
              {videoCategories.length > 1 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
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
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                        videosCategoryFilter === cat
                          ? getCategoryBadgeColor(cat)
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{getCategoryIcon(cat)}</span>
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
                <div className="text-center py-12 text-gray-500">
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
                        <div className="flex-1 min-w-0">
                          <a
                            href={video.video_url || `https://www.youtube.com/watch?v=${video.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 hover:text-red-600 line-clamp-2"
                          >
                            {video.title}
                          </a>
                          
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {/* Category Badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeColor(video.detected_category || 'Other')}`}>
                              <span>{getCategoryIcon(video.detected_category || 'Other')}</span>
                              {video.detected_category || 'Other'}
                            </span>
                            
                            {/* Language Badge */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              🌐 {video.detected_language || (video.languages && video.languages[0]) || 'Unknown'}
                            </span>
                            
                            {/* Date */}
                            <span className="text-xs text-gray-500">
                              📅 {formatShortDate(video.published_at)}
                            </span>
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
    </div>
  );
};

export default ManageVideosModal;
