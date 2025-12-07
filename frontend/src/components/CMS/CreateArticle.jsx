import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, convertToRaw, ContentState } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import NotificationModal from '../NotificationModal';

const CreateArticle = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Changed from articleId to id to match the route
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [states, setStates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editorState, setEditorState] = useState(EditorState.createEmpty());
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
    summary: '',
    author: 'Tadka Team', // Default author
    language: 'en',
    states: 'all',
    category: '',
    content_type: 'post', // New field for content type
    image: '',
    image_gallery: [], // New field for image gallery
    youtube_url: '',
    tags: '',
    artists: [], // New field for artists
    movie_rating: '', // New field for movie rating
    is_featured: false,
    is_published: true,
    is_scheduled: false,
    scheduled_publish_at: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
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
    review_genre: '',
    review_runtime: '',
    movie_language: '',
    platform: '',
    ott_platform: '',
    // Comment settings
    comments_enabled: true,
    review_comments_enabled: true,
    // Top Story
    is_top_story: false
  });

  const [selectedState, setSelectedState] = useState(''); // Temporary state for dropdown selection
  const [selectedStates, setSelectedStates] = useState([]); // Array of selected states
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(''); // Changed to single artist (string)
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

  // OTT Platform states
  const [ottPlatforms, setOttPlatforms] = useState([]);
  const [showOttModal, setShowOttModal] = useState(false);
  const [newOttPlatformName, setNewOttPlatformName] = useState('');

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
    seo: false
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
    const shouldNavigate = notification.type === 'success' && 
                          (notification.title.includes('Created Successfully') || 
                           notification.title.includes('Updated Successfully'));
    
    closeNotification();
    
    // Only navigate to dashboard after successful create/update operations
    if (shouldNavigate) {
      navigate('/cms/dashboard');
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
          summary: article.summary || '',
          author: article.author || '',
          language: article.language || 'en',
          states: article.states || 'all',
          category: article.category || '',
          content_type: article.content_type || 'post', // Load content type
          image: article.image || article.main_image_url || '',
          image_gallery: article.image_gallery ? JSON.parse(article.image_gallery) : [], // Load image gallery safely
          youtube_url: article.youtube_url || '',
          tags: article.tags || '',
          movie_rating: article.movie_rating || '', // Load movie rating
          is_featured: article.is_featured || false,
          is_published: article.is_published || false,
          is_scheduled: article.is_scheduled || false,
          scheduled_publish_at: article.scheduled_publish_at ? new Date(article.scheduled_publish_at).toISOString().slice(0, 16) : '',
          seo_title: article.seo_title || '',
          seo_description: article.seo_description || '',
          seo_keywords: article.seo_keywords || '',
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
          review_genre: article.review_genre || '',
          review_runtime: article.review_runtime || '',
          movie_language: article.movie_language || '',
          platform: article.platform || '',
          ott_platform: article.ott_platform || '',
          // Comment settings
          comments_enabled: article.comments_enabled !== undefined ? article.comments_enabled : true,
          review_comments_enabled: article.review_comments_enabled !== undefined ? article.review_comments_enabled : true
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
    fetchOttPlatforms(); // Fetch OTT platforms
    
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
      setCategories(data.categories);
      // No default category - user must select one
    } catch (error) {
      console.error('Error fetching CMS config:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const onEditorStateChange = (editorState) => {
    setEditorState(editorState);
    const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    setFormData(prev => ({
      ...prev,
      content: htmlContent
    }));
  };

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
          
          // Update form with the returned URL
          setFormData(prev => ({
            ...prev,
            image: data.url
          }));
          
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
      const artists = [];
      
      // Fetch artists from existing posts
      const articlesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/articles`);
      if (articlesResponse.ok) {
        const articles = await articlesResponse.json();
        
        // Extract artists from posts
        articles.forEach(article => {
          if (article.artists) {
            try {
              const articleArtists = JSON.parse(article.artists);
              artists.push(...articleArtists);
            } catch (e) {
              // Skip if JSON parsing fails
            }
          }
        });
      }
      
      // Fetch artists from existing galleries
      const galleriesResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/galleries`);
      if (galleriesResponse.ok) {
        const galleries = await galleriesResponse.json();
        
        // Extract artists from galleries
        galleries.forEach(gallery => {
          if (gallery.artists && Array.isArray(gallery.artists)) {
            artists.push(...gallery.artists);
          }
        });
      }
      
      // Remove duplicates and set
      const uniqueArtists = [...new Set(artists)].filter(artist => artist && artist.trim());
      setAvailableArtists(uniqueArtists);
    } catch (error) {
      console.error('Error fetching artists:', error);
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

  // Fetch OTT platforms
  const fetchOttPlatforms = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/ott-platforms`);
      if (response.ok) {
        const data = await response.json();
        setOttPlatforms(data.platforms || []);
      }
    } catch (error) {
      console.error('Error fetching OTT platforms:', error);
    }
  };

  // Handle adding new OTT platform
  const handleAddOttPlatform = async () => {
    if (!newOttPlatformName.trim()) return;
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cms/ott-platforms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOttPlatformName.trim() })
      });
      
      if (response.ok) {
        await fetchOttPlatforms();
        setNewOttPlatformName('');
        showNotification('success', 'Platform Added', 'OTT platform added successfully');
      } else {
        const data = await response.json();
        showNotification('error', 'Error', data.detail || 'Failed to add platform');
      }
    } catch (error) {
      console.error('Error adding OTT platform:', error);
      showNotification('error', 'Error', 'Failed to add platform');
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
      // Strip HTML tags for summary creation
      const textContent = formData.content.replace(/<[^>]*>/g, '');
      
      const submitData = {
        ...formData,
        article_language: formData.language || 'en', // Map language to article_language for backend
        summary: textContent.substring(0, 200) + '...', // Generate summary from content
        states: JSON.stringify(selectedStates), // Convert states array to JSON string
        artists: JSON.stringify(selectedArtist ? [selectedArtist] : []), // Include selected artist as array
        image_gallery: JSON.stringify(formData.image_gallery), // Include image gallery as JSON string
        gallery_id: selectedGallery ? selectedGallery.id : null, // Include selected gallery ID
        seo_title: formData.seo_title || formData.title,
        seo_description: formData.seo_description || textContent.substring(0, 160) + '...',
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
        throw new Error(`Failed to ${isEditMode ? 'update' : 'create'} article`);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} article:`, error);
      showNotification(
        'error',
        `Error ${isEditMode ? 'Updating' : 'Creating'} Post`,
        `There was an error ${isEditMode ? 'updating' : 'creating'} your post. Please check your connection and try again.`
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
      <div className="min-h-screen bg-gray-50 pt-2 pb-4">
        <div className="max-w-5xl-plus mx-auto px-8">
          {/* Sticky Header - Same pattern as Latest News */}
          <div className={`sticky top-16 z-40 border-b-2 border-gray-300 mb-6`} style={{ backgroundColor: 'rgb(249 250 251 / var(--tw-bg-opacity, 1))' }}>
            <div className="pl-0 pr-4 py-4">
              <div className="mb-2">
                <h1 className="text-base font-bold text-black text-left leading-tight">
                  {isEditMode ? 'Edit Post' : 'New Post'}
                </h1>
              </div>
              
              {/* Back button and status on same line */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-900 opacity-75 flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  {isEditMode ? 'Editing existing post' : 'Creating new post'}
                </p>

                {/* Back Button with Border */}
                <button
                  onClick={() => navigate('/cms/dashboard')}
                  className="flex items-center space-x-2 text-xs font-medium text-gray-900 opacity-75 hover:opacity-100 focus:outline-none border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 transition-all duration-200"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
                  </svg>
                  <span>Back</span>
                </button>
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
                      Language *
                    </label>
                    <select
                      name="language"
                      value={formData.language}
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-left">Target States</label>
                    
                    {/* Selected States Display */}
                    {selectedStates.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {selectedStates.map((stateCode) => {
                          const stateName = states.find(s => s.code === stateCode)?.name || stateCode;
                          return (
                            <span
                              key={stateCode}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                            >
                              {stateName}
                              {stateCode !== 'all' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveState(stateCode)}
                                  className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* State Selection Searchable Dropdown with Add Button */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={showStateDropdown ? stateSearchQuery : (selectedState ? states.find(s => s.code === selectedState)?.name : '')}
                          onChange={(e) => {
                            setSelectedState('');
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
                            }, 200);
                          }}
                          placeholder="Search..."
                          className="w-full p-2 border border-gray-300 rounded-md text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
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
                              {states
                                .filter(state => state.name.toLowerCase().includes(stateSearchQuery.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((state) => (
                                  <div
                                    key={state.code}
                                    onClick={() => {
                                      setSelectedState(state.code);
                                      setStateSearchQuery('');
                                      setShowStateDropdown(false);
                                    }}
                                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-left ${
                                      selectedState === state.code ? 'bg-blue-100 text-blue-800' : 'text-gray-900'
                                    }`}
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
                      <button
                        type="button"
                        onClick={handleAddState}
                        disabled={!selectedState || selectedStates.includes(selectedState)}
                        className={`px-4 py-2 rounded-md font-medium ${
                          !selectedState || selectedStates.includes(selectedState)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Add
                      </button>
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
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Category *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={showCategoryDropdown ? categorySearchQuery : (formData.category ? categories.find(cat => cat.slug === formData.category)?.name : '')}
                        onChange={(e) => {
                          setCategorySearchQuery(e.target.value);
                          setShowCategoryDropdown(true);
                        }}
                        onFocus={() => {
                          setCategorySearchQuery('');
                          setShowCategoryDropdown(true);
                        }}
                        onBlur={() => {
                          // Small delay to allow click on dropdown items
                          setTimeout(() => {
                            setCategorySearchQuery('');
                          }, 200);
                        }}
                        placeholder="Search..."
                        className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                        required
                      />
                      {showCategoryDropdown && (
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
                      <option value="movie_review">Movie Review</option>
                      <option value="photo">Photo Gallery</option>
                      <option value="post">Post</option>
                      <option value="video">Video</option>
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
                      {/* Left Column: Title and Image Upload (60% = 3 cols) */}
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

                        {/* Main Image Upload */}
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

                        {/* Top Story Checkbox - Enhanced Design */}
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-4 hover:border-amber-300 transition-all">
                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              name="is_top_story"
                              checked={formData.is_top_story}
                              onChange={handleInputChange}
                              className="form-checkbox h-5 w-5 text-amber-600 mt-0.5 rounded focus:ring-2 focus:ring-amber-500 flex-shrink-0"
                            />
                            <div className="flex-1 text-left">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold text-gray-800">Mark as Top Story</span>
                                <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                                </svg>
                              </div>
                              <p className="text-xs text-gray-600 mt-1 text-left">
                                {(() => {
                                  try {
                                    const states = formData.states ? JSON.parse(formData.states) : [];
                                    return states.length === 0 ? '📰 Will appear in National Top Stories' : '🏛️ Will appear in State Top Stories';
                                  } catch {
                                    return '🏛️ Will appear in State Top Stories';
                                  }
                                })()}
                              </p>
                            </div>
                          </label>
                        </div>

                        {/* Enable Comments Checkbox - Enhanced Design */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 hover:border-blue-300 transition-all">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              name="comments_enabled"
                              checked={formData.comments_enabled}
                              onChange={handleInputChange}
                              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-gray-800">Enable Comments</span>
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"></path>
                              </svg>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Right Column: Image Preview (40% = 2 cols) */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Image Preview
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center" style={{ minHeight: '200px' }}>
                          {formData.image ? (
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
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Non-POST Type: Title Only (No Image) */}
                  {formData.content_type !== 'post' && (
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
                    <div className="space-y-4">
                      {/* Gallery Type Dropdown */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Gallery Type *
                        </label>
                        <select
                          value={galleryCategory}
                          onChange={(e) => handleGalleryCategoryChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Gallery Type</option>
                          <option value="Actor">Actor</option>
                          <option value="Actress">Actress</option>
                          <option value="Events">Events</option>
                          <option value="Politics">Politics</option>
                          <option value="Travel">Travel</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>

                      {/* Entity Dropdown - Shows based on Gallery Type */}
                      {galleryCategory && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700 text-left">
                              Select {galleryCategory} *
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowEntityModal(true)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Add New {galleryCategory}
                            </button>
                          </div>
                          <select
                            value={selectedEntity}
                            onChange={(e) => handleEntitySelection(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Select {galleryCategory}</option>
                            {availableEntities
                              .filter(e => e.is_active)
                              .map(entity => (
                                <option key={entity.id} value={entity.name}>
                                  {entity.name}
                                </option>
                              ))
                            }
                          </select>
                          {selectedEntity && (
                            <p className="text-xs text-gray-500 mt-1 text-left">
                              This will be gallery #{nextGalleryNumber} for {selectedEntity}
                            </p>
                          )}
                        </div>
                      )}

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

                      {/* Direct Image Gallery Management */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                          Image Gallery ({formData.image_gallery.length} images)
                        </label>
                        
                        {/* Add new image */}
                        <div className="mb-3 space-y-2">
                          {/* URL Input */}
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={newImageUrl}
                              onChange={(e) => setNewImageUrl(e.target.value)}
                              placeholder="Enter image URL"
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={handleAddImageToGallery}
                              className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              Add URL
                            </button>
                          </div>
                          
                          {/* File Upload */}
                          <div className="flex gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const url = await handleGalleryImageUpload(file);
                                  if (url) {
                                    handleAddImageToGallery({ target: { value: '' } }, url);
                                    e.target.value = ''; // Reset file input
                                  }
                                }
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={!galleryCategory || !selectedEntity}
                            />
                          </div>
                          {(!galleryCategory || !selectedEntity) && (
                            <p className="text-xs text-red-500 text-left">
                              Please select Gallery Type and {galleryCategory || 'Entity'} before uploading images
                            </p>
                          )}
                        </div>

                        {/* Gallery images list */}
                        {formData.image_gallery.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-md">
                            <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm">No images in gallery. Add images using the URL input above.</p>
                          </div>
                        ) : (
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
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Artist
                        </label>
                        <div className="flex gap-2">
                          <select
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={selectedArtist}
                            onChange={(e) => handleSelectArtist(e.target.value)}
                          >
                            <option value="">Select Artist</option>
                            {availableArtists
                              .sort((a, b) => a.localeCompare(b))
                              .map((artist, index) => (
                                <option key={index} value={artist}>
                                  {artist}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowArtistModal(true)}
                            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
                            title="Add New Artist"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* VIDEO Type Fields */}
                  {formData.content_type === 'video' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          YouTube Video URL
                        </label>
                        <input
                          type="url"
                          name="youtube_url"
                          value={formData.youtube_url}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>
                    </div>
                  )}

                  {/* MOVIE REVIEW Type Fields */}
                  {formData.content_type === 'movie_review' && (
                    <div className="space-y-4">
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
                        {formData.youtube_url && (
                          <p className="mt-1 text-xs text-gray-500">
                            Trailer will be embedded on the article page
                          </p>
                        )}
                      </div>

                      {/* Movie Info Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Rating (Stars) *
                          </label>
                          <select
                            name="movie_rating"
                            value={formData.movie_rating}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Select Rating</option>
                            <option value="0.5">★☆☆☆☆ (0.5)</option>
                            <option value="1.0">★☆☆☆☆ (1.0)</option>
                            <option value="1.5">★★☆☆☆ (1.5)</option>
                            <option value="2.0">★★☆☆☆ (2.0)</option>
                            <option value="2.5">★★★☆☆ (2.5)</option>
                            <option value="3.0">★★★☆☆ (3.0)</option>
                            <option value="3.5">★★★★☆ (3.5)</option>
                            <option value="4.0">★★★★☆ (4.0)</option>
                            <option value="4.5">★★★★★ (4.5)</option>
                            <option value="5.0">★★★★★ (5.0)</option>
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

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Cast (comma-separated)
                          </label>
                          <input
                            type="text"
                            name="review_cast"
                            value={formData.review_cast}
                            onChange={handleInputChange}
                            placeholder="e.g., Actor 1, Actor 2, Actor 3"
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

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
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Genre
                          </label>
                          <select
                            name="review_genre"
                            value={formData.review_genre}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            <option value="Family">Family</option>
                            <option value="Mystery">Mystery</option>
                            <option value="Adventure">Adventure</option>
                            <option value="Biography">Biography</option>
                            <option value="Musical">Musical</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Language
                          </label>
                          <select
                            name="movie_language"
                            value={formData.movie_language}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select Language</option>
                            <option value="Hindi">Hindi</option>
                            <option value="Telugu">Telugu</option>
                            <option value="Tamil">Tamil</option>
                            <option value="English">English</option>
                            <option value="Malayalam">Malayalam</option>
                            <option value="Kannada">Kannada</option>
                            <option value="Marathi">Marathi</option>
                            <option value="Bengali">Bengali</option>
                            <option value="Punjabi">Punjabi</option>
                            <option value="Gujarati">Gujarati</option>
                          </select>
                        </div>
                      </div>

                      {/* Trailer URL */}
                      
                      {/* Platform Selection */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                          Platform
                        </label>
                        <select
                          name="platform"
                          value={formData.platform}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Platform</option>
                          <option value="Theater">Theater</option>
                          <option value="OTT">OTT</option>
                          <option value="YouTube">YouTube</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* OTT Platform Selection - Show only when Platform is OTT */}
                      {formData.platform === 'OTT' && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700 text-left">
                              OTT Platform
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowOttModal(true)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Manage OTT Platforms
                            </button>
                          </div>
                          <select
                            name="ott_platform"
                            value={formData.ott_platform}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select OTT Platform</option>
                            {ottPlatforms
                              .filter(p => p.is_active)
                              .map(platform => (
                                <option key={platform.id} value={platform.name}>
                                  {platform.name}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      )}
                      
                      {/* Review Sections */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 text-left">Review Sections</h4>
                        
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

                        {/* Plot Summary */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Main Plot *
                          </label>
                          <textarea
                            name="review_plot_summary"
                            value={formData.review_plot_summary}
                            onChange={handleInputChange}
                            rows="4"
                            placeholder="Brief overview of the story without spoilers..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Performances */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Performances *
                          </label>
                          <textarea
                            name="review_performances"
                            value={formData.review_performances}
                            onChange={handleInputChange}
                            rows="4"
                            placeholder="Highlight key actors and their performances..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* What Works */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            What Works *
                          </label>
                          <textarea
                            name="review_what_works"
                            value={formData.review_what_works}
                            onChange={handleInputChange}
                            rows="4"
                            placeholder="Strengths and positive aspects of the movie..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* What Doesn't Work */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            What Doesn't Work *
                          </label>
                          <textarea
                            name="review_what_doesnt_work"
                            value={formData.review_what_doesnt_work}
                            onChange={handleInputChange}
                            rows="4"
                            placeholder="Weaknesses and issues with the movie..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Technical Aspects */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Technical Aspects (Optional)
                          </label>
                          <textarea
                            name="review_technical_aspects"
                            value={formData.review_technical_aspects}
                            onChange={handleInputChange}
                            rows="3"
                            placeholder="Music, Cinematography, Direction, etc..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Final Verdict */}
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                            Final Verdict *
                          </label>
                          <textarea
                            name="review_final_verdict"
                            value={formData.review_final_verdict}
                            onChange={handleInputChange}
                            rows="3"
                            placeholder="Overall recommendation and who should watch this movie..."
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Enable Movie Review Comments Checkbox */}
                        <div>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name="review_comments_enabled"
                              checked={formData.review_comments_enabled}
                              onChange={handleInputChange}
                              className="form-checkbox h-4 w-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Enable Movie Review Comments</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Content (Hidden for Movie Reviews, shown for other types) */}
                  {formData.content_type !== 'movie_review' && (
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
                          options: ['inline', 'blockType', 'list', 'textAlign', 'link', 'image', 'history'],
                          inline: {
                            inDropdown: false,
                            options: ['bold', 'italic', 'underline', 'strikethrough']
                          },
                          blockType: {
                            inDropdown: true,
                            options: ['Normal', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Blockquote']
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
                </div>
              )}
            </div>

            {/* SEO Section - Accordion */}
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
                </div>

                {/* Scheduling Section */}
                {formData.is_scheduled && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                      Scheduled Publish Date & Time (IST) *
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
                      The post will be automatically published at the scheduled time if auto-publishing is enabled by admin.
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
                        <div className="aspect-video bg-gray-100 rounded-md mb-3 overflow-hidden">
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
                        <div className="aspect-w-16 aspect-h-9 mb-3">
                          {gallery.images && gallery.images.length > 0 ? (
                            <img
                              src={gallery.images[0].url || gallery.images[0]}
                              alt={gallery.title}
                              className="w-full h-32 object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center">
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

      {/* OTT Platform Management Modal */}
      {showOttModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Manage OTT Platforms</h3>
              <button
                onClick={() => setShowOttModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {/* Add New Platform */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  Add New OTT Platform
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOttPlatformName}
                    onChange={(e) => setNewOttPlatformName(e.target.value)}
                    placeholder="Enter platform name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOttPlatform();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddOttPlatform}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Available Platforms List */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 text-left">Available Platforms</h4>
                <div className="space-y-2">
                  {ottPlatforms.map(platform => (
                    <div
                      key={platform.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <span className="text-sm text-gray-900">{platform.name}</span>
                      <span className={`text-xs px-2 py-1 rounded ${platform.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                        {platform.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t">
              <button
                onClick={() => setShowOttModal(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateArticle;