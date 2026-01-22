import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Globe, RefreshCw, Save, Loader2 } from 'lucide-react';

const CricketSchedulesAgentForm = ({ agent, onSave, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agent_type: 'cricket_schedules',
    schedule_source: 'bbc',
    schedule_days: 7,
    fetch_mode: 'full',
    is_active: true,
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        agent_type: 'cricket_schedules',
        schedule_source: agent.schedule_source || 'bbc',
        schedule_days: agent.schedule_days || 7,
        fetch_mode: agent.fetch_mode || 'full',
        is_active: agent.is_active !== false,
      });
    }
  }, [agent]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Agent Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Agent Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., BBC Cricket Schedules"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Description of this agent..."
          rows={2}
        />
      </div>

      {/* Schedule Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Globe className="w-4 h-4 inline mr-1" />
          Schedule Source *
        </label>
        <select
          value={formData.schedule_source}
          onChange={(e) => setFormData(prev => ({ ...prev, schedule_source: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="bbc">BBC Sport Cricket</option>
          <option value="espn-cricinfo">ESPN Cricinfo</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Source website to scrape cricket schedules from
        </p>
      </div>

      {/* Number of Days */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Calendar className="w-4 h-4 inline mr-1" />
          Days to Fetch *
        </label>
        <input
          type="number"
          min={1}
          max={30}
          value={formData.schedule_days}
          onChange={(e) => setFormData(prev => ({ ...prev, schedule_days: parseInt(e.target.value) || 7 }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Number of days of schedules to fetch (1-30)
        </p>
      </div>

      {/* Fetch Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <RefreshCw className="w-4 h-4 inline mr-1" />
          Fetch Mode
        </label>
        <select
          value={formData.fetch_mode}
          onChange={(e) => setFormData(prev => ({ ...prev, fetch_mode: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="full">Full Refresh (Re-fetch all days)</option>
          <option value="next">Next Day Only (Maintain window)</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          "Full" refreshes all schedules. "Next Day" adds new schedules to maintain the configured day window.
        </p>
      </div>

      {/* Active Status */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
          Agent is Active
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {agent ? 'Update Agent' : 'Create Agent'}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default CricketSchedulesAgentForm;
