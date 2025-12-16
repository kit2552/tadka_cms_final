import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { INDIAN_STATES, getStateNameByCode } from '../utils/statesConfig';
import { DEFAULT_STATE_LANGUAGE_MAPPING } from '../utils/stateLanguageMapping';

const SystemSettings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('aws');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showAccessKeyId, setShowAccessKeyId] = useState(true); // Start with visible
  const [connectionStatus, setConnectionStatus] = useState('unknown'); // unknown, testing, connected, disconnected
  const [originalKeys, setOriginalKeys] = useState({ accessKeyId: '', secretKey: '' }); // Store original unmasked values

  // AWS Configuration State
  const [awsConfig, setAwsConfig] = useState({
    is_enabled: false,
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    s3_bucket_name: '',
    root_folder_path: '',
    articles_root_folder: 'articles',
    galleries_root_folder: 'galleries',
    tadka_pics_root_folder: 'tadka-pics',
    max_file_size_mb: 10
  });

  // Users State
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'editor',
    is_active: true
  });

  // State-Language Mapping State
  const [stateLanguageMapping, setStateLanguageMapping] = useState(DEFAULT_STATE_LANGUAGE_MAPPING);
  const [editingMapping, setEditingMapping] = useState(null);

  // Google Ads State
  const [adSettings, setAdSettings] = useState({
    article_content_mid: false,
    article_sidebar_comments: false,
    homepage_banner: false,
    homepage_sidebar: false,
    category_page_top: false,
    homepage_sponsored_ads: false
  });
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsNotification, setAdsNotification] = useState({ show: false, type: '', message: '' });

  // AI API Keys State
  const [aiApiKeys, setAiApiKeys] = useState({
    openai_api_key: '',
    gemini_api_key: '',
    anthropic_api_key: '',
    openai_default_model: '',
    gemini_default_model: '',
    anthropic_default_model: '',
    default_text_model: '',
    default_image_model: ''
  });
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [unmaskedKeys, setUnmaskedKeys] = useState({
    openai: null,
    gemini: null,
    anthropic: null
  });
  const [aiModels, setAiModels] = useState({
    openai: [],
    gemini: [],
    anthropic: [],
    allText: [],
    allImage: []
  });
  const [loadingModels, setLoadingModels] = useState({
    openai: false,
    gemini: false,
    anthropic: false
  });
  const [testingKey, setTestingKey] = useState(null);

  useEffect(() => {
    loadAWSConfig();
    loadUsers();
    fetchAdSettings();
    loadAIAPIKeys();
    fetchAllTextModels();
    fetchAllImageModels();
  }, []);

  const loadAWSConfig = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/aws-config`);
      const data = await response.json();
      
      // Store masked values as placeholders but keep original if exists
      if (data.aws_access_key_id && data.aws_access_key_id.includes('****')) {
        setOriginalKeys(prev => ({ ...prev, accessKeyId: data.aws_access_key_id }));
      }
      if (data.aws_secret_access_key && data.aws_secret_access_key.includes('****')) {
        setOriginalKeys(prev => ({ ...prev, secretKey: data.aws_secret_access_key }));
      }
      
      setAwsConfig(data);
    } catch (error) {
      console.error('Failed to load AWS config:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/users`);
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const fetchAdSettings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ad-settings`);
      if (response.ok) {
        const data = await response.json();
        setAdSettings(data);
      }
    } catch (error) {
      console.error('Error fetching ad settings:', error);
      showAdsNotification('error', 'Failed to load ad settings');
    } finally {
      setAdsLoading(false);
    }
  };

  const handleAdToggle = async (key) => {
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
        showAdsNotification('success', 'Setting saved automatically');
      } else {
        // Revert on failure
        setAdSettings(prev => ({
          ...prev,
          [key]: !newValue
        }));
        showAdsNotification('error', 'Failed to save setting');
      }
    } catch (error) {
      console.error('Error saving ad settings:', error);
      // Revert on failure
      setAdSettings(prev => ({
        ...prev,
        [key]: !newValue
      }));
      showAdsNotification('error', 'An error occurred while saving');
    }
  };

  const showAdsNotification = (type, message) => {
    setAdsNotification({ show: true, type, message });
    setTimeout(() => {
      setAdsNotification({ show: false, type: '', message: '' });
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

  const handleAWSConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAwsConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveAWSConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Prepare config for sending - don't send masked values
      const configToSend = { ...awsConfig };
      
      // If keys are masked (haven't been changed), don't send them
      if (configToSend.aws_access_key_id && configToSend.aws_access_key_id.includes('****')) {
        delete configToSend.aws_access_key_id;
      }
      if (configToSend.aws_secret_access_key && configToSend.aws_secret_access_key.includes('****')) {
        delete configToSend.aws_secret_access_key;
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/aws-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSend)
      });

      if (response.ok) {
        const data = await response.json();
        setAwsConfig(data);
        
        // Store new masked values
        if (data.aws_access_key_id && data.aws_access_key_id.includes('****')) {
          setOriginalKeys(prev => ({ ...prev, accessKeyId: data.aws_access_key_id }));
        }
        if (data.aws_secret_access_key && data.aws_secret_access_key.includes('****')) {
          setOriginalKeys(prev => ({ ...prev, secretKey: data.aws_secret_access_key }));
        }
        
        setMessage({ type: 'success', text: 'AWS configuration saved successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to save configuration' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save AWS configuration' });
    } finally {
      setLoading(false);
    }
  };

  const testAWSConnection = async () => {
    setLoading(true);
    setConnectionStatus('testing');
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/aws-config/test`, {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionStatus('connected');
        setMessage({ type: 'success', text: data.message });
      } else {
        setConnectionStatus('disconnected');
        // Handle error response
        const errorMessage = data.detail || data.message || 'Connection test failed';
        setMessage({ type: 'error', text: errorMessage });
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setMessage({ type: 'error', text: error.message || 'Connection test failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUserFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
        is_active: user.is_active
      });
    } else {
      setEditingUser(null);
      setUserForm({
        username: '',
        email: '',
        password: '',
        role: 'editor',
        is_active: true
      });
    }
    setShowUserModal(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const url = editingUser
        ? `${process.env.REACT_APP_BACKEND_URL}/api/system-settings/users/${editingUser.id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/system-settings/users`;

      const method = editingUser ? 'PUT' : 'POST';
      
      const payload = editingUser 
        ? { email: userForm.email, password: userForm.password || undefined, role: userForm.role, is_active: userForm.is_active }
        : userForm;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `User ${editingUser ? 'updated' : 'created'} successfully!` });
        setShowUserModal(false);
        loadUsers();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to save user' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save user' });
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'User deleted successfully!' });
        loadUsers();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to delete user' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete user' });
    } finally {
      setLoading(false);
    }
  };

  // AI API Keys Functions
  const loadAIAPIKeys = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-api-keys`);
      const data = await response.json();
      setAiApiKeys(data);
    } catch (error) {
      console.error('Failed to load AI API keys:', error);
    }
  };

  const toggleKeyVisibility = async (provider) => {
    const stateMap = {
      openai: { show: showOpenAIKey, setShow: setShowOpenAIKey, key: 'openai_api_key' },
      gemini: { show: showGeminiKey, setShow: setShowGeminiKey, key: 'gemini_api_key' },
      anthropic: { show: showAnthropicKey, setShow: setShowAnthropicKey, key: 'anthropic_api_key' }
    };

    const { show, setShow, key } = stateMap[provider];

    // If showing (about to hide), just toggle
    if (show) {
      setShow(false);
      return;
    }

    // If key is masked and we haven't fetched unmasked version yet
    const currentKey = aiApiKeys[key];
    if (currentKey && (currentKey.includes('****')) && !unmaskedKeys[provider]) {
      try {
        // Fetch unmasked key
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-api-keys?unmask=true`);
        if (response.ok) {
          const data = await response.json();
          setUnmaskedKeys(prev => ({
            ...prev,
            [provider]: data[key]
          }));
          // Update the displayed key with unmasked version
          setAiApiKeys(prev => ({
            ...prev,
            [key]: data[key]
          }));
        }
      } catch (error) {
        console.error('Failed to fetch unmasked key:', error);
      }
    }

    setShow(true);
  };

  const handleAIKeyChange = (e) => {
    const { name, value } = e.target;
    setAiApiKeys(prev => ({ ...prev, [name]: value }));
  };

  const saveAIAPIKeys = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const keysToSend = { ...aiApiKeys };
      
      // Don't send masked keys
      if (keysToSend.openai_api_key && keysToSend.openai_api_key.startsWith('sk-****')) {
        delete keysToSend.openai_api_key;
      }
      if (keysToSend.gemini_api_key && keysToSend.gemini_api_key.startsWith('****')) {
        delete keysToSend.gemini_api_key;
      }
      if (keysToSend.anthropic_api_key && keysToSend.anthropic_api_key.startsWith('sk-****')) {
        delete keysToSend.anthropic_api_key;
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-api-keys`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keysToSend)
      });

      if (response.ok) {
        const data = await response.json();
        setAiApiKeys(data);
        setMessage({ type: 'success', text: 'AI API keys saved successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to save AI API keys' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save AI API keys' });
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (provider) => {
    setLoadingModels(prev => ({ ...prev, [provider]: true }));
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-models/${provider}`);
      if (response.ok) {
        const data = await response.json();
        setAiModels(prev => ({ ...prev, [provider]: data.models }));
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || `Failed to fetch ${provider} models` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to fetch ${provider} models` });
    } finally {
      setLoadingModels(prev => ({ ...prev, [provider]: false }));
    }
  };

  const fetchAllTextModels = async () => {
    setLoadingModels(prev => ({ ...prev, allText: true }));
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-models/all-text`);
      if (response.ok) {
        const data = await response.json();
        setAiModels(prev => ({ ...prev, allText: data.models }));
        setMessage({ type: 'success', text: 'Text models refreshed successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to refresh text models' });
      }
    } catch (error) {
      console.error('Failed to fetch all text models:', error);
      setMessage({ type: 'error', text: 'Failed to refresh text models' });
    } finally {
      setLoadingModels(prev => ({ ...prev, allText: false }));
    }
  };

  const fetchAllImageModels = async () => {
    setLoadingModels(prev => ({ ...prev, allImage: true }));
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-models/all-image`);
      if (response.ok) {
        const data = await response.json();
        setAiModels(prev => ({ ...prev, allImage: data.models }));
        setMessage({ type: 'success', text: 'Image models refreshed successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to refresh image models' });
      }
    } catch (error) {
      console.error('Failed to fetch all image models:', error);
      setMessage({ type: 'error', text: 'Failed to refresh image models' });
    } finally {
      setLoadingModels(prev => ({ ...prev, allImage: false }));
    }
  };

  const refreshAllModels = async () => {
    setMessage({ type: '', text: '' });
    await Promise.all([
      fetchAllTextModels(),
      fetchAllImageModels(),
      fetchModels('openai'),
      fetchModels('gemini'),
      fetchModels('anthropic')
    ]);
    setMessage({ type: 'success', text: 'All models refreshed successfully!' });
  };

  const testAPIKey = async (provider) => {
    setTestingKey(provider);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/ai-api-keys/test/${provider}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        // Fetch models after successful validation
        await fetchModels(provider);
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to test ${provider} API key` });
    } finally {
      setTestingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 text-left">
          <h1 className="text-xl font-semibold text-gray-900 text-left">CMS Settings</h1>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-1 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('google')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'google'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2.033 16.01c-.564-1.789-1.632-3.932-1.821-4.474-.273-.787-.396-1.547-.396-2.442 0-1.279.366-2.164 1.027-2.783.575-.54 1.366-.866 2.223-.866.857 0 1.648.326 2.223.866.661.619 1.027 1.504 1.027 2.783 0 .895-.123 1.655-.396 2.442-.189.542-1.257 2.685-1.821 4.474h-2.066z"/>
                </svg>
                Google
              </button>
              <button
                onClick={() => setActiveTab('aws')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'aws'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335c-.072.048-.144.071-.208.071-.08 0-.16-.04-.239-.112-.112-.12-.208-.248-.288-.384-.08-.144-.16-.304-.256-.488-.64.755-1.44 1.135-2.4 1.135-.687 0-1.231-.191-1.64-.583-.408-.392-.616-.911-.616-1.559 0-.695.247-1.255.744-1.695.496-.44 1.151-.664 1.983-.664.272 0 .552.024.855.064.304.04.616.104.936.168v-.559c0-.583-.12-1-.36-1.271-.248-.272-.671-.408-1.279-.408-.28 0-.568.032-.863.104-.296.072-.576.144-.84.24-.128.047-.216.08-.264.095-.048.016-.088.024-.104.024-.096 0-.144-.072-.144-.216v-.336c0-.112.016-.2.056-.256s.112-.104.216-.16c.28-.143.615-.263 1.008-.36s.791-.151 1.199-.151c.911 0 1.575.2 2.007.616.424.416.64 1.047.64 1.903v2.496zm-3.311 1.239c.263 0 .536-.048.823-.143.288-.096.543-.271.768-.512.128-.144.224-.304.272-.488.048-.184.08-.392.08-.631v-.304c-.24-.047-.496-.087-.767-.112-.272-.024-.536-.04-.792-.04-.559 0-.968.111-1.239.335-.272.224-.408.543-.408.968 0 .408.104.712.32.92.216.2.52.296.943.296zm6.455.863c-.12 0-.199-.024-.256-.064-.056-.048-.104-.151-.151-.28l-1.735-5.735c-.048-.16-.072-.264-.072-.32 0-.128.064-.2.191-.2h.783c.128 0 .215.023.263.063.056.048.096.152.144.28l1.247 4.904 1.159-4.904c.04-.16.088-.256.144-.28.056-.04.143-.063.271-.063h.64c.128 0 .215.023.271.063.056.048.104.152.144.28l1.175 4.968 1.279-4.968c.048-.16.096-.256.151-.28.056-.04.143-.063.264-.063h.743c.127 0 .199.063.199.2 0 .047-.008.096-.016.151-.008.056-.024.12-.048.2l-1.783 5.735c-.048.16-.096.256-.151.28-.056.04-.136.063-.256.063h-.688c-.128 0-.215-.023-.271-.071-.056-.048-.104-.144-.144-.28l-1.151-4.783-1.143 4.775c-.04.16-.088.256-.144.28-.056.048-.143.071-.271.071h-.688zm10.295.215c-.415 0-.831-.048-1.239-.143-.407-.096-.719-.2-.927-.304-.128-.063-.215-.136-.247-.2-.032-.063-.048-.136-.048-.2v-.351c0-.144.056-.216.16-.216.04 0 .08.008.12.024.04.016.104.04.168.072.336.16.695.28 1.08.36s.775.12 1.167.12c.615 0 1.095-.104 1.431-.32.336-.215.512-.536.512-.959 0-.28-.088-.52-.271-.711-.184-.2-.559-.384-1.111-.568l-1.599-.504c-.815-.264-1.415-.655-1.775-1.167-.36-.512-.543-1.08-.543-1.695 0-.488.104-.92.32-1.287.215-.368.504-.68.864-.936.359-.256.767-.44 1.247-.568.48-.127.983-.191 1.511-.191.183 0 .375.008.567.032.2.024.383.056.567.088.175.04.343.08.504.127.16.048.295.096.4.144.104.048.183.104.231.151.048.048.088.104.12.176.024.071.04.151.04.247v.328c0 .144-.056.224-.16.224-.064 0-.167-.04-.312-.104-.671-.312-1.423-.472-2.247-.472-.56 0-.999.088-1.327.272-.329.184-.488.456-.488.823 0 .272.095.504.287.688.191.184.583.376 1.167.568l1.567.496c.807.256 1.391.623 1.743 1.111.353.488.527 1.04.527 1.647 0 .504-.104.96-.32 1.343-.215.384-.504.711-.88.976-.368.264-.791.464-1.279.607-.495.136-1.023.2-1.591.2z"/>
                </svg>
                AWS
              </button>
              <button
                onClick={() => setActiveTab('apikeys')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'apikeys'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                API Keys
              </button>
              <button
                onClick={() => setActiveTab('ads')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'ads'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ads
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'appearance'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Appearance
              </button>
              <button
                onClick={() => setActiveTab('other')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'other'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Other Settings
              </button>
              <button
                onClick={() => setActiveTab('state-language')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'state-language'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                State-Language
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'notifications'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {activeTab === 'aws' && (
              <div className="space-y-6">
                <form onSubmit={saveAWSConfig} className="space-y-6">
                  {/* Enable S3 Toggle */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 text-base">Enable AWS S3 Storage</h3>
                        <p className="text-sm text-gray-600">Enable AWS S3 for file uploads and media storage</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          name="is_enabled"
                          checked={awsConfig.is_enabled}
                          onChange={handleAWSConfigChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                  </div>

                  {/* AWS Credentials */}
                  <div className="space-y-5">
                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        AWS Access Key ID <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          name="aws_access_key_id"
                          value={awsConfig.aws_access_key_id || ''}
                          onChange={handleAWSConfigChange}
                          disabled={!awsConfig.is_enabled}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="AKIA5XTURFZYPI6B2TZW"
                          required={awsConfig.is_enabled}
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        AWS Secret Access Key <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSecretKey ? "text" : "password"}
                          name="aws_secret_access_key"
                          value={awsConfig.aws_secret_access_key || ''}
                          onChange={handleAWSConfigChange}
                          disabled={!awsConfig.is_enabled}
                          className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                          required={awsConfig.is_enabled}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                          disabled={!awsConfig.is_enabled}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {showSecretKey ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        AWS Region <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="aws_region"
                        value={awsConfig.aws_region}
                        onChange={handleAWSConfigChange}
                        disabled={!awsConfig.is_enabled}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="us-east-1">US East (Ohio)</option>
                        <option value="us-east-2">US East (N. Virginia)</option>
                        <option value="us-west-1">US West (N. California)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                        <option value="eu-west-1">Europe (Ireland)</option>
                      </select>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        S3 Bucket Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="s3_bucket_name"
                        value={awsConfig.s3_bucket_name}
                        onChange={handleAWSConfigChange}
                        disabled={!awsConfig.is_enabled}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="prime-pixel-cms-uploads"
                        required={awsConfig.is_enabled}
                      />
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        Articles Root Folder
                      </label>
                      <input
                        type="text"
                        name="articles_root_folder"
                        value={awsConfig.articles_root_folder}
                        onChange={handleAWSConfigChange}
                        disabled={!awsConfig.is_enabled}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="articles"
                      />
                      <p className="mt-1 text-xs text-gray-500">Path: {awsConfig.articles_root_folder}/YYYY/MM/DD/N.ext</p>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        Galleries Root Folder
                      </label>
                      <input
                        type="text"
                        name="galleries_root_folder"
                        value={awsConfig.galleries_root_folder}
                        onChange={handleAWSConfigChange}
                        disabled={!awsConfig.is_enabled}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="galleries"
                      />
                      <p className="mt-1 text-xs text-gray-500">Path: {awsConfig.galleries_root_folder}/YYYY/MM/DD/N.ext</p>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        Tadka Pics Root Folder
                      </label>
                      <input
                        type="text"
                        name="tadka_pics_root_folder"
                        value={awsConfig.tadka_pics_root_folder}
                        onChange={handleAWSConfigChange}
                        disabled={!awsConfig.is_enabled}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="tadka-pics"
                      />
                      <p className="mt-1 text-xs text-gray-500">Path: {awsConfig.tadka_pics_root_folder}/YYYY/MM/DD/N.ext</p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium text-sm transition-colors"
                    >
                      {loading ? 'Saving...' : 'Save Configuration'}
                    </button>
                    {awsConfig.is_enabled && (
                      <button
                        type="button"
                        onClick={testAWSConnection}
                        disabled={loading}
                        className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 font-medium text-sm transition-colors"
                      >
                        {loading && connectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* Test Connection Result Modal */}
            {connectionStatus === 'connected' && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Successful</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Successfully connected to AWS S3. Your bucket is accessible and ready to use.
                    </p>
                    <button
                      onClick={() => setConnectionStatus('unknown')}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {connectionStatus === 'disconnected' && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                  <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                      <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Failed</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      {message.text.replace('❌ ', '') || 'Unable to connect to AWS S3. Please check your credentials and try again.'}
                    </p>
                    <button
                      onClick={() => setConnectionStatus('unknown')}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Google Tab */}
            {activeTab === 'google' && (
              <div className="py-16">
                <div className="flex items-start gap-4">
                  <svg className="w-12 h-12 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Google Integration</h3>
                    <p className="text-gray-600">Configure Google authentication and services</p>
                  </div>
                </div>
              </div>
            )}

            {/* API Keys Tab */}
            {activeTab === 'apikeys' && (
              <div className="space-y-8">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 text-left">AI API Keys Management</h3>
                  <p className="text-sm text-gray-600 text-left">Configure API keys for AI content generation. These keys will be used for generating articles and content.</p>
                </div>

                <form onSubmit={saveAIAPIKeys} className="space-y-8">
                  {/* OpenAI Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                        <path d="M22.2819 9.8211C23.0545 10.4494 23.5 11.3992 23.5 12.4081C23.5 13.417 23.0545 14.3668 22.2819 14.9951L13.5 21.5581C12.6875 22.2186 11.625 22.5 10.5625 22.3719C9.5 22.2437 8.5625 21.7186 7.9375 20.9074L2.25 13.0951C1.625 12.284 1.25 11.2751 1.25 10.2251C1.25 9.17516 1.625 8.16626 2.25 7.35516L7.9375 -0.456838C8.5625 -1.26794 9.5 -1.79304 10.5625 -1.92119C11.625 -2.04934 12.6875 -1.76794 13.5 -1.10743L22.2819 5.45566C23.0545 6.08396 23.5 7.03376 23.5 8.04266C23.5 9.05156 23.0545 10.0014 22.2819 10.6297V9.8211Z" fill="#10A37F"/>
                        <path d="M10.5625 8.21094C11.6875 8.21094 12.625 9.14844 12.625 10.2734C12.625 11.3984 11.6875 12.3359 10.5625 12.3359C9.4375 12.3359 8.5 11.3984 8.5 10.2734C8.5 9.14844 9.4375 8.21094 10.5625 8.21094Z" fill="white"/>
                      </svg>
                      <div className="text-left">
                        <h4 className="text-base font-semibold text-gray-900">OpenAI</h4>
                        <p className="text-sm text-gray-600">GPT models for text generation</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-left">
                        <label className="block text-sm font-medium text-gray-700 mb-2">OpenAI API Key</label>
                        <div className="relative">
                          <input
                            type={showOpenAIKey ? "text" : "password"}
                            name="openai_api_key"
                            value={aiApiKeys.openai_api_key || ''}
                            onChange={handleAIKeyChange}
                            className="w-full px-4 py-2.5 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                            placeholder="sk-proj-..."
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility('openai')}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              title={showOpenAIKey ? "Hide key" : "Show full key"}
                            >
                              {showOpenAIKey ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              )}
                            </button>
                            {aiApiKeys.openai_api_key && (
                              <button
                                type="button"
                                onClick={() => testAPIKey('openai')}
                                disabled={testingKey === 'openai'}
                                className="text-blue-600 hover:text-blue-700 text-xs font-medium disabled:opacity-50"
                              >
                                {testingKey === 'openai' ? 'Testing...' : 'Test'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {aiModels.openai.length > 0 && (
                        <div className="text-left">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Default Model</label>
                          <select
                            name="openai_default_model"
                            value={aiApiKeys.openai_default_model || ''}
                            onChange={handleAIKeyChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          >
                            <option value="">Select a model</option>
                            {aiModels.openai.map(model => (
                              <option key={model.id} value={model.id}>{model.name}</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">This model will be used by default for content generation</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Google Gemini Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
                        <path fill="#34A853" d="M12 2v20l10-5V7L12 2z" opacity="0.7"/>
                      </svg>
                      <div className="text-left">
                        <h4 className="text-base font-semibold text-gray-900">Google Gemini</h4>
                        <p className="text-sm text-gray-600">Gemini models for multimodal AI</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-left">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Gemini API Key</label>
                        <div className="relative">
                          <input
                            type={showGeminiKey ? "text" : "password"}
                            name="gemini_api_key"
                            value={aiApiKeys.gemini_api_key || ''}
                            onChange={handleAIKeyChange}
                            className="w-full px-4 py-2.5 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                            placeholder="AIza..."
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility('gemini')}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              title={showGeminiKey ? "Hide key" : "Show full key"}
                            >
                              {showGeminiKey ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              )}
                            </button>
                            {aiApiKeys.gemini_api_key && (
                              <button
                                type="button"
                                onClick={() => testAPIKey('gemini')}
                                disabled={testingKey === 'gemini'}
                                className="text-blue-600 hover:text-blue-700 text-xs font-medium disabled:opacity-50"
                              >
                                {testingKey === 'gemini' ? 'Testing...' : 'Test'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {aiModels.gemini.length > 0 && (
                        <div className="text-left">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Default Model</label>
                          <select
                            name="gemini_default_model"
                            value={aiApiKeys.gemini_default_model || ''}
                            onChange={handleAIKeyChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          >
                            <option value="">Select a model</option>
                            {aiModels.gemini.map(model => (
                              <option key={model.id} value={model.id}>{model.name}</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">This model will be used by default for content generation</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Anthropic Claude Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8" viewBox="0 0 24 24">
                        <rect width="24" height="24" rx="4" fill="#181818"/>
                        <path d="M8 16L12 8L16 16" stroke="#D97757" strokeWidth="2" fill="none"/>
                      </svg>
                      <div className="text-left">
                        <h4 className="text-base font-semibold text-gray-900">Anthropic Claude</h4>
                        <p className="text-sm text-gray-600">Claude models for advanced reasoning</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="text-left">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Anthropic API Key</label>
                        <div className="relative">
                          <input
                            type={showAnthropicKey ? "text" : "password"}
                            name="anthropic_api_key"
                            value={aiApiKeys.anthropic_api_key || ''}
                            onChange={handleAIKeyChange}
                            className="w-full px-4 py-2.5 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                            placeholder="sk-ant-..."
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility('anthropic')}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              title={showAnthropicKey ? "Hide key" : "Show full key"}
                            >
                              {showAnthropicKey ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              )}
                            </button>
                            {aiApiKeys.anthropic_api_key && (
                              <button
                                type="button"
                                onClick={() => testAPIKey('anthropic')}
                                disabled={testingKey === 'anthropic'}
                                className="text-blue-600 hover:text-blue-700 text-xs font-medium disabled:opacity-50"
                              >
                                {testingKey === 'anthropic' ? 'Testing...' : 'Test'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {aiModels.anthropic.length > 0 && (
                        <div className="text-left">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Default Model</label>
                          <select
                            name="anthropic_default_model"
                            value={aiApiKeys.anthropic_default_model || ''}
                            onChange={handleAIKeyChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          >
                            <option value="">Select a model</option>
                            {aiModels.anthropic.map(model => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                                {model.description && ` - ${model.description}`}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">This model will be used by default for content generation</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Default Text Generation Model Section */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="text-left flex-1">
                        <h4 className="text-base font-semibold text-gray-900">Default Text Generation Model</h4>
                        <p className="text-sm text-gray-600">Select the default model for AI text content generation</p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchAllTextModels}
                        disabled={loadingModels.allText}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        title="Refresh text models from all providers"
                      >
                        <svg 
                          className={`w-4 h-4 ${loadingModels.allText ? 'animate-spin' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {loadingModels.allText ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Text Generation Model</label>
                      <select
                        name="default_text_model"
                        value={aiApiKeys.default_text_model || ''}
                        onChange={handleAIKeyChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm bg-white"
                        disabled={loadingModels.allText}
                      >
                        <option value="">Select a text generation model</option>
                        {aiModels.allText.map(model => (
                          <option key={`${model.provider}-${model.id}`} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        {aiApiKeys.default_text_model 
                          ? `Selected: ${aiModels.allText.find(m => m.id === aiApiKeys.default_text_model)?.name || aiApiKeys.default_text_model}`
                          : 'This model will be used by default when generating articles and text content'}
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        💡 Click "Refresh" to fetch the latest models from OpenAI, Gemini, and Anthropic
                      </p>
                    </div>
                  </div>

                  {/* Default Image Generation Model Section */}
                  <div className="bg-gradient-to-r from-pink-50 to-orange-50 border border-pink-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="text-left">
                        <h4 className="text-base font-semibold text-gray-900">Default Image Generation Model</h4>
                        <p className="text-sm text-gray-600">Select the default model for AI image generation</p>
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Image Generation Model</label>
                      <select
                        name="default_image_model"
                        value={aiApiKeys.default_image_model || ''}
                        onChange={handleAIKeyChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-sm bg-white"
                        disabled={loadingModels.allImage}
                      >
                        <option value="">Select an image generation model</option>
                        {aiModels.allImage.map(model => (
                          <option key={`${model.provider}-${model.id}`} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        {aiApiKeys.default_image_model 
                          ? `Selected: ${aiModels.allImage.find(m => m.id === aiApiKeys.default_image_model)?.name || aiApiKeys.default_image_model}`
                          : 'This model will be used by default when generating images for articles'}
                      </p>
                      {aiApiKeys.default_image_model && (
                        <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                          <strong>Model Details:</strong> {aiModels.allImage.find(m => m.id === aiApiKeys.default_image_model)?.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-left">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">About AI API Keys & Models</h4>
                        <ul className="text-xs text-blue-800 space-y-1">
                          <li>• <strong>API Keys:</strong> Configure your API keys for OpenAI, Gemini, and Anthropic to enable AI content generation</li>
                          <li>• <strong>Test Keys:</strong> Click "Test" to validate your API key and fetch available models from each provider</li>
                          <li>• <strong>Text Generation Model:</strong> Choose a default model for generating article content from all available providers</li>
                          <li>• <strong>Image Generation Model:</strong> Choose a default model for generating article images (DALL-E, Imagen/Nano Banana)</li>
                          <li>• <strong>Security:</strong> All keys are stored securely and masked after saving. Click the eye icon to view full keys</li>
                          <li>• <strong>Get API Keys:</strong> OpenAI Platform, Google AI Studio, and Anthropic Console</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-6 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium text-sm transition-colors"
                    >
                      {loading ? 'Saving...' : 'Save AI API Keys'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Ads Tab */}
            {activeTab === 'ads' && (
              <div className="space-y-6">
                {adsLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-gray-500">Loading ad settings...</div>
                  </div>
                ) : (
                  <>
                    {/* Notification */}
                    {adsNotification.show && (
                      <div className={`p-3 rounded-lg ${
                        adsNotification.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {adsNotification.message}
                      </div>
                    )}

                    {/* Google Ads Section */}
                    <div className="mb-8">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-left">Google Ads Placements</h3>
                        <p className="text-sm text-gray-600 text-left">Enable or disable Google Ads at different locations across your site. Changes are saved automatically.</p>
                      </div>

                      {/* Google Ad Placements Grid */}
                      <div className="space-y-2">
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
                                onClick={() => placement.status === 'Active' && handleAdToggle(placement.key)}
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

                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-left">
                            <h4 className="text-sm font-semibold text-blue-900 mb-1">Important Information</h4>
                            <ul className="text-xs text-blue-800 space-y-1">
                              <li>• Make sure you have added your Google AdSense code to your site</li>
                              <li>• Enabled placements will show Google Ads automatically</li>
                              <li>• Changes take effect immediately on your live site</li>
                              <li>• "Coming Soon" placements are under development</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sponsored Ads Section */}
                    <div className="mb-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 text-left">Sponsored Ads</h3>
                        <p className="text-sm text-gray-600 text-left">Manage sponsored ads created through the CMS. Toggle to show or hide the sponsored ads section on your homepage.</p>
                      </div>

                      {/* Sponsored Ads Placement */}
                      <div className="space-y-2">
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
                                onClick={() => handleAdToggle('homepage_sponsored_ads')}
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

                      <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-left">
                            <h4 className="text-sm font-semibold text-purple-900 mb-1">About Sponsored Ads</h4>
                            <ul className="text-xs text-purple-800 space-y-1">
                              <li>• Create sponsored ads from the "Ad Settings" tab in Manage Content</li>
                              <li>• Ads are displayed in a dedicated section on the homepage</li>
                              <li>• Toggle this setting to show or hide all sponsored ads</li>
                              <li>• Individual ads can be managed separately from the Ads tab in Manage Content</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="py-16">
                <div className="flex items-start gap-4">
                  <svg className="w-12 h-12 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Appearance Settings</h3>
                    <p className="text-gray-600">Customize the look and feel of your CMS</p>
                  </div>
                </div>
              </div>
            )}

            {/* Other Settings Tab */}
            {activeTab === 'other' && (
              <div className="py-16">
                <div className="flex items-start gap-4">
                  <svg className="w-12 h-12 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Other Settings</h3>
                    <p className="text-gray-600">Additional CMS configuration options</p>
                  </div>
                </div>
              </div>
            )}

            {/* State-Language Tab */}
            {activeTab === 'state-language' && (
              <div className="space-y-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 text-left">State-Language Mapping</h3>
                  <p className="text-sm text-gray-600 text-left">Configure the default language for each Indian state. This mapping is used for content targeting and recommendations.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          State Code
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          State Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Primary Language
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* ALL States (National) - First Row */}
                      <tr className="bg-blue-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">
                          all
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          All States (National/Bollywood)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                          {editingMapping === 'all' ? (
                            <input
                              type="text"
                              value={stateLanguageMapping['all']}
                              onChange={(e) => setStateLanguageMapping({...stateLanguageMapping, 'all': e.target.value})}
                              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="font-semibold text-blue-700">{stateLanguageMapping['all']}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-left">
                          {editingMapping === 'all' ? (
                            <button
                              onClick={() => setEditingMapping(null)}
                              className="text-green-600 hover:text-green-900 font-medium"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingMapping('all')}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* All Indian States */}
                      {INDIAN_STATES.map((state) => (
                        <tr key={state.code} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">
                            {state.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                            {state.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-left">
                            {editingMapping === state.code ? (
                              <input
                                type="text"
                                value={stateLanguageMapping[state.code] || 'Hindi'}
                                onChange={(e) => setStateLanguageMapping({...stateLanguageMapping, [state.code]: e.target.value})}
                                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              stateLanguageMapping[state.code] || 'Hindi'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-left">
                            {editingMapping === state.code ? (
                              <button
                                onClick={() => setEditingMapping(null)}
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Save
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditingMapping(state.code)}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">About State-Language Mapping</h4>
                      <p className="text-sm text-blue-800">
                        This mapping determines the default language for content in each state. The "ALL" option represents national/Bollywood content that is shown to all users regardless of their state selection.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="py-16">
                <div className="flex items-start gap-4">
                  <svg className="w-12 h-12 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Notifications</h3>
                    <p className="text-gray-600">Configure email and push notifications</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
