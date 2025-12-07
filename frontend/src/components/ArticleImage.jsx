import React, { useState } from 'react';
import ArticleImagePlaceholder from './ArticleImagePlaceholder';

const ArticleImage = ({ 
  src, 
  alt = '', 
  contentType = 'Article',
  className = '',
  width = 'w-full',
  height = 'h-48',
  placeholderClassName = '',
  imgClassName = 'object-cover rounded-lg'
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageOrientation, setImageOrientation] = useState('horizontal');

  // Show placeholder if no src, image failed to load, or still loading
  if (!src || imageError) {
    return (
      <ArticleImagePlaceholder 
        contentType={contentType}
        className={placeholderClassName}
        width={width}
        height={height}
      />
    );
  }

  const handleImageLoad = (e) => {
    const img = e.target;
    // Detect if image is vertical (portrait)
    if (img.naturalHeight > img.naturalWidth) {
      setImageOrientation('vertical');
    }
    setImageLoading(false);
  };

  // For photoshoots, use object-contain with black background for vertical images
  const isPhotoshoot = contentType === 'photoshoots';
  const isVertical = imageOrientation === 'vertical';
  const shouldUseContain = isPhotoshoot && isVertical;
  
  const containerBgClass = shouldUseContain ? 'bg-black' : '';
  const imageObjectFit = shouldUseContain ? 'object-contain' : imgClassName;
  
  // Use taller height for vertical photoshoot images (8rem = 128px instead of 4rem = 64px)
  const adjustedHeight = (isPhotoshoot && isVertical) ? 'h-32' : height;

  return (
    <div className={`${width} ${adjustedHeight} ${className} ${containerBgClass}`}>
      {imageLoading && (
        <ArticleImagePlaceholder 
          contentType={contentType}
          className={placeholderClassName}
          width={width}
          height={adjustedHeight}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={`${width} ${adjustedHeight} ${imageObjectFit} ${imageLoading ? 'hidden' : 'block'}`}
        onLoad={handleImageLoad}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
      />
    </div>
  );
};

export default ArticleImage;