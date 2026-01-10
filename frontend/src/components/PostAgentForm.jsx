import React, { useState, useEffect } from 'react';

const PostAgentForm = ({ onClose, onSave, editingAgent }) => {
  const [activeTab, setActiveTab] = useState('recurring');
  const [categoryFilters, setCategoryFilters] = useState({}); // Store filters per category
  const [formData, setFormData] = useState({
    agent_name: '',
    agent_type: 'post',
    mode: 'recurring',
    schedule_selection: 'all_days',
    selected_days: [],
    post_time: '09:00 AM',
    timezone: 'IST',
    category: '',
    target_state: '',
    article_language: 'en',
    content_type: 'post',
    word_count: '<100',
    split_content: false,
    split_paragraphs: 2,
    reference_urls: [],
    image_option: 'web_search',
    content_workflow: 'in_review',
    is_top_story: false,
    comments_enabled: true,
    schedule_post: false,
    post_date: '',
    adhoc_post_time: '09:00 AM',
    is_active: true,
    custom_prompt: '',  // Custom prompt for this agent instance
    // Photo Gallery Agent fields
    gallery_type: 'vertical',
    gallery_category: 'Actress',
    tadka_pics_enabled: false,
    max_images: 50,
    // Tadka Pics Agent fields
    source_type: 'websites',  // 'websites' or 'instagram'
    instagram_content_type: 'photos',  // 'photos' or 'reels'
    instagram_urls: [],
    // Video Agent fields
    video_category: 'trailers_teasers',  // trailers_teasers, latest_video_songs, events_interviews, tadka_shorts
    target_language: '',  // Target language for video filtering (Telugu, Tamil, Hindi, etc.)
    search_query: '',  // Optional specific search query
    max_videos: 5,
    channel_types: [],  // YouTube channel types - NO DEFAULTS, user must select
    content_filter: 'videos',  // 'videos', 'shorts', or 'both'
    // Filter settings (editable keywords)
    include_keywords: '',
    exclude_keywords: '',
    // Post Aggregation fields
    enable_aggregation: false,  // Enable post grouping
    aggregation_lookback_days: 2,  // Days to look back for grouping
    // TV Video Agent fields
    tv_video_category: 'tv-today',  // tv-today, tv-today-hindi, news-today, news-today-hindi
    aggregate_by_channel: true,  // Always aggregate by channel name for TV Video Agent
    tv_channel_types: ['tv_channel', 'news_channel'],  // Default channel types for TV Video Agent
    lookback_days: 2,  // Period to fetch videos (1-30 days)
    // Reality Shows Agent fields
    reality_show_category: 'tv-reality-shows',  // tv-reality-shows, tv-reality-shows-hindi
    reality_show_name: '',  // Specific reality show to fetch from (e.g., "Bigg Boss", "Indian Idol")
    youtube_channel_id: '',  // YouTube channel ID for the reality show
    include_keywords: '',  // Comma-separated keywords that must be in video titles
    reality_show_lookback_days: 2,  // Days to look back for videos
    // OTT Release Agent fields
    ott_language: 'Hindi',  // Language filter for OTT releases
    ott_streaming_now: true,  // Fetch "Streaming Now" releases
    ott_streaming_soon: false,  // Fetch "Streaming Soon" releases
    ott_fetch_limit: 10,  // Number of releases to fetch
    // Theater Release Agent fields
    theater_fetch_limit: 10,  // Number of releases to fetch
    theater_include_english: true,  // Include English language movies
    theater_search_trailers: false  // Search YouTube RSS for trailers
  });
  
  // Default filter settings for each category
  const defaultFilterSettings = {
    trailers_teasers: {
      include: ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
      exclude: ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making', 'dubbed', 'full movie', 'song promo', 'promo song']
    },
    latest_video_songs: {
      include: ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
      exclude: ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'best of', 'top 10', 'mashup', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored']
    },
    events_interviews: {
      include: ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
      exclude: ['trailer', 'teaser', 'song']
    },
    tadka_shorts: {
      include: ['shorts', 'reels', 'hot', 'photoshoot'],
      exclude: []
    },
    // Bollywood categories
    trailers_teasers_bollywood: {
      include: ['trailer', 'teaser', 'first look', 'glimpse', 'motion poster'],
      exclude: ['reaction', 'review', 'explained', 'scene', 'behind the scenes', 'making', 'dubbed', 'full movie', 'song promo', 'promo song']
    },
    latest_video_songs_bollywood: {
      include: ['lyrical', 'video song', 'full video', 'full song', 'song', 'promo'],
      exclude: ['reaction', 'cover', 'karaoke', 'instrumental', 'scene', 'making', 'behind', 'dubbed', 'full movie', 'jukebox', 'scenes', 'comedy', 'best of', 'top 10', 'mashup', 'trailer', 'teaser', 'first look', 'glimpse', 'audio', '8k', 'remastered', 'restored']
    },
    events_interviews_bollywood: {
      include: ['interview', 'press meet', 'event', 'promotion', 'launch', 'speech'],
      exclude: ['trailer', 'teaser', 'song']
    },
    tadka_shorts_bollywood: {
      include: ['shorts', 'reels', 'hot', 'photoshoot'],
      exclude: []
    }
  };
  
  const [showAgentPromptEditor, setShowAgentPromptEditor] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [categories, setCategories] = useState([]);
  const [states, setStates] = useState([]);
  const [stateSearch, setStateSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryPromptMappings, setCategoryPromptMappings] = useState({});
  const [realityShows, setRealityShows] = useState([]);

  useEffect(() => {
    if (editingAgent) {
      const agentType = editingAgent.agent_type || 'post';
      const videoCategory = editingAgent.video_category || 'trailers_teasers';
      
      // Get default filter settings for the category if not provided
      const defaults = defaultFilterSettings[videoCategory] || { include: [], exclude: [] };
      const includeKw = editingAgent.include_keywords || defaults.include.join(', ');
      const excludeKw = editingAgent.exclude_keywords || defaults.exclude.join(', ');
      
      // Initialize categoryFilters with the current agent's filters
      if (videoCategory && (editingAgent.include_keywords || editingAgent.exclude_keywords)) {
        setCategoryFilters({
          [videoCategory]: {
            include: includeKw,
            exclude: excludeKw
          }
        });
      }
      
      setFormData(prev => ({
        ...prev,
        ...editingAgent,
        selected_days: editingAgent.selected_days || [],
        // Ensure agent_type is set from editingAgent
        agent_type: agentType,
        // Pre-select category based on agent type
        category: editingAgent.category || (agentType === 'photo_gallery' ? 'photoshoots' : agentType === 'video' ? 'trailers-teasers' : agentType === 'tv_video' ? 'tv-today' : prev.category),
        // Set content_type to video for video and tv_video agents
        content_type: (agentType === 'video' || agentType === 'tv_video') ? 'video' : (editingAgent.content_type || prev.content_type),
        // Set channel types based on agent type
        channel_types: agentType === 'tv_video' 
          ? (editingAgent.tv_channel_types || editingAgent.channel_types || ['tv_channel', 'news_channel'])
          : (editingAgent.channel_types || prev.channel_types),
        tv_channel_types: agentType === 'tv_video'
          ? (editingAgent.tv_channel_types || editingAgent.channel_types || ['tv_channel', 'news_channel'])
          : undefined,
        // Set filter keywords
        include_keywords: includeKw,
        exclude_keywords: excludeKw
      }));
      setActiveTab(editingAgent.mode || 'recurring');
    }
    fetchCategories();
    fetchStates();
    fetchCategoryPromptMappings();
    fetchRealityShows();
  }, [editingAgent]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/config`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchStates = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/config`);
      const data = await response.json();
      setStates(data.states || []);
    } catch (error) {
      console.error('Failed to fetch states:', error);
    }
  };

  const fetchRealityShows = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/reality-shows`);
      const data = await response.json();
      setRealityShows(data || []);
      console.log('✅ Loaded reality shows from system settings:', data);
    } catch (error) {
      console.error('Failed to fetch reality shows:', error);
    }
  };

  const timeSlots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const hourDisplay = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const period = hour < 12 ? 'AM' : 'PM';
      const minuteDisplay = minute === 0 ? '00' : minute;
      timeSlots.push(`${hourDisplay}:${minuteDisplay} ${period}`);
    }
  }

  const wordCounts = ['<100', '<150', '<200', '<250', '<300', '<350', '<400', '<450', '<500'];
  
  const languageOptions = [
    { code: 'en', name: 'English' },
    { code: 'te', name: 'Telugu' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'kn', name: 'Kannada' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'pa', name: 'Punjabi' }
  ];

  const contentTypeOptions = [
    { value: 'post', label: 'Post' },
    { value: 'video_post', label: 'Video Post' },
    { value: 'video', label: 'Video' },
    { value: 'photo', label: 'Photo Gallery' },
    { value: 'movie_review', label: 'Movie Review' },
    { value: 'ott_review', label: 'OTT Review' }
  ];

  const imageOptions = [
    { value: 'ai_generate', label: 'AI Generate' },
    { value: 'upload', label: 'Upload Image' },
    { value: 'existing', label: 'Use Existing Image' },
    { value: 'web_search', label: 'Web Search' }
  ];

  const workflowOptions = [
    { value: 'in_review', label: 'In Review' },
    { value: 'ready_to_publish', label: 'Approved' },
    { value: 'auto_post', label: 'Auto Publish' }
  ];

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const fetchCategoryPromptMappings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/category-prompt-mappings`);
      const data = await response.json();
      setCategoryPromptMappings(data.mappings || {});
    } catch (error) {
      console.error('Failed to fetch mappings:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Update form data
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        mode: activeTab
      };
      
      // If updating include/exclude keywords, also update categoryFilters
      if ((name === 'include_keywords' || name === 'exclude_keywords') && prev.video_category) {
        setCategoryFilters(prevFilters => ({
          ...prevFilters,
          [prev.video_category]: {
            include: name === 'include_keywords' ? value : (prevFilters[prev.video_category]?.include || prev.include_keywords),
            exclude: name === 'exclude_keywords' ? value : (prevFilters[prev.video_category]?.exclude || prev.exclude_keywords)
          }
        }));
      }
      
      return newData;
    });
  };

  const handleDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      selected_days: prev.selected_days.includes(day)
        ? prev.selected_days.filter(d => d !== day)
        : [...prev.selected_days, day]
    }));
  };

  const addReferenceUrl = () => {
    setFormData(prev => ({
      ...prev,
      reference_urls: [...prev.reference_urls, { url: '', url_type: 'auto' }]
    }));
  };

  const updateReferenceUrl = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      reference_urls: prev.reference_urls.map((item, i) => {
        if (i !== index) return item;
        // Handle both old format (string) and new format (object)
        if (typeof item === 'string') {
          return field === 'url' ? { url: value, url_type: 'auto' } : { url: item, url_type: value };
        }
        return { ...item, [field]: value };
      })
    }));
  };

  const removeReferenceUrl = (index) => {
    setFormData(prev => ({
      ...prev,
      reference_urls: prev.reference_urls.filter((_, i) => i !== index)
    }));
  };

  // Helper to get URL value (handles both old string format and new object format)
  const getUrlValue = (item) => {
    return typeof item === 'string' ? item : (item?.url || '');
  };

  // Helper to get URL type (handles both old string format and new object format)
  const getUrlType = (item) => {
    return typeof item === 'string' ? 'auto' : (item?.url_type || 'auto');
  };

  const urlTypeOptions = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'listing', label: 'Listing Page' },
    { value: 'direct', label: 'Direct Article' }
  ];

  // Instagram URL helpers
  const addInstagramUrl = () => {
    setFormData(prev => ({
      ...prev,
      instagram_urls: [...prev.instagram_urls, '']
    }));
  };

  const updateInstagramUrl = (index, value) => {
    setFormData(prev => ({
      ...prev,
      instagram_urls: prev.instagram_urls.map((url, i) => i === index ? value : url)
    }));
  };

  const removeInstagramUrl = (index) => {
    setFormData(prev => ({
      ...prev,
      instagram_urls: prev.instagram_urls.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Check if we're editing an existing agent (has id) or creating new
      const isEditing = editingAgent && editingAgent.id;
      const url = isEditing
        ? `${process.env.REACT_APP_BACKEND_URL}/api/ai-agents/${editingAgent.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/ai-agents`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Agent ${isEditing ? 'updated' : 'created'} successfully!` });
        setTimeout(() => {
          onSave();
        }, 1500);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to save agent' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save agent' });
    } finally {
      setLoading(false);
    }
  };

  const filteredStates = states.filter(state =>
    state.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-10">
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingAgent ? 'Edit' : 'Create'} {
                formData.agent_type === 'ott_release' ? 'OTT Release Agent' :
                formData.agent_type === 'reality_show' ? 'Reality Show Agent' :
                formData.agent_type === 'tv_video' ? 'TV Video Agent' :
                formData.agent_type === 'video' ? 'Video Agent' :
                formData.agent_type === 'photo_gallery' ? 'Photo Gallery Agent' :
                formData.agent_type === 'tadka_pics' ? 'Tadka Pics Agent' :
                'Post Agent'
              }
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {formData.agent_type === 'ott_release' 
                ? 'Configure OTT release fetching from Binged.com' 
                : 'Configure your automated post generation agent'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <div className="flex gap-4 items-center">
              <button
                type="button"
                onClick={() => {
                  // Only allow tab switching for new agents (no id means new agent)
                  if (!editingAgent?.id) setActiveTab('recurring');
                }}
                disabled={editingAgent?.id && editingAgent.mode !== 'recurring'}
                className={`py-2.5 px-4 font-medium text-xs border-b-2 transition-colors ${
                  activeTab === 'recurring'
                    ? 'border-blue-600 text-blue-600'
                    : editingAgent?.id && editingAgent.mode !== 'recurring'
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 cursor-pointer'
                }`}
              >
                Recurring Mode
              </button>
              <button
                type="button"
                onClick={() => {
                  // Only allow tab switching for new agents (no id means new agent)
                  if (!editingAgent?.id) setActiveTab('adhoc');
                }}
                disabled={editingAgent?.id && editingAgent.mode !== 'adhoc'}
                className={`py-2.5 px-4 font-medium text-xs border-b-2 transition-colors ${
                  activeTab === 'adhoc'
                    ? 'border-blue-600 text-blue-600'
                    : editingAgent?.id && editingAgent.mode !== 'adhoc'
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 cursor-pointer'
                }`}
              >
                Adhoc Mode
              </button>
              {/* Only show warning when editing existing agent (has id) */}
              {editingAgent?.id && (
                <span className="text-xs text-orange-600 ml-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-8V7m0 0V5m0 2h2m-2 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Mode cannot be changed after creation
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Recurring Mode */}
            {activeTab === 'recurring' && (
              <>
                {/* Schedule Settings Section */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2 text-left">Schedule Settings</h3>
                  
                  {/* Agent Name */}
                  <div className="text-left">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Agent Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="agent_name"
                      value={formData.agent_name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter agent name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Schedule Selection */}
                    <div className="text-left">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Schedule Selection
                      </label>
                      <select
                        name="schedule_selection"
                        value={formData.schedule_selection}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all_days">All Days</option>
                        <option value="scheduled_days">Scheduled Days</option>
                      </select>
                    </div>

                    {/* Post Time */}
                    <div className="text-left">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Post Time
                      </label>
                      <select
                        name="post_time"
                        value={formData.post_time}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {timeSlots.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Select Days */}
                  {formData.schedule_selection === 'scheduled_days' && (
                    <div className="text-left">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Select Days
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {days.map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleDayToggle(day)}
                            className={`px-3 py-1 rounded font-medium text-xs transition-colors ${
                              formData.selected_days.includes(day)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Time Zone */}
                  <div className="text-left">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Time Zone
                    </label>
                    <select
                      name="timezone"
                      value={formData.timezone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="IST">IST (Indian Standard Time)</option>
                      <option value="EST">EST (Eastern Standard Time)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Adhoc Mode */}
            {activeTab === 'adhoc' && (
              <>
                {/* Agent Name */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Agent Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="agent_name"
                    value={formData.agent_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter agent name"
                  />
                </div>

                {/* Schedule Post Checkbox */}
                <div className="flex items-center gap-2 text-left">
                  <input
                    type="checkbox"
                    name="schedule_post"
                    id="schedule_post"
                    checked={formData.schedule_post}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="schedule_post" className="text-xs font-medium text-gray-700">
                    Schedule Post
                  </label>
                </div>

                {/* Schedule Post Fields */}
                {formData.schedule_post && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="text-left">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Post Date
                      </label>
                      <input
                        type="date"
                        name="post_date"
                        value={formData.post_date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="text-left">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Post Time
                      </label>
                      <select
                        name="adhoc_post_time"
                        value={formData.adhoc_post_time}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {timeSlots.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Common Fields - Content Settings - Hide for tadka_pics, video, tv_video, reality_show, and ott_release agents */}
            {formData.agent_type !== 'tadka_pics' && formData.agent_type !== 'video' && formData.agent_type !== 'tv_video' && formData.agent_type !== 'reality_show' && formData.agent_type !== 'ott_release' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 text-left">Content Settings</h3>
              
              {/* Category Selection */}
              <div className="text-left">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  {/* Selected Category Tag */}
                  {formData.category && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {categories.find(cat => cat.slug === formData.category)?.name || formData.category}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, category: '' }))}
                          className="text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                  
                  {/* Search Input */}
                  <input
                    type="text"
                    value={showCategoryDropdown ? categorySearch : (formData.category ? categories.find(cat => cat.slug === formData.category)?.name : '')}
                    onChange={(e) => {
                      setCategorySearch(e.target.value);
                      setShowCategoryDropdown(true);
                    }}
                    onFocus={() => {
                      setCategorySearch('');
                      setShowCategoryDropdown(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setCategorySearch('');
                        setShowCategoryDropdown(false);
                      }, 200);
                    }}
                    placeholder="Search and select category..."
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  
                  {/* Dropdown appears only when typing */}
                  {showCategoryDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => {
                          setShowCategoryDropdown(false);
                          setCategorySearch('');
                        }}
                      />
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {categories
                          .filter(cat => 
                            cat.slug !== 'latest-news' && 
                            cat.name.toLowerCase() !== 'latest news' &&
                            cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                          )
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(cat => (
                            <div
                              key={cat.slug}
                              onClick={() => {
                                // Load prompt from category mapping if no custom prompt exists
                                const defaultPrompt = categoryPromptMappings[cat.slug] || '';
                                setFormData(prev => ({ 
                                  ...prev, 
                                  category: cat.slug,
                                  // Only set custom_prompt if it's empty (new agent or category changed)
                                  custom_prompt: prev.custom_prompt || defaultPrompt
                                }));
                                setCategorySearch('');
                                setShowCategoryDropdown(false);
                              }}
                              className={`px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-xs ${
                                formData.category === cat.slug ? 'bg-blue-100 text-blue-800' : 'text-gray-900'
                              }`}
                            >
                              {cat.name}
                            </div>
                          ))}
                        {categories.filter(cat => 
                          cat.slug !== 'latest-news' && 
                          cat.name.toLowerCase() !== 'latest news' &&
                          cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-1.5 text-xs text-gray-500">No categories found</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Target State */}
              <div className="text-left">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target State
                </label>
                <div className="relative">
                  {/* Selected State Tag */}
                  {formData.target_state && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {formData.target_state}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, target_state: '' }))}
                          className="text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  )}
                  
                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search and select state..."
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    onFocus={() => setStateSearch('')}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  
                  {/* Dropdown appears only when typing */}
                  {stateSearch && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                      <div
                        onClick={() => {
                          setFormData(prev => ({ ...prev, target_state: '' }));
                          setStateSearch('');
                        }}
                        className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-xs text-gray-900 border-b"
                      >
                        All States
                      </div>
                      {filteredStates.map(state => (
                        <div
                          key={state.code}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, target_state: state.name }));
                            setStateSearch('');
                          }}
                          className="px-3 py-1.5 cursor-pointer hover:bg-blue-50 text-xs text-gray-900"
                        >
                          {state.name}
                        </div>
                      ))}
                      {filteredStates.length === 0 && (
                        <div className="px-3 py-1.5 text-xs text-gray-500">No states found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Word Count */}
              <div className="text-left">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Word Count
                </label>
                <select
                  name="word_count"
                  value={formData.word_count}
                  onChange={handleInputChange}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {wordCounts.map(count => (
                    <option key={count} value={count}>{count} words</option>
                  ))}
                </select>
              </div>

              {/* Article Language & Content Type Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Article Language */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Article Language
                  </label>
                  <select
                    name="article_language"
                    value={formData.article_language}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {languageOptions.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                {/* Content Type */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    name="content_type"
                    value={formData.content_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {contentTypeOptions.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Top Story & Comments Checkboxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* Mark as Top Story */}
                <div className="flex items-center gap-2 text-left">
                  <input
                    type="checkbox"
                    name="is_top_story"
                    id="is_top_story"
                    checked={formData.is_top_story}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_top_story" className="text-xs font-medium text-gray-700">
                    Mark as Top Story
                  </label>
                </div>

                {/* Enable Comments */}
                <div className="flex items-center gap-2 text-left">
                  <input
                    type="checkbox"
                    name="comments_enabled"
                    id="comments_enabled"
                    checked={formData.comments_enabled}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="comments_enabled" className="text-xs font-medium text-gray-700">
                    Enable Comments
                  </label>
                </div>
              </div>
            </div>
            )}

            {/* Agent Prompt Section - Hide for tadka_pics and ott_release */}
            {formData.agent_type !== 'tadka_pics' && formData.agent_type !== 'ott_release' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-gray-900">Agent Prompt</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formData.agent_type === 'photo_gallery' 
                      ? 'Customize the AI prompt for generating gallery content and title'
                      : 'Customize the AI prompt for this agent (loaded from category mapping)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // If no custom prompt, load appropriate default
                    if (!formData.custom_prompt) {
                      if (formData.agent_type === 'photo_gallery') {
                        // Default gallery prompt
                        setFormData(prev => ({
                          ...prev,
                          custom_prompt: `Create engaging content for a photo gallery post.

Original Title: {title}
Artist/Celebrity: {artist_name}

Original Content:
{content}

Instructions:
1. Generate a catchy, SEO-friendly title (max 10 words)
2. Write engaging content about this photoshoot/gallery ({word_count} words max)
3. Mention the artist name naturally
4. Use professional, engaging language suitable for entertainment news
5. Format: First line should be the title, then a blank line, then the content`
                        }));
                      } else if (formData.category) {
                        setFormData(prev => ({
                          ...prev,
                          custom_prompt: categoryPromptMappings[formData.category] || ''
                        }));
                      }
                    }
                    setShowAgentPromptEditor(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Prompt
                </button>
              </div>
              
              {/* Prompt Preview */}
              <div className="bg-white rounded border border-gray-300 p-3">
                {formData.custom_prompt ? (
                  <div className="text-xs text-gray-700 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {formData.custom_prompt.substring(0, 300)}
                    {formData.custom_prompt.length > 300 && '...'}
                  </div>
                ) : formData.agent_type === 'photo_gallery' ? (
                  <div className="text-xs text-gray-500 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    <span className="text-purple-600 font-medium">[Using built-in gallery prompt]</span>
                    <br />
                    Create engaging content for a photo gallery post with title and description...
                  </div>
                ) : formData.category && categoryPromptMappings[formData.category] ? (
                  <div className="text-xs text-gray-500 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                    <span className="text-blue-600 font-medium">[Using default from category mapping]</span>
                    <br />
                    {categoryPromptMappings[formData.category].substring(0, 250)}...
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    {formData.category ? 'No prompt defined for this category. Click "Edit Prompt" to add one.' : 'Select a category first to load the default prompt.'}
                  </p>
                )}
              </div>
              
              {formData.custom_prompt && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-green-600 font-medium">✓ Using custom prompt</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, custom_prompt: '' }))}
                    className="text-xs text-red-600 hover:text-red-800 underline"
                  >
                    Reset to default
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Tadka Pics Settings Section - Only for tadka_pics agent type */}
            {formData.agent_type === 'tadka_pics' && (
              <div className="bg-orange-50 rounded-lg p-4 space-y-4 border border-orange-200">
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-orange-900">🔥 Tadka Pics Settings</h3>
                  <p className="text-xs text-orange-600 mt-0.5">Create Tadka Pics galleries from websites or Instagram</p>
                </div>
                
                {/* Source Type Selection */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Source Type *
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="source_type"
                        value="websites"
                        checked={formData.source_type === 'websites'}
                        onChange={(e) => setFormData(prev => ({ ...prev, source_type: e.target.value }))}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm text-gray-700">Websites</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="source_type"
                        value="instagram"
                        checked={formData.source_type === 'instagram'}
                        onChange={(e) => setFormData(prev => ({ ...prev, source_type: e.target.value }))}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm text-gray-700">Instagram</span>
                    </label>
                  </div>
                </div>

                {/* Instagram Content Type - Only show when Instagram is selected */}
                {formData.source_type === 'instagram' && (
                  <div className="text-left">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Instagram Content Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="instagram_content_type"
                          value="photos"
                          checked={formData.instagram_content_type === 'photos'}
                          onChange={(e) => setFormData(prev => ({ ...prev, instagram_content_type: e.target.value }))}
                          className="w-4 h-4 text-orange-600"
                        />
                        <span className="text-sm text-gray-700">Photos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="instagram_content_type"
                          value="reels"
                          checked={formData.instagram_content_type === 'reels'}
                          onChange={(e) => setFormData(prev => ({ ...prev, instagram_content_type: e.target.value }))}
                          className="w-4 h-4 text-orange-600"
                        />
                        <span className="text-sm text-gray-700">Reels</span>
                      </label>
                    </div>
                  </div>
                )}
                
                {/* Gallery Category */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Gallery Category *
                  </label>
                  <select
                    name="gallery_category"
                    value={formData.gallery_category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="Actress">Actress</option>
                    <option value="Actor">Actor</option>
                    <option value="Events">Events</option>
                    <option value="Politics">Politics</option>
                    <option value="Travel">Travel</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                
                {/* Max Images */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Maximum Images
                  </label>
                  <select
                    name="max_images"
                    value={formData.max_images}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value={10}>10 images</option>
                    <option value={20}>20 images</option>
                    <option value={30}>30 images</option>
                    <option value={50}>50 images (max)</option>
                  </select>
                </div>
                
                {/* Tadka Pics Info */}
                <div className="bg-orange-100 rounded p-2 text-xs text-orange-800">
                  <strong>Note:</strong> Tadka Pics are always enabled and gallery type is always vertical.
                  No article content will be generated - only the image gallery.
                </div>
              </div>
            )}

            {/* Photo Gallery Settings Section - Only for photo_gallery agent type */}
            {formData.agent_type === 'photo_gallery' && (
              <div className="bg-purple-50 rounded-lg p-4 space-y-4 border border-purple-200">
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-purple-900">📸 Photo Gallery Settings</h3>
                  <p className="text-xs text-purple-600 mt-0.5">Configure how the gallery agent scrapes and creates galleries</p>
                </div>
                
                {/* Gallery Type & Category Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Gallery Type (Orientation) */}
                  <div className="text-left">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gallery Type *
                    </label>
                    <select
                      name="gallery_type"
                      value={formData.gallery_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="vertical">Vertical</option>
                      <option value="horizontal">Horizontal</option>
                    </select>
                  </div>
                  
                  {/* Gallery Category */}
                  <div className="text-left">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gallery Category *
                    </label>
                    <select
                      name="gallery_category"
                      value={formData.gallery_category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="Actress">Actress</option>
                      <option value="Actor">Actor</option>
                      <option value="Events">Events</option>
                      <option value="Politics">Politics</option>
                      <option value="Travel">Travel</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
                
                {/* Max Images */}
                <div className="text-left">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Maximum Images to Download
                  </label>
                  <select
                    name="max_images"
                    value={formData.max_images}
                    onChange={handleInputChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value={10}>10 images</option>
                    <option value={20}>20 images</option>
                    <option value={30}>30 images</option>
                    <option value={50}>50 images (max)</option>
                  </select>
                </div>
                
                {/* Tadka Pics Toggle - Only for Vertical Galleries */}
                {formData.gallery_type === 'vertical' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-purple-200">
                    <input
                      type="checkbox"
                      name="tadka_pics_enabled"
                      id="tadka_pics_enabled"
                      checked={formData.tadka_pics_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, tadka_pics_enabled: e.target.checked }))}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="tadka_pics_enabled" className="text-sm text-gray-700">
                      Enable for Tadka Pics
                    </label>
                    <span className="text-xs text-gray-500 ml-2">
                      (Show in Tadka Pics section on homepage)
                    </span>
                  </div>
                )}
                
                <div className="bg-purple-100 rounded p-2 text-xs text-purple-800">
                  <strong>How it works:</strong> The agent will scrape the reference URL, download images, upload to S3, 
                  create a gallery, identify/create the artist, and generate an article with Photo Gallery content type.
                </div>
              </div>
            )}

            {/* Video Agent Settings */}
            {formData.agent_type === 'video' && (
              <div className="bg-red-50 rounded-lg p-4 space-y-4 border border-red-200">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-red-900 text-left">Video Agent Settings</h3>
                </div>
                
                {/* Target Language for Video Agent */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Language <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="target_language"
                    value={formData.target_language || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_language: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    required
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
                  <p className="text-xs text-gray-500 mt-1">
                    Videos will be filtered by this language from RSS collection
                  </p>
                </div>
                
                {/* Video Category */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Video Category</label>
                  <select
                    name="video_category"
                    value={formData.video_category}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      const currentCategory = formData.video_category;
                      
                      // Save current filters for the current category before switching
                      if (currentCategory) {
                        setCategoryFilters(prev => ({
                          ...prev,
                          [currentCategory]: {
                            include: formData.include_keywords,
                            exclude: formData.exclude_keywords
                          }
                        }));
                      }
                      
                      // Check if we have saved filters for the new category
                      const savedFilters = categoryFilters[newCategory];
                      
                      if (savedFilters) {
                        // Restore saved filters
                        setFormData(prev => ({
                          ...prev,
                          video_category: newCategory,
                          include_keywords: savedFilters.include,
                          exclude_keywords: savedFilters.exclude
                        }));
                      } else {
                        // Use defaults only if no saved filters
                        const defaults = defaultFilterSettings[newCategory] || { include: [], exclude: [] };
                        setFormData(prev => ({
                          ...prev,
                          video_category: newCategory,
                          include_keywords: defaults.include.join(', '),
                          exclude_keywords: defaults.exclude.join(', ')
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <optgroup label="Regional">
                      <option value="trailers_teasers">Trailers & Teasers</option>
                      <option value="latest_video_songs">Latest Video Songs</option>
                      <option value="tadka_shorts">Tadka Shorts</option>
                    </optgroup>
                    <optgroup label="Bollywood">
                      <option value="trailers_teasers_bollywood">Trailers & Teasers Bollywood</option>
                      <option value="latest_video_songs_bollywood">Latest Video Songs Bollywood</option>
                      <option value="tadka_shorts_bollywood">Tadka Shorts Bollywood</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.video_category === 'trailers_teasers' && 'Find movie trailers, teasers, first looks released today'}
                    {formData.video_category === 'latest_video_songs' && 'Find trending movie/music videos released today'}
                    {formData.video_category === 'tadka_shorts' && 'Find hot & trending YouTube Shorts of actresses'}
                    {formData.video_category === 'trailers_teasers_bollywood' && 'Find Bollywood movie trailers, teasers, first looks'}
                    {formData.video_category === 'latest_video_songs_bollywood' && 'Find trending Bollywood music videos'}
                    {formData.video_category === 'tadka_shorts_bollywood' && 'Find hot & trending Bollywood YouTube Shorts'}
                  </p>
                </div>
                
                {/* Content Filter - Videos/Shorts */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content Type Filter</label>
                  <select
                    name="content_filter"
                    value={formData.content_filter || 'videos'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="videos">Only Videos</option>
                    <option value="shorts">Only Shorts</option>
                    <option value="both">Both Videos & Shorts</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Filter content from YouTube channels by type
                  </p>
                </div>
                
                {/* Filter Settings */}
                <div className="text-left border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Filter Settings</label>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults = defaultFilterSettings[formData.video_category] || { include: [], exclude: [] };
                        setFormData(prev => ({
                          ...prev,
                          include_keywords: defaults.include.join(', '),
                          exclude_keywords: defaults.exclude.join(', ')
                        }));
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Reset to Defaults
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Include Keywords <span className="text-gray-400">(video title must contain at least one)</span>
                      </label>
                      <textarea
                        name="include_keywords"
                        value={formData.include_keywords || ''}
                        onChange={handleInputChange}
                        placeholder="trailer, teaser, first look..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Exclude Keywords <span className="text-gray-400">(skip videos containing these)</span>
                      </label>
                      <textarea
                        name="exclude_keywords"
                        value={formData.exclude_keywords || ''}
                        onChange={handleInputChange}
                        placeholder="reaction, review, behind the scenes..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Comma-separated keywords used to filter videos from RSS feed
                  </p>
                </div>
                
                {/* Search Query */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Query <span className="text-gray-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="search_query"
                    value={formData.search_query || ''}
                    onChange={handleInputChange}
                    placeholder={
                      formData.video_category === 'trailers_teasers' ? 'e.g., Pushpa 2, Game Changer' :
                      formData.video_category === 'events_interviews' ? 'e.g., Samantha, Rashmika' :
                      formData.video_category === 'tadka_shorts' ? 'e.g., Disha Patani, Janhvi Kapoor' :
                      'Enter specific movie or celebrity name'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for general search based on selected state/language
                  </p>
                </div>
                
                {/* Post Aggregation Settings */}
                <div className="text-left border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      name="enable_aggregation"
                      checked={formData.enable_aggregation || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, enable_aggregation: e.target.checked }))}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Enable Post Aggregation <span className="text-gray-400">(Group by Movie/Event Name)</span>
                    </label>
                  </div>
                  
                  {formData.enable_aggregation && (
                    <div className="ml-7 mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lookback Period for Grouping
                      </label>
                      <select
                        name="aggregation_lookback_days"
                        value={formData.aggregation_lookback_days || 2}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="1">1 Day</option>
                        <option value="2">2 Days</option>
                        <option value="3">3 Days</option>
                        <option value="5">5 Days</option>
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                        <option value="30">30 Days</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Check posts from the last N days to find matching groups
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Channel Types Selection */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">YouTube Channel Types</label>
                  <p className="text-xs text-gray-500 mb-2">Select which types of channels to search for videos</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'production_house', label: 'Production Houses' },
                      { value: 'music_label', label: 'Music Labels' },
                      { value: 'movie_news_channel', label: 'Movie News Channels' },
                      { value: 'movie_interviews_channel', label: 'Movie Interviews Channels' },
                      { value: 'tech_interviews_channel', label: 'Tech Interviews Channels' },
                      { value: 'movie_channel', label: 'Movie Channels' },
                      { value: 'news_channel', label: 'News Channels' },
                      { value: 'tv_channel', label: 'TV Channels' },
                      { value: 'reality_show', label: 'Reality Shows' }
                    ].map(type => (
                      <label
                        key={type.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                          (formData.channel_types || []).includes(type.value)
                            ? 'bg-red-50 border-red-400 text-red-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-red-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(formData.channel_types || []).includes(type.value)}
                          onChange={(e) => {
                            const currentTypes = formData.channel_types || [];
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                channel_types: [...currentTypes, type.value]
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                channel_types: currentTypes.filter(t => t !== type.value)
                              }));
                            }
                          }}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{type.label}</span>
                        {(formData.channel_types || []).includes(type.value) && (
                          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Videos will be searched directly in channels of selected types (based on state/language)
                  </p>
                </div>
                
                {/* Info Note */}
                <div className="bg-white rounded border border-red-200 p-3 text-xs text-gray-600">
                  <strong>How it works:</strong> The agent searches videos directly within official YouTube channels 
                  (by channel ID) filtered by the selected channel types and language. This ensures only verified, 
                  official content is fetched. Manage channels in Settings → YouTube Channels.
                </div>
              </div>
            )}

            {/* Split Content Section - Only for post agent type */}
            {formData.agent_type !== 'photo_gallery' && formData.agent_type !== 'video' && formData.agent_type !== 'tv_video' && formData.agent_type !== 'reality_show' && formData.agent_type !== 'ott_release' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-gray-900">Split Content</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Generate content in multiple paragraphs for Main & Secondary sections</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="split_content"
                    checked={formData.split_content}
                    onChange={(e) => setFormData(prev => ({ ...prev, split_content: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {formData.split_content && (
                <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
                  <label className="text-xs font-medium text-gray-700">Number of Paragraphs:</label>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, split_paragraphs: num }))}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          formData.split_paragraphs === num
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">
                    (First half → Main Content, Rest → Secondary Content)
                  </span>
                </div>
              )}
              </div>
            )}

            {/* TV Video Agent Settings */}
            {formData.agent_type === 'tv_video' && (
              <div className="bg-indigo-50 rounded-lg p-4 space-y-4 border border-indigo-200">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-indigo-900 text-left">TV Video Agent Settings</h3>
                </div>
                
                {/* Target Language */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Language <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="target_language"
                    value={formData.target_language || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      target_language: e.target.value,
                      content_type: 'video'  // Always set to video
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
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
                  <p className="text-xs text-gray-500 mt-1">
                    Videos will be filtered by this language
                  </p>
                </div>
                
                {/* TV Video Category */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Video Category</label>
                  <select
                    name="tv_video_category"
                    value={formData.tv_video_category || 'tv-today'}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      tv_video_category: e.target.value,
                      category: e.target.value,  // Set both for backend
                      content_type: 'video'  // Always set to video
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <optgroup label="TV & News">
                      <option value="tv-today">TV Today</option>
                      <option value="tv-today-hindi">TV Today Hindi</option>
                      <option value="news-today">News Today</option>
                      <option value="news-today-hindi">News Today Hindi</option>
                    </optgroup>
                    <optgroup label="Events & Celebrity">
                      <option value="events-interviews">Filmy Focus Today</option>
                      <option value="events-interviews-bollywood">Filmy Focus Today Bollywood</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.tv_video_category === 'tv-today' && 'Regional TV shows and programs'}
                    {formData.tv_video_category === 'tv-today-hindi' && 'Hindi TV shows and programs'}
                    {formData.tv_video_category === 'news-today' && 'Regional breaking news and updates'}
                    {formData.tv_video_category === 'news-today-hindi' && 'Hindi breaking news and updates'}
                    {formData.tv_video_category === 'events-interviews' && 'Regional celebrity events, press meets, and promotions'}
                    {formData.tv_video_category === 'events-interviews-bollywood' && 'Bollywood celebrity events and press meets'}
                  </p>
                </div>

                {/* Channel Types */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">YouTube Channel Types <span className="text-red-500">*</span></label>
                  <p className="text-xs text-gray-500 mb-3">Select which types of channels to search for videos</p>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: 'tv_channel', label: 'TV Channels' },
                      { value: 'news_channel', label: 'News Channels' },
                      { value: 'entertainment_channel', label: 'Entertainment Channels' },
                      { value: 'reality_show', label: 'Reality Shows' },
                      { value: 'movie_news_channel', label: 'Movie News Channels' },
                      { value: 'movie_interviews_channel', label: 'Movie Interviews Channels' },
                      { value: 'tech_interviews_channel', label: 'Tech Interviews Channels' },
                      { value: 'movie_channel', label: 'Movie Channels' },
                      { value: 'production_house', label: 'Production Houses' },
                      { value: 'music_label', label: 'Music Labels' },
                      { value: 'ott_channel', label: 'OTT Channels' }
                    ].map(type => (
                      <label
                        key={type.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                          (formData.tv_channel_types || formData.channel_types || []).includes(type.value)
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={(formData.tv_channel_types || formData.channel_types || []).includes(type.value)}
                          onChange={(e) => {
                            const currentTypes = formData.tv_channel_types || formData.channel_types || [];
                            const newTypes = e.target.checked
                              ? [...currentTypes, type.value]
                              : currentTypes.filter(t => t !== type.value);
                            
                            setFormData(prev => ({
                              ...prev,
                              tv_channel_types: newTypes,
                              channel_types: newTypes  // Update both for backend
                            }));
                          }}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">{type.label}</span>
                        {(formData.tv_channel_types || formData.channel_types || []).includes(type.value) && (
                          <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-red-500 mt-2 font-medium">
                    ⚠️ You must select at least one channel type. Agent will fetch ONLY from selected types.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(formData.tv_video_category === 'tv-today' || formData.tv_video_category === 'tv-today-hindi') && 
                      '💡 Recommended: TV Channels'}
                    {(formData.tv_video_category === 'news-today' || formData.tv_video_category === 'news-today-hindi') && 
                      '💡 Recommended: News Channels'}
                    {(formData.tv_video_category === 'events-interviews' || formData.tv_video_category === 'events-interviews-bollywood') && 
                      '💡 Recommended: Movie News Channels, Movie Interviews Channels, Entertainment Channels'}
                  </p>
                </div>

                {/* Content Type Filter */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content Type Filter</label>
                  <select
                    name="content_filter"
                    value={formData.content_filter || 'videos'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="videos">Only Videos</option>
                    <option value="shorts">Only Shorts</option>
                    <option value="both">Both Videos & Shorts</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose whether to fetch regular videos, shorts, or both from the channels
                  </p>
                </div>

                {/* Lookback Period */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lookback Period <span className="text-red-500">*</span></label>
                  <select
                    name="lookback_days"
                    value={formData.lookback_days || 2}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="1">Last 24 Hours</option>
                    <option value="2">Last 2 Days</option>
                    <option value="3">Last 3 Days</option>
                    <option value="5">Last 5 Days</option>
                    <option value="7">Last 7 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="30">Last 30 Days</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Agent will fetch ALL videos published within this period
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-white rounded-lg border border-indigo-200 p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-gray-700 space-y-1">
                      <p className="font-semibold text-indigo-900">Channel Aggregation:</p>
                      <p>• Videos automatically grouped by <strong>YouTube channel name</strong></p>
                      <p>• Each channel creates one card with all its videos</p>
                      <p>• Last 48 hours content only</p>
                      <p>• No keyword filtering - all channel videos included</p>
                      <p className="text-indigo-700 mt-2">
                        ✨ Simple & efficient - perfect for TV & News content!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reality Shows Agent Settings */}
            {formData.agent_type === 'reality_show' && (
              <div className="bg-pink-50 rounded-lg p-4 space-y-4 border border-pink-200">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-pink-900 text-left">Reality Shows Agent Settings</h3>
                </div>

                {/* Reality Show Category */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    name="reality_show_category"
                    value={formData.reality_show_category || 'tv-reality-shows'}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      reality_show_category: e.target.value,
                      category: e.target.value,  // Set both for backend
                      content_type: 'video'  // Always set to video
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="tv-reality-shows">TV Reality Shows</option>
                    <option value="tv-reality-shows-hindi">TV Reality Shows Hindi</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.reality_show_category === 'tv-reality-shows' && 'Regional reality show content'}
                    {formData.reality_show_category === 'tv-reality-shows-hindi' && 'Hindi reality show content'}
                  </p>
                </div>

                {/* Reality Show Selector */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Reality Show <span className="text-red-500">*</span></label>
                  <select
                    name="reality_show_name"
                    value={formData.reality_show_name || ''}
                    onChange={(e) => {
                      const selectedShowName = e.target.value;
                      const selectedShow = realityShows.find(show => show.show_name === selectedShowName);
                      
                      if (selectedShow) {
                        // Auto-populate all fields from system settings
                        setFormData(prev => ({
                          ...prev,
                          reality_show_name: selectedShow.show_name,
                          youtube_channel_id: selectedShow.youtube_channel_id,
                          target_language: selectedShow.language,
                          include_keywords: selectedShow.filter_keywords
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          reality_show_name: '',
                          youtube_channel_id: '',
                          target_language: '',
                          include_keywords: ''
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="">-- Select a show --</option>
                    {realityShows.filter(show => {
                      // Filter by language based on category
                      const isHindi = formData.reality_show_category === 'tv-reality-shows-hindi';
                      if (isHindi) {
                        return show.language && show.language.toLowerCase() === 'hindi';
                      } else {
                        return show.language && show.language.toLowerCase() !== 'hindi';
                      }
                    }).map(show => (
                      <option key={show.id} value={show.show_name}>
                        {show.show_name} ({show.language})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-blue-600 mt-2 font-medium">
                    ℹ️ Shows are configured in System Settings → TV Reality Shows
                  </p>
                  {!formData.reality_show_name && (
                    <p className="text-xs text-red-500 mt-1 font-medium">
                      ⚠️ Please select a reality show. If no shows available, add them in System Settings first.
                    </p>
                  )}
                </div>

                {/* YouTube Channel - READ ONLY (Auto-populated) */}
                {formData.reality_show_name && (
                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube Channel <span className="text-xs text-gray-500">(Auto-populated)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.youtube_channel_id || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Configured in System Settings for this show
                    </p>
                  </div>
                )}

                {/* Target Language - READ ONLY (Auto-populated) */}
                {formData.reality_show_name && (
                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Language <span className="text-xs text-gray-500">(Auto-populated)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.target_language || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Configured in System Settings for this show
                    </p>
                  </div>
                )}

                {/* Filter Keywords - READ ONLY (Auto-populated) */}
                {formData.reality_show_name && (
                  <div className="text-left">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Include Filter Keywords <span className="text-xs text-gray-500">(Auto-populated)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.include_keywords || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only videos containing these keywords will be fetched. Configured in System Settings.
                    </p>
                  </div>
                )}

                {/* Content Type Filter */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content Type Filter</label>
                  <select
                    name="content_filter"
                    value={formData.content_filter || 'videos'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="videos">Only Videos</option>
                    <option value="shorts">Only Shorts</option>
                    <option value="both">Both Videos & Shorts</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose whether to fetch regular videos, shorts, or both from the show
                  </p>
                </div>

                {/* Lookback Period */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lookback Period <span className="text-red-500">*</span></label>
                  <select
                    name="reality_show_lookback_days"
                    value={formData.reality_show_lookback_days || 2}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="1">Last 24 Hours</option>
                    <option value="2">Last 2 Days</option>
                    <option value="3">Last 3 Days</option>
                    <option value="5">Last 5 Days</option>
                    <option value="7">Last 7 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="30">Last 30 Days</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Agent will fetch ALL videos from the selected show published within this period (no limit)
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-white rounded-lg border border-pink-200 p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-pink-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-gray-700 space-y-1">
                      <p className="font-semibold text-pink-900">Reality Show Agent - Auto-Configured:</p>
                      <p>• Fetches from YouTube channel configured in System Settings</p>
                      <p>• Filters videos by keywords (only matching videos included)</p>
                      <p>• Fetches ALL matching videos in lookback period (no limit)</p>
                      <p>• Groups all videos by show name as single card</p>
                      <p>• Videos displayed in modal (like TV Today/News Today)</p>
                      <p className="text-blue-700 mt-2 font-medium">
                        💡 To add/edit shows: System Settings → TV Reality Shows
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* OTT Release Settings Section - Only for ott_release agent type */}
            {formData.agent_type === 'ott_release' && (
              <div className="bg-teal-50 rounded-lg p-4 space-y-4 border border-teal-200">
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-teal-900">🎬 OTT Release Agent Settings</h3>
                  <p className="text-xs text-teal-600 mt-0.5">Fetch OTT releases from Binged.com and create movie/web series entries</p>
                </div>

                {/* Language Selection */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="ott_language"
                    value={formData.ott_language || 'Hindi'}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="Hindi">Hindi</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Bengali">Bengali</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Punjabi">Punjabi</option>
                    <option value="English">English</option>
                    <option value="Korean">Korean</option>
                    <option value="Japanese">Japanese</option>
                  </select>
                </div>

                {/* Fetch Limit Selection */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Releases to Fetch
                  </label>
                  <select
                    name="ott_fetch_limit"
                    value={formData.ott_fetch_limit || 10}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value={5}>5 releases</option>
                    <option value={10}>10 releases</option>
                    <option value={20}>20 releases</option>
                    <option value={50}>50 releases</option>
                  </select>
                </div>

                {/* Streaming Type Checkboxes */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Release Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ott_streaming_now"
                        checked={formData.ott_streaming_now !== false}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Streaming Now</span>
                      <span className="text-xs text-gray-500">(Currently available on OTT)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="ott_streaming_soon"
                        checked={formData.ott_streaming_soon === true}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Streaming Soon</span>
                      <span className="text-xs text-gray-500">(Upcoming releases)</span>
                    </label>
                  </div>
                </div>

                {/* Content Workflow for OTT Release */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content Workflow
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {workflowOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, content_workflow: option.value }))}
                        className={`p-2 rounded border-2 font-medium text-xs transition-all ${
                          formData.content_workflow === option.value
                            ? 'border-teal-600 bg-teal-100 text-teal-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-white rounded-lg p-3 border border-teal-200">
                  <div className="text-xs text-teal-800 text-left space-y-1">
                    <p className="font-semibold text-teal-900">How it works:</p>
                    <p>• Fetches releases from Binged.com for selected language</p>
                    <p>• Extracts movie details: cast, director, synopsis, trailer</p>
                    <p>• Creates OTT Release entries in Manage Content → Movie Releases</p>
                    <p>• Skips duplicates (already existing movies)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Instagram URLs Section - Only for Tadka Pics with Instagram source */}
            {formData.agent_type === 'tadka_pics' && formData.source_type === 'instagram' && (
              <div className="bg-pink-50 rounded-lg p-4 space-y-3 border border-pink-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-pink-900 text-left">📸 Instagram Post</h3>
                  <button
                    type="button"
                    onClick={addInstagramUrl}
                    className="flex items-center gap-1 px-3 py-1 bg-pink-600 text-white text-xs font-medium rounded hover:bg-pink-700 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Instagram Post
                  </button>
                </div>
                
                {formData.instagram_urls.length === 0 ? (
                  <div className="text-left bg-white rounded border border-pink-200 p-3">
                    <p className="text-xs text-gray-500">
                      No Instagram posts added. Click "Add Instagram Post" to add a post/reel.
                    </p>
                    <p className="text-xs text-pink-600 mt-2">
                      <strong>How to add Instagram post:</strong><br/>
                      1. Open the Instagram post/reel on desktop<br/>
                      2. Click ⋯ menu → "Copy link" <strong>OR</strong><br/>
                      3. Click ⋯ menu → "Embed" → Copy the embed code<br/>
                      4. Paste either the URL or embed code here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.instagram_urls.map((url, index) => (
                      <div key={index} className="bg-white p-2 rounded border border-pink-200">
                        <div className="flex items-start gap-2">
                          <textarea
                            value={url}
                            onChange={(e) => updateInstagramUrl(index, e.target.value)}
                            placeholder="Paste Instagram URL or embed code here...&#10;Example URL: https://www.instagram.com/p/ABC123/&#10;Example embed: <blockquote class=&quot;instagram-media&quot;..."
                            rows={3}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeInstagramUrl(index)}
                            className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {url && url.includes('instagram.com') && (
                          <p className="text-xs text-green-600 mt-1">✓ Instagram link detected</p>
                        )}
                        {url && url.includes('blockquote') && (
                          <p className="text-xs text-green-600 mt-1">✓ Embed code detected</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reference Content Section - Hide for Tadka Pics with Instagram source, Video agents, TV Video agents, Reality Show agents, and OTT Release agents */}
            {!(formData.agent_type === 'tadka_pics' && formData.source_type === 'instagram') && formData.agent_type !== 'video' && formData.agent_type !== 'tv_video' && formData.agent_type !== 'reality_show' && formData.agent_type !== 'ott_release' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 text-left">Reference Content</h3>
                <button
                  type="button"
                  onClick={addReferenceUrl}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Ref Content
                </button>
              </div>
              
              {formData.reference_urls.length === 0 ? (
                <div className="text-left bg-white rounded border border-gray-300 p-3">
                  <p className="text-xs text-gray-500">
                    No reference URLs added. Click "Add Ref Content" to add reference websites that the AI will check for latest news related to your selected category.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.reference_urls.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                      <input
                        type="url"
                        value={getUrlValue(item)}
                        onChange={(e) => updateReferenceUrl(index, 'url', e.target.value)}
                        placeholder="https://example.com/news"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <select
                        value={getUrlType(item)}
                        onChange={(e) => updateReferenceUrl(index, 'url_type', e.target.value)}
                        className="w-36 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        title="URL Type"
                      >
                        {urlTypeOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeReferenceUrl(index)}
                        className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove URL"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500 text-left space-y-1">
                <p>Add reference URLs for the AI to use as content sources.</p>
                <ul className="list-disc list-inside pl-2 text-gray-400">
                  <li><strong>Auto Detect</strong> - Agent guesses if it's a listing or direct article</li>
                  <li><strong>Listing Page</strong> - Agent finds the latest article link first, then fetches its content</li>
                  <li><strong>Direct Article</strong> - Agent fetches content directly from this URL</li>
                </ul>
              </div>
            </div>
            )}

            {/* Image Options Section - Hide for photo_gallery, tadka_pics, video, tv_video, reality_show, and ott_release */}
            {formData.agent_type !== 'photo_gallery' && formData.agent_type !== 'tadka_pics' && formData.agent_type !== 'video' && formData.agent_type !== 'tv_video' && formData.agent_type !== 'reality_show' && formData.agent_type !== 'ott_release' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 text-left">Image Options</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {imageOptions.map(option => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 px-3 py-2 border-2 rounded cursor-pointer transition-all text-xs ${
                      formData.image_option === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="image_option"
                      value={option.value}
                      checked={formData.image_option === option.value}
                      onChange={handleInputChange}
                      className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            )}

            {/* Content Workflow Section - Hide for tadka_pics and ott_release */}
            {formData.agent_type !== 'tadka_pics' && formData.agent_type !== 'ott_release' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 text-left">Content Workflow</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {workflowOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, content_workflow: option.value }))}
                    className={`p-2 rounded border-2 font-medium text-xs transition-all ${
                      formData.content_workflow === option.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Message */}
            {message.text && (
              <div className={`p-3 rounded text-xs ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message.text}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-black text-white rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {loading 
                ? 'Saving...' 
                : editingAgent?.id 
                  ? 'Save Agent'
                  : activeTab === 'recurring' 
                    ? 'Save Recurring Agent' 
                    : 'Save Adhoc Agent'
              }
            </button>
          </div>
        </form>
      </div>

      {/* Agent Prompt Editor Modal */}
      {showAgentPromptEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Editor Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Agent Prompt
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Customize the prompt for this specific agent instance
                </p>
              </div>
              <button
                onClick={() => setShowAgentPromptEditor(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <textarea
                value={formData.custom_prompt || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_prompt: e.target.value }))}
                className="w-full h-96 px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Enter the custom AI prompt for this agent..."
              />
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs font-semibold text-yellow-900 mb-2">Available Placeholders:</p>
                <ul className="text-xs text-yellow-800 space-y-1">
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}target_state_context{'}'}</code> - State-specific context (e.g., "focusing on Telangana region")</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}target_audience{'}'}</code> - Target audience (e.g., "readers in Telangana")</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}word_count{'}'}</code> - Configured word count</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}state_language{'}'}</code> - Regional language (e.g., "Telugu")</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}reference_content_section{'}'}</code> - Fetched reference content</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}split_content_section{'}'}</code> - Split content instructions</li>
                </ul>
              </div>
              
              {/* Load from category button */}
              {formData.category && categoryPromptMappings[formData.category] && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      custom_prompt: categoryPromptMappings[formData.category] || '' 
                    }))}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors border border-gray-300"
                  >
                    Load from Category Mapping
                  </button>
                  <span className="text-xs text-gray-500">
                    (Category: {categories.find(c => c.slug === formData.category)?.name || formData.category})
                  </span>
                </div>
              )}
            </div>

            {/* Editor Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAgentPromptEditor(false)}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setShowAgentPromptEditor(false)}
                className="px-4 py-1.5 bg-black text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PostAgentForm;
