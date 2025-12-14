import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import ImageModal from '../components/ImageModal';

const TadkaPics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filteredGalleries, setFilteredGalleries] = useState([]);
  const [tadkaShorts, setTadkaShorts] = useState([]);
  
  // Modal state for image gallery
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);

  // Scroll restoration logic
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('tadkaPicsScrollPosition');
    
    if (savedScrollPosition && location.state?.fromDetail) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition));
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }

    if (location.state?.fromDetail) {
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    const fetchTadkaPicsData = async () => {
      try {
        setLoading(true);
        
        // Fetch galleries from the backend API
        const galleriesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/galleries/tadka-pics?limit=100`);
        console.log('Tadka Pics galleries response status:', galleriesResponse.status);
        
        if (galleriesResponse.ok) {
          const data = await galleriesResponse.json();
          console.log('Tadka Pics galleries received:', data.length);
          setGalleries(data);
        } else {
          console.log('Tadka Pics galleries response not ok');
          setGalleries([]);
        }

        // Fetch Tadka Shorts for sidebar
        const shortsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001'}/api/articles/sections/tadka-shorts?limit=20`);
        if (shortsResponse.ok) {
          const shortsData = await shortsResponse.json();
          // Combine tadka_shorts and bollywood for sidebar
          const allShorts = [...(shortsData.tadka_shorts || []), ...(shortsData.bollywood || [])];
          setTadkaShorts(allShorts);
          console.log('Tadka Shorts for sidebar:', allShorts.length);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading Tadka Pics data:', err);
        setError('Failed to load galleries. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTadkaPicsData();
  }, []);

  // Update filtered galleries when filter changes
  useEffect(() => {
    const filtered = filterGalleriesByDate(galleries, selectedFilter);
    setFilteredGalleries(filtered);
  }, [galleries, selectedFilter]);

  // Get random image from gallery
  const getRandomGalleryImage = (gallery) => {
    if (gallery.images && Array.isArray(gallery.images) && gallery.images.length > 0) {
      const randomIndex = Math.floor(Math.random() * gallery.images.length);
      const randomImage = gallery.images[randomIndex];
      return randomImage.url || randomImage.data || randomImage;
    }
    return null;
  };

  // Filter options for the dropdown
  const filterOptions = [
    { value: 'latest', label: 'Latest' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 Days' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'quarter', label: 'Last 3 Months' },
    { value: 'halfYear', label: 'Last 6 Months' },
    { value: 'year', label: 'Last Year' }
  ];

  // Function to filter galleries by date
  const filterGalleriesByDate = (galleries, filter) => {
    if (!galleries || galleries.length === 0) {
      return [];
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const filtered = galleries.filter((gallery) => {
      let galleryDate;
      if (gallery.created_at) {
        galleryDate = new Date(gallery.created_at);
      } else {
        return false;
      }
      
      const galleryDateOnly = new Date(galleryDate.getFullYear(), galleryDate.getMonth(), galleryDate.getDate());
      const timeDiff = now - galleryDate;
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

      switch (filter) {
        case 'latest':
          return true;
        case 'thisWeek':
          const currentWeekStart = new Date(today);
          const dayOfWeek = today.getDay();
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          currentWeekStart.setDate(today.getDate() - daysToMonday);
          const currentWeekEnd = new Date(currentWeekStart);
          currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
          return galleryDateOnly >= currentWeekStart && galleryDateOnly <= currentWeekEnd;
        case 'today':
          return galleryDateOnly.getTime() === today.getTime();
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return galleryDateOnly.getTime() === yesterday.getTime();
        case 'week':
          return daysDiff >= 0 && daysDiff <= 7;
        case 'month':
          return daysDiff >= 0 && daysDiff <= 30;
        case 'quarter':
          return daysDiff >= 0 && daysDiff <= 90;
        case 'halfYear':
          return daysDiff >= 0 && daysDiff <= 180;
        case 'year':
          return daysDiff >= 0 && daysDiff <= 365;
        default:
          return false;
      }
    });
    
    return filtered;
  };

  const handleFilterChange = (filterValue) => {
    setSelectedFilter(filterValue);
    setIsFilterOpen(false);
  };

  const getCurrentFilterLabel = () => {
    const option = filterOptions.find(opt => opt.value === selectedFilter);
    return option ? option.label : 'Latest';
  };

  const handleGalleryClick = (gallery) => {
    sessionStorage.setItem('tadkaPicsScrollPosition', window.scrollY.toString());
    
    // Prepare all images from the gallery for the modal
    const allImages = gallery.images.map((img, idx) => ({
      id: `${gallery.gallery_id}-${idx}`,
      name: gallery.entity_name || gallery.title,
      url: img.url || img.data,
      fullImage: img.url || img.data,
      alt: `${gallery.entity_name || gallery.title} - Image ${idx + 1}`
    }));
    
    // Select a random image to start with
    const randomIndex = Math.floor(Math.random() * allImages.length);
    
    setSelectedImage(allImages[randomIndex]);
    setGalleryImages(allImages);
    setImageModalOpen(true);
  };
  
  const handleModalClose = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
    setGalleryImages([]);
  };

  const handleShortClick = (short) => {
    if (short.content_type === 'video' || short.content_type === 'video_post' || short.youtube_url) {
      navigate(`/video/${short.id}`);
    } else {
      const slug = short.slug || short.title.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${short.id}/${slug}`);
    }
  };

  const getYouTubeThumbnail = (youtubeUrl) => {
    if (!youtubeUrl) return null;
    
    let videoId = null;
    if (youtubeUrl.includes('youtube.com/watch?v=')) {
      videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    } else if (youtubeUrl.includes('youtube.com/shorts/')) {
      videoId = youtubeUrl.split('shorts/')[1]?.split('?')[0];
    } else if (youtubeUrl.includes('youtu.be/')) {
      videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0];
    }
    
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently published';
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const lightThemeClasses = {
    pageBackground: 'bg-gray-50',
    cardBackground: 'bg-white',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-200'
  };

  const themeClasses = lightThemeClasses;

  if (error) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBackground} flex items-center justify-center`}>
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">🖼️</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Unable to Load Galleries</h2>
          <p className={`${themeClasses.textSecondary} mb-6`}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Loading Modal */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl px-4 py-3">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <p className="text-sm font-medium text-gray-700">Loading...</p>
            </div>
          </div>
        </div>
      )}
      
      <div className={`min-h-screen ${themeClasses.pageBackground}`}>
        {/* Main Container */}
        <div className="max-w-5xl-plus mx-auto px-8 pb-6">
          
          {/* Two Section Layout - 70%/30% split */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
            
            {/* Tadka Pics Section - 70% width */}
            <div className="lg:col-span-7 -mt-1">
              {/* Section Header - Sticky with filter */}
              <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
                <div className="pl-0 pr-4 py-4">
                  <div className="mb-2">
                    <h2 className="text-base font-bold text-black text-left leading-tight">
                      Tadka Pics
                    </h2>
                  </div>
                
                {/* Gallery count and Filter */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-900 opacity-75">
                    {filteredGalleries.length} galleries from {getCurrentFilterLabel().toLowerCase()}
                  </p>

                  {/* Filter Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="flex items-center space-x-2 text-xs font-medium text-gray-900 opacity-75 hover:opacity-100 focus:outline-none"
                    >  
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                      </svg>
                      <span>{getCurrentFilterLabel()}</span>
                      <svg className={`w-3 h-3 ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isFilterOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                        <div className="py-1">
                          {filterOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleFilterChange(option.value)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${
                                selectedFilter === option.value 
                                  ? 'bg-blue-50 text-blue-700 font-medium' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {option.label}
                              {selectedFilter === option.value && (
                                <svg className="inline-block w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Galleries Grid - 3 Column Vertical Layout within 70% section */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {filteredGalleries.map((gallery) => {
                const thumbnailImage = getRandomGalleryImage(gallery);
                
                return (
                  <div
                    key={gallery.id}
                    className="cursor-pointer group"
                    onClick={() => handleGalleryClick(gallery)}
                  >
                    <div className="rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300">
                      <div className="relative w-full" style={{ paddingBottom: '150%' }}>
                        {/* 2:3 aspect ratio for vertical photos */}
                        <img
                          src={thumbnailImage || 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop'}
                          alt={gallery.entity_name || gallery.title}
                          className="absolute inset-0 w-full h-full group-hover:scale-105 transition-transform duration-300"
                          style={{ 
                            objectFit: 'cover',
                            objectPosition: 'top',
                            display: 'block'
                          }}
                          loading="lazy"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&h=600&fit=crop';
                          }}
                        />
                        {/* Title overlay at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-2 border-t border-gray-700">
                          <p className="text-white text-xs font-medium line-clamp-2 text-center leading-tight">
                            {gallery.entity_name || gallery.title}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

              {filteredGalleries.length === 0 && !loading && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400 mb-1">No galleries found</p>
                  <p className="text-xs text-gray-400">Try selecting a different time period</p>
                </div>
              )}
            </div>

            {/* Tadka Shorts Section - 30% width */}
            <div className="lg:col-span-3 border-t border-gray-300 lg:border-t-0 pt-2 lg:pt-0">
              {/* Tadka Shorts Header */}
              <div className={`sticky top-16 z-30 border-b-2 border-gray-300 mb-3`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
                <div className="pl-0 pr-4 py-4">
                  <div className="mb-2">
                    <h2 className="text-base font-bold text-black text-left leading-tight">
                      Tadka Shorts
                    </h2>
                  </div>
                  <p className="text-xs text-gray-900 opacity-75 text-left">
                    Trending videos you may like
                  </p>
                </div>
              </div>

              {/* Tadka Shorts List */}
              <div className="space-y-0">
                {tadkaShorts.length > 0 ? (
                  tadkaShorts.map((short, index) => (
                    <div
                      key={short.id}
                      onClick={() => handleShortClick(short)}
                      className={`group cursor-pointer hover:bg-gray-50 transition-colors duration-200 p-2 ${
                        index < tadkaShorts.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <div className="flex space-x-3">
                        <img
                          src={getYouTubeThumbnail(short.youtube_url) || short.image_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=60&h=45&fit=crop'}
                          alt={short.title}
                          className="w-20 h-16 object-cover rounded flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-tight mb-2 text-left line-clamp-2" style={{ fontSize: '0.9rem' }}>
                            {short.title}
                          </h4>
                          <p className="text-xs text-gray-600 text-left">
                            {formatDate(short.published_at || short.publishedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400">No shorts available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Image Modal for viewing galleries */}
      {imageModalOpen && selectedImage && (
        <ImageModal
          isOpen={imageModalOpen}
          onClose={handleModalClose}
          image={selectedImage}
          images={galleryImages}
        />
      )}
    </>
  );
};

export default TadkaPics;
