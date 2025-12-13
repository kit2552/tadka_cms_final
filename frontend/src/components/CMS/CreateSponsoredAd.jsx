import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, convertToRaw, ContentState } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import NotificationModal from '../NotificationModal';

const CreateSponsoredAd = ({ onClose }) => {
  const navigate = useNavigate();
  const { id } = useParams(); // Changed from articleId to id to match the route
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [states, setStates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
  const [editorStateSecondary, setEditorStateSecondary] = useState(EditorState.createEmpty());
  
  // Movie Review Editor States
  const [editorPlotSummary, setEditorPlotSummary] = useState(EditorState.createEmpty());
  const [editorPerformances, setEditorPerformances] = useState(EditorState.createEmpty());
  const [editorWhatWorks, setEditorWhatWorks] = useState(EditorState.createEmpty());
  const [editorWhatDoesntWork, setEditorWhatDoesntWork] = useState(EditorState.createEmpty());
  const [editorTechnicalAspects, setEditorTechnicalAspects] = useState(EditorState.createEmpty());
  const [editorFinalVerdict, setEditorFinalVerdict] = useState(EditorState.createEmpty());
  
  // Movie Review Accordion States
  const [reviewAccordions, setReviewAccordions] = useState({
    plot: true,
    performances: false,
    whatWorks: false,
    whatDoesnt: false,
    technical: false,
    verdict: false
  });
  const [notification, setNotification] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });
  
  const [formData, setFormData] = useState({
    title: '',
    short_title: '',
    content: '',
    content_secondary: '', // Second content for ad placement
    summary: '',
    author: 'Tadka Team', // Default author
    article_language: 'en',
    states: 'all',
    category: '',
    content_type: 'post', // New field for content type
    ad_type: 'sponsored_section', // New field: sponsored_section, ad_post, landing_home, landing_inner
    image: '',
    image_gallery: [], // New field for image gallery
    youtube_url: '',
    media_type: 'image', // New field: 'image' or 'youtube'
    tags: '',
    artists: [], // New field for artists
    movie_rating: '', // New field for movie rating
    is_featured: false,
    is_published: true,
    is_scheduled: false,
    scheduled_publish_at: '',
    scheduled_timezone: 'IST',
    // Landing Page specific fields
    sponsored_link: '',
    sponsored_label: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    // AEO & FAQ fields
    aeo_title: '',
    aeo_description: '',
    aeo_keywords: '',
    faqs: [], // Array of {question: '', answer: ''}
    // E-E-A-T fields
    author_credentials: '',
    sources: '',
    fact_checked_by: '',
    last_reviewed_date: '',
    // Movie Review specific fields
    review_quick_verdict: '',
    review_plot_summary: '',
    review_performances: '',
    review_what_works: '',
    review_what_doesnt_work: '',
    review_technical_aspects: '',
    review_final_verdict: '',
    review_cast: '',
    review_director: '',
    review_producer: '',
    review_banner: '',
    review_music_director: '',
    review_dop: '',
    review_editor: '',
    review_genre: '',
    review_runtime: '',
    movie_language: '',
    censor_rating: '',
    release_date: '',
    platform: '',
    ott_content_type: '',
    ott_platforms: [],
    // Comment settings
    comments_enabled: true,
    review_comments_enabled: true,
    social_media_type: '',
    social_media_embed: '',
    // Top Story
    is_top_story: false,
    top_story_duration_hours: 24
  });

  const [selectedState, setSelectedState] = useState(''); // Temporary state for dropdown selection
  const [selectedStates, setSelectedStates] = useState([]); // Array of selected states
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(''); // Changed to single artist (string)
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [tempGenre, setTempGenre] = useState('');
  const [tempLanguage, setTempLanguage] = useState('');
  const [availableArtists, setAvailableArtists] = useState([]); // Available artists from API
  const [showArtistModal, setShowArtistModal] = useState(false); // New state for artist modal
  const [newArtistName, setNewArtistName] = useState(''); // New state for new artist name
  
  // Gallery selection states
  const [selectedGallery, setSelectedGallery] = useState(null); // Selected gallery object
  const [showGalleryModal, setShowGalleryModal] = useState(false); // Gallery selection modal
  const [availableGalleries, setAvailableGalleries] = useState([]); // Available galleries from API
  const [gallerySearchTerm, setGallerySearchTerm] = useState(''); // Search term for galleries
  
  // Image gallery management states
  const [newImageUrl, setNewImageUrl] = useState(''); // For adding new images to gallery
  const [editingImageIndex, setEditingImageIndex] = useState(null); // Index of image being edited

  // OTT Platform states removed

  // Gallery Category states
  const [galleryCategory, setGalleryCategory] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [availableEntities, setAvailableEntities] = useState([]);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [newEntityName, setNewEntityName] = useState('');
  const [nextGalleryNumber, setNextGalleryNumber] = useState(1);

  // Accordion states
  const [accordionStates, setAccordionStates] = useState({
    authorTargeting: true,
    category: true,
    contentType: true,
    seo: false,
    aeo: false,
    faqs: false,
    eeat: false
  });

  const showNotification = (type, title, message) => {
    setNotification({
      isOpen: true,
      type,
      title,
      message
    });
  };

  const closeNotification = () => {
    setNotification({
      isOpen: false,
      type: 'success',
      title: '',
      message: ''
    });
  };

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    // If it's already a full URL (S3), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // If it's a local path, prefix with backend URL
    if (imagePath.startsWith('/uploads/') || imagePath.startsWith('uploads/')) {
      const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
      return `${process.env.REACT_APP_BACKEND_URL}${cleanPath}`;
    }
    // For base64 or other formats, return as is
    return imagePath;
  };

  const handleNotificationClose = () => {
    const shouldClose = notification.type === 'success' && 
                          (notification.title.includes('Created Successfully') || 
                           notification.title.includes('Updated Successfully'));
    
    closeNotification();
    
    // Close the modal after successful create/update operations
    if (shouldClose && onClose) {
      onClose();
    }
  };

  // Separate function to load gallery by ID
  const loadGalleryById = async (galleryId) => {
    try {
      const galleryResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/galleries/by-id/${galleryId}`);
      if (galleryResponse.ok) {
        const gallery = await galleryResponse.json();
        setSelectedGallery(gallery);
      }
    } catch (e) {
      console.error('Error loading gallery:', e);
      setSelectedGallery(null);
    }
  };

  // Load article data for editing
  const loadArticle = async (id) => {
    setLoadingArticle(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/articles/${id}`);
      if (response.ok) {
        const article = await response.json();
        
        // Populate form data
        setFormData({
          title: article.title || '',
          short_title: article.short_title || '',
          content: article.content || '',
          content_secondary: article.content_secondary || '',
          summary: article.summary || '',
          author: article.author || '',
          article_language: article.article_language || 'en',
          states: article.states || 'all',
          category: article.category || '',
          content_type: article.content_type || 'post', // Load content type
          ad_type: article.ad_type || (article.category === 'sponsored-ads' ? 'sponsored_section' : 'ad_post'), // Load or infer ad type
          image: article.image || article.main_image_url || '',
          image_gallery: article.image_gallery ? JSON.parse(article.image_gallery) : [], // Load image gallery safely
          youtube_url: article.youtube_url || '',
          media_type: article.youtube_url ? 'youtube' : 'image', // Infer media type based on what's present
          tags: article.tags || '',
          movie_rating: article.movie_rating || '', // Load movie rating
          is_featured: article.is_featured || false,
          is_published: article.is_published || false,
          is_scheduled: article.is_scheduled || false,
          scheduled_publish_at: article.scheduled_publish_at ? new Date(article.scheduled_publish_at).toISOString().slice(0, 16) : '',
          seo_title: article.seo_title || '',
          seo_description: article.seo_description || '',
          seo_keywords: article.seo_keywords || '',
          // AEO & FAQ fields
          aeo_title: article.aeo_title || '',
          aeo_description: article.aeo_description || '',
          aeo_keywords: article.aeo_keywords || '',
          faqs: article.faqs ? JSON.parse(article.faqs) : [],
          // E-E-A-T fields
          author_credentials: article.author_credentials || '',
          sources: article.sources || '',
          fact_checked_by: article.fact_checked_by || '',
          last_reviewed_date: article.last_reviewed_date || '',
          // Movie Review fields
          review_quick_verdict: article.review_quick_verdict || '',
          review_plot_summary: article.review_plot_summary || '',
          review_performances: article.review_performances || '',
          review_what_works: article.review_what_works || '',
          review_what_doesnt_work: article.review_what_doesnt_work || '',
          review_technical_aspects: article.review_technical_aspects || '',
          review_final_verdict: article.review_final_verdict || '',
          review_cast: article.review_cast || '',
          review_director: article.review_director || '',
          review_producer: article.review_producer || '',
          review_banner: article.review_banner || '',
          review_music_director: article.review_music_director || '',
          review_dop: article.review_dop || '',
          review_editor: article.review_editor || '',
          review_genre: article.review_genre || '',
          review_runtime: article.review_runtime || '',
          movie_language: article.movie_language || '',
          censor_rating: article.censor_rating || '',
          release_date: article.release_date || '',
          platform: article.platform || '',
          ott_content_type: article.ott_content_type || '',
          ott_platforms: (() => {
            try {
              return typeof article.ott_platforms === 'string' 
                ? JSON.parse(article.ott_platforms) 
                : (article.ott_platforms || []);
            } catch {
              return [];
            }
          })(),
          // Comment settings
          comments_enabled: article.comments_enabled !== undefined ? article.comments_enabled : true,
          review_comments_enabled: article.review_comments_enabled !== undefined ? article.review_comments_enabled : true,
          // Top Story flag
          is_top_story: article.is_top_story || false,
          top_story_duration_hours: article.top_story_duration_hours || 24,
          scheduled_timezone: article.scheduled_timezone || 'IST',
          social_media_type: article.social_media_type || '',
          social_media_embed: article.social_media_embed || ''
        });
        
        // Set selected states (multiple selection)
        if (article.states && article.states !== 'all') {
          try {
            const statesArray = JSON.parse(article.states);
            if (Array.isArray(statesArray) && statesArray.length > 0) {
              setSelectedStates(statesArray); // Set all states
            } else {
              setSelectedStates(['all']);
            }
          } catch (e) {
            console.error('Error parsing states:', e);
            setSelectedStates(['all']);
          }
        } else {
          setSelectedStates(['all']);
        }
        
        // Set selected artist (single selection)
        if (article.artists) {
          try {
            const artistsArray = typeof article.artists === 'string' ? JSON.parse(article.artists) : article.artists;
            // Take the first artist if array exists
            setSelectedArtist(artistsArray && artistsArray.length > 0 ? artistsArray[0] : '');
          } catch (e) {
            setSelectedArtist('');
          }
        }

        // Set selected genres
        if (article.review_genre) {
          try {
            const genresArray = typeof article.review_genre === 'string' ? JSON.parse(article.review_genre) : article.review_genre;
            if (Array.isArray(genresArray)) {
              setSelectedGenres(genresArray);
            } else if (typeof article.review_genre === 'string' && article.review_genre) {
              // Handle old format (comma-separated string)
              setSelectedGenres([article.review_genre]);
            }
          } catch (e) {
            // If not JSON, treat as single genre
            if (article.review_genre) {
              setSelectedGenres([article.review_genre]);
            }
          }
        }

        // Set selected languages
        if (article.movie_language) {
          try {
            const languagesArray = typeof article.movie_language === 'string' ? JSON.parse(article.movie_language) : article.movie_language;
            if (Array.isArray(languagesArray)) {
              setSelectedLanguages(languagesArray);
            } else if (typeof article.movie_language === 'string' && article.movie_language) {
              // Handle old format (single string)
              setSelectedLanguages([article.movie_language]);
            }
          } catch (e) {
            // If not JSON, treat as single language
            if (article.movie_language) {
              setSelectedLanguages([article.movie_language]);
            }
          }
        }

        // OTT platforms loading removed
        
        // Load selected gallery if gallery_id exists
        if (article.gallery_id && availableGalleries.length > 0) {
          const gallery = availableGalleries.find(g => g.id === article.gallery_id);
          if (gallery) {
            setSelectedGallery(gallery);
          }
        }
        
        // Load gallery data separately to avoid blocking form load
        if (article.gallery_id && !availableGalleries.find(g => g.id === article.gallery_id)) {
          loadGalleryById(article.gallery_id);
        }
        
        
        // Set editor content
        if (article.content) {
          const contentBlock = htmlToDraft(article.content);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorState(EditorState.createWithContent(contentState));
          }
        }

        // Set secondary editor content
        if (article.content_secondary) {
          const contentBlock = htmlToDraft(article.content_secondary);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorStateSecondary(EditorState.createWithContent(contentState));
          }
        }

        // Load Movie Review Rich Text Editors
        if (article.review_plot_summary) {
          const contentBlock = htmlToDraft(article.review_plot_summary);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorPlotSummary(EditorState.createWithContent(contentState));
          }
        }
        if (article.review_performances) {
          const contentBlock = htmlToDraft(article.review_performances);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorPerformances(EditorState.createWithContent(contentState));
          }
        }
        if (article.review_what_works) {
          const contentBlock = htmlToDraft(article.review_what_works);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorWhatWorks(EditorState.createWithContent(contentState));
          }
        }
        if (article.review_what_doesnt_work) {
          const contentBlock = htmlToDraft(article.review_what_doesnt_work);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorWhatDoesntWork(EditorState.createWithContent(contentState));
          }
        }
        if (article.review_technical_aspects) {
          const contentBlock = htmlToDraft(article.review_technical_aspects);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorTechnicalAspects(EditorState.createWithContent(contentState));
          }
        }
        if (article.review_final_verdict) {
          const contentBlock = htmlToDraft(article.review_final_verdict);
          if (contentBlock) {
            const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
            setEditorFinalVerdict(EditorState.createWithContent(contentState));
          }
        }
        
      } else {
        throw new Error('Failed to load article');
      }
    } catch (error) {
      console.error('Error loading article:', error);
      showNotification('error', 'Error Loading Article', 'Failed to load article data. Please try again.');
    } finally {
      setLoadingArticle(false);
    }
  };

  useEffect(() => {
    fetchCMSConfig();
    fetchAvailableArtists(); // Fetch available artists
    fetchGalleries(); // Fetch available galleries
    
    if (isEditMode && id) {
      loadArticle(id);
    } else {
      // Check if we're returning from preview (draft data exists in localStorage)
      const draftData = localStorage.getItem('articleDraft');
      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          
          // Restore form data
          setFormData(draft.formData);
          
          // Restore selected states
          if (draft.selectedStates) {
            setSelectedStates(draft.selectedStates);
          }
          
          // Restore selected artist
          if (draft.selectedArtist) {
            setSelectedArtist(draft.selectedArtist);
          }
          
          // Restore selected gallery
          if (draft.selectedGallery) {
            setSelectedGallery(draft.selectedGallery);
          }
          
          // Restore editor content
          if (draft.formData.content) {
            const contentBlock = htmlToDraft(draft.formData.content);
            if (contentBlock) {
              const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
              setEditorState(EditorState.createWithContent(contentState));
            }
          }

          // Restore secondary editor content
          if (draft.formData.content_secondary) {
            const contentBlock = htmlToDraft(draft.formData.content_secondary);
            if (contentBlock) {
              const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
              setEditorStateSecondary(EditorState.createWithContent(contentState));
            }
          }
          
          // Clear the draft from localStorage after restoring
          localStorage.removeItem('articleDraft');
          
          // Show notification that draft was restored
          showNotification('success', 'Draft Restored', 'Your unsaved changes have been restored.');
          
          console.log('Draft data restored from localStorage');
        } catch (error) {
          console.error('Error restoring draft data:', error);
          localStorage.removeItem('articleDraft');
        }
      }
    }
  }, [isEditMode, id]);

  // Auto-save draft data every 30 seconds for new articles
  useEffect(() => {
    if (!isEditMode && formData.title) {
      const autoSaveInterval = setInterval(() => {
        const draftData = {
          formData: formData,
          selectedStates: selectedStates,
          selectedArtist: selectedArtist,
          selectedGallery: selectedGallery
        };
        localStorage.setItem('articleDraft', JSON.stringify(draftData));
        console.log('Draft auto-saved');
      }, 30000); // Save every 30 seconds

      return () => clearInterval(autoSaveInterval);
    }
  }, [formData, selectedStates, selectedArtist, selectedGallery, isEditMode]);

  const fetchCMSConfig = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/config`);
      const data = await response.json();
      setLanguages(data.languages);
      setStates(data.states); // Now uses updated backend states
      
      // Fetch all regular categories (same as Create Article form)
      const categoriesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/categories`);
      const categoriesData = await categoriesResponse.json();
      
      // Filter out sponsored-ads and landing page categories (managed by ad_type field)
      const regularCategories = categoriesData.filter(cat => 
        cat.slug !== 'sponsored-ads' && 
        cat.slug !== 'sponsored-post' && 
        cat.slug !== 'landing-page-ad' &&
        cat.slug !== 'latest-news'
      );
      
      setCategories(regularCategories);
      // No default category - user must select one
    } catch (error) {
      console.error('Error fetching CMS config:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Reset OTT platforms when content type changes
    if (name === 'content_type') {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
        ott_platforms: [] // Clear OTT platforms when content type changes
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const onEditorStateChange = (editorState) => {
    setEditorState(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({
      ...prev,
      content: htmlContent
    }));
  };

  const onEditorStateChangeSecondary = (editorState) => {
    setEditorStateSecondary(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({
      ...prev,
      content_secondary: htmlContent
    }));
  };

  // Movie Review Editor Handlers
  const onEditorPlotSummaryChange = (editorState) => {
    setEditorPlotSummary(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({ ...prev, review_plot_summary: htmlContent }));
  };

  const onEditorPerformancesChange = (editorState) => {
    setEditorPerformances(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({ ...prev, review_performances: htmlContent }));
  };

  const onEditorWhatWorksChange = (editorState) => {
    setEditorWhatWorks(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({ ...prev, review_what_works: htmlContent }));
  };

  const onEditorWhatDoesntWorkChange = (editorState) => {
    setEditorWhatDoesntWork(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({ ...prev, review_what_doesnt_work: htmlContent }));
  };

  const onEditorTechnicalAspectsChange = (editorState) => {
    setEditorTechnicalAspects(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({ ...prev, review_technical_aspects: htmlContent }));
  };

  const onEditorFinalVerdictChange = (editorState) => {
    setEditorFinalVerdict(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({ ...prev, review_final_verdict: htmlContent }));
  };

  const toggleReviewAccordion = (key) => {
    setReviewAccordions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Genre handlers
  const handleAddGenre = () => {
    if (tempGenre && !selectedGenres.includes(tempGenre)) {
      const newGenres = [...selectedGenres, tempGenre];
      setSelectedGenres(newGenres);
      setFormData(prev => ({ ...prev, review_genre: JSON.stringify(newGenres) }));
      setTempGenre('');
    }
  };

  const handleRemoveGenre = (genreToRemove) => {
    const newGenres = selectedGenres.filter(g => g !== genreToRemove);
    setSelectedGenres(newGenres);
    setFormData(prev => ({ ...prev, review_genre: JSON.stringify(newGenres) }));
  };

  // Language handlers
  const handleAddLanguage = () => {
    if (tempLanguage && !selectedLanguages.includes(tempLanguage)) {
      const newLanguages = [...selectedLanguages, tempLanguage];
      setSelectedLanguages(newLanguages);
      setFormData(prev => ({ ...prev, movie_language: JSON.stringify(newLanguages) }));
      setTempLanguage('');
    }
  };

  const handleRemoveLanguage = (languageToRemove) => {
    const newLanguages = selectedLanguages.filter(l => l !== languageToRemove);
    setSelectedLanguages(newLanguages);
    setFormData(prev => ({ ...prev, movie_language: JSON.stringify(newLanguages) }));
  };

  // OTT Platform handlers removed

  const handleAddState = () => {
    // Don't add if already selected or if trying to add 'all' when other states exist
    if (selectedState === 'all') {
      // If adding 'all', clear all other states
      setSelectedStates(['all']);
      return;
    }
    
    if (!selectedStates.includes(selectedState)) {
      // Remove 'all' if adding a specific state
      const newStates = selectedStates.filter(s => s !== 'all');
      setSelectedStates([...newStates, selectedState]);
    }
  };

  const handleRemoveState = (stateCode) => {
    const newStates = selectedStates.filter(s => s !== stateCode);
    // If no states left, default to 'all'
    setSelectedStates(newStates.length === 0 ? ['all'] : newStates);
  };


  // Upload callback for rich text editor images
  const uploadImageCallback = async (file) => {
    return new Promise(async (resolve, reject) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('content_type', 'articles');
        
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/upload-image`, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          resolve({ data: { link: data.url } });
        } else {
          reject('Upload failed');
        }
      } catch (error) {
        console.error('Editor image upload error:', error);
        reject(error);
      }
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setLoading(true);
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload to backend
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/upload-image`, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Update form with the returned URL (with cache-busting timestamp)
          setFormData(prev => ({
            ...prev,
            image: `${data.url}?t=${Date.now()}`
          }));
          
          // Reset the file input
          e.target.value = '';
          
          showNotification('success', 'Image Uploaded', 
            `Image uploaded successfully using ${data.storage === 's3' ? 'AWS S3' : 'local storage'}`);
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Image upload error:', error);
        showNotification('error', 'Upload Failed', 'Failed to upload image. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle gallery image upload with folder structure
  const handleGalleryImageUpload = async (file) => {
    if (!file || !galleryCategory || !selectedEntity) {
      showNotification('error', 'Missing Information', 'Please select gallery type and entity first');
      return null;
    }

    try {
      setLoading(true);
      
      // Create folder path: {category_type}/{entity_folder_name}/{gallery_number}
      const entityFolderName = selectedEntity.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      const folderPath = `${galleryCategory.toLowerCase()}/${entityFolderName}/${nextGalleryNumber}`;
      
      // Create FormData for file upload
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('content_type', 'galleries');
      uploadFormData.append('folder_path', folderPath);
      
      // Upload to backend
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/upload-image`, {
        method: 'POST',
        body: uploadFormData
      });
      
      if (response.ok) {
        const data = await response.json();
        showNotification('success', 'Image Uploaded', 'Image uploaded successfully');
        return data.url;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Gallery image upload error:', error);
      showNotification('error', 'Upload Failed', 'Failed to upload image. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePublishChange = (e) => {
    const isChecked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      is_published: isChecked,
      is_scheduled: isChecked ? false : prev.is_scheduled, // Clear scheduling if publishing immediately
      scheduled_publish_at: isChecked ? '' : prev.scheduled_publish_at
    }));
  };

  const handleScheduleChange = (e) => {
    const isChecked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      is_scheduled: isChecked,
      is_published: isChecked ? false : prev.is_published, // Clear immediate publish if scheduling
      scheduled_publish_at: isChecked ? prev.scheduled_publish_at : ''
    }));
  };

  // Artist management functions
  const fetchAvailableArtists = async () => {
    try {
      // Fetch artists from the dedicated artists API
      const artistsResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/artists`);
      if (artistsResponse.ok) {
        const artists = await artistsResponse.json();
        // Extract just the names from the artist objects
        const artistNames = artists.map(artist => artist.name);
        setAvailableArtists(artistNames);
      } else {
        console.error('Failed to fetch artists');
        setAvailableArtists([]);
      }
    } catch (error) {
      console.error('Error fetching artists:', error);
      setAvailableArtists([]);
    }
  };

  // Fetch available galleries
  const fetchGalleries = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/galleries`);
      if (response.ok) {
        const galleries = await response.json();
        setAvailableGalleries(galleries);
      }
    } catch (error) {
      console.error('Error fetching galleries:', error);
    }
  };

  // Gallery Category handlers
  const fetchGalleryEntities = async (categoryType) => {
    if (!categoryType) return;
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/cms/gallery-entities/${categoryType.toLowerCase()}`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableEntities(data.entities || []);
      }
    } catch (error) {
      console.error('Error fetching entities:', error);
    }
  };

  const handleGalleryCategoryChange = (category) => {
    setGalleryCategory(category);
    setSelectedEntity('');
    setNextGalleryNumber(1);
    if (category) {
      fetchGalleryEntities(category);
    } else {
      setAvailableEntities([]);
    }
  };

  const handleEntitySelection = async (entityName) => {
    setSelectedEntity(entityName);
    
    if (entityName && galleryCategory) {
      // Fetch next gallery number for this entity
      try {
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/cms/gallery-next-number/${galleryCategory}/${entityName}`
        );
        if (response.ok) {
          const data = await response.json();
          setNextGalleryNumber(data.next_number);
        }
      } catch (error) {
        console.error('Error fetching next gallery number:', error);
      }
    }
  };

  const handleAddEntity = async () => {
    if (!newEntityName.trim() || !galleryCategory) return;
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/cms/gallery-entities/${galleryCategory.toLowerCase()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newEntityName.trim() })
        }
      );
      
      if (response.ok) {
        await fetchGalleryEntities(galleryCategory);
        setNewEntityName('');
        setShowEntityModal(false);
        showNotification('success', 'Added', `${galleryCategory} added successfully`);
      } else {
        const data = await response.json();
        showNotification('error', 'Error', data.detail || 'Failed to add entity');
      }
    } catch (error) {
      console.error('Error adding entity:', error);
      showNotification('error', 'Error', 'Failed to add entity');
    }
  };

  // Gallery selection handlers
  const handleGallerySelect = (gallery) => {
    setSelectedGallery(gallery);
    setShowGalleryModal(false);
    setGallerySearchTerm('');
  };

  const handleGalleryRemove = () => {
    setSelectedGallery(null);
  };

  // Image gallery management handlers
  const handleAddImageToGallery = (e, uploadedUrl = null) => {
    const urlToAdd = uploadedUrl || newImageUrl.trim();
    if (urlToAdd) {
      const newImage = {
        id: Date.now(), // Simple ID for the image
        url: urlToAdd,
        alt: `Gallery image ${formData.image_gallery.length + 1}`
      };
      setFormData(prev => ({
        ...prev,
        image_gallery: [...prev.image_gallery, newImage]
      }));
      if (!uploadedUrl) {
        setNewImageUrl('');
      }
    }
  };

  const handleRemoveImageFromGallery = (index) => {
    setFormData(prev => ({
      ...prev,
      image_gallery: prev.image_gallery.filter((_, i) => i !== index)
    }));
  };

  const handleEditImage = (index, newUrl) => {
    if (newUrl.trim()) {
      setFormData(prev => ({
        ...prev,
        image_gallery: prev.image_gallery.map((img, i) => 
          i === index ? { ...img, url: newUrl.trim() } : img
        )
      }));
    }
    setEditingImageIndex(null);
  };

  const handleMoveImageUp = (index) => {
    if (index > 0) {
      setFormData(prev => {
        const newGallery = [...prev.image_gallery];
        [newGallery[index - 1], newGallery[index]] = [newGallery[index], newGallery[index - 1]];
        return { ...prev, image_gallery: newGallery };
      });
    }
  };

  const handleMoveImageDown = (index) => {
    if (index < formData.image_gallery.length - 1) {
      setFormData(prev => {
        const newGallery = [...prev.image_gallery];
        [newGallery[index], newGallery[index + 1]] = [newGallery[index + 1], newGallery[index]];
        return { ...prev, image_gallery: newGallery };
      });
    }
  };

  // Filter galleries based on search term
  const filteredGalleries = availableGalleries
    .filter(gallery =>
      gallery.title.toLowerCase().includes(gallerySearchTerm.toLowerCase())
    )
    .sort((a, b) => a.title.localeCompare(b.title));

  // Accordion toggle function
  const toggleAccordion = (section) => {
    setAccordionStates(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleAddArtist = () => {
    if (newArtistName.trim()) {
      const newArtist = newArtistName.trim();
      
      // Add to available artists list if not already present
      if (!availableArtists.includes(newArtist)) {
        setAvailableArtists(prev => [...prev, newArtist]);
      }
      
      // Set as selected artist
      setSelectedArtist(newArtist);
      
      // Clear form and close modal
      setNewArtistName('');
      setShowArtistModal(false);
    }
  };

  const handleSelectArtist = (artistName) => {
    setSelectedArtist(artistName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation for photo gallery content type
      if (formData.content_type === 'photo' && !selectedGallery) {
        showNotification(
          'error',
          'Gallery Required',
          'Please select an image gallery for Photo Gallery content type.'
        );
        setLoading(false);
        return;
      }

      // Validation for video post content type
      if (formData.content_type === 'video_post' && !formData.youtube_url) {
        showNotification(
          'error',
          'YouTube URL Required',
          'Please provide a YouTube URL for Video Post content type.'
        );
        setLoading(false);
        return;
      }

      // Strip HTML tags for summary creation
      const textContent = formData.content.replace(/<[^>]*>/g, '');
      
      // Clean image URL by removing cache-busting timestamp
      const cleanImageUrl = formData.image ? formData.image.split('?t=')[0] : '';
      
      const submitData = {
        ...formData,
        image: cleanImageUrl, // Use clean URL without timestamp
        article_language: formData.article_language || 'en', // Use backend field name
        summary: textContent.substring(0, 200) + '...', // Generate summary from content
        states: JSON.stringify(selectedStates), // Convert states array to JSON string
        artists: JSON.stringify(selectedArtist ? [selectedArtist] : []), // Include selected artist as array
        image_gallery: JSON.stringify(formData.image_gallery), // Include image gallery as JSON string
        gallery_id: selectedGallery ? selectedGallery.id : null, // Include selected gallery ID
        seo_title: formData.seo_title || formData.title,
        seo_description: formData.seo_description || textContent.substring(0, 160) + '...',
        faqs: JSON.stringify(formData.faqs), // Convert FAQs array to JSON string
        ott_platforms: JSON.stringify(formData.ott_platforms || []), // Convert OTT platforms array to JSON string
        // Handle scheduling data
        scheduled_publish_at: formData.is_scheduled && formData.scheduled_publish_at 
          ? new Date(formData.scheduled_publish_at).toISOString() 
          : null
      };

      const url = isEditMode 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/cms/articles/${id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/cms/articles`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const result = await response.json();
        
        let statusText = 'saved as draft';
        if (formData.is_scheduled) {
          statusText = `scheduled for ${new Date(formData.scheduled_publish_at).toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })} IST`;
        } else if (formData.is_published) {
          statusText = 'published';
        }
        
        // Clear draft data on successful submission
        localStorage.removeItem('articleDraft');
        localStorage.removeItem('previewArticle');
        
        showNotification(
          'success',
          isEditMode ? 'Post Updated Successfully!' : 'Post Created Successfully!',
          `Your post "${formData.title}" has been ${isEditMode ? 'updated' : 'created'} and ${statusText}.`
        );
      } else {
        // Handle different error status codes
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {};
        }
        
        // Extract error message
        let errorMessage = `Failed to ${isEditMode ? 'update' : 'create'} article`;
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail)) {
            // Pydantic validation errors
            errorMessage = errorData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join(', ');
          }
        }
        
        if (response.status === 409) {
          throw new Error(errorData.detail || 'An article with this title already exists');
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} article:`, error);
      
      // Extract error message safely
      let errorMessage = `There was an error ${isEditMode ? 'updating' : 'creating'} your post. Please check your connection and try again.`;
      if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      showNotification(
        'error',
        `Error ${isEditMode ? 'Updating' : 'Creating'} Post`,
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (id && id !== 'new') {
      // For existing articles, redirect to actual article page
      const slug = formData.slug || formData.title?.toLowerCase().replace(/\s+/g, '-');
      navigate(`/article/${id}/${slug}?preview=true`);
    } else {
      // For new articles, store ALL form data in localStorage for restoration
      const draftData = {
        formData: formData,
        selectedStates: selectedStates,
        selectedArtist: selectedArtist,
        selectedGallery: selectedGallery
      };
      
      // Save draft for restoration when user returns
      localStorage.setItem('articleDraft', JSON.stringify(draftData));
      
      // Store preview data for preview page
      localStorage.setItem('previewArticle', JSON.stringify({
        ...formData,
        states: selectedStates // Use states array directly for preview compatibility
      }));
      
      navigate('/cms/preview/new');
    }
  };

  const handleTranslate = () => {
    alert('Translation feature will be implemented with Google Translate API integration');
  };

  const handleUnpublish = async () => {
    if (!id || id === 'new') return;
    
    const action = formData.is_published ? 'unpublish' : 'publish';
    const confirmMessage = `Are you sure you want to ${action} this article?`;
    
    if (!window.confirm(confirmMessage)) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/articles/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_published: !formData.is_published
        })
      });

      if (response.ok) {
        setFormData(prev => ({ ...prev, is_published: !prev.is_published }));
        showNotification(`Article ${action}ed successfully!`, 'success');
      } else {
        throw new Error(`Failed to ${action} article`);
      }
    } catch (error) {
      console.error(`Error ${action}ing article:`, error);
      showNotification(`Failed to ${action} article. Please try again.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>
        {`
          .wrapper-class {
            border: 1px solid #d1d5db;
            border-radius: 0.375rem;
          }
          .toolbar-class {
            border: none;
            border-bottom: 1px solid #d1d5db;
            border-radius: 0.375rem 0.375rem 0 0;
            background: #f9fafb;
            padding: 8px;
          }
          .editor-class {
            min-height: 300px;
            padding: 12px;
            font-size: 14px;
            border: none;
            border-radius: 0 0 0.375rem 0.375rem;
            background: white;
          }
          .editor-class:focus {
            outline: none;
          }
          .rdw-option-wrapper {
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            margin: 0 2px;
            background: white;
          }
          .rdw-option-wrapper:hover {
            background: #f3f4f6;
          }
          .rdw-option-active {
            background: #3b82f6;
            color: white;
          }
          .rdw-dropdown-wrapper {
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
            background: white;
          }
          .rdw-dropdown-optionwrapper {
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 0.25rem;
          }
        `}
      </style>
      <div className="min-h-screen bg-gray-50 pt-0 pb-4">
        <div className="max-w-5xl-plus mx-auto px-8">
          {/* Sticky Header - Same pattern as Latest News */}
          <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-2`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
            <div className="pl-0 pr-4 py-3">
              <div className="flex items-center justify-between">
                <h1 className="text-base font-bold text-black text-left leading-tight">
                  {isEditMode ? 'Edit Ad' : 'New Ad'}
                </h1>
                {/* Close Button */}
                <button
                  onClick={onClose}
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center pt-[7px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Status text */}
              <div className="flex items-center mt-1">
                <p className="text-xs text-gray-900 opacity-75 flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  {isEditMode ? 'Editing ad' : 'Creating ad'}
                </p>
              </div>
            </div>
          </div>

        {/* Form */}
        {loadingArticle ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading article data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Form Content */}
            <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Author, Language, State Targeting - Accordion */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('authorTargeting')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">Author & Targeting</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.authorTargeting ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.authorTargeting && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Author *
                    </label>
                    <select
                      name="author"
                      value={formData.author}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="Admin">Admin</option>
                      <option value="AI">AI</option>
                      <option value="Tadka Team">Tadka Team</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Article Language *
                    </label>
                    <select
                      name="article_language"
                      value={formData.article_language}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {languages
                        .sort((a, b) => a.native_name.localeCompare(b.native_name))
                        .map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.native_name} ({lang.name})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-left">Target States</label>
                    
                    {/* Display Selected State */}
                    {selectedStates.length > 0 && selectedStates[0] && (
                      <div className="mb-2 text-left">
                        <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-blue-100 text-blue-800">
                          {states.find(s => s.code === selectedStates[0])?.name || selectedStates[0]}
                        </span>
                      </div>
                    )}
                    
                    {/* Searchable Input for Single State Selection */}
                    <div className="relative">
                      <input
                        type="text"
                        value={stateSearchQuery}
                        onChange={(e) => {
                          setStateSearchQuery(e.target.value);
                          setShowStateDropdown(true);
                        }}
                        onFocus={() => {
                          setStateSearchQuery('');
                          setShowStateDropdown(true);
                        }}
                        onBlur={() => {
                          // Small delay to allow click on dropdown items
                          setTimeout(() => {
                            setStateSearchQuery('');
                            setShowStateDropdown(false);
                          }, 200);
                        }}
                        placeholder="Search..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                      {showStateDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => {
                              setShowStateDropdown(false);
                              setStateSearchQuery('');
                            }}
                          />
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto text-left">
                            {/* All States and Individual States */}
                            {states
                              .filter(state => state.name.toLowerCase().includes(stateSearchQuery.toLowerCase()))
                              .sort((a, b) => {
                                // Keep 'all' at the top, then sort alphabetically
                                if (a.code === 'all') return -1;
                                if (b.code === 'all') return 1;
                                return a.name.localeCompare(b.name);
                              })
                              .map(state => (
                                <div
                                  key={state.code}
                                  onClick={() => {
                                    setSelectedStates([state.code]);
                                    setStateSearchQuery('');
                                    setShowStateDropdown(false);
                                  }}
                                  className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-left text-gray-900"
                                >
                                  {state.name}
                                </div>
                              ))}
                            {states.filter(state => state.name.toLowerCase().includes(stateSearchQuery.toLowerCase())).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500 text-left">No states found</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Category & Content Type - Accordion */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('category')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">Category & Content Type</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.category ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.category && (
                <div className="p-6 space-y-4">
                  {/* Ad Type Selection */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Ad Type *
                    </label>
                    <select
                      name="ad_type"
                      value={formData.ad_type}
                      onChange={(e) => {
                        const newAdType = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          ad_type: newAdType,
                          // Auto-set category based on ad type
                          category: newAdType === 'sponsored_section' 
                            ? 'sponsored-ads' 
                            : (newAdType === 'landing_home' || newAdType === 'landing_inner') 
                              ? 'landing-page' 
                              : prev.category
                        }));
                      }}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="sponsored_section">Ad in Sponsored Section</option>
                      <option value="ad_post">Ad Post</option>
                      <option value="landing_home">Landing Page - Home Page</option>
                      <option value="landing_inner">Landing Page - Inner Pages</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.ad_type === 'sponsored_section' && 'This ad will appear in the Sponsored Ads section of the home page'}
                      {formData.ad_type === 'ad_post' && 'This ad will appear as a regular post in the selected category'}
                      {formData.ad_type === 'landing_home' && 'Landing page functionality - Coming soon'}
                      {formData.ad_type === 'landing_inner' && 'Landing page functionality - Coming soon'}
                    </p>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Category *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={
                          formData.ad_type === 'sponsored_section' 
                            ? 'Sponsored Ad' 
                            : (formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner')
                              ? 'Landing Page'
                              : (showCategoryDropdown ? categorySearchQuery : (formData.category ? categories.find(cat => cat.slug === formData.category)?.name : ''))
                        }
                        onChange={(e) => {
                          const isLocked = formData.ad_type === 'sponsored_section' || formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner';
                          if (!isLocked) {
                            setCategorySearchQuery(e.target.value);
                            setShowCategoryDropdown(true);
                          }
                        }}
                        onFocus={() => {
                          const isLocked = formData.ad_type === 'sponsored_section' || formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner';
                          if (!isLocked) {
                            setCategorySearchQuery('');
                            setShowCategoryDropdown(true);
                          }
                        }}
                        onBlur={() => {
                          // Small delay to allow click on dropdown items
                          setTimeout(() => {
                            setCategorySearchQuery('');
                          }, 200);
                        }}
                        placeholder={
                          (formData.ad_type === 'sponsored_section' || formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner') 
                            ? '' 
                            : 'Search...'
                        }
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                        required
                        disabled={formData.ad_type === 'sponsored_section' || formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner'}
                        style={
                          (formData.ad_type === 'sponsored_section' || formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner')
                            ? { backgroundColor: '#f3f4f6', cursor: 'not-allowed' } 
                            : {}
                        }
                      />
                      {showCategoryDropdown && formData.ad_type !== 'sponsored_section' && formData.ad_type !== 'landing_home' && formData.ad_type !== 'landing_inner' && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => {
                              setShowCategoryDropdown(false);
                              setCategorySearchQuery('');
                            }}
                          />
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto text-left">
                            {categories
                              .filter(cat => 
                                cat.slug !== 'latest-news' && 
                                cat.slug !== 'sponsored-ads' &&
                                cat.name.toLowerCase() !== 'latest news' &&
                                cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                              )
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map(cat => (
                                <div
                                  key={cat.slug}
                                  onClick={() => {
                                    handleInputChange({ target: { name: 'category', value: cat.slug } });
                                    setCategorySearchQuery('');
                                    setShowCategoryDropdown(false);
                                  }}
                                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-left ${
                                    formData.category === cat.slug ? 'bg-blue-100 text-blue-800' : 'text-gray-900'
                                  }`}
                                >
                                  {cat.name}
                                </div>
                              ))}
                            {categories.filter(cat => 
                              cat.slug !== 'latest-news' && 
                              cat.slug !== 'sponsored-ads' &&
                              cat.name.toLowerCase() !== 'latest news' &&
                              cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                            ).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500 text-left">No categories found</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Content Type *
                    </label>
                    <select
                      name="content_type"
                      value={formData.content_type}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="photo">Photo Gallery</option>
                      <option value="post">Post</option>
                      <option value="video">Video</option>
                      <option value="video_post">Video Post</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Content Details - Accordion */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('contentType')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">Content Details</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.contentType ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.contentType && (
                <div className="p-6">
                  
                  {/* POST Type Fields - Two Column Layout */}
                  {formData.content_type === 'post' && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-4">
                      {/* Left Column: Title and Media Selection (60% = 3 cols) */}
                      <div className="space-y-4 md:col-span-3">
                        {/* Title Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Title *
                          </label>
                          <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Media Type Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Main Media Type *
                          </label>
                          <select
                            name="media_type"
                            value={formData.media_type}
                            onChange={(e) => {
                              setFormData(prev => ({
                                ...prev,
                                media_type: e.target.value,
                                // Clear the other field when switching
                                image: e.target.value === 'youtube' ? '' : prev.image,
                                youtube_url: e.target.value === 'image' ? '' : prev.youtube_url
                              }));
                            }}
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="image">Image</option>
                            <option value="youtube">YouTube Video</option>
                          </select>
                        </div>

                        {/* Main Image Upload - Only show if media_type is 'image' */}
                        {formData.media_type === 'image' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                              Main Image
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        {/* YouTube URL - Only show if media_type is 'youtube' */}
                        {formData.media_type === 'youtube' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                              YouTube URL
                            </label>
                            <input
                              type="url"
                              name="youtube_url"
                              value={formData.youtube_url}
                              onChange={handleInputChange}
                              placeholder="https://www.youtube.com/watch?v=..."
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Right Column: Media Preview (40% = 2 cols) */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          {formData.media_type === 'image' ? 'Image Preview' : 'Video Preview'}
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center" style={{ minHeight: '200px' }}>
                          {formData.media_type === 'image' ? (
                            // Image Preview
                            formData.image ? (
                              <img 
                                src={getImageUrl(formData.image)} 
                                alt="Preview" 
                                className="max-w-full max-h-full object-contain rounded"
                              />
                            ) : (
                              <div className="text-center p-4">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">No image uploaded</p>
                              </div>
                            )
                          ) : (
                            // YouTube Video Preview
                            formData.youtube_url ? (
                              <iframe
                                width="100%"
                                height="200"
                                src={formData.youtube_url.replace('watch?v=', 'embed/').split('&')[0]}
                                title="YouTube video preview"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="rounded"
                              ></iframe>
                            ) : (
                              <div className="text-center p-4">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-500">No video URL entered</p>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VIDEO POST Type Fields - Similar to POST but with YouTube URL */}
                  {formData.content_type === 'video_post' && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-4">
                      {/* Left Column: Title and YouTube URL (60% = 3 cols) */}
                      <div className="space-y-4 md:col-span-3">
                        {/* Title Field */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Title *
                          </label>
                          <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* YouTube Video URL */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            YouTube Video URL *
                          </label>
                          <input
                            type="url"
                            name="youtube_url"
                            value={formData.youtube_url}
                            onChange={handleInputChange}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                          <p className="text-xs text-gray-600 mt-1 text-left">
                            This will be used as the thumbnail and video player
                          </p>
                        </div>
                      </div>

                      {/* Right Column: Video Preview (40% = 2 cols) */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Video Preview
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center" style={{ minHeight: '200px' }}>
                          {formData.youtube_url ? (
                            <div className="w-full p-2">
                              <iframe
                                src={formData.youtube_url.replace('watch?v=', 'embed/').split('&')[0]}
                                className="w-full rounded"
                                style={{ height: '180px' }}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="YouTube Video Preview"
                              />
                            </div>
                          ) : (
                            <div className="text-center p-4">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                              </svg>
                              <p className="mt-2 text-sm text-gray-500">No video URL</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Non-POST, Non-VIDEO-POST and Non-MOVIE-REVIEW Type: Title Only (No Image) */}
                  {formData.content_type !== 'post' && formData.content_type !== 'video_post' && formData.content_type !== 'movie_review' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}

                  {/* PHOTO GALLERY Type Fields */}
                  {formData.content_type === 'photo' && (
                    <div className="space-y-4 mb-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Image Gallery
                        </label>
                        <div className="w-full">
                          {selectedGallery ? (
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <span className="text-sm text-blue-800">{selectedGallery.title}</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowGalleryModal(true)}
                                  className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors duration-200"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={handleGalleryRemove}
                                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors duration-200"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setShowGalleryModal(true)}
                              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors duration-200"
                            >
                              Select Image Gallery
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Image Gallery Management - Hidden for data compatibility */}
                      <div style={{display: 'none'}}>
                        {formData.image_gallery.length > 0 && (
                          <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-2">
                            {formData.image_gallery.map((image, index) => (
                              <div key={image.id || index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                                {/* Image preview */}
                                <img
                                  src={image.url}
                                  alt={image.alt || `Gallery image ${index + 1}`}
                                  className="w-16 h-16 object-cover rounded border"
                                  onError={(e) => {
                                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMSAyMUgyMVYyM0gyM1YyMUgyMVpNNDMgNDNWNDFINDFWNDNINDNaTTQxIDIxVjIzSDQzVjIxSDQxWk0yMSA0M1Y0MUgyM1Y0M0gyMVoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
                                  }}
                                />
                                
                                {/* Image URL (editable) */}
                                <div className="flex-1 min-w-0">
                                  {editingImageIndex === index ? (
                                    <div className="flex gap-1">
                                      <input
                                        type="url"
                                        defaultValue={image.url}
                                        onBlur={(e) => handleEditImage(index, e.target.value)}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            handleEditImage(index, e.target.value);
                                          }
                                        }}
                                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        autoFocus
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => setEditingImageIndex(index)}
                                      className="text-xs text-gray-600 truncate cursor-pointer hover:text-blue-600 p-1 rounded hover:bg-gray-100"
                                      title={image.url}
                                    >
                                      {image.url}
                                    </div>
                                  )}
                                </div>

                                {/* Control buttons */}
                                <div className="flex gap-1">
                                  {/* Move up */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveImageUp(index)}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 14l5-5 5 5" />
                                    </svg>
                                  </button>
                                  
                                  {/* Move down */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveImageDown(index)}
                                    disabled={index === formData.image_gallery.length - 1}
                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 10l-5 5-5-5" />
                                    </svg>
                                  </button>
                                  
                                  {/* Remove */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImageFromGallery(index)}
                                    className="p-1 text-red-400 hover:text-red-600"
                                    title="Remove image"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* VIDEO POST Type Fields */}
                  {formData.content_type === 'video_post' && (
                    <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-5 mb-6">
                      <h4 className="text-base font-bold text-gray-900 mb-4 text-left">
                        Video Information
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column - Form Fields */}
                        <div className="space-y-4">
                          {/* Title Field */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                              Title *
                            </label>
                            <input
                              type="text"
                              name="title"
                              value={formData.title}
                              onChange={handleInputChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          {/* YouTube URL */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                              YouTube Video URL *
                            </label>
                            <input
                              type="url"
                              name="youtube_url"
                              value={formData.youtube_url}
                              onChange={handleInputChange}
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="https://www.youtube.com/watch?v=..."
                              required
                            />
                          </div>
                        </div>
                        
                        {/* Right Column - Preview */}
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            YouTube Preview
                          </label>
                          <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                            {formData.youtube_url ? (
                              <img
                                src={`https://img.youtube.com/vi/${formData.youtube_url.split('v=')[1]?.split('&')[0] || formData.youtube_url.split('/').pop()}/maxresdefault.jpg`}
                                alt="YouTube Preview"
                                className="w-full h-auto"
                                onError={(e) => {
                                  e.target.src = `https://img.youtube.com/vi/${formData.youtube_url.split('v=')[1]?.split('&')[0] || formData.youtube_url.split('/').pop()}/hqdefault.jpg`;
                                }}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-48 text-gray-400">
                                <div className="text-center">
                                  <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <p className="text-sm">Enter YouTube URL to see preview</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MOVIE REVIEW Type Fields */}
                  {formData.content_type === 'movie_review' && (
                    <>
                      {/* Section 1: Basic Info - Two Column Layout */}
                      <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-5 mb-6">
                        <h4 className="text-base font-bold text-gray-900 mb-4 text-left">
                          Basic Information
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left Column (50%) */}
                          <div className="space-y-4">
                            {/* Title Field */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Title *
                              </label>
                              <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>

                            {/* YouTube Trailer Link */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                YouTube Trailer Link *
                              </label>
                              <input
                                type="url"
                                name="youtube_url"
                                value={formData.youtube_url}
                                onChange={handleInputChange}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              />
                            </div>

                            {/* Rating (Stars) - Styled like checkbox section */}
                            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-all">
                              <label className="block text-sm font-semibold text-gray-800 mb-2 text-left">
                                Rating (Stars) *
                              </label>
                              <select
                                name="movie_rating"
                                value={formData.movie_rating}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                required
                              >
                                <option value="">Select Rating</option>
                                {Array.from({length: 21}, (_, i) => i * 0.25).map(rating => (
                                  <option key={rating} value={rating.toFixed(2)}>
                                    {rating === 0 ? 'Not Rated' : `${rating.toFixed(2)} Stars`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Right Column: Main Image (50%) */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                              Main Image
                            </label>
                            <div className="rounded-lg bg-black flex items-center justify-center overflow-hidden" style={{ minHeight: '320px' }}>
                              {formData.youtube_url ? (
                                <img
                                  src={`https://img.youtube.com/vi/${formData.youtube_url.split('v=')[1]?.split('&')[0] || formData.youtube_url.split('/').pop()}/maxresdefault.jpg`}
                                  alt="YouTube Thumbnail"
                                  className="max-w-full max-h-full object-contain"
                                  style={{ maxHeight: '320px' }}
                                  onError={(e) => {
                                    // Fallback to hqdefault if maxresdefault doesn't exist
                                    e.target.src = `https://img.youtube.com/vi/${formData.youtube_url.split('v=')[1]?.split('&')[0] || formData.youtube_url.split('/').pop()}/hqdefault.jpg`;
                                  }}
                                />
                              ) : (
                                <div className="text-center p-4">
                                  <p className="mt-2 text-sm text-gray-400">No trailer URL provided</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Movie Information */}
                      <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-5 mb-6">
                        <h4 className="text-base font-bold text-gray-900 mb-4 text-left">
                          Movie Information
                        </h4>
                        
                        <div className="space-y-4">
                          {/* Row 1: Director and Producer */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Director
                              </label>
                              <input
                                type="text"
                                name="review_director"
                                value={formData.review_director}
                                onChange={handleInputChange}
                                placeholder="Director name"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Producer
                              </label>
                              <input
                                type="text"
                                name="review_producer"
                                value={formData.review_producer || ''}
                                onChange={handleInputChange}
                                placeholder="Producer name"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Row 2: Banner and Music Director */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Banner (Production House)
                              </label>
                              <input
                                type="text"
                                name="review_banner"
                                value={formData.review_banner || ''}
                                onChange={handleInputChange}
                                placeholder="Production house name"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Music Director
                              </label>
                              <input
                                type="text"
                                name="review_music_director"
                                value={formData.review_music_director || ''}
                                onChange={handleInputChange}
                                placeholder="Music Director name"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Row 3: DOP and Editor */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                DOP (Cinematographer)
                              </label>
                              <input
                                type="text"
                                name="review_dop"
                                value={formData.review_dop || ''}
                                onChange={handleInputChange}
                                placeholder="Director of Photography"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Editor
                              </label>
                              <input
                                type="text"
                                name="review_editor"
                                value={formData.review_editor || ''}
                                onChange={handleInputChange}
                                placeholder="Editor name"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Row 4: Cast - Textarea */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                              Cast
                            </label>
                            <textarea
                              name="review_cast"
                              value={formData.review_cast}
                              onChange={handleInputChange}
                              rows="2"
                              placeholder="Enter cast members, one per line or comma-separated"
                              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Row 5: Genre and Language */}
                          <div className="grid grid-cols-2 gap-4">
                            {/* Genre Multi-Select */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Genre
                              </label>
                              <div className="flex gap-2 mb-2">
                                <select
                                  value={tempGenre}
                                  onChange={(e) => setTempGenre(e.target.value)}
                                  className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Genre</option>
                                  <option value="Action">Action</option>
                                  <option value="Comedy">Comedy</option>
                                  <option value="Drama">Drama</option>
                                  <option value="Thriller">Thriller</option>
                                  <option value="Horror">Horror</option>
                                  <option value="Romance">Romance</option>
                                  <option value="Sci-Fi">Sci-Fi</option>
                                  <option value="Fantasy">Fantasy</option>
                                  <option value="Crime">Crime</option>
                                  <option value="Mystery">Mystery</option>
                                  <option value="Adventure">Adventure</option>
                                  <option value="Animation">Animation</option>
                                  <option value="Biography">Biography</option>
                                  <option value="Family">Family</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={handleAddGenre}
                                  disabled={!tempGenre}
                                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                  Add
                                </button>
                              </div>
                              {/* Selected Genres */}
                              {selectedGenres.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {selectedGenres.map((genre, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
                                    >
                                      {genre}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveGenre(genre)}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Language Multi-Select */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Language
                              </label>
                              <div className="flex gap-2 mb-2">
                                <select
                                  value={tempLanguage}
                                  onChange={(e) => setTempLanguage(e.target.value)}
                                  className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Select Language</option>
                                  <option value="Telugu">Telugu</option>
                                  <option value="Hindi">Hindi</option>
                                  <option value="Tamil">Tamil</option>
                                  <option value="Malayalam">Malayalam</option>
                                  <option value="Kannada">Kannada</option>
                                  <option value="English">English</option>
                                  <option value="Bengali">Bengali</option>
                                  <option value="Marathi">Marathi</option>
                                  <option value="Punjabi">Punjabi</option>
                                  <option value="Gujarati">Gujarati</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={handleAddLanguage}
                                  disabled={!tempLanguage}
                                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                  Add
                                </button>
                              </div>
                              {/* Selected Languages */}
                              {selectedLanguages.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {selectedLanguages.map((language, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded-md"
                                    >
                                      {language}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLanguage(language)}
                                        className="text-green-600 hover:text-green-800"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Row 6: Censor Rating and Runtime */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Censor Rating
                              </label>
                              <select
                                name="censor_rating"
                                value={formData.censor_rating}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select Rating</option>
                                <optgroup label="India (CBFC)">
                                  <option value="U">U - Unrestricted Public Exhibition</option>
                                  <option value="UA">UA - Parental Guidance for under 12</option>
                                  <option value="A">A - Restricted to adults (18+)</option>
                                  <option value="S">S - Restricted to specialized audiences</option>
                                </optgroup>
                                <optgroup label="USA (MPAA)">
                                  <option value="G">G - General Audiences</option>
                                  <option value="PG">PG - Parental Guidance Suggested</option>
                                  <option value="PG-13">PG-13 - Parents Strongly Cautioned</option>
                                  <option value="R">R - Restricted (17+ with adult)</option>
                                  <option value="NC-17">NC-17 - Adults Only (18+)</option>
                                </optgroup>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Runtime
                              </label>
                              <input
                                type="text"
                                name="review_runtime"
                                value={formData.review_runtime}
                                onChange={handleInputChange}
                                placeholder="e.g., 2h 30m"
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* Row 7: Platform and Release Date */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Release
                              </label>
                              <select
                                name="platform"
                                value={formData.platform}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select Release Type</option>
                                <option value="Theater">Theater</option>
                                <option value="OTT">OTT</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                Release Date
                              </label>
                              <input
                                type="date"
                                name="release_date"
                                value={formData.release_date}
                                onChange={handleInputChange}
                                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          {/* OTT Release Fields - Show only when platform is OTT */}
                          {formData.platform === 'OTT' && (
                            <>
                              {/* Row 7: Content Type and OTT Platforms */}
                              <div className="grid grid-cols-2 gap-4">
                                {/* Content Type */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                                    Content Type
                                  </label>
                                  <select
                                    name="ott_content_type"
                                    value={formData.ott_content_type}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">Select Type</option>
                                    <option value="Movie">Movie</option>
                                    <option value="Web Series">Web Series</option>
                                  </select>
                                </div>

                                {/* OTT Platforms Multi-Select */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    OTT Platforms
                                  </label>
                                  <div className="flex gap-2">
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        const platform = e.target.value;
                                        if (platform && !formData.ott_platforms.includes(platform)) {
                                          setFormData({
                                            ...formData,
                                            ott_platforms: [...formData.ott_platforms, platform]
                                          });
                                        }
                                      }}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="">Select Platform</option>
                                      <option value="Netflix">Netflix</option>
                                      <option value="Amazon Prime">Amazon Prime</option>
                                      <option value="Disney+ Hotstar">Disney+ Hotstar</option>
                                      <option value="Zee5">Zee5</option>
                                      <option value="SonyLIV">SonyLIV</option>
                                      <option value="Jio Cinema">Jio Cinema</option>
                                      <option value="Aha">Aha</option>
                                      <option value="Sun NXT">Sun NXT</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  </div>
                                  {formData.ott_platforms.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {formData.ott_platforms.map((platform, index) => (
                                        <span
                                          key={index}
                                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                                        >
                                          {platform}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFormData({
                                                ...formData,
                                                ott_platforms: formData.ott_platforms.filter((_, i) => i !== index)
                                              });
                                            }}
                                            className="ml-1 text-blue-600 hover:text-blue-800"
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                      {/* Trailer URL */}
                        </div>
                      </div>
                      
                      {/* Review Sections */}
                      <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-5 mt-6">
                        <h4 className="text-base font-bold text-gray-900 mb-4 text-left">
                          Review Sections
                        </h4>
                        <div className="space-y-4">
                        
                        {/* Quick Verdict */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Quick Verdict (Tagline) *
                          </label>
                          <input
                            type="text"
                            name="review_quick_verdict"
                            value={formData.review_quick_verdict}
                            onChange={handleInputChange}
                            placeholder="e.g., A Heartwarming Family Drama"
                            maxLength="100"
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1 text-left">Single impactful line (max 100 characters)</p>
                        </div>

                        {/* Plot Summary - Accordion */}
                        <div className="mb-4 border border-gray-300 rounded-md">
                          <div 
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleReviewAccordion('plot')}
                          >
                            <label className="text-sm font-medium text-gray-700 cursor-pointer">
                              Main Plot *
                            </label>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${reviewAccordions.plot ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {reviewAccordions.plot && (
                            <div className="border-t border-gray-300">
                              <Editor
                                editorState={editorPlotSummary}
                                onEditorStateChange={onEditorPlotSummaryChange}
                                wrapperClassName="wrapper-class"
                                editorClassName="editor-class"
                                toolbarClassName="toolbar-class"
                                toolbar={{
                                  options: ['inline', 'list', 'textAlign', 'history'],
                                  inline: { options: ['bold', 'italic', 'underline'] }
                                }}
                                placeholder="Brief overview of the story without spoilers..."
                                editorStyle={{ minHeight: '150px', padding: '12px', fontSize: '14px' }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Performances - Accordion */}
                        <div className="mb-4 border border-gray-300 rounded-md">
                          <div 
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleReviewAccordion('performances')}
                          >
                            <label className="text-sm font-medium text-gray-700 cursor-pointer">
                              Performances *
                            </label>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${reviewAccordions.performances ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {reviewAccordions.performances && (
                            <div className="border-t border-gray-300">
                              <Editor
                                editorState={editorPerformances}
                                onEditorStateChange={onEditorPerformancesChange}
                                wrapperClassName="wrapper-class"
                                editorClassName="editor-class"
                                toolbarClassName="toolbar-class"
                                toolbar={{
                                  options: ['inline', 'list', 'textAlign', 'history'],
                                  inline: { options: ['bold', 'italic', 'underline'] }
                                }}
                                placeholder="Highlight key actors and their performances..."
                                editorStyle={{ minHeight: '150px', padding: '12px', fontSize: '14px' }}
                              />
                            </div>
                          )}
                        </div>

                        {/* What Works - Accordion */}
                        <div className="mb-4 border border-gray-300 rounded-md">
                          <div 
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleReviewAccordion('whatWorks')}
                          >
                            <label className="text-sm font-medium text-gray-700 cursor-pointer">
                              What Works *
                            </label>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${reviewAccordions.whatWorks ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {reviewAccordions.whatWorks && (
                            <div className="border-t border-gray-300">
                              <Editor
                                editorState={editorWhatWorks}
                                onEditorStateChange={onEditorWhatWorksChange}
                                wrapperClassName="wrapper-class"
                                editorClassName="editor-class"
                                toolbarClassName="toolbar-class"
                                toolbar={{
                                  options: ['inline', 'list', 'textAlign', 'history'],
                                  inline: { options: ['bold', 'italic', 'underline'] }
                                }}
                                placeholder="Strengths and positive aspects of the movie..."
                                editorStyle={{ minHeight: '150px', padding: '12px', fontSize: '14px' }}
                              />
                            </div>
                          )}
                        </div>

                        {/* What Doesn't Work - Accordion */}
                        <div className="mb-4 border border-gray-300 rounded-md">
                          <div 
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleReviewAccordion('whatDoesnt')}
                          >
                            <label className="text-sm font-medium text-gray-700 cursor-pointer">
                              What Doesn&apos;t Work *
                            </label>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${reviewAccordions.whatDoesnt ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {reviewAccordions.whatDoesnt && (
                            <div className="border-t border-gray-300">
                              <Editor
                                editorState={editorWhatDoesntWork}
                                onEditorStateChange={onEditorWhatDoesntWorkChange}
                                wrapperClassName="wrapper-class"
                                editorClassName="editor-class"
                                toolbarClassName="toolbar-class"
                                toolbar={{
                                  options: ['inline', 'list', 'textAlign', 'history'],
                                  inline: { options: ['bold', 'italic', 'underline'] }
                                }}
                                placeholder="Weaknesses and issues with the movie..."
                                editorStyle={{ minHeight: '150px', padding: '12px', fontSize: '14px' }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Technical Aspects - Accordion */}
                        <div className="mb-4 border border-gray-300 rounded-md">
                          <div 
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleReviewAccordion('technical')}
                          >
                            <label className="text-sm font-medium text-gray-700 cursor-pointer">
                              Technical Aspects (Optional)
                            </label>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${reviewAccordions.technical ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {reviewAccordions.technical && (
                            <div className="border-t border-gray-300">
                              <Editor
                                editorState={editorTechnicalAspects}
                                onEditorStateChange={onEditorTechnicalAspectsChange}
                                wrapperClassName="wrapper-class"
                                editorClassName="editor-class"
                                toolbarClassName="toolbar-class"
                                toolbar={{
                                  options: ['inline', 'list', 'textAlign', 'history'],
                                  inline: { options: ['bold', 'italic', 'underline'] }
                                }}
                                placeholder="Music, Cinematography, Direction, etc..."
                                editorStyle={{ minHeight: '120px', padding: '12px', fontSize: '14px' }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Final Verdict - Accordion */}
                        <div className="mb-4 border border-gray-300 rounded-md">
                          <div 
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleReviewAccordion('verdict')}
                          >
                            <label className="text-sm font-medium text-gray-700 cursor-pointer">
                              Final Verdict *
                            </label>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${reviewAccordions.verdict ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {reviewAccordions.verdict && (
                            <div className="border-t border-gray-300">
                              <Editor
                                editorState={editorFinalVerdict}
                                onEditorStateChange={onEditorFinalVerdictChange}
                                wrapperClassName="wrapper-class"
                                editorClassName="editor-class"
                                toolbarClassName="toolbar-class"
                                toolbar={{
                                  options: ['inline', 'list', 'textAlign', 'history'],
                                  inline: { options: ['bold', 'italic', 'underline'] }
                                }}
                                placeholder="Overall recommendation and who should watch this movie..."
                                editorStyle={{ minHeight: '120px', padding: '12px', fontSize: '14px' }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    </>
                  )}

                  {/* Main Content (Hidden for Movie Reviews and Video, shown for other types including Video Post) */}
                  {formData.content_type !== 'movie_review' && formData.content_type !== 'video' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Main Content *
                    </label>
                    <div className="border border-gray-300 rounded-md">
                      <Editor
                        editorState={editorState}
                        onEditorStateChange={onEditorStateChange}
                        wrapperClassName="wrapper-class"
                        editorClassName="editor-class"
                        toolbarClassName="toolbar-class"
                        toolbar={{
                          options: ['inline', 'list', 'textAlign', 'link', 'image', 'history'],
                          inline: {
                            inDropdown: false,
                            options: ['bold', 'italic', 'underline', 'strikethrough']
                          },
                          list: {
                            inDropdown: false,
                            options: ['unordered', 'ordered']
                          },
                          textAlign: {
                            inDropdown: false,
                            options: ['left', 'center', 'right', 'justify']
                          },
                          link: {
                            inDropdown: false,
                            showOpenOptionOnHover: true,
                            defaultTargetOption: '_blank',
                            options: ['link', 'unlink']
                          },
                          image: {
                            urlEnabled: true,
                            uploadEnabled: true,
                            uploadCallback: uploadImageCallback,
                            previewImage: true,
                            inputAccept: 'image/gif,image/jpeg,image/jpg,image/png,image/svg',
                            alt: { present: true, mandatory: false },
                            defaultSize: {
                              height: 'auto',
                              width: '100%'
                            }
                          },
                          history: {
                            inDropdown: false,
                            options: ['undo', 'redo']
                          }
                        }}
                        placeholder="Write your article content here..."
                        editorStyle={{
                          minHeight: '300px',
                          padding: '12px',
                          fontSize: '14px',
                          border: 'none',
                          borderRadius: '0 0 0.375rem 0.375rem'
                        }}
                        toolbarStyle={{
                          border: 'none',
                          borderBottom: '1px solid #d1d5db',
                          borderRadius: '0.375rem 0.375rem 0 0',
                          marginBottom: '0'
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-left">
                      Use the toolbar above to format your content with headings, bold, italic, lists, links, and more.
                    </p>
                  </div>
                  )}

                  {/* Social Media Embed Section - Between Main and Secondary Content */}
                  {(formData.content_type === 'post' || formData.content_type === 'video_post' || formData.content_type === 'photo') && (
                    <div className="space-y-3 mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-800 text-left">Social Media Embed (Optional)</h3>
                      <p className="text-xs text-gray-600 text-left">Embed will appear between main content and secondary content</p>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Platform
                        </label>
                        <select
                          name="social_media_type"
                          value={formData.social_media_type}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">None</option>
                          <option value="twitter">Twitter/X</option>
                          <option value="instagram">Instagram</option>
                          <option value="facebook">Facebook</option>
                          <option value="tiktok">TikTok</option>
                          <option value="youtube">YouTube</option>
                        </select>
                      </div>
                      
                      {formData.social_media_type && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Embed Code (Recommended) or Share Link
                          </label>
                          <textarea
                            name="social_media_embed"
                            value={formData.social_media_embed}
                            onChange={handleInputChange}
                            placeholder="Paste embed code or share link here..."
                            rows="4"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <p className="text-xs text-gray-600 mt-1 text-left">
                            {formData.social_media_type === 'twitter' && 'Paste Twitter/X embed code'}
                            {formData.social_media_type === 'instagram' && 'Paste Instagram embed code or post URL'}
                            {formData.social_media_type === 'facebook' && 'Paste Facebook embed code or post URL'}
                            {formData.social_media_type === 'tiktok' && 'Paste TikTok embed code or video URL'}
                            {formData.social_media_type === 'youtube' && 'Paste YouTube embed code or video URL'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Secondary Content (Hidden for Movie Reviews and Video, shown for other types including Video Post) */}
                  {formData.content_type !== 'movie_review' && formData.content_type !== 'video' && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                      Secondary Content (Optional)
                    </label>
                    <div className="border border-gray-300 rounded-md">
                      <Editor
                        editorState={editorStateSecondary}
                        onEditorStateChange={onEditorStateChangeSecondary}
                        wrapperClassName="wrapper-class"
                        editorClassName="editor-class"
                        toolbarClassName="toolbar-class"
                        toolbar={{
                          options: ['inline', 'list', 'textAlign', 'link', 'image', 'history'],
                          inline: {
                            inDropdown: false,
                            options: ['bold', 'italic', 'underline', 'strikethrough']
                          },
                          list: {
                            inDropdown: false,
                            options: ['unordered', 'ordered']
                          },
                          textAlign: {
                            inDropdown: false,
                            options: ['left', 'center', 'right', 'justify']
                          },
                          link: {
                            inDropdown: false,
                            showOpenOptionOnHover: true,
                            defaultTargetOption: '_blank',
                            options: ['link', 'unlink']
                          },
                          image: {
                            urlEnabled: true,
                            uploadEnabled: true,
                            uploadCallback: uploadImageCallback,
                            previewImage: true,
                            inputAccept: 'image/gif,image/jpeg,image/jpg,image/png,image/svg',
                            alt: { present: true, mandatory: false },
                            defaultSize: {
                              height: 'auto',
                              width: '100%'
                            }
                          },
                          history: {
                            inDropdown: false,
                            options: ['undo', 'redo']
                          }
                        }}
                        placeholder="Write additional content here (will appear after main content)..."
                        editorStyle={{
                          minHeight: '200px',
                          padding: '12px',
                          fontSize: '14px',
                          border: 'none',
                          borderRadius: '0 0 0.375rem 0.375rem'
                        }}
                        toolbarStyle={{
                          border: 'none',
                          borderBottom: '1px solid #d1d5db',
                          borderRadius: '0.375rem 0.375rem 0 0',
                          marginBottom: '0'
                        }}
                      />
                    </div>
                  </div>
                  )}
                </div>
              )}
            </div>

            {/* Landing Page Specific Fields - Only show for landing pages */}
            {(formData.ad_type === 'landing_home' || formData.ad_type === 'landing_inner') && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 text-left">Landing Page Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Sponsored Link
                    </label>
                    <input
                      type="url"
                      name="sponsored_link"
                      value={formData.sponsored_link}
                      onChange={handleInputChange}
                      placeholder="https://example.com"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">URL where users will be redirected when clicking on this landing page</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Sponsored Label
                    </label>
                    <input
                      type="text"
                      name="sponsored_label"
                      value={formData.sponsored_label}
                      onChange={handleInputChange}
                      placeholder="e.g., 'Sponsored', 'Advertisement', 'Promoted'"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Label to display indicating this is sponsored content</p>
                  </div>
                </div>
              </div>
            )}

            {/* SEO Section - Accordion - Hide for landing pages */}
            {formData.ad_type !== 'landing_home' && formData.ad_type !== 'landing_inner' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('seo')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">SEO & Tags</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.seo ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.seo && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      SEO Title
                    </label>
                    <input
                      type="text"
                      name="seo_title"
                      value={formData.seo_title}
                      onChange={handleInputChange}
                      placeholder="Leave empty to use article title"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      SEO Description
                    </label>
                    <textarea
                      name="seo_description"
                      value={formData.seo_description}
                      onChange={handleInputChange}
                      rows="2"
                      placeholder="SEO description for search engines"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      SEO Keywords
                    </label>
                    <input
                      type="text"
                      name="seo_keywords"
                      value={formData.seo_keywords}
                      onChange={handleInputChange}
                      placeholder="keyword1, keyword2, keyword3"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Tags
                    </label>
                    <input
                      type="text"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      placeholder="tag1, tag2, tag3"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* AEO Section - Accordion - Hide for landing pages */}
            {formData.ad_type !== 'landing_home' && formData.ad_type !== 'landing_inner' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('aeo')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">AEO (Answer Engine Optimization)</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.aeo ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.aeo && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      AEO Title
                    </label>
                    <input
                      type="text"
                      name="aeo_title"
                      value={formData.aeo_title}
                      onChange={handleInputChange}
                      placeholder="Optimized title for AI search engines"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      AEO Description
                    </label>
                    <textarea
                      name="aeo_description"
                      value={formData.aeo_description}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Clear, concise answer for AI engines (ChatGPT, Perplexity, etc.)"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      AEO Keywords
                    </label>
                    <input
                      type="text"
                      name="aeo_keywords"
                      value={formData.aeo_keywords}
                      onChange={handleInputChange}
                      placeholder="Conversational keywords, question phrases"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* FAQs Section - Accordion - Hide for landing pages */}
            {formData.ad_type !== 'landing_home' && formData.ad_type !== 'landing_inner' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('faqs')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">FAQs (Frequently Asked Questions)</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.faqs ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.faqs && (
                <div className="p-6 space-y-4">
                  {formData.faqs.map((faq, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">FAQ #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newFaqs = formData.faqs.filter((_, i) => i !== index);
                            setFormData({...formData, faqs: newFaqs});
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Question
                          </label>
                          <input
                            type="text"
                            value={faq.question}
                            onChange={(e) => {
                              const newFaqs = [...formData.faqs];
                              newFaqs[index].question = e.target.value;
                              setFormData({...formData, faqs: newFaqs});
                            }}
                            placeholder="Enter question"
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Answer
                          </label>
                          <textarea
                            value={faq.answer}
                            onChange={(e) => {
                              const newFaqs = [...formData.faqs];
                              newFaqs[index].answer = e.target.value;
                              setFormData({...formData, faqs: newFaqs});
                            }}
                            rows="2"
                            placeholder="Enter answer"
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        faqs: [...formData.faqs, { question: '', answer: '' }]
                      });
                    }}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                  >
                    + Add FAQ
                  </button>
                </div>
              )}
            </div>
            )}

            {/* E-E-A-T Section - Accordion - Hide for landing pages */}
            {formData.ad_type !== 'landing_home' && formData.ad_type !== 'landing_inner' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div 
                className="px-6 py-4 border-b border-gray-200 cursor-pointer flex items-center justify-between hover:bg-gray-50"
                onClick={() => toggleAccordion('eeat')}
              >
                <h3 className="text-base font-bold text-gray-900 text-left">E-E-A-T Signals (Expertise & Authority)</h3>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${accordionStates.eeat ? 'transform rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
              {accordionStates.eeat && (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Author Credentials
                    </label>
                    <input
                      type="text"
                      name="author_credentials"
                      value={formData.author_credentials}
                      onChange={handleInputChange}
                      placeholder="e.g., Senior Film Critic, 15+ years experience"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Sources & References
                    </label>
                    <textarea
                      name="sources"
                      value={formData.sources}
                      onChange={handleInputChange}
                      rows="2"
                      placeholder="Citations, official sources, links (comma separated)"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        Fact Checked By
                      </label>
                      <input
                        type="text"
                        name="fact_checked_by"
                        value={formData.fact_checked_by}
                        onChange={handleInputChange}
                        placeholder="Editor name"
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        Last Reviewed Date
                      </label>
                      <input
                        type="date"
                        name="last_reviewed_date"
                        value={formData.last_reviewed_date}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Publishing & Sponsored Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 text-left">Publishing Settings</h3>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_featured"
                      checked={formData.is_featured}
                      onChange={handleInputChange}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Sponsored Article</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_published"
                      checked={formData.is_published && !formData.is_scheduled}
                      onChange={handlePublishChange}
                      disabled={formData.is_scheduled}
                      className="form-checkbox h-4 w-4 text-blue-600 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-700">Publish Immediately</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_scheduled"
                      checked={formData.is_scheduled}
                      onChange={handleScheduleChange}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Schedule for Later</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_top_story"
                      checked={formData.is_top_story}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_top_story: e.target.checked }))}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Feature as Top Story</span>
                  </label>
                </div>

                {/* Top Story Duration Section */}
                {formData.is_top_story && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Top Story Duration (Hours) *
                    </label>
                    <input
                      type="number"
                      name="top_story_duration_hours"
                      value={formData.top_story_duration_hours}
                      onChange={handleInputChange}
                      min="1"
                      max="168"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required={formData.is_top_story}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      This ad will appear in the Top Stories section for {formData.top_story_duration_hours} hours from publish time, then automatically move to its category section.
                    </p>
                  </div>
                )}

                {/* Scheduling Section */}
                {formData.is_scheduled && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        Timezone *
                      </label>
                      <select
                        name="scheduled_timezone"
                        value={formData.scheduled_timezone}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={formData.is_scheduled}
                      >
                        <option value="IST">IST (Indian Standard Time - UTC+5:30)</option>
                        <option value="EST">EST (Eastern Standard Time - UTC-5:00)</option>
                      </select>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Scheduled Publish Date & Time ({formData.scheduled_timezone}) *
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduled_publish_at"
                      value={formData.scheduled_publish_at}
                      onChange={handleInputChange}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={formData.is_scheduled}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      The post will be automatically published at the scheduled time ({formData.scheduled_timezone}) if auto-publishing is enabled by admin.
                    </p>
                  </div>
                )}
              </div>

            </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Post' : 'Create Post')}
              </button>

              <button
                type="button"
                onClick={handlePreview}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Preview
              </button>

              {isEditMode && (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  disabled={loading}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    formData.is_published
                      ? 'bg-orange-600 hover:bg-orange-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-50`}
                >
                  {formData.is_published ? 'Unpublish' : 'Publish'}
                </button>
              )}

              <button
                type="button"
                onClick={handleTranslate}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Generate Translation
              </button>

              <button
                type="button"
                onClick={() => navigate('/cms/dashboard')}
                className="bg-gray-600 hover:bg-gray-700 text-gray-100 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
        </>
        )}

        {/* Notification Modal */}
        <NotificationModal
          isOpen={notification.isOpen}
          onClose={handleNotificationClose}
          type={notification.type}
          title={notification.title}
          message={notification.message}
        />

        {/* Gallery Selection Modal */}
        {showGalleryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg">G</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-gray-900 text-left">Select Image Gallery</h2>
                      <p className="text-sm text-gray-600">Choose a gallery to associate with this photo post</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowGalleryModal(false);
                      setGallerySearchTerm('');
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
                
                {/* Search */}
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search galleries..."
                    value={gallerySearchTerm}
                    onChange={(e) => setGallerySearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="bg-white p-6 max-h-96 overflow-y-auto">
                {filteredGalleries.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGalleries.map((gallery) => (
                      <div
                        key={gallery.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer bg-white"
                        onClick={() => handleGallerySelect(gallery)}
                      >
                        <div className={`bg-gray-100 rounded-md mb-3 overflow-hidden ${
                          gallery.gallery_type === 'vertical' ? 'aspect-[3/4]' : 'aspect-video'
                        }`}>
                          {gallery.images && gallery.images.length > 0 ? (
                            <img
                              src={gallery.images[0].data || gallery.images[0].url}
                              alt={gallery.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center" style={{display: gallery.images && gallery.images.length > 0 ? 'none' : 'flex'}}>
                            <span className="text-gray-400 font-bold text-2xl">G</span>
                          </div>
                        </div>
                        <h4 className="font-medium text-gray-900 text-sm mb-1 text-left">{gallery.title}</h4>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{gallery.images ? gallery.images.length : 0} images</span>
                          {gallery.artists && gallery.artists.length > 0 && (
                            <span>{gallery.artists.join(', ')}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="w-full mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGallerySelect(gallery);
                          }}
                        >
                          Select Gallery
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white">
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">
                      {gallerySearchTerm ? 'No galleries found matching your search.' : 'No galleries available.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Artist Modal */}
        {showArtistModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl max-w-sm w-full overflow-hidden">
              {/* Header */}
              <div className="bg-gray-800 border-b border-gray-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                      <span className="text-red-600 font-bold text-lg">A</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-white text-left">Add Artist</h2>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowArtistModal(false);
                      setNewArtistName('');
                    }}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="bg-gray-800 px-6 py-4">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleAddArtist();
                }}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-1 text-left">
                      Artist Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newArtistName}
                      onChange={(e) => setNewArtistName(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left"
                      placeholder="Enter artist name"
                      autoFocus
                    />
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="bg-gray-800 border-t border-gray-600 px-6 py-4">
                <div className="flex justify-center">
                  <button
                    onClick={handleAddArtist}
                    disabled={!newArtistName.trim()}
                    className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white py-2 px-4 rounded-md transition-colors duration-200"
                  >
                    Add Artist
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery Selection Modal */}
        {showGalleryModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900 text-left">Select Image Gallery</h2>
                  <button
                    onClick={() => {
                      setShowGalleryModal(false);
                      setGallerySearchTerm('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
                
                {/* Search */}
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search galleries..."
                    value={gallerySearchTerm}
                    onChange={(e) => setGallerySearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {filteredGalleries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No galleries found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGalleries.map((gallery) => (
                      <div
                        key={gallery.id}
                        onClick={() => handleGallerySelect(gallery)}
                        className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-200"
                      >
                        <div className="mb-3">
                          {gallery.images && gallery.images.length > 0 ? (
                            <img
                              src={gallery.images[0].url || gallery.images[0]}
                              alt={gallery.title}
                              className={`w-full object-cover rounded ${
                                gallery.gallery_type === 'vertical' ? 'h-40' : 'h-32'
                              }`}
                            />
                          ) : (
                            <div className={`w-full bg-gray-200 rounded flex items-center justify-center ${
                              gallery.gallery_type === 'vertical' ? 'h-40' : 'h-32'
                            }`}>
                              <span className="text-gray-400">No Image</span>
                            </div>
                          )}
                        </div>
                        <h3 className="font-medium text-gray-900 text-left">{gallery.title}</h3>
                        <p className="text-sm text-gray-500 text-left mt-1">
                          {gallery.images ? gallery.images.length : 0} images
                        </p>
                        {gallery.artists && gallery.artists.length > 0 && (
                          <p className="text-xs text-blue-600 text-left mt-1">
                            Artists: {gallery.artists.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Gallery Entity Management Modal */}
      {showEntityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add New {galleryCategory}</h3>
              <button
                onClick={() => {
                  setShowEntityModal(false);
                  setNewEntityName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                {galleryCategory} Name
              </label>
              <input
                type="text"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                placeholder={`Enter ${galleryCategory.toLowerCase()} name`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEntity();
                  }
                }}
              />
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowEntityModal(false);
                  setNewEntityName('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEntity}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTT Platform Management Modal removed */}
    </>
  );
};

export default CreateSponsoredAd;