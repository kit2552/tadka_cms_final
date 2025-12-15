import React, { useState, useEffect } from 'react';
import GalleryImageModal from './GalleryImageModal';

const GallerySlider = ({ gallery, title }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showModal, setShowModal] = useState(false);
  
  // Parse images
  let images = gallery.images || [];
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }
  
  if (!images || images.length === 0) return null;
  
  const currentImageUrl = typeof images[currentSlide] === 'string' 
    ? images[currentSlide] 
    : images[currentSlide].url;
  
  // Track image view changes
  const trackImageView = async (imageIndex, action) => {
    try {
      const imageUrl = typeof images[imageIndex] === 'string' 
        ? images[imageIndex] 
        : images[imageIndex].url;
      
      const trackingData = {
        event_type: 'gallery_image_view',
        gallery_id: gallery.id || gallery.gallery_id,
        gallery_title: title,
        image_index: imageIndex + 1,
        total_images: images.length,
        image_url: imageUrl,
        action: action,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        source: 'article_gallery_slider'
      };

      // Send to backend API
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      await fetch(`${backendUrl}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingData)
      });

      // Update browser history for SEO/analytics tracking
      const pathParts = window.location.pathname.split('/');
      const articleId = pathParts[2]; // Extract article ID from URL
      const newUrl = `${window.location.pathname}?image=${imageIndex + 1}&gallery=${encodeURIComponent(title)}&source=slider`;
      window.history.pushState(
        { imageIndex, galleryTitle: title, action }, 
        `${title} - Image ${imageIndex + 1}`, 
        newUrl
      );

    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
  };

  // Track whenever slide changes
  useEffect(() => {
    if (images.length > 0) {
      trackImageView(currentSlide, 'slide_change');
    }
  }, [currentSlide]);

  const handleImageClick = () => {
    setShowModal(true);
  };
  
  const handleModalClose = () => {
    setShowModal(false);
  };
  
  const handleModalNext = () => {
    setCurrentSlide((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };
  
  const handleModalPrev = () => {
    setCurrentSlide((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };
  
  return (
    <>
      <div className="mb-3 bg-white relative">
        <div className="relative group">
          <div 
            className="w-full h-96 overflow-hidden bg-black cursor-pointer relative flex items-center justify-center"
            onClick={handleImageClick}
          >
            <img
              src={currentImageUrl}
              alt={`${title} - Image ${currentSlide + 1}`}
              className="object-contain transition-opacity duration-200 group-hover:opacity-90"
              style={{ maxWidth: '100%', maxHeight: '384px' }}
            />
            
            {/* Preview Eye Icon Overlay - Appears on Hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
          
          {/* Navigation arrows - At bottom inside image */}
          {images.length > 1 && (
            <>
              {/* Previous Button - Bottom Left */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="absolute bottom-8 left-8 z-10 text-white opacity-70 hover:opacity-100 hover:text-gray-300 transition-all duration-200 transform hover:scale-110"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Image Counter - Bottom Center - Rectangular with slight rounded corners */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded text-sm font-medium">
                {currentSlide + 1} / {images.length}
              </div>
              
              {/* Next Button - Bottom Right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="absolute bottom-8 right-8 z-10 text-white opacity-70 hover:opacity-100 hover:text-gray-300 transition-all duration-200 transform hover:scale-110"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Modal */}
      {showModal && (
        <GalleryImageModal
          images={images}
          currentIndex={currentSlide}
          title={title}
          galleryType={gallery.type}
          galleryId={gallery.id || gallery.gallery_id}
          onClose={handleModalClose}
          onNext={handleModalNext}
          onPrev={handleModalPrev}
        />
      )}
    </>
  );
};

export default GallerySlider;
