import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { extractArticleIdFromURL, createSEOArticleURL } from '../utils/seoUtils';
import { PlaceholderImage } from '../utils/imageUtils';
import CommentSection from '../components/CommentSection';

const ArticlePage = () => {
  const { articleId, slug } = useParams();
  const navigate = useNavigate();
  const { theme, getSectionHeaderClasses } = useTheme();
  const { t } = useLanguage();
  const [article, setArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Update page title and meta tags for SEO
  useEffect(() => {
    if (article) {
      // Update page title
      document.title = `${article.title} | Tadka News`;
      
      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', article.summary || article.content?.substring(0, 160) || '');
      } else {
        const newMetaDescription = document.createElement('meta');
        newMetaDescription.name = 'description';
        newMetaDescription.content = article.summary || article.content?.substring(0, 160) || '';
        document.head.appendChild(newMetaDescription);
      }

      // Update meta keywords
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      const articleTags = Array.isArray(article.tags) ? article.tags.join(', ') : '';
      const keywords = `${article.title}, ${article.category || 'news'}, Tadka News, ${articleTags}`;
      if (metaKeywords) {
        metaKeywords.setAttribute('content', keywords);
      } else {
        const newMetaKeywords = document.createElement('meta');
        newMetaKeywords.name = 'keywords';
        newMetaKeywords.content = keywords;
        document.head.appendChild(newMetaKeywords);
      }
    }

    return () => {
      // Reset title when component unmounts
      document.title = 'Tadka News';
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

    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  // Auto scroll to top when article page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []); // Run only once when component mounts

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
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" style={{ height: 'calc(100vh - 120px)' }}>
          
          {/* Article Section - 60% width - Scrollable */}
          <div className="lg:col-span-3 overflow-y-auto custom-scrollbar" style={{ height: '100%' }}>
            {/* Article Section Header - Sticky with published date and bottom border */}
            <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-6`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-base font-bold text-black text-left leading-tight font-sans">
                    {article.title}
                  </h1>
                  {/* Preview Mode Badge */}
                  {window.location.search.includes('preview=true') && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
                      Preview Mode
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-900 opacity-75 flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  Published on {formatDate(article.published_at || article.created_at)}
                </p>
              </div>
            </div>

            {/* Main Image or YouTube Video - White background */}
            {article.content_type === 'video' && article.youtube_url ? (
              <div className="mb-3 bg-white">
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
            ) : article.image ? (
              <div className="mb-3 bg-white">
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
              <div className="mb-3 bg-white">
                <PlaceholderImage 
                  contentType={article.content_type || 'post'} 
                  className="w-full h-96"
                />
              </div>
            )}

            {/* Movie Review Content */}
            {article.content_type === 'movie_review' ? (
              <div className="space-y-6 mb-8">
                {/* Movie Info Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {article.movie_rating && (
                      <div>
                        <span className="text-sm font-semibold text-gray-700">Rating:</span>
                        <div className="flex items-center mt-1">
                          {[...Array(5)].map((_, i) => {
                            const rating = parseFloat(article.movie_rating);
                            const filled = i < Math.floor(rating);
                            const half = i === Math.floor(rating) && rating % 1 >= 0.5;
                            return (
                              <svg
                                key={i}
                                className={`w-5 h-5 ${filled ? 'text-yellow-400' : half ? 'text-yellow-400' : 'text-gray-300'}`}
                                fill={filled || half ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                {half ? (
                                  <>
                                    <defs>
                                      <linearGradient id={`half-${i}`}>
                                        <stop offset="50%" stopColor="currentColor" />
                                        <stop offset="50%" stopColor="rgb(209 213 219)" />
                                      </linearGradient>
                                    </defs>
                                    <path
                                      fill={`url(#half-${i})`}
                                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                    />
                                  </>
                                ) : (
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                )}
                              </svg>
                            );
                          })}
                          <span className="ml-2 text-lg font-bold text-gray-900">{article.movie_rating}/5</span>
                        </div>
                      </div>
                    )}
                    {article.review_runtime && (
                      <div>
                        <span className="text-sm font-semibold text-gray-700">Runtime:</span>
                        <p className="text-gray-900 mt-1">{article.review_runtime}</p>
                      </div>
                    )}
                    {article.review_genre && (
                      <div>
                        <span className="text-sm font-semibold text-gray-700">Genre:</span>
                        <p className="text-gray-900 mt-1">{article.review_genre}</p>
                      </div>
                    )}
                    {article.review_director && (
                      <div>
                        <span className="text-sm font-semibold text-gray-700">Director:</span>
                        <p className="text-gray-900 mt-1">{article.review_director}</p>
                      </div>
                    )}
                  </div>
                  {article.review_cast && (
                    <div className="mt-4">
                      <span className="text-sm font-semibold text-gray-700">Cast:</span>
                      <p className="text-gray-900 mt-1">{article.review_cast}</p>
                    </div>
                  )}
                </div>

                {/* Quick Verdict */}
                {article.review_quick_verdict && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-l-4 border-blue-500 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Quick Verdict</h3>
                    <p className="text-lg font-semibold text-blue-900 italic">{article.review_quick_verdict}</p>
                  </div>
                )}

                {/* Plot Summary */}
                {article.review_plot_summary && (
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      What's It About?
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{article.review_plot_summary}</p>
                  </div>
                )}

                {/* Performances */}
                {article.review_performances && (
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Performances
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{article.review_performances}</p>
                  </div>
                )}

                {/* What Works */}
                {article.review_what_works && (
                  <div className="bg-green-50 p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      What Works
                    </h3>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-line">{article.review_what_works}</div>
                  </div>
                )}

                {/* What Doesn't Work */}
                {article.review_what_doesnt_work && (
                  <div className="bg-red-50 p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      What Doesn't Work
                    </h3>
                    <div className="text-gray-700 leading-relaxed whitespace-pre-line">{article.review_what_doesnt_work}</div>
                  </div>
                )}

                {/* Technical Aspects */}
                {article.review_technical_aspects && (
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Technical Aspects
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{article.review_technical_aspects}</p>
                  </div>
                )}

                {/* Final Verdict */}
                {article.review_final_verdict && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg shadow-sm border-l-4 border-gray-600">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                      <svg className="w-6 h-6 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Final Verdict
                    </h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{article.review_final_verdict}</p>
                  </div>
                )}

                {/* Trailer */}
                {article.youtube_url && (
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Watch Trailer</h3>
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden">
                      <iframe
                        src={getYouTubeEmbedUrl(article.youtube_url)}
                        title={`${article.title} Trailer`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                      ></iframe>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Regular Article Content - No background, no horizontal padding */
              <div className="prose prose-lg max-w-none mb-3 pt-3 pb-3">
                <div className={`text-gray-900 leading-relaxed space-y-6 text-justify`}>
                  {article.content ? (
                    <div dangerouslySetInnerHTML={{ __html: article.content }} />
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
              </div>
            </div>

          </div>

          {/* Right Sidebar - Comments & Related Articles Section - 40% width - Scrollable */}
          <div className="lg:col-span-2 border-t border-gray-300 lg:border-t-0 pt-2 lg:pt-0 overflow-y-auto custom-scrollbar" style={{ height: '100%' }}>
            {/* Comment Section */}
            {article.content_type === 'movie_review' && (article.review_comments_enabled !== false) && (
              <div className="mb-6">
                <div className={`sticky top-16 z-30 border-b-2 border-gray-300 mb-4`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
                  <div className="pl-0 pr-4 py-4">
                    <div className="mb-1">
                      <h2 className="text-base font-bold text-black text-left leading-tight">
                        Movie Review Comments
                      </h2>
                    </div>
                    <p className="text-xs text-gray-900 opacity-75 text-left">
                      Share your thoughts
                    </p>
                  </div>
                </div>
                <div className="overflow-y-auto pr-4" style={{ maxHeight: '400px' }}>
                  <CommentSection articleId={article.id} commentType="review" />
                </div>
              </div>
            )}
            {article.content_type !== 'movie_review' && (article.comments_enabled !== false) && (
              <div className="mb-6">
                <div className={`sticky top-16 z-30 border-b-2 border-gray-300 mb-4`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
                  <div className="pl-0 pr-4 py-4">
                    <div className="mb-1">
                      <h2 className="text-base font-bold text-black text-left leading-tight">
                        Comments
                      </h2>
                    </div>
                    <p className="text-xs text-gray-900 opacity-75 text-left">
                      Share your thoughts
                    </p>
                  </div>
                </div>
                <div className="overflow-y-auto pr-4" style={{ maxHeight: '400px' }}>
                  <CommentSection articleId={article.id} commentType="regular" />
                </div>
              </div>
            )}

            {/* Related Articles Section Header - Sticky */}
            <div className={`sticky top-16 z-30 border-b-2 border-gray-300 mb-6`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
              <div className="pl-0 pr-4 py-4">
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