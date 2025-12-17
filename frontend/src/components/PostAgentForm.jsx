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
    is_active: true
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [categories, setCategories] = useState([]);
  const [states, setStates] = useState([]);
  const [stateSearch, setStateSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryPromptMappings, setCategoryPromptMappings] = useState({});
  const [editingMappings, setEditingMappings] = useState({});

  useEffect(() => {
    if (editingAgent) {
      setFormData({
        ...editingAgent,
        selected_days: editingAgent.selected_days || []
      });
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
    { value: 'video', label: 'Video' },
    { value: 'photo-gallery', label: 'Photo Gallery' },
    { value: 'movie-review', label: 'Movie Review' },
    { value: 'ott-review', label: 'OTT Review' }
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
      setEditingMappings(data.mappings || {});
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
      reference_urls: [...prev.reference_urls, '']
    }));
  };

  const updateReferenceUrl = (index, value) => {
    setFormData(prev => ({
      ...prev,
      reference_urls: prev.reference_urls.map((url, i) => i === index ? value : url)
    }));
  };

  const removeReferenceUrl = (index) => {
    setFormData(prev => ({
      ...prev,
      reference_urls: prev.reference_urls.filter((_, i) => i !== index)
    }));
  };

  const handlePromptChange = (categorySlug, prompt) => {
    setEditingMappings(prev => ({
      ...prev,
      [categorySlug]: prompt
    }));
  };

  const openPromptEditor = (categorySlug) => {
    setEditingCategory(categorySlug);
    setShowPromptEditor(true);
  };

  const savePromptEdit = () => {
    setShowPromptEditor(false);
    setEditingCategory(null);
  };

  const saveMappings = async () => {
    try {
      const mappingsArray = Object.entries(editingMappings).map(([category, prompt]) => ({
        category,
        prompt
      }));

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/category-prompt-mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingsArray)
      });

      if (response.ok) {
        const data = await response.json();
        setCategoryPromptMappings(data.mappings);
        setShowMappingModal(false);
        setMessage({ type: 'success', text: 'Category-prompt mappings saved successfully!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save mappings' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const url = editingAgent
        ? `${process.env.REACT_APP_BACKEND_URL}/api/ai-agents/${editingAgent.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/ai-agents`;
      
      const method = editingAgent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Agent ${editingAgent ? 'updated' : 'created'} successfully!` });
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

            {/* Common Fields - Content Settings */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 text-left">Content Settings</h3>
              
              {/* Category Selection with Mapping Button */}
              <div className="text-left">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMappingModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Category-Prompt Mapping
                  </button>
                </div>
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
                                setFormData(prev => ({ ...prev, category: cat.slug }));
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

            {/* Split Content Section */}
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

            {/* Reference Content Section */}
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
                  {formData.reference_urls.map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateReferenceUrl(index, e.target.value)}
                        placeholder="https://example.com/news"
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
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
              <p className="text-xs text-gray-500 text-left">
                Add reference URLs that the AI should check for the latest news. The agent will analyze these sources and use them as references when generating content.
              </p>
            </div>

            {/* Image Options Section */}
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

            {/* Content Workflow Section */}
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

      {/* Category-Prompt Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-900">Category-Prompt Mapping</h2>
                <p className="text-xs text-gray-600 mt-0.5">Configure AI prompts for each category</p>
              </div>
              <button
                onClick={() => {
                  setShowMappingModal(false);
                  setEditingMappings(categoryPromptMappings);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-xs text-blue-800">
                  Each category has a custom AI prompt. When a category is selected, its prompt will be used for content generation. The prompt includes placeholders for Target State and Word Count which will be replaced dynamically.
                </p>
              </div>

              <div className="space-y-3">
                {categories
                  .filter(cat => cat.slug !== 'latest-news')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(cat => (
                    <div key={cat.slug} className="flex items-start gap-3 bg-gray-50 rounded p-3 border border-gray-200">
                      <div className="w-32 flex-shrink-0 text-left">
                        <label className="text-xs font-semibold text-gray-900 block mb-1">
                          {cat.name}
                        </label>
                        <span className="text-xs text-gray-500">({cat.slug})</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-700 font-mono bg-white rounded p-2 border border-gray-300 truncate">
                          {editingMappings[cat.slug]?.substring(0, 120)}...
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openPromptEditor(cat.slug)}
                        className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                      >
                        Edit Prompt
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMappingModal(false);
                  setEditingMappings(categoryPromptMappings);
                }}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveMappings}
                className="px-4 py-1.5 bg-black text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Save All Prompts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Editor Modal */}
      {showPromptEditor && editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Editor Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Prompt: {categories.find(c => c.slug === editingCategory)?.name}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Use {'{'}target_state_context{'}'}, {'{'}target_audience{'}'}, and {'{'}word_count{'}'} as placeholders
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPromptEditor(false);
                  setEditingCategory(null);
                }}
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
                value={editingMappings[editingCategory] || ''}
                onChange={(e) => handlePromptChange(editingCategory, e.target.value)}
                className="w-full h-96 px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Enter the AI prompt for this category..."
              />
              <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs font-semibold text-yellow-900 mb-2">Available Placeholders:</p>
                <ul className="text-xs text-yellow-800 space-y-1">
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}target_state_context{'}'}</code> - Replaced with state-specific context (e.g., "in Telangana" or "in India")</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}target_audience{'}'}</code> - Replaced with target audience (e.g., "for Telangana readers")</li>
                  <li>• <code className="bg-yellow-100 px-1 rounded">{'{'}word_count{'}'}</code> - Replaced with configured word count</li>
                </ul>
              </div>
            </div>

            {/* Editor Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPromptEditor(false);
                  setEditingCategory(null);
                }}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={savePromptEdit}
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
