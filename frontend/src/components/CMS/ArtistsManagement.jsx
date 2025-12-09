import React, { useState, useEffect } from 'react';

const ArtistsManagement = () => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newArtistName, setNewArtistName] = useState('');
  const [editingArtist, setEditingArtist] = useState(null);
  const [editName, setEditName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchArtists();
  }, []);

  const fetchArtists = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/artists`);
      if (response.ok) {
        const data = await response.json();
        setArtists(data);
      }
    } catch (error) {
      console.error('Error fetching artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddArtist = async (e) => {
    e.preventDefault();
    if (!newArtistName.trim()) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArtistName.trim() })
      });

      if (response.ok) {
        setNewArtistName('');
        fetchArtists();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to add artist');
      }
    } catch (error) {
      console.error('Error adding artist:', error);
      alert('Failed to add artist');
    }
  };

  const handleUpdateArtist = async (artistId) => {
    if (!editName.trim()) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/artists/${artistId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });

      if (response.ok) {
        setEditingArtist(null);
        setEditName('');
        fetchArtists();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to update artist');
      }
    } catch (error) {
      console.error('Error updating artist:', error);
      alert('Failed to update artist');
    }
  };

  const handleDeleteArtist = async (artistId, artistName) => {
    if (!window.confirm(`Are you sure you want to delete "${artistName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/artists/${artistId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchArtists();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to delete artist');
      }
    } catch (error) {
      console.error('Error deleting artist:', error);
      alert('Failed to delete artist');
    }
  };

  const startEdit = (artist) => {
    setEditingArtist(artist.id);
    setEditName(artist.name);
  };

  const cancelEdit = () => {
    setEditingArtist(null);
    setEditName('');
  };

  const filteredArtists = artists.filter(artist =>
    artist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Manage Artists / Actors / Events</h2>

        {/* Add New Artist Form */}
        <form onSubmit={handleAddArtist} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newArtistName}
              onChange={(e) => setNewArtistName(e.target.value)}
              placeholder="Enter artist, actor, actress, or event name"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Artists List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : filteredArtists.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No artists found matching your search' : 'No artists added yet'}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-gray-600 mb-2">
              Total: {filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'}
            </div>
            {filteredArtists.map((artist) => (
              <div
                key={artist.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {editingArtist === artist.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateArtist(artist.id)}
                      className="px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-gray-800 font-medium">{artist.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(artist)}
                        className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteArtist(artist.id, artist.name)}
                        className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistsManagement;
