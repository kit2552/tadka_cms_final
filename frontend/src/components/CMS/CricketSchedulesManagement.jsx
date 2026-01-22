import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Trophy, Trash2, RefreshCw, Loader2, Globe } from 'lucide-react';

const CricketSchedulesManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState(7);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/cricket-schedules?days=${days}&limit=200`);
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [days]);

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    
    setDeleting(scheduleId);
    try {
      const response = await fetch(`${API_URL}/api/cricket-schedules/${scheduleId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        setTotal(prev => prev - 1);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    } finally {
      setDeleting(null);
    }
  };

  const handleClearOld = async () => {
    if (!window.confirm('Delete all schedules older than today?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/cricket-schedules/clear/old`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Deleted ${data.deleted} old schedules`);
        fetchSchedules();
      }
    } catch (error) {
      console.error('Error clearing old schedules:', error);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'TBD';
    
    // Add Z if not present to treat as UTC
    let utcDateString = dateString;
    if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
      utcDateString = dateString + 'Z';
    }
    
    const date = new Date(utcDateString);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const datePart = date.toLocaleString('en-US', {
      timeZone: userTimezone,
      month: 'short',
      day: 'numeric'
    });
    
    const timePart = date.toLocaleString('en-US', {
      timeZone: userTimezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
    
    let tzAbbr = date.toLocaleString('en-US', {
      timeZone: userTimezone,
      timeZoneName: 'short'
    }).split(' ').pop();
    
    if (tzAbbr === 'GMT+5:30') tzAbbr = 'IST';
    
    return `${datePart}, ${timePart} ${tzAbbr}`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      live: 'bg-red-100 text-red-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return badges[status] || badges.scheduled;
  };

  const getMatchTypeBadge = (matchType) => {
    if (matchType?.includes('T20')) return 'bg-purple-100 text-purple-800';
    if (matchType?.includes('ODI')) return 'bg-blue-100 text-blue-800';
    if (matchType?.includes('Test')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Group schedules by date
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const date = schedule.match_date || 'Unknown';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(schedule);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Cricket Schedules</h2>
          <p className="text-sm text-gray-500">{total} matches in next {days} days</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={2}>Next 2 Days</option>
            <option value={7}>Next 7 Days</option>
            <option value={14}>Next 14 Days</option>
            <option value={30}>Next 30 Days</option>
          </select>
          <button
            onClick={fetchSchedules}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleClearOld}
            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear Old
          </button>
        </div>
      </div>

      {/* Schedules List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Schedules Found</h3>
          <p className="text-gray-500 mt-2">
            Run the Cricket Schedules agent to fetch match schedules
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSchedules).map(([date, dateSchedules]) => (
            <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Date Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({dateSchedules.length} matches)
                  </span>
                </div>
              </div>

              {/* Matches */}
              <div className="divide-y divide-gray-100">
                {dateSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {/* Teams */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-900">
                            {schedule.team1}
                          </span>
                          <span className="text-gray-400">vs</span>
                          <span className="font-semibold text-gray-900">
                            {schedule.team2}
                          </span>
                        </div>

                        {/* Meta Info */}
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          {/* Time */}
                          <div className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-4 h-4" />
                            {formatDateTime(schedule.match_datetime_utc)}
                          </div>

                          {/* Match Type */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getMatchTypeBadge(schedule.match_type)}`}>
                            {schedule.match_type}
                          </span>

                          {/* Status */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(schedule.status)}`}>
                            {schedule.status}
                          </span>

                          {/* Tournament */}
                          {schedule.tournament && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Trophy className="w-4 h-4" />
                              {schedule.tournament}
                            </div>
                          )}

                          {/* Venue */}
                          {schedule.venue && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <MapPin className="w-4 h-4" />
                              {schedule.venue}
                            </div>
                          )}

                          {/* Source */}
                          <div className="flex items-center gap-1 text-gray-400">
                            <Globe className="w-3 h-3" />
                            {schedule.source}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deleting === schedule.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {deleting === schedule.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CricketSchedulesManagement;
