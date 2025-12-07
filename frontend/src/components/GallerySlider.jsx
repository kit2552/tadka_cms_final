import React, { useState } from 'react';
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
            className="w-full h-96 overflow-hidden bg-black cursor-pointer relative"
            onClick={handleImageClick}
          >
            <img
              src={currentImageUrl}
              alt={`${title} - Image ${currentSlide + 1}`}
              className="w-full h-full object-contain transition-opacity duration-200 group-hover:opacity-90"
            />
            
            {/* Preview Eye Icon Overlay - Appears on Hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
          
          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full transition-all flex items-center justify-center text-2xl z-10"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full transition-all flex items-center justify-center text-2xl z-10"
              >
                ›
              </button>
              
              {/* Slide indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                {currentSlide + 1} / {images.length}
              </div>
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
          onClose={handleModalClose}
          onNext={handleModalNext}
          onPrev={handleModalPrev}
        />
      )}
    </>
  );
};

export default GallerySlider;
