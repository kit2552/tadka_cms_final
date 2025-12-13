import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArticleIdFromURL, createSEOArticleURL } from '../utils/seoUtils';
import { PlaceholderImage } from '../utils/imageUtils';
import CommentSection from '../components/CommentSection';
import { generateArticleSchema, insertSchemaMarkup } from '../utils/schemaMarkup';
import GallerySlider from '../components/GallerySlider';

const ArticlePage = () => {
  const { articleId, slug } = useParams();
  const navigate = useNavigate();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [adSettings, setAdSettings] = useState({
    article_content_mid: false,
    article_sidebar_comments: false
  });
  const [twitterEmbedError, setTwitterEmbedError] = useState(false);

  // Utility function to strip inline styles from links before rendering
  const stripLinkStyles = (html) => {
    if (!html) return html;
    const cleaned = html
      .replace(/<a([^>]*?)style="[^"]*"([^>]*?)>/gi, '<a$1$2>') // Remove inline styles (double quotes)
      .replace(/<a([^>]*?)style='[^']*'([^>]*?)>/gi, '<a$1$2>'); // Remove inline styles (single quotes)
    
    // Log if any changes were made
    if (cleaned !== html) {
      console.log('🧹 Stripped inline styles from links');
    }
    return cleaned;
  };

  // Update page title, meta tags, and schema markup for SEO/AEO
  useEffect(() => {
    if (article) {
      // Update page title
      document.title = `${article.title} | Tadka News`;
      
      // Update meta description (prioritize AEO description)
      const metaDescription = document.querySelector('meta[name="description"]');
      const description = article.aeo_description || article.seo_description || article.summary || article.content?.substring(0, 160) || '';
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      } else {
        const newMetaDescription = document.createElement('meta');
        newMetaDescription.name = 'description';
        newMetaDescription.content = description;
        document.head.appendChild(newMetaDescription);
      }

      // Update meta keywords (combine SEO and AEO keywords)
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      const articleTags = Array.isArray(article.tags) ? article.tags.join(', ') : '';
      const aeoKeywords = article.aeo_keywords || '';
      const seoKeywords = article.seo_keywords || '';
      const keywords = `${article.title}, ${article.category || 'news'}, Tadka News, ${articleTags}, ${aeoKeywords}, ${seoKeywords}`.replace(/,\s*,/g, ',');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords);
      } else {
        const newMetaKeywords = document.createElement('meta');
        newMetaKeywords.name = 'keywords';
        newMetaKeywords.content = keywords;
        document.head.appendChild(newMetaKeywords);
      }

      // Generate and insert Schema.org structured data
      const schemas = generateArticleSchema(article);
      insertSchemaMarkup(schemas);
      
      console.log('📊 Schema markup inserted:', schemas.length, 'schemas');
    }

    return () => {
      // Reset title and remove schema markup when component unmounts
      document.title = 'Tadka News';
      const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
      existingScripts.forEach(script => script.remove());
    };
  }, [article]);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles/${articleId}`);
        if (response.ok) {
          const data = await response.json();
          setArticle(data);
          
          // Fetch user ratings for movie reviews
          if (data.content_type === 'movie_review') {
            fetchUserRatings(articleId);
          }
          
          // Fetch related articles based on category
          if (data.category) {
            const relatedResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles/category/${data.category}?limit=10`);
            if (relatedResponse.ok) {
              const relatedData = await relatedResponse.json();
              setRelatedArticles(relatedData.filter(a => a.id !== parseInt(articleId)).slice(0, 6));
            }
          }
        } else {
          throw new Error('Article not found');
        }
      } catch (err) {
        setError('Failed to load article');
        console.error('Error fetching article:', err);
      } finally {
        setLoading(false);
      }
    };

    const loadAdSettings = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ad-settings`);
        if (response.ok) {
          const data = await response.json();
          setAdSettings(data);
        }
      } catch (err) {
        console.error('Failed to load ad settings:', err);
      }
    };

    if (articleId) {
      fetchArticle();
    }
    loadAdSettings();
  }, [articleId]);

  const fetchUserRatings = async (articleId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles/${articleId}/comments?comment_type=review`);
      if (response.ok) {
        const data = await response.json();
        const comments = data.comments || [];
        
        // Filter comments with ratings and calculate average
        const ratingsOnly = comments.filter(c => c.rating).map(c => parseInt(c.rating));
        if (ratingsOnly.length > 0) {
          const average = ratingsOnly.reduce((sum, rating) => sum + rating, 0) / ratingsOnly.length;
          setUserRating(average.toFixed(1));
          setReviewCount(ratingsOnly.length);
        }
      }
    } catch (err) {
      console.error('Error fetching user ratings:', err);
    }
  };

  // Auto scroll to top when article page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []); // Run only once when component mounts

  // Load Instagram embed script immediately on mount
  useEffect(() => {
    // Preload Instagram embed script
    if (!window.instgrm && !document.querySelector('script[src*="instagram.com/embed.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []); // Run once on mount

  // Process Instagram embeds when article loads
  useEffect(() => {
    if (article && article.social_media_type === 'instagram' && article.social_media_embed) {
      // Wait for script to load and process embeds
      const processEmbed = () => {
        if (window.instgrm && window.instgrm.Embeds) {
          window.instgrm.Embeds.process();
        }
      };

      if (window.instgrm) {
        processEmbed();
      } else {
        // Wait for script to load
        const checkScript = setInterval(() => {
          if (window.instgrm) {
            clearInterval(checkScript);
            processEmbed();
          }
        }, 100);

        // Cleanup after 5 seconds
        setTimeout(() => clearInterval(checkScript), 5000);
      }
    }
  }, [article]);

  // Load Twitter widgets script and render tweets
  useEffect(() => {
    if (article && article.social_media_type === 'twitter' && article.social_media_embed) {
      setTwitterEmbedError(false);
      
      // Load Twitter widgets script if not already loaded
      if (!window.twttr) {
        const script = document.createElement('script');
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        document.body.appendChild(script);
        
        script.onload = () => {
          // After script loads, render the tweet and check if it loaded successfully
          if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load().then(() => {
              // Check after 3 seconds if iframe was created
              setTimeout(() => {
                const twitterIframes = document.querySelectorAll('iframe[id^="twitter-widget"]');
                if (twitterIframes.length === 0) {
                  setTwitterEmbedError(true);
                }
              }, 3000);
            });
          }
        };
      } else {
        // Script already loaded, just render
        if (window.twttr.widgets) {
          window.twttr.widgets.load().then(() => {
            // Check after 3 seconds if iframe was created
            setTimeout(() => {
              const twitterIframes = document.querySelectorAll('iframe[id^="twitter-widget"]');
              if (twitterIframes.length === 0) {
                setTwitterEmbedError(true);
              }
            }, 3000);
          });
        }
      }
    }
  }, [article]);

  const handleShare = (platform) => {
    const url = window.location.href;
    const title = article?.title || 'Check out this article';
    
    let shareUrl = '';
    
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        break;
      case 'reddit':
        shareUrl = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        break;
      case 'copy':
        // Copy link to clipboard
        navigator.clipboard.writeText(url).then(() => {
          alert('Link copied to clipboard!');
        }).catch(err => {
          console.error('Failed to copy link:', err);
        });
        return;
      case 'email':
        // Open email client with pre-filled content
        const subject = encodeURIComponent(title);
        const body = encodeURIComponent(`Check out this article: ${title}\n\n${url}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        return;
      default:
        return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handleRelatedArticleClick = (relatedArticle) => {
    const seoUrl = createSEOArticleURL(relatedArticle.id, relatedArticle.title);
    navigate(seoUrl);
  };

  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Function to convert YouTube URL to embed URL
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return '';
    
    // Handle different YouTube URL formats
    let videoId = '';
    
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1]?.split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
      return url; // Already an embed URL
    }
    
    // Add parameters to remove/minimize YouTube branding
    const embedParams = [
      'modestbranding=1',    // Reduces YouTube branding
      'rel=0',               // Don't show related videos at end
      'controls=1',          // Show player controls
      'showinfo=0',          // Hide video title and uploader info
      'fs=1',                // Allow fullscreen
      'cc_load_policy=0',    // Hide closed captions
      'iv_load_policy=3',    // Hide video annotations
      'disablekb=0',         // Enable keyboard controls
      'playsinline=1'        // Play inline on mobile
    ].join('&');
    
    return videoId ? `https://www.youtube.com/embed/${videoId}?${embedParams}` : '';
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

  // Force light theme for content areas regardless of user's theme selection
  const lightThemeClasses = {
    pageBackground: 'bg-gray-50',
    cardBackground: 'bg-white',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-600',
    border: 'border-gray-200'
  };

  const themeClasses = lightThemeClasses;
  const sectionHeaderClasses = getSectionHeaderClasses();

  if (loading) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBackground} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={`text-lg font-medium ${themeClasses.textPrimary}`}>Loading article...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBackground} flex items-center justify-center`}>
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">📰</div>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-2`}>Article Not Found</h2>
          <p className={`${themeClasses.textSecondary} mb-6`}>The article you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={handleBackNavigation}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className={`min-h-screen ${themeClasses.pageBackground} flex items-center justify-center`}>
        <div className="text-center">
          <p className={`text-lg font-medium ${themeClasses.textPrimary}`}>Article not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${themeClasses.pageBackground}`}>
      {/* Main Container - Remove top padding for article pages */}
      <div className="max-w-5xl-plus mx-auto px-8 pb-6">
        
        {/* Two Section Layout with Gap - 60%/40% split */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[calc(100vh-120px)]">
          
          {/* Article Section - 60% width - Scrollable */}
          <div className="lg:col-span-3 lg:overflow-y-auto custom-scrollbar lg:h-full" style={{ paddingRight: '14px' }}>
            {/* Article Section Header - Sticky with published date and bottom border */}
            <div className={`sticky top-0 z-40 border-b-2 border-gray-300`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 pt-4" style={{ paddingBottom: '1rem' }}>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-base font-bold text-black text-left leading-tight font-sans">
                    {article.title}
                  </h1>
                </div>
                <p className="text-xs text-gray-900 opacity-75 text-left">
                  Published on {formatDate(article.published_at || article.created_at)}
                </p>
              </div>
            </div>

            {/* Main Image or YouTube Video or Gallery Slider - White background */}
            {(article.content_type === 'video' || article.content_type === 'video_post' || article.content_type === 'movie_review') && article.youtube_url ? (
              <div className="mb-3 bg-white" style={{ marginTop: '1rem' }}>
                <div className="relative aspect-video w-full overflow-hidden">
                  <iframe
                    src={getYouTubeEmbedUrl(article.youtube_url)}
                    title={article.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  ></iframe>
                </div>
              </div>
            ) : article.content_type === 'photo' && article.gallery ? (
              <div style={{ marginTop: '1rem' }}>
                <GallerySlider gallery={article.gallery} title={article.title} />
              </div>
            ) : article.image ? (
              <div className="mb-3 bg-white" style={{ marginTop: '1rem' }}>
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-96 object-cover"
                  onError={(e) => {
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-full h-96 bg-gray-500 flex items-center justify-center';
                    placeholder.innerHTML = `<span class="text-white font-bold text-6xl">${article.content_type === 'video' ? 'V' : article.content_type === 'photo' ? 'P' : article.content_type === 'movie_review' ? 'M' : 'A'}</span>`;
                    e.target.parentNode.replaceChild(placeholder, e.target);
                  }}
                />
              </div>
            ) : (
              <div className="mb-3 bg-white" style={{ marginTop: '1rem' }}>
                <PlaceholderImage 
                  contentType={article.content_type || 'post'} 
                  className="w-full h-96"
                />
              </div>
            )}

            {/* Movie Review Content */}
            {article.content_type === 'movie_review' ? (
              <div className="space-y-6 mb-8">
                {/* Compact Movie Info Card - Dark Theme */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 rounded-lg shadow-xl border border-gray-700">
                  <div className="flex items-stretch justify-between gap-6">
                    {/* Left Side - Movie Details (4 Sections) */}
                    <div className="flex-1 space-y-0 text-left">
                      
                      {/* Section 1: Basic Info */}
                      <div className="space-y-2 py-2">
                        {article.title && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Movie</span>
                            <span className="text-white font-medium text-xs">{article.title.replace(' Movie Review', '')}</span>
                          </div>
                        )}
                        {article.movie_language && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Language</span>
                            <span className="text-white font-medium text-xs">
                              {(() => {
                                try {
                                  if (typeof article.movie_language === 'string' && article.movie_language.startsWith('[')) {
                                    const languages = JSON.parse(article.movie_language);
                                    return Array.isArray(languages) ? languages.join(', ') : article.movie_language;
                                  }
                                  return article.movie_language;
                                } catch (e) {
                                  return article.movie_language;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                        {article.platform && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Release</span>
                            <span className="text-white font-medium text-xs">{article.platform}</span>
                          </div>
                        )}
                        {article.censor_rating && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Censor Rating</span>
                            <span className="text-white font-medium text-xs">{article.censor_rating}</span>
                          </div>
                        )}
                        {article.platform === 'OTT' && article.ott_platforms && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">OTT</span>
                            <span className="text-white font-medium text-xs">
                              {(() => {
                                try {
                                  const platforms = typeof article.ott_platforms === 'string' 
                                    ? JSON.parse(article.ott_platforms) 
                                    : article.ott_platforms;
                                  return Array.isArray(platforms) ? platforms.join(', ') : article.ott_platforms;
                                } catch {
                                  return article.ott_platforms;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                        {article.review_genre && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Genre</span>
                            <span className="text-white font-medium text-xs">
                              {(() => {
                                try {
                                  const genres = typeof article.review_genre === 'string' 
                                    ? JSON.parse(article.review_genre) 
                                    : article.review_genre;
                                  return Array.isArray(genres) ? genres.join(', ') : article.review_genre;
                                } catch {
                                  return article.review_genre;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Divider between sections */}
                      {(() => {
                        const hasValidBanner = article.review_banner && article.review_banner !== 'Not Available' && article.review_banner !== 'N/A';
                        const hasValidProducer = article.review_producer && article.review_producer !== 'Not Available' && article.review_producer !== 'N/A';
                        const hasValidDirector = article.review_director && article.review_director !== 'Not Available' && article.review_director !== 'N/A';
                        const hasValidMusic = article.review_music_director && article.review_music_director !== 'Not Available' && article.review_music_director !== 'N/A';
                        const hasValidDop = article.review_dop && article.review_dop !== 'Not Available' && article.review_dop !== 'N/A';
                        const hasValidEditor = article.review_editor && article.review_editor !== 'Not Available' && article.review_editor !== 'N/A';
                        
                        return (hasValidBanner || hasValidProducer || hasValidDirector || hasValidMusic || hasValidDop || hasValidEditor) && (
                          <div className="border-t border-gray-700 my-2"></div>
                        );
                      })()}

                      {/* Section 2: Production & Crew (Combined) */}
                      {(() => {
                        const hasValidBanner = article.review_banner && article.review_banner !== 'Not Available' && article.review_banner !== 'N/A';
                        const hasValidProducer = article.review_producer && article.review_producer !== 'Not Available' && article.review_producer !== 'N/A';
                        const hasValidDirector = article.review_director && article.review_director !== 'Not Available' && article.review_director !== 'N/A';
                        const hasValidMusic = article.review_music_director && article.review_music_director !== 'Not Available' && article.review_music_director !== 'N/A';
                        const hasValidDop = article.review_dop && article.review_dop !== 'Not Available' && article.review_dop !== 'N/A';
                        const hasValidEditor = article.review_editor && article.review_editor !== 'Not Available' && article.review_editor !== 'N/A';
                        
                        return (hasValidBanner || hasValidProducer || hasValidDirector || hasValidMusic || hasValidDop || hasValidEditor) && (
                          <div className="space-y-2 py-2">
                            {hasValidBanner && (
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Banner</span>
                                <span className="text-white font-medium text-xs">{article.review_banner}</span>
                              </div>
                            )}
                            {hasValidProducer && (
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Producer</span>
                                <span className="text-white font-medium text-xs">{article.review_producer}</span>
                              </div>
                            )}
                            {hasValidDirector && (
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Director</span>
                                <span className="text-white font-medium text-xs">{article.review_director}</span>
                              </div>
                            )}
                            {hasValidMusic && (
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Music</span>
                                <span className="text-white font-medium text-xs">{article.review_music_director}</span>
                              </div>
                            )}
                            {hasValidDop && (
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">DOP</span>
                                <span className="text-white font-medium text-xs">{article.review_dop}</span>
                              </div>
                            )}
                            {hasValidEditor && (
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px]">Editor</span>
                                <span className="text-white font-medium text-xs">{article.review_editor}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Divider between sections */}
                      {article.review_cast && (
                        <div className="border-t border-gray-700 my-2"></div>
                      )}

                      {/* Section 3: Cast */}
                      {article.review_cast && (
                        <div className="space-y-2 py-2">
                          <div className="flex items-start gap-4">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[85px] pt-0.5">Cast</span>
                            <span className="text-white font-medium text-xs leading-relaxed">{article.review_cast}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Side - Rating */}
                    {article.movie_rating && (
                      <div className="flex flex-col items-center border-l border-gray-700 pl-4 flex-shrink-0">
                        {/* Top Section - Ratings */}
                        <div className="flex flex-col items-center">
                          <div className="text-4xl font-bold text-white leading-none">
                          {(() => {
                            const rating = parseFloat(article.movie_rating);
                            return rating % 1 === 0 ? rating.toFixed(0) : rating.toString();
                          })()}
                        </div>
                          <div className="text-xs text-gray-400 mb-1">/5</div>
                          <div className="flex items-center gap-0.5 mb-3">
                            {[...Array(5)].map((_, i) => {
                              const rating = parseFloat(article.movie_rating);
                              const filled = i < Math.floor(rating);
                              return (
                                <svg
                                  key={i}
                                  className={`w-3 h-3 ${filled ? 'text-yellow-400' : 'text-gray-600'}`}
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              );
                            })}
                          </div>

                          {/* Divider */}
                          <div className="w-full border-t border-gray-700 mb-3"></div>

                          {/* User Rating */}
                          {userRating ? (
                            <div className="flex flex-col items-center">
                              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">User Rating</div>
                              <div className="text-2xl font-bold text-white leading-none">
                                {(() => {
                                  const rating = parseFloat(userRating);
                                  return rating % 1 === 0 ? rating.toFixed(0) : rating.toString();
                                })()}
                              </div>
                              <div className="text-[10px] text-gray-400 mb-1">/5</div>
                              <div className="flex items-center gap-0.5">
                                {[...Array(5)].map((_, i) => {
                                  const rating = parseFloat(userRating);
                                  const filled = i < Math.floor(rating);
                                  return (
                                    <svg
                                      key={i}
                                      className={`w-2.5 h-2.5 ${filled ? 'text-yellow-400' : 'text-gray-600'}`}
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                    </svg>
                                  );
                                })}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-1">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">User Rating</div>
                              <div className="text-xs text-gray-500">No reviews yet</div>
                            </div>
                          )}

                          {/* Runtime and Release Date - Right below User Rating */}
                          {(article.review_runtime || article.release_date) && (
                            <>
                              <div className="w-full border-t border-gray-700 my-2"></div>
                              <div className="flex flex-col items-center gap-2 py-2">
                                {article.review_runtime && (
                                  <div className="text-xs text-gray-300 font-medium">{article.review_runtime}</div>
                                )}
                                {article.release_date && (
                                  <div className="text-xs text-gray-300 font-medium">
                                    {new Date(article.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Verdict */}
                {article.review_quick_verdict && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">Quick Verdict</h3>
                    </div>
                    <p className="text-gray-900 leading-relaxed whitespace-pre-line text-left">{article.review_quick_verdict}</p>
                  </div>
                )}

                <style>{`
                  .movie-review-content p,
                  .movie-review-content span {
                    font-size: 1rem !important;
                    line-height: 1.75 !important;
                  }
                  .movie-review-content {
                    font-size: 1rem;
                  }
                `}</style>

                {/* Plot Summary */}
                {article.review_plot_summary && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">Main Plot</h3>
                    </div>
                    <div className="movie-review-content text-gray-900 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: stripLinkStyles(article.review_plot_summary) }} />
                  </div>
                )}

                {/* Performances */}
                {article.review_performances && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">Performances</h3>
                    </div>
                    <div className="movie-review-content text-gray-900 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: stripLinkStyles(article.review_performances) }} />
                  </div>
                )}

                {/* What Works */}
                {article.review_what_works && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">What Works</h3>
                    </div>
                    <div className="movie-review-content text-gray-900 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: stripLinkStyles(article.review_what_works) }} />
                  </div>
                )}

                {/* What Doesn't Work */}
                {article.review_what_doesnt_work && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">What Doesn't Work</h3>
                    </div>
                    <div className="movie-review-content text-gray-900 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: stripLinkStyles(article.review_what_doesnt_work) }} />
                  </div>
                )}

                {/* Technical Aspects */}
                {article.review_technical_aspects && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">Technical Aspects</h3>
                    </div>
                    <div className="movie-review-content text-gray-900 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: stripLinkStyles(article.review_technical_aspects) }} />
                  </div>
                )}

                {/* Final Verdict */}
                {article.review_final_verdict && (
                  <div className="mb-6">
                    <div className="border-b-2 border-gray-300 mb-4 pb-3">
                      <h3 className="text-base font-bold text-black text-left leading-tight">Final Verdict</h3>
                    </div>
                    <div className="movie-review-content text-gray-900 leading-relaxed text-left" dangerouslySetInnerHTML={{ __html: stripLinkStyles(article.review_final_verdict) }} />
                  </div>
                )}
              </div>
            ) : (
              /* Regular Article Content - No background, no horizontal padding */
              <div className="prose prose-lg max-w-none mb-3 pt-3 pb-3">
                <style>{`
                  /* Override ALL link styles in article content */
                  .prose a,
                  .prose a[style],
                  .prose a[style*="color"],
                  .prose a[style*="Color"],
                  .prose p a,
                  .prose div a {
                    color: #2563eb !important;
                    text-decoration: underline !important;
                    background: none !important;
                  }
                  .prose a:hover {
                    color: #1d4ed8 !important;
                  }
                `}</style>
                <div className={`text-gray-900 leading-relaxed space-y-6 text-left`}>
                  {/* Main Content */}
                  {article.content ? (
                    <div dangerouslySetInnerHTML={{ 
                      __html: stripLinkStyles(
                        article.content
                          .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>\s*$/gi, '') // Remove trailing empty paragraphs
                          .trim()
                      )
                    }} />
                  ) : (
                    <>
                      <p>
                        This is the main content of the article. In a real application, this would be 
                        the full article content retrieved from your backend database.
                      </p>
                      <p>
                        You can add rich text content here including multiple paragraphs, quotes, 
                        and other formatted content that makes up the complete article.
                      </p>
                      <p>
                        The article content would continue here with additional paragraphs, 
                        analysis, and conclusions relevant to the topic.
                      </p>
                    </>
                  )}

                  {/* Social Media Embed */}
                  {article.social_media_type && article.social_media_embed && (
                    <div className="my-6">
                      {article.social_media_type === 'twitter' && (
                        <div className="flex justify-center flex-col items-center">
                          {article.social_media_embed.includes('<blockquote') || article.social_media_embed.includes('<iframe') ? (
                            <div dangerouslySetInnerHTML={{ __html: article.social_media_embed }} />
                          ) : (
                            <>
                              <blockquote className="twitter-tweet" data-theme={theme === 'dark' ? 'dark' : 'light'}>
                                <a href={article.social_media_embed}></a>
                              </blockquote>
                              {twitterEmbedError && (
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md text-center">
                                  <p className="text-sm text-yellow-800 mb-2">⚠️ Unable to load tweet</p>
                                  <p className="text-xs text-yellow-700">This tweet may be deleted, private, or unavailable.</p>
                                  <a 
                                    href={article.social_media_embed} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-xs underline mt-2 inline-block"
                                  >
                                    Try opening on Twitter/X
                                  </a>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {article.social_media_type === 'instagram' && (
                        <div className="flex justify-center my-6">
                          <div 
                            className="instagram-embed-container"
                            style={{ width: '100%', maxWidth: '700px' }}
                            dangerouslySetInnerHTML={{ __html: article.social_media_embed }} 
                          />
                          <style>{`
                            .instagram-embed-container .instagram-media {
                              min-width: 326px !important;
                              max-width: 700px !important;
                              width: 100% !important;
                              margin: 0 auto !important;
                            }
                            .instagram-embed-container iframe {
                              max-width: 700px !important;
                              width: 100% !important;
                            }
                          `}</style>
                        </div>
                      )}
                      {article.social_media_type === 'facebook' && (
                        <div className="flex justify-center">
                          <div dangerouslySetInnerHTML={{ __html: article.social_media_embed }} />
                        </div>
                      )}
                      {article.social_media_type === 'tiktok' && (
                        <div className="flex justify-center">
                          <div dangerouslySetInnerHTML={{ __html: article.social_media_embed }} />
                        </div>
                      )}
                      {article.social_media_type === 'youtube' && article.social_media_embed.includes('iframe') && (
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <div 
                            className="absolute inset-0"
                            dangerouslySetInnerHTML={{ __html: article.social_media_embed }} 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ad Placeholder - Only show if secondary content exists AND ad is enabled */}
                  {article.content_secondary && adSettings.article_content_mid && (
                    <div className="my-6 border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 text-center">
                      <p className="text-sm text-gray-500 font-medium">Advertisement Space</p>
                      <p className="text-xs text-gray-400 mt-1">Ad will be displayed here</p>
                    </div>
                  )}

                  {/* Secondary Content */}
                  {article.content_secondary && (
                    <div dangerouslySetInnerHTML={{ 
                      __html: article.content_secondary
                        .replace(/^\s*<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '') // Remove leading empty paragraphs
                        .trim()
                    }} />
                  )}
                </div>
              </div>
            )}

            {/* Share Icons - Bottom of article content */}
            <div className="border-t border-gray-300 mb-2 lg:mb-8" style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="py-3 flex justify-start space-x-2.5">
                <button
                  onClick={() => handleShare('facebook')}
                  className="w-6 h-6 bg-blue-600 text-white rounded-md flex items-center justify-center hover:bg-blue-700 transition-colors duration-200"
                  title="Share on Facebook"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('twitter')}
                  className="w-6 h-6 bg-black text-white rounded-md flex items-center justify-center hover:bg-gray-800 transition-colors duration-200"
                  title="Share on X"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('linkedin')}
                  className="w-6 h-6 bg-blue-700 text-white rounded-md flex items-center justify-center hover:bg-blue-800 transition-colors duration-200"
                  title="Share on LinkedIn"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('whatsapp')}
                  className="w-6 h-6 bg-green-500 text-white rounded-md flex items-center justify-center hover:bg-green-600 transition-colors duration-200"
                  title="Share on WhatsApp"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.488"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('telegram')}
                  className="w-6 h-6 bg-blue-500 text-white rounded-md flex items-center justify-center hover:bg-blue-600 transition-colors duration-200"
                  title="Share on Telegram"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('reddit')}
                  className="w-6 h-6 bg-orange-500 text-white rounded-md flex items-center justify-center hover:bg-orange-600 transition-colors duration-200"
                  title="Share on Reddit"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.526-.73a.326.326 0 0 0-.218-.095z"/>
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('copy')}
                  className="w-6 h-6 bg-gray-600 text-white rounded-md flex items-center justify-center hover:bg-gray-700 transition-colors duration-200"
                  title="Copy Link"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  onClick={() => handleShare('email')}
                  className="w-6 h-6 bg-red-600 text-white rounded-md flex items-center justify-center hover:bg-red-700 transition-colors duration-200"
                  title="Share via Email"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

          </div>

          {/* Right Sidebar - Comments & Related Articles Section - 40% width - Scrollable */}
          <div className="lg:col-span-2 border-t border-gray-300 lg:border-t-0 pt-2 lg:pt-0 lg:overflow-y-auto custom-scrollbar lg:h-full" style={{ paddingLeft: '0px', paddingRight: '4px' }}>
            {/* Comment Section */}
            {article.content_type === 'movie_review' && (article.review_comments_enabled !== false) && (
              <div className="mb-6" style={{ marginTop: '1rem' }}>
                <CommentSection articleId={article.id} commentType="review" headerTitle="User Reviews" />
              </div>
            )}
            {article.content_type !== 'movie_review' && (article.comments_enabled !== false) && (
              <div className="mb-6" style={{ marginTop: '1rem' }}>
                <CommentSection articleId={article.id} commentType="regular" headerTitle="Comments" />
              </div>
            )}

            {/* Ad Placeholder - Between Comments and Related Posts - Only show if enabled */}
            {adSettings.article_sidebar_comments && (
              <div className="mb-6 pr-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 text-center">
                  <p className="text-sm text-gray-500 font-medium">Advertisement Space</p>
                  <p className="text-xs text-gray-400 mt-1">Sidebar ad will be displayed here</p>
                </div>
              </div>
            )}

            {/* Related Articles Section Header - Sticky */}
            <div className={`sticky top-0 z-30 border-b-2 border-gray-300`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))', marginBottom: '1rem' }}>
              <div className="pl-0 pr-4" style={{ paddingTop: '0px', paddingBottom: '1rem' }}>
                <div className="mb-1">
                  <h2 className="text-base font-bold text-black text-left leading-tight">
                    Related Posts
                  </h2>
                </div>
                <p className="text-xs text-gray-900 opacity-75 text-left">
                  Content you may like
                </p>
              </div>
            </div>

            {/* Related Articles List */}
            <div className="space-y-4">
              <div className="space-y-4">
                {relatedArticles.length > 0 ? (
                  relatedArticles.map((relatedArticle, index) => (
                    <div
                      key={relatedArticle.id}
                      onClick={() => handleRelatedArticleClick(relatedArticle)}
                      className={`group cursor-pointer hover:bg-gray-50 transition-colors duration-200 pb-4 ${
                        index < relatedArticles.length - 1 ? 'border-b border-gray-200' : ''
                      }`}
                    >
                      <div className="flex space-x-3">
                        {relatedArticle.image_url ? (
                          <img
                            src={relatedArticle.image_url}
                            alt={relatedArticle.title}
                            className="w-20 h-16 object-cover rounded flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              const placeholder = document.createElement('div');
                              placeholder.className = 'w-20 h-16 bg-gray-500 flex items-center justify-center rounded flex-shrink-0';
                              placeholder.innerHTML = `<span class="text-white font-bold text-lg">${relatedArticle.content_type === 'video' ? 'V' : relatedArticle.content_type === 'photo' ? 'P' : relatedArticle.content_type === 'movie_review' ? 'M' : 'A'}</span>`;
                              e.target.parentNode.replaceChild(placeholder, e.target);
                            }}
                          />
                        ) : (
                          <PlaceholderImage 
                            contentType={relatedArticle.content_type || 'post'} 
                            className="w-20 h-16"
                          />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className={`font-medium text-gray-900 group-hover:text-blue-600 transition-colors duration-200 leading-tight mb-2 text-left line-clamp-2`} style={{ fontSize: '0.9rem' }}>
                            {relatedArticle.title}
                          </h4>
                          <p className={`text-xs text-gray-600 text-left`}>
                            {formatDate(relatedArticle.published_at || relatedArticle.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={`text-gray-600 text-sm text-left`}>
                    No related posts found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArticlePage;