import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Trash2, Video, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const GroupedPosts = () => {
  const [groupedPosts, setGroupedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [stats, setStats] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, groupId: null, groupTitle: '' });
  const [editModal, setEditModal] = useState({ isOpen: false, groupId: null, currentTitle: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [successModal, setSuccessModal] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    fetchGroupedPosts();
    fetchStats();
  }, []);

  const fetchGroupedPosts = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts?limit=100`);
      const data = await response.json();
      setGroupedPosts(data.groups || []);
    } catch (error) {
      console.error('Error fetching grouped posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts-stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleDeleteGroup = (groupId) => {
    console.log('handleDeleteGroup called with groupId:', groupId);
    const group = groupedPosts.find(g => (g._id || g.id) === groupId);
    console.log('Found group:', group);
    if (!group) {
      alert('Error: Group not found');
      return;
    }
    setDeleteConfirmModal({
      isOpen: true,
      groupId: groupId,
      groupTitle: group.group_title || 'this group'
    });
  };

  const confirmDelete = async () => {
    const groupId = deleteConfirmModal.groupId;
    
    if (!groupId) {
      alert('Error: No group selected for deletion');
      setDeleteConfirmModal({ isOpen: false, groupId: null, groupTitle: '' });
      return;
    }

    // Close modal first but keep groupId in a local variable
    setDeleteConfirmModal({ isOpen: false, groupId: null, groupTitle: '' });

    try {
      console.log('Deleting group:', groupId);
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts/${groupId}`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Delete response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Delete successful:', data);
        await fetchGroupedPosts();
        await fetchStats();
        setSuccessModal({ isOpen: true, message: 'Group and all associated articles deleted successfully' });
      } else {
        const data = await response.json();
        console.error('Delete failed:', data);
        setSuccessModal({ isOpen: true, message: `Failed to delete: ${data.detail || 'Unknown error'}` });
      }
    } catch (error) {
      console.error('Error deleting grouped post:', error);
      setSuccessModal({ isOpen: true, message: `Error: ${error.message}` });
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmModal({ isOpen: false, groupId: null, groupTitle: '' });
  };

  const handleEditGroup = (groupId, currentTitle) => {
    setEditModal({ isOpen: true, groupId, currentTitle });
  };

  const handleSaveEdit = async () => {
    const { groupId, currentTitle } = editModal;
    setEditModal({ isOpen: false, groupId: null, currentTitle: '' });

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts/${groupId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_title: currentTitle })
        }
      );

      if (response.ok) {
        fetchGroupedPosts();
        fetchStats();
        setSuccessModal({ isOpen: true, message: 'Group title updated successfully' });
      } else {
        setSuccessModal({ isOpen: true, message: 'Failed to update group title' });
      }
    } catch (error) {
      console.error('Error updating group title:', error);
      setSuccessModal({ isOpen: true, message: 'Error updating group title' });
    }
  };

  const cancelEdit = () => {
    setEditModal({ isOpen: false, groupId: null, currentTitle: '' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    
    // Get timezone abbreviation
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneAbbr = new Date().toLocaleTimeString('en-US', {
      timeZoneName: 'short'
    }).split(' ').pop();
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' ' + timeZoneAbbr;
  };

  const formatDateOnly = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeOnly = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const timeZoneAbbr = new Date().toLocaleTimeString('en-US', {
      timeZoneName: 'short'
    }).split(' ').pop();
    
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }) + ' ' + timeZoneAbbr;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const timeZoneAbbr = new Date().toLocaleTimeString('en-US', {
      timeZoneName: 'short'
    }).split(' ').pop();
    
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `${dateStr}, ${timeStr} ${timeZoneAbbr}`;
  };

  const getCategoryDisplayName = (category) => {
    if (!category) return 'No Category';
    
    const categoryMap = {
      'trailer': 'Trailer',
      'teaser': 'Teaser',
      'first-look': 'First Look',
      'song': 'Song',
      'glimpse-or-promos': 'Glimpse or Promos',
      'interview': 'Interview',
      'events-interviews': 'Filmy Focus Today',
      'events-interviews-bollywood': 'Filmy Focus Today Bollywood',
      'press-meet': 'Press Meet',
      'events': 'Events',
      'speech': 'Speech',
      'making-videos': 'Making Videos',
      'review': 'Review',
      'shorts': 'Shorts',
      'full-movie': 'Full Movie',
      'other': 'Other',
      'tv-today': 'TV Today',
      'tv-today-hindi': 'TV Today Hindi',
      'news-today': 'News Today',
      'news-today-hindi': 'News Today Hindi'
    };
    return categoryMap[category?.toLowerCase()] || category;
  };

  // Get unique categories from grouped posts
  const uniqueCategories = [...new Set(groupedPosts.map(group => group.category))].sort();

  // Filter grouped posts based on search and category
  const filteredGroupedPosts = groupedPosts.filter(group => {
    const matchesSearch = searchQuery === '' || 
      group.group_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || group.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Filter */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex justify-end items-center gap-3">
          <input
            type="text"
            placeholder="Search by group name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-64"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-48"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((category) => (
              <option key={category} value={category}>
                {getCategoryDisplayName(category)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped Posts Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '55%' }}>
                POST
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '30%' }}>
                DETAILS
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredGroupedPosts.map((group) => (
              <React.Fragment key={group.id || group._id}>
                {/* Main Row */}
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleGroup(group.id || group._id)}
                      className="flex items-start gap-2 text-left w-full"
                    >
                      <div className="flex-shrink-0 pt-1">
                        {expandedGroups[group.id || group._id] ? (
                          <ChevronUp className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-2">
                          {group.group_title} <span className="text-gray-500 font-normal">({group.posts_count})</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800">
                          {getCategoryDisplayName(group.category)}
                        </span>
                      </div>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center px-3 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 w-fit">
                        By AI Agent
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 w-fit">
                        {formatDateTime(group.updated_at)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group.id || group._id, group.group_title);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Edit Group Name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id || group._id);
                        }}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Row - Show all posts */}
                {expandedGroups[group.id || group._id] && (
                  <tr className="bg-gray-50">
                    <td colSpan="3" className="px-6 py-4">
                      <PostsList groupId={group.id || group._id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filteredGroupedPosts.length === 0 && (
          <div className="text-center py-12">
            <Video className="mx-auto h-12 w-12 text-gray-400" />
            {groupedPosts.length === 0 ? (
              <>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No grouped posts</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Enable aggregation in Video Agent to start grouping posts by movie/event name
                </p>
              </>
            ) : (
              <>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No groups found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your search or filter criteria
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
            </div>
            
            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete <span className="font-semibold text-gray-900">{deleteConfirmModal.groupTitle}</span>?
              </p>
              <p className="text-sm text-red-600 font-medium mt-2">
                This will permanently delete all associated articles in this group.
              </p>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Name Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Group Name</h3>
            </div>
            
            {/* Body */}
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Title
              </label>
              <input
                type="text"
                value={editModal.currentTitle}
                onChange={(e) => setEditModal({ ...editModal, currentTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter group name"
              />
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editModal.currentTitle.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  editModal.currentTitle.trim()
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Modal */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            {/* Body */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-900 text-center">
                {successModal.message}
              </p>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 rounded-b-lg flex justify-center">
              <button
                onClick={() => setSuccessModal({ isOpen: false, message: '' })}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component to fetch and display posts in a group
const PostsList = ({ groupId }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMenu, setActionMenu] = useState({ show: false, postId: null, post: null });
  const [moveModal, setMoveModal] = useState({ show: false, postId: null, postTitle: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ 
    show: false, 
    postId: null, 
    postTitle: '', 
    targetCardId: null, 
    targetCardTitle: '' 
  });

  useEffect(() => {
    fetchPosts();
  }, [groupId]);

  const fetchPosts = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts/${groupId}`
      );
      const data = await response.json();
      setPosts(data.articles || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchCards = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts?limit=500&status=published`
      );
      const data = await response.json();
      
      // Filter cards based on search query
      const filtered = (data.groups || []).filter(group => 
        group.group_title.toLowerCase().includes(query.toLowerCase()) &&
        group.id !== groupId // Exclude current group
      );
      
      setSearchResults(filtered.slice(0, 20)); // Show max 20 results
    } catch (error) {
      console.error('Error searching cards:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleMovePost = async (targetCardId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/grouped-posts/${targetCardId}/add-article`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: confirmModal.postId })
        }
      );

      if (response.ok) {
        // Remove from current group's UI
        await fetchPosts();
        setConfirmModal({ show: false, postId: null, postTitle: '', targetCardId: null, targetCardTitle: '' });
        setMoveModal({ show: false, postId: null, postTitle: '' });
      } else {
        const error = await response.json();
        alert(`Failed to move post: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error moving post:', error);
      alert('Failed to move post. Please try again.');
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchCards(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getCategoryDisplayName = (slug) => {
    const categoryMap = {
      'politics': 'Politics',
      'movies': 'Movies',
      'sports': 'Sports',
      'entertainment': 'Entertainment',
      'boxoffice': 'Box Office',
      'ott': 'OTT',
      'moviereviews': 'Movie Reviews',
      'ottreviews': 'OTT Reviews',
      'topstories': 'Top Stories',
      'viral-shorts': 'Viral Shorts'
    };
    return categoryMap[slug] || slug;
  };

  const getFullLanguageName = (code) => {
    const languageMap = {
      'en': 'English',
      'hi': 'Hindi',
      'te': 'Telugu',
      'ta': 'Tamil',
      'kn': 'Kannada',
      'ml': 'Malayalam',
      'mr': 'Marathi',
      'bn': 'Bengali',
      'gu': 'Gujarati',
      'pa': 'Punjabi',
      'od': 'Odia',
      'as': 'Assamese',
      'ur': 'Urdu'
    };
    return languageMap[code] || code;
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading posts...</div>;
  }

  return (
    <>
      {/* Posts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '55%' }}>
                POST
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '35%' }}>
                DETAILS
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {posts.map((post, index) => (
              <tr 
                key={post.id} 
                className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}
              >
                {/* POST Column - Title and Labels */}
                <td className="px-4 py-3">
                  <div className="text-left">
                    <h3 className={`text-sm font-medium hover:text-blue-600 mb-2 text-left ${
                      post.is_top_story ? 'font-bold text-blue-700' : 'text-gray-900'
                    }`}>
                      <Link to={`/cms/edit/${post.id}`} className="flex items-center gap-1">
                        {post.is_top_story && (
                          <span className="text-yellow-500" title="Top Story">⭐</span>
                        )}
                        {post.title}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap gap-2 text-xs text-left">
                      {/* Main Card Badge */}
                      {index === 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                          Main Card
                        </span>
                      )}
                      
                      {/* Content Language Badge - Full Name */}
                      {post.content_language && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          {getFullLanguageName(post.content_language)}
                        </span>
                      )}
                      
                      {/* Content Type Badge */}
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                        {post.content_type === 'video' ? 'Video' : 
                         post.content_type === 'video_post' ? 'Video Post' :
                         post.content_type === 'photo' ? 'Photo Gallery' : 
                         post.content_type === 'movie_review' ? 'Movie Review' : 
                         'Post'}
                      </span>
                      
                      {/* Sponsored Badge */}
                      {post.is_featured && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                          Sponsored
                        </span>
                      )}
                      
                      {/* Top Story Badge */}
                      {post.is_top_story && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          Top Story
                        </span>
                      )}
                      
                      {/* Status Badge */}
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                        post.status === 'published' || post.is_published 
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : post.status === 'approved'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : post.is_scheduled
                              ? 'bg-orange-50 text-orange-700 border-orange-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {post.status === 'published' || post.is_published 
                          ? 'Published' 
                          : post.status === 'approved'
                            ? 'Approved'
                            : post.is_scheduled 
                              ? 'Scheduled' 
                              : 'Draft'}
                      </span>
                    </div>
                  </div>
                </td>
                
                {/* DETAILS Column */}
                <td className="px-4 py-3">
                  <div className="space-y-1 text-left">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                        By {post.author === 'AI Agent' && post.agent_name 
                          ? `${post.agent_name} AI Agent` 
                          : post.author}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200">
                        {post.is_scheduled 
                          ? `Scheduled: ${formatDate(post.scheduled_publish_at)}`
                          : formatDate(post.published_at)
                        }
                      </span>
                    </div>
                  </div>
                </td>
                
                {/* ACTIONS Column - 3 Dots Menu */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setActionMenu({ 
                      show: true, 
                      postId: post.id, 
                      post: post
                    })}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors inline-flex items-center justify-center"
                    title="Actions"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2"/>
                      <circle cx="12" cy="12" r="2"/>
                      <circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {posts.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">
            No posts found in this group.
          </div>
        )}
      </div>

      {/* Action Menu Modal */}
      {actionMenu.show && actionMenu.post && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 text-left truncate">{actionMenu.post.title}</h3>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  setMoveModal({ 
                    show: true, 
                    postId: actionMenu.postId, 
                    postTitle: actionMenu.post.title 
                  });
                  setActionMenu({ show: false, postId: null, post: null });
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Move to Another Card
              </button>
              <Link
                to={`/cms/edit/${actionMenu.postId}`}
                onClick={() => setActionMenu({ show: false, postId: null, post: null })}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Post
              </Link>
              <Link
                to={`/cms/preview/${actionMenu.postId}`}
                onClick={() => setActionMenu({ show: false, postId: null, post: null })}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview Post
              </Link>
              {actionMenu.post.youtube_url && (
                <a
                  href={actionMenu.post.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Watch on YouTube
                </a>
              )}
              <button
                onClick={async () => {
                  setActionMenu({ show: false, postId: null, post: null });
                  try {
                    const newStatus = actionMenu.post.is_published ? 'draft' : 'published';
                    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api/cms/articles/${actionMenu.postId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        status: newStatus, 
                        is_published: !actionMenu.post.is_published 
                      })
                    });
                    if (response.ok) {
                      await fetchPosts();
                    }
                  } catch (error) {
                    console.error('Error updating status:', error);
                  }
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 ${
                  actionMenu.post.is_published
                    ? 'text-orange-600 hover:bg-orange-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {actionMenu.post.is_published ? 'Unpublish' : 'Publish'}
              </button>
            </div>
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setActionMenu({ show: false, postId: null, post: null })}
                className="w-full px-3 py-2 text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Card Modal */}
      {moveModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Move Post to Another Card</h3>
              <p className="text-sm text-gray-600 mt-1">Post: {moveModal.postTitle}</p>
            </div>
            <div className="p-4">
              {/* Search Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search for a card (Latest 500 published cards)
                </label>
                <input
                  type="text"
                  placeholder="Type card title to search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  autoFocus
                />
              </div>

              {/* Search Results */}
              <div className="max-h-96 overflow-y-auto">
                {searching && (
                  <div className="text-center py-4 text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                    <p className="mt-2 text-sm">Searching...</p>
                  </div>
                )}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No matching cards found</p>
                  </div>
                )}

                {!searching && searchQuery.length < 2 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Type at least 2 characters to search</p>
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => {
                          setConfirmModal({
                            show: true,
                            postId: moveModal.postId,
                            postTitle: moveModal.postTitle,
                            targetCardId: card.id,
                            targetCardTitle: card.group_title
                          });
                          setMoveModal({ show: false, postId: null, postTitle: '' });
                        }}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{card.group_title}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                {card.category}
                              </span>
                              <span>{card.posts_count} posts</span>
                              <span>•</span>
                              <span>{new Date(card.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setMoveModal({ show: false, postId: null, postTitle: '' });
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="w-full px-4 py-2 text-sm text-gray-600 bg-gray-200 hover:bg-gray-300 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-purple-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Confirm Move Post
              </h3>
              <div className="text-sm text-gray-600 space-y-2 mb-6">
                <p className="text-center">
                  <span className="font-medium">Post:</span><br />
                  <span className="text-gray-900">{confirmModal.postTitle}</span>
                </p>
                <div className="flex items-center justify-center py-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <p className="text-center">
                  <span className="font-medium">Will be moved to:</span><br />
                  <span className="text-purple-700 font-semibold">{confirmModal.targetCardTitle}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal({ 
                    show: false, 
                    postId: null, 
                    postTitle: '', 
                    targetCardId: null, 
                    targetCardTitle: '' 
                  })}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-200 hover:bg-gray-300 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleMovePost(confirmModal.targetCardId)}
                  className="flex-1 px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded font-medium transition-colors"
                >
                  Confirm Move
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper function to extract YouTube video ID
const extractYouTubeId = (url) => {
  if (!url) return null;
  if (url.includes('youtube.com/watch?v=')) {
    return url.split('v=')[1]?.split('&')[0];
  } else if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split('?')[0];
  }
  return null;
};

export default GroupedPosts;

