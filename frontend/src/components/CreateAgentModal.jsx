import React from 'react';

const CreateAgentModal = ({ onClose, onSelect }) => {
  const agentTypes = [
    {
      type: 'post',
      name: 'Post Agent',
      description: 'Automatically generate and publish articles based on topics',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'blue'
    },
    {
      type: 'photo_gallery',
      name: 'Photo Gallery Agent',
      description: 'Create photo galleries from websites with article content',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'purple'
    },
    {
      type: 'tadka_pics',
      name: 'Tadka Pics Agent',
      description: 'Create Tadka Pics galleries from websites or Instagram',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      color: 'orange'
    },
    {
      type: 'video',
      name: 'Video Agent',
      description: 'Find and post YouTube trailers, teasers, trending videos & shorts',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'red'
    },
    {
      type: 'tv_video',
      name: 'TV Video Agent',
      description: 'Find and post TV & News videos - grouped by channel name',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'indigo'
    },
    {
      type: 'reality_show',
      name: 'Reality Shows Agent',
      description: 'Find and post reality show videos from specific shows',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      color: 'pink'
    },
    {
      type: 'ott_release',
      name: 'OTT Release Agent',
      description: 'Fetch and create OTT movie/web series releases from Binged.com',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      ),
      color: 'teal'
    },
    {
      type: 'theater_release',
      name: 'Theater Release Agent',
      description: 'Fetch and create theater movie releases from IMDb India',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      ),
      color: 'amber'
    },
    {
      type: 'review',
      name: 'Review Agent',
      description: 'Generate movie, product, or service reviews automatically',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      color: 'green'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600 hover:bg-blue-50 border-blue-200',
      purple: 'bg-purple-100 text-purple-600 hover:bg-purple-50 border-purple-200',
      green: 'bg-green-100 text-green-600 hover:bg-green-50 border-green-200',
      orange: 'bg-orange-100 text-orange-600 hover:bg-orange-50 border-orange-200',
      red: 'bg-red-100 text-red-600 hover:bg-red-50 border-red-200',
      indigo: 'bg-indigo-100 text-indigo-600 hover:bg-indigo-50 border-indigo-200',
      pink: 'bg-pink-100 text-pink-600 hover:bg-pink-50 border-pink-200',
      teal: 'bg-teal-100 text-teal-600 hover:bg-teal-50 border-teal-200',
      amber: 'bg-amber-100 text-amber-600 hover:bg-amber-50 border-amber-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create AI Agent</h2>
            <p className="text-sm text-gray-600 mt-1">Select the type of agent you want to create</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Agent Types */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agentTypes.map(agent => (
              <button
                key={agent.type}
                onClick={() => onSelect(agent.type)}
                className={`p-6 rounded-lg border-2 transition-all text-left ${getColorClasses(agent.color)} hover:shadow-md`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4">
                    {agent.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{agent.name}</h3>
                  <p className="text-sm opacity-80">{agent.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAgentModal;
