import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateAgentModal from '../components/CreateAgentModal';
import PostAgentForm from '../components/PostAgentForm';

const AIAgents = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [runningAgents, setRunningAgents] = useState(new Set());
  const [runResults, setRunResults] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, agentId: null, agentName: '' });

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai-agents`);
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentTypeSelect = (type) => {
    setSelectedAgentType(type);
    setShowCreateModal(false);
    setShowAgentForm(true);
  };

  const handleAgentSaved = () => {
    setShowAgentForm(false);
    setSelectedAgentType(null);
    setEditingAgent(null);
    fetchAgents();
  };

  const handleToggleAgent = async (agentId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai-agents/${agentId}/toggle`, {
        method: 'POST'
      });
      fetchAgents();
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  const handleDeleteAgent = (agentId, agentName) => {
    setDeleteConfirm({ show: true, agentId, agentName });
  };

  const confirmDelete = async () => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai-agents/${deleteConfirm.agentId}`, {
        method: 'DELETE'
      });
      fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    } finally {
      setDeleteConfirm({ show: false, agentId: null, agentName: '' });
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setSelectedAgentType(agent.agent_type);
    setShowAgentForm(true);
  };

  const handleRunAgent = async (agentId) => {
    // Check if agent is already running
    if (runningAgents.has(agentId)) return;
    
    // Mark agent as running
    setRunningAgents(prev => new Set([...prev, agentId]));
    setRunResults(prev => ({ ...prev, [agentId]: null }));
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai-agents/${agentId}/run`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Handle different agent types
        let message = '';
        if (data.groups_created !== undefined || data.groups_updated !== undefined) {
          // TV Video agent response
          const articlesCreated = data.articles_created || 0;
          const articlesExisting = data.articles_existing || 0;
          const groupsCreated = data.groups_created || 0;
          const groupsUpdated = data.groups_updated || 0;
          
          message = `${articlesCreated} new videos added! (${groupsCreated} new groups, ${groupsUpdated} updated)`;
        } else if (data.posts_created !== undefined) {
          // Video agent response
          message = `${data.posts_created} video post(s) created successfully!`;
        } else if (data.gallery_id !== undefined) {
          // Gallery agent response
          message = `Gallery "${data.title}" created successfully!`;
        } else {
          // Post agent response
          message = `Article "${data.title || 'Untitled'}" created successfully!`;
        }
        
        setRunResults(prev => ({ 
          ...prev, 
          [agentId]: { 
            success: true, 
            message: message,
            articleId: data.article_id || data.gallery_id
          }
        }));
      } else {
        setRunResults(prev => ({ 
          ...prev, 
          [agentId]: { 
            success: false, 
            message: data.detail || data.message || 'Failed to run agent'
          }
        }));
      }
    } catch (error) {
      console.error('Failed to run agent:', error);
      setRunResults(prev => ({ 
        ...prev, 
        [agentId]: { 
          success: false, 
          message: 'Network error. Please try again.'
        }
      }));
    } finally {
      setRunningAgents(prev => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
      
      // Clear result after 5 seconds
      setTimeout(() => {
        setRunResults(prev => {
          const next = { ...prev };
          delete next[agentId];
          return next;
        });
      }, 5000);
    }
  };

  const getAgentTypeIcon = (type) => {
    switch(type) {
      case 'post':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'photo_gallery':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'review':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        );
      case 'ott_release':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getAgentTypeName = (type) => {
    switch(type) {
      case 'post': return 'Post Agent';
      case 'photo_gallery': return 'Photo Gallery Agent';
      case 'review': return 'Review Agent';
      case 'video': return 'Video Agent';
      case 'tadka_pics': return 'Tadka Pics Agent';
      case 'tv_video': return 'TV Video Agent';
      case 'reality_show': return 'Reality Shows Agent';
      case 'ott_release': return 'OTT Release Agent';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-4">
      <div className="max-w-5xl-plus mx-auto px-8">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 text-left">AI Agents</h1>
              <p className="mt-1 text-xs text-gray-600 text-left">
                Manage your AI agents for automated content generation
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-black text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create AI Agent
            </button>
          </div>
        </div>

        {/* Agents List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No AI Agents Yet</h3>
            <p className="text-xs text-gray-600 mb-4">Get started by creating your first AI agent</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create AI Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${agent.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                      {getAgentTypeIcon(agent.agent_type)}
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">{agent.agent_name}</h3>
                      <p className="text-xs text-gray-500">{getAgentTypeName(agent.agent_type)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAgent(agent.id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      agent.is_active ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      agent.is_active ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="space-y-1.5 mb-3 text-left">
                  <div className="flex items-center gap-1.5 text-xs">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-600">
                      {agent.mode === 'recurring' ? (
                        <>
                          {agent.schedule_selection === 'all_days' ? 'Every day' : 'Scheduled days'} at {agent.post_time}
                        </>
                      ) : (
                        'Adhoc mode'
                      )}
                    </span>
                  </div>
                  {agent.topic && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-gray-600 truncate">{agent.topic}</span>
                    </div>
                  )}
                  {agent.target_language && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                      <span className="text-gray-600">{agent.target_language}</span>
                    </div>
                  )}
                </div>

                {/* Run Result Message */}
                {runResults[agent.id] && (
                  <div className={`mb-2 px-3 py-2 rounded text-xs ${
                    runResults[agent.id].success 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {runResults[agent.id].message}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleRunAgent(agent.id)}
                    disabled={runningAgents.has(agent.id) || !agent.is_active}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1 ${
                      runningAgents.has(agent.id) 
                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                        : !agent.is_active
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                    title={!agent.is_active ? 'Enable agent to run' : 'Run agent now'}
                  >
                    {runningAgents.has(agent.id) ? (
                      <>
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Running...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Run
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id, agent.agent_name)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onSelect={handleAgentTypeSelect}
        />
      )}

      {/* Agent Form Modal - Show for post, photo_gallery, tadka_pics, video, tv_video, and reality_show agents */}
      {showAgentForm && (selectedAgentType === 'post' || selectedAgentType === 'photo_gallery' || selectedAgentType === 'tadka_pics' || selectedAgentType === 'video' || selectedAgentType === 'tv_video' || selectedAgentType === 'reality_show' || selectedAgentType === 'ott_release') && (
        <PostAgentForm
          onClose={() => {
            setShowAgentForm(false);
            setSelectedAgentType(null);
            setEditingAgent(null);
          }}
          onSave={handleAgentSaved}
          editingAgent={editingAgent ? editingAgent : { agent_type: selectedAgentType }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-center w-10 h-10 mx-auto mb-3 rounded-full bg-red-100">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900 text-center mb-1">Delete Agent</h3>
              <p className="text-sm text-gray-600 text-center">
                Are you sure you want to delete <span className="font-medium text-gray-900">"{deleteConfirm.agentName}"</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex border-t border-gray-200">
              <button
                onClick={() => setDeleteConfirm({ show: false, agentId: null, agentName: '' })}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgents;
