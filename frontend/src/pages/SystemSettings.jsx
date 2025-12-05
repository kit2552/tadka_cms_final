import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SystemSettings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('aws');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // AWS Configuration State
  const [awsConfig, setAwsConfig] = useState({
    is_enabled: false,
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    s3_bucket_name: '',
    root_folder_path: '',
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

  useEffect(() => {
    loadAWSConfig();
    loadUsers();
  }, []);

  const loadAWSConfig = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/aws-config`);
      const data = await response.json();
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
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/aws-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(awsConfig)
      });

      if (response.ok) {
        const data = await response.json();
        setAwsConfig(data);
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
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/system-settings/aws-config/test`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: `✅ ${data.message}` });
      } else {
        setMessage({ type: 'error', text: `❌ ${data.message}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Connection test failed' });
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/cms')}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            ← Back to CMS
          </button>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2">Configure AWS S3 storage and manage users</p>
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
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('aws')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'aws'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AWS Configuration
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                User Management
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'aws' && (
              <form onSubmit={saveAWSConfig} className="space-y-6">
                {/* Enable S3 */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_enabled"
                    checked={awsConfig.is_enabled}
                    onChange={handleAWSConfigChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900 font-medium">
                    Enable AWS S3 Storage
                  </label>
                </div>

                {/* AWS Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AWS Access Key ID *
                    </label>
                    <input
                      type="text"
                      name="aws_access_key_id"
                      value={awsConfig.aws_access_key_id}
                      onChange={handleAWSConfigChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      required={awsConfig.is_enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AWS Secret Access Key *
                    </label>
                    <input
                      type="password"
                      name="aws_secret_access_key"
                      value={awsConfig.aws_secret_access_key}
                      onChange={handleAWSConfigChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      required={awsConfig.is_enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AWS Region *
                    </label>
                    <select
                      name="aws_region"
                      value={awsConfig.aws_region}
                      onChange={handleAWSConfigChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-1">US West (N. California)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                      <option value="eu-west-1">Europe (Ireland)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      S3 Bucket Name *
                    </label>
                    <input
                      type="text"
                      name="s3_bucket_name"
                      value={awsConfig.s3_bucket_name}
                      onChange={handleAWSConfigChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="my-bucket-name"
                      required={awsConfig.is_enabled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Root Folder Path
                    </label>
                    <input
                      type="text"
                      name="root_folder_path"
                      value={awsConfig.root_folder_path}
                      onChange={handleAWSConfigChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="images/uploads (optional)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum File Size (MB)
                    </label>
                    <input
                      type="number"
                      name="max_file_size_mb"
                      value={awsConfig.max_file_size_mb}
                      onChange={handleAWSConfigChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Saving...' : 'Save Configuration'}
                  </button>

                  {awsConfig.is_enabled && (
                    <button
                      type="button"
                      onClick={testAWSConnection}
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                      Test Connection
                    </button>
                  )}
                </div>
              </form>
            )}

            {activeTab === 'users' && (
              <div>
                {/* Add User Button */}
                <div className="mb-6">
                  <button
                    onClick={() => openUserModal()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    + Add User
                  </button>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                              user.role === 'editor' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => openUserModal(user)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>

            <form onSubmit={saveUser} className="space-y-4">
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={userForm.username}
                    onChange={handleUserFormChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={userForm.email}
                  onChange={handleUserFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={userForm.password}
                  onChange={handleUserFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  name="role"
                  value={userForm.role}
                  onChange={handleUserFormChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={userForm.is_active}
                  onChange={handleUserFormChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;
