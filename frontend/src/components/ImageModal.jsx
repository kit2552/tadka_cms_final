import React, { useEffect, useState, useRef } from 'react';

const ImageModal = ({ image, images, onClose, onNext, onPrev, onImageChange }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
          } else {
            onClose();
          }
          break;
        case 'ArrowLeft':
          onPrev(image.id);
          break;
        case 'ArrowRight':
          onNext(image.id);
          break;
        default:
          break;
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.style.overflow = 'unset';
    };
  }, [image.id, onClose, onNext, onPrev, isFullscreen]);

  const onTouchStart = (e) => {
    setTouchEnd(null); // otherwise the swipe is fired even with usual touch events
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextClick(); // Swipe left to go to next image
    }
    if (isRightSwipe) {
      handlePrevClick(); // Swipe right to go to previous image
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  const handleNextClick = () => {
    setIsLoading(true);
    onNext(image.id);
  };

  const handlePrevClick = () => {
    setIsLoading(true);
    onPrev(image.id);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Image Container */}
      <div className="relative max-w-4xl max-h-full flex items-center justify-center">
        
        {/* Main Image with Touch Support */}
        <div 
          className="relative overflow-hidden max-w-full max-h-full"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          
          {/* Top Right Controls */}
          <div className="absolute top-4 right-4 flex items-center space-x-2 z-20">
            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-md transition-all backdrop-blur-sm"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                // Minimize icon
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"></path>
                </svg>
              ) : (
                // Fullscreen icon
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                </svg>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
            className="absolute top-2 right-2 z-70 bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all duration-200 rounded-lg p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          )}

          {/* Error State */}
          {imageError && (
            <div className="flex items-center justify-center p-8 bg-gray-100">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-gray-600">Failed to load image</p>
              </div>
            </div>
          )}

          {/* Actual Image */}
          <img
            src={image.fullImage}
            alt={image.name}
            className={`max-w-full max-h-[98vh] object-contain rounded-lg ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>

        {/* Previous Button - Bottom Left - Outside image container */}
        <button
          onClick={handlePrevClick}
          className="absolute bottom-8 left-8 z-70 text-white opacity-70 hover:opacity-100 hover:text-gray-300 transition-all duration-200 transform hover:scale-110 pointer-events-auto"
          style={{ pointerEvents: 'auto' }}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Image Name - Between the arrows - Only show if name exists and not in fullscreen */}
        {image.name && !isFullscreen && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-70 text-white text-center">
            <p className="text-lg font-semibold bg-black bg-opacity-50 px-4 py-2 rounded-lg">
              {image.name}
            </p>
          </div>
        )}

        {/* Next Button - Bottom Right - Outside image container */}
        <button
          onClick={handleNextClick}
          className="absolute bottom-8 right-8 z-70 text-white opacity-70 hover:opacity-100 hover:text-gray-300 transition-all duration-200 transform hover:scale-110 pointer-events-auto"
          style={{ pointerEvents: 'auto' }}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImageModal;