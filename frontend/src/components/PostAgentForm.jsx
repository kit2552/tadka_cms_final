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
    topic: '',
    target_state: '',
    word_count: '<100',
    image_option: 'ai_generate',
    content_workflow: 'in_review',
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

  const topics = categories.map(cat => ({
    value: `Trending Breaking Latest ${cat.name} News`,
    label: `Trending Breaking Latest ${cat.name} News`
  }));
  topics.unshift({ value: 'Trending Breaking Latest Top Stories', label: 'Trending Breaking Latest Top Stories' });

  const wordCounts = ['<100', '<150', '<200', '<250', '<300', '<350', '<400', '<450', '<500'];
  const imageOptions = [
    { value: 'ai_generate', label: 'AI Generate' },
    { value: 'upload', label: 'Upload Image' },
    { value: 'existing', label: 'Use Existing Image' },
    { value: 'web_search', label: 'Web Search' }
  ];

  const workflowOptions = [
    { value: 'in_review', label: 'In Review First' },
    { value: 'ready_to_publish', label: 'Ready to Publish' },
    { value: 'auto_post', label: 'Auto Post' }
  ];

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="agent_name"
                    value={formData.agent_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter agent name"
                  />
                </div>

                {/* Schedule Post Checkbox */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="schedule_post"
                    id="schedule_post"
                    checked={formData.schedule_post}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="schedule_post" className="text-sm font-medium text-gray-700">
                    Schedule Post
                  </label>
                </div>

                {/* Schedule Post Fields */}
                {formData.schedule_post && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Post Date
                      </label>
                      <input
                        type="date"
                        name="post_date"
                        value={formData.post_date}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Post Time
                      </label>
                      <select
                        name="adhoc_post_time"
                        value={formData.adhoc_post_time}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Content Settings</h3>
              
              {/* Select Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Topic
                </label>
                <select
                  name="topic"
                  value={formData.topic}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a topic</option>
                  {topics.map(topic => (
                    <option key={topic.value} value={topic.value}>{topic.label}</option>
                  ))}
                </select>
              </div>

              {/* Target State */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target State
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search state..."
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
                  />
                  <select
                    name="target_state"
                    value={formData.target_state}
                    onChange={handleInputChange}
                    size="5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All States</option>
                    {filteredStates.map(state => (
                      <option key={state.code} value={state.name}>{state.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Word Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Word Count
                  </label>
                  <select
                    name="word_count"
                    value={formData.word_count}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {wordCounts.map(count => (
                      <option key={count} value={count}>{count} words</option>
                    ))}
                  </select>
                </div>

                {/* Image Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image Options
                  </label>
                  <select
                    name="image_option"
                    value={formData.image_option}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {imageOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Content Workflow */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Content Workflow
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workflowOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, content_workflow: option.value }))}
                    className={`p-4 rounded-lg border-2 font-medium text-sm transition-all ${
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
              <div className={`p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message.text}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              {loading ? 'Saving...' : 'Save Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostAgentForm;
