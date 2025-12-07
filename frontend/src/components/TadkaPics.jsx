import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import ImageModal from './ImageModal';
import { PlaceholderImage } from '../utils/imageUtils';

const TadkaPics = ({ images, onImageClick }) => {
  const { t } = useLanguage();
  const { getSectionHeaderClasses } = useTheme();
  
  // State for galleries data
  const [actressImages, setActressImages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch Tadka Pics galleries from API
  useEffect(() => {
    const fetchTadkaPics = async () => {
      try {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
        const response = await fetch(`${backendUrl}/api/galleries/tadka-pics?limit=20`);
        
        if (response.ok) {
          const galleries = await response.json();
          
          // Transform galleries to the format expected by the component
          const transformedImages = [];
          galleries.forEach((gallery, galleryIndex) => {
            const images = Array.isArray(gallery.images) ? gallery.images : 
                          (typeof gallery.images === 'string' ? JSON.parse(gallery.images) : []);
            
            images.forEach((img, imgIndex) => {
              transformedImages.push({
                id: `${gallery.id}-${imgIndex}`,
                gallery_id: gallery.gallery_id,
                name: gallery.title || gallery.entity_name || 'Gallery Image',
                image: img.url || img.data,
                fullImage: img.url || img.data,
                gallery: gallery
              });
            });
          });
          
          setActressImages(transformedImages);
        }
      } catch (error) {
        console.error('Error fetching Tadka Pics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTadkaPics();
  }, []);

  const [scrollPosition, setScrollPosition] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const scrollContainerRef = useRef(null);

  // Show loading state or empty state
  if (loading) {
    return (
      <div className="bg-white">
        <div className="max-w-5xl-plus mx-auto px-8">
          <div className={`${getSectionHeaderClasses().containerClass} px-3 py-2 border rounded-lg text-left mb-3`}>
            <h3 className={`${getSectionHeaderClasses().textClass}`} style={{fontSize: '14px', fontWeight: '500'}}>{t('sections.tadka_pics', 'Tadka Pics')}</h3>
          </div>
          <div className="text-center text-gray-500 py-8">Loading...</div>
        </div>
      </div>
    );
  }

  if (actressImages.length === 0) {
    return null; // Don't show section if no images
  }

  // Enhanced analytics tracking
  const trackImageClick = async (imageId, imageName, action) => {
    try {
      // Comprehensive tracking data
      const trackingData = {
        imageId: imageId,
        imageName: imageName,
        action: action,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
        source: 'home_page_slider'
      };

      // Send to backend API
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      await fetch(`${backendUrl}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingData)
      });

      // Update browser history for SEO/analytics tracking
      const newUrl = `${window.location.pathname}?image=${imageId}&actress=${encodeURIComponent(imageName)}&source=slider`;
      window.history.pushState(
        { imageId, imageName, action }, 
        `${imageName} - Tadka Pics`, 
        newUrl
      );

    } catch (error) {
      console.error('Analytics tracking failed:', error);
    }
  };

  const handleImageClick = (index) => {
    const clickedImage = actressImages[index];
    if (clickedImage && onImageClick) {
      trackImageClick(clickedImage.id, clickedImage.name, 'home_slider_click');
      onImageClick(clickedImage, actressImages);
    }
  };

  // Touch event handlers for swipe functionality
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe || isRightSwipe) {
      const container = scrollContainerRef.current;
      if (container) {
        const imageWidth = 110; // Width + margin
        const currentScroll = container.scrollLeft;
        const newPosition = isLeftSwipe ? 
          Math.min(currentScroll + imageWidth, container.scrollWidth - container.clientWidth) :
          Math.max(currentScroll - imageWidth, 0);
        
        setScrollPosition(newPosition);
        container.scrollTo({ left: newPosition, behavior: 'smooth' });
      }
    }
  };

  // Auto scroll effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const maxScroll = container.scrollWidth - container.clientWidth;
        
        if (scrollPosition >= maxScroll) {
          // Reset to beginning
          setScrollPosition(0);
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          // Scroll 1px to the right for slow movement
          const newPosition = scrollPosition + 1;
          setScrollPosition(newPosition);
          container.scrollTo({ left: newPosition, behavior: 'smooth' });
        }
      }
    }, 50); // 50ms interval for slow, smooth scrolling

    return () => clearInterval(interval);
  }, [scrollPosition]);

  return (
    <div className="bg-white">
      <div className="max-w-5xl-plus mx-auto px-8">
        {/* Header matching Events slider style */}
        <div className={`${getSectionHeaderClasses().containerClass} px-3 py-2 border rounded-lg text-left mb-3 flex items-center justify-between relative`}>
          <h3 className={`${getSectionHeaderClasses().textClass}`} style={{fontSize: '14px', fontWeight: '500'}}>{t('sections.tadka_pics', 'Tadka Pics')}</h3>
          <Link 
            to="/top-insta-pics" 
            className={`group flex items-center justify-center text-xs ${getSectionHeaderClasses().moreButtonClass} transition-colors duration-200 absolute top-1/2 transform -translate-y-1/2 right-4`}
          >
            <svg 
              className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </Link>
        </div>
        
        {/* Multiple Images Horizontal Scroll Container */}
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide" 
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {actressImages.map((actress, index) => (
              <div 
                key={actress.id} 
                className="flex-shrink-0 cursor-pointer group transition-transform duration-300 hover:scale-105"
                onClick={() => handleImageClick(index)}
              >
                <div className="relative w-24 h-36 rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-gray-300 transition-colors duration-300">
                  <img
                    src={actress.image}
                    alt={actress.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  {/* Gradient overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent h-12"></div>
                  {/* Name overlay */}
                  <div className="absolute bottom-1 left-1 right-1 text-white text-xs font-medium truncate">
                    {actress.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TadkaPics;