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

  useEffect(() => {
    loadAWSConfig();
    loadUsers();
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
                onClick={() => setActiveTab('placeholders')}
                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-normal text-sm transition-colors ${
                  activeTab === 'placeholders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Placeholders
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
              <div className="py-16">
                <div className="flex items-start gap-4">
                  <svg className="w-12 h-12 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">API Keys Management</h3>
                    <p className="text-gray-600">Manage third-party API keys and integrations</p>
                  </div>
                </div>
              </div>
            )}

            {/* Placeholders Tab */}
            {activeTab === 'placeholders' && (
              <div className="py-16">
                <div className="flex items-start gap-4">
                  <svg className="w-12 h-12 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Placeholders Configuration</h3>
                    <p className="text-gray-600">Configure placeholder images and defaults</p>
                  </div>
                </div>
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
