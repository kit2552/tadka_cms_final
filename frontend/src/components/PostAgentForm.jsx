import React, { useState, useEffect } from 'react';

const PostAgentForm = ({ onClose, onSave, editingAgent }) => {
  const [activeTab, setActiveTab] = useState('recurring');
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
    video_category: 'trailers_teasers',  // trailers_teasers, trending_videos, events_interviews, tadka_shorts
    search_query: '',  // Optional specific search query
    max_videos: 5
  });
  
  const [showAgentPromptEditor, setShowAgentPromptEditor] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [categories, setCategories] = useState([]);
  const [states, setStates] = useState([]);
  const [stateSearch, setStateSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryPromptMappings, setCategoryPromptMappings] = useState({});

  useEffect(() => {
    if (editingAgent) {
      const agentType = editingAgent.agent_type || 'post';
      setFormData(prev => ({
        ...prev,
        ...editingAgent,
        selected_days: editingAgent.selected_days || [],
        // Ensure agent_type is set from editingAgent
        agent_type: agentType,
        // Pre-select category based on agent type
        category: editingAgent.category || (agentType === 'photo_gallery' ? 'photoshoots' : agentType === 'video' ? 'trailers' : prev.category),
        // Set content_type to video for video agents
        content_type: agentType === 'video' ? 'video' : (editingAgent.content_type || prev.content_type)
      }));
      setActiveTab(editingAgent.mode || 'recurring');
    }
    fetchCategories();
    fetchStates();
    fetchCategoryPromptMappings();
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      mode: activeTab
    }));
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
              {editingAgent ? 'Edit' : 'Create'} Post Agent
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">Configure your automated post generation agent</p>
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
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('recurring')}
                className={`py-2.5 px-4 font-medium text-xs border-b-2 transition-colors ${
                  activeTab === 'recurring'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Recurring Mode
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('adhoc')}
                className={`py-2.5 px-4 font-medium text-xs border-b-2 transition-colors ${
                  activeTab === 'adhoc'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Adhoc Mode
              </button>
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

            {/* Common Fields - Content Settings - Hide for tadka_pics and video agents */}
            {formData.agent_type !== 'tadka_pics' && formData.agent_type !== 'video' && (
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

            {/* Agent Prompt Section - Hide for tadka_pics */}
            {formData.agent_type !== 'tadka_pics' && (
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
                
                {/* Video Category */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Video Category</label>
                  <select
                    name="video_category"
                    value={formData.video_category}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="trailers_teasers">Trailers & Teasers</option>
                    <option value="trending_videos">Trending Videos</option>
                    <option value="events_interviews">Events & Interviews</option>
                    <option value="tadka_shorts">Tadka Shorts</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.video_category === 'trailers_teasers' && 'Find movie trailers, teasers, first looks released today'}
                    {formData.video_category === 'trending_videos' && 'Find trending movie/music videos released today'}
                    {formData.video_category === 'events_interviews' && 'Find celebrity events, interviews, promotions'}
                    {formData.video_category === 'tadka_shorts' && 'Find hot & trending YouTube Shorts of actresses'}
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
                
                {/* Max Videos */}
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Videos to Fetch</label>
                  <div className="flex items-center gap-2">
                    {[3, 5, 10, 15].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, max_videos: num }))}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                          formData.max_videos === num
                            ? 'bg-red-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:border-red-400'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Info Note */}
                <div className="bg-white rounded border border-red-200 p-3 text-xs text-gray-600">
                  <strong>How it works:</strong> The agent will search YouTube for videos released today (IST) based on your 
                  selected state/language and category. Videos will be created as posts with "Video" content type.
                </div>
              </div>
            )}

            {/* Split Content Section - Only for post agent type */}
            {formData.agent_type !== 'photo_gallery' && formData.agent_type !== 'video' && (
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

            {/* Reference Content Section - Hide for Tadka Pics with Instagram source and Video agents */}
            {!(formData.agent_type === 'tadka_pics' && formData.source_type === 'instagram') && formData.agent_type !== 'video' && (
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

            {/* Image Options Section - Hide for photo_gallery, tadka_pics, and video */}
            {formData.agent_type !== 'photo_gallery' && formData.agent_type !== 'tadka_pics' && formData.agent_type !== 'video' && (
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

            {/* Content Workflow Section - Hide for tadka_pics */}
            {formData.agent_type !== 'tadka_pics' && (
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
              {loading ? 'Saving...' : 'Save Agent'}
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
