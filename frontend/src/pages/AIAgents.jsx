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

  useEffect(() => {
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

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;
    
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ai-agents/${agentId}`, {
        method: 'DELETE'
      });
      fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleEditAgent = (agent) => {
    setEditingAgent(agent);
    setSelectedAgentType(agent.agent_type);
    setShowAgentForm(true);
  };

  const getAgentTypeIcon = (type) => {
    switch(type) {
      case 'post':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'photo_gallery':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'review':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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
                  {agent.target_state && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-600">{agent.target_state}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
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

      {/* Agent Form Modal */}
      {showAgentForm && selectedAgentType === 'post' && (
        <PostAgentForm
          onClose={() => {
            setShowAgentForm(false);
            setSelectedAgentType(null);
            setEditingAgent(null);
          }}
          onSave={handleAgentSaved}
          editingAgent={editingAgent}
        />
      )}
    </div>
  );
};

export default AIAgents;
