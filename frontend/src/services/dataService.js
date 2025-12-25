import mockData from '../data/comprehensiveMockData';
import { STATE_CODE_MAPPING, parseStoredStates, DEFAULT_SELECTED_STATES } from '../utils/statesConfig';
import { getLanguagesForState } from '../utils/stateLanguageMapping';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL 
  ? `${process.env.REACT_APP_BACKEND_URL}/api`
  : 'http://localhost:8001/api';

export const dataService = {

  // Helper function to parse user state string into array of individual states
  parseUserStates(stateString) {
    return parseStoredStates(stateString);
  },
  
  // Helper function to get unique languages from user's selected states
  getLanguagesFromStates(stateCodes) {
    const languageSet = new Set();
    if (stateCodes && stateCodes.length > 0) {
      stateCodes.forEach(stateCode => {
        const languages = getLanguagesForState(stateCode);
        languages.forEach(lang => languageSet.add(lang));
      });
    }
    return Array.from(languageSet);
  },
  
  // Fetch Movie Reviews data from backend - latest 20 from each category
  async getMovieReviewsData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/movie-reviews?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch movie reviews');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching movie reviews:', error);
      // Fallback to empty data
      return {
        movie_reviews: [],
        bollywood: []
      };
    }
  },

  // Fetch trending videos data from backend - regional (filtered by language) and bollywood
  async getTrendingVideosData(userStateCodes = null) {
    try {
      console.log('🔍 getTrendingVideosData called with userStateCodes:', userStateCodes);
      
      let url = `${API_BASE_URL}/articles/sections/trending-videos?limit=20`;
      
      // Convert state codes to languages
      if (userStateCodes && userStateCodes.length > 0) {
        const userLanguages = this.getLanguagesFromStates(userStateCodes);
        console.log('🔍 Converted to languages:', userLanguages);
        if (userLanguages.length > 0) {
          url += `&languages=${userLanguages.join(',')}`;
        }
      }
      
      console.log('🔍 Fetching trending videos from:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch trending videos data');
      }
      const data = await response.json();
      console.log('Trending videos data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching trending videos data:', error);
      // Fallback to empty data structure
      return {
        trending_videos: [],
        bollywood: []
      };
    }
  },

  // Fetch Trailers & Teasers data from backend with state-based language filtering
  async getTrailersData(userStateCodes = null) {
    try {
      console.log('🔍 getTrailersData called with userStateCodes:', userStateCodes);
      
      let url = `${API_BASE_URL}/articles/sections/trailers-teasers?limit=20`;
      
      // Add states parameter if available
      if (userStateCodes && userStateCodes.length > 0) {
        url += `&states=${userStateCodes.join(',')}`;
        console.log('🔍 Trailers URL with states:', url);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch trailers data');
      }
      const data = await response.json();
      console.log('Trailers data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching trailers data:', error);
      // Fallback to empty data structure
      return {
        trailers: [],
        bollywood: []
      };
    }
  },

  // Fetch Politics data from backend - state politics with user state filtering and national politics
  async getPoliticsData(userStates = ['Andhra Pradesh', 'Telangana']) {
    try {
      // Map user states to state codes that match the backend using centralized mapping
      const userStateCodes = userStates.map(state => {
        return STATE_CODE_MAPPING[state] || state.toLowerCase();
      });
      
      // Build API URL with state codes as query parameter
      const stateCodesParam = userStateCodes.length > 0 ? userStateCodes.join(',') : '';
      const apiUrl = `${API_BASE_URL}/articles/sections/politics?limit=20${stateCodesParam ? `&states=${stateCodesParam}` : ''}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch politics data');
      }
      const data = await response.json();
      
      return {
        state_politics: data.state_politics || [],
        national_politics: data.national_politics || []
      };
    } catch (error) {
      console.error('Error fetching politics data:', error);
      // Fallback to empty data
      return {
        state_politics: [],
        national_politics: []
      };
    }
  },

  // Fetch Movies data from backend - movie news with user state filtering and bollywood movies
  async getMoviesData(userStates = ['AP', 'Telangana']) {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/movies?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch movies data');
      }
      const data = await response.json();
      
      // Filter movie news based on user's selected states (similar to politics filtering)
      // Use the 'states' field from the backend API for filtering
      const filteredMovieNewsArticles = data.movies.filter(article => {
        // If no states field, show all articles (for backwards compatibility)
        if (!article.states) {
          return true;
        }
        
        // Parse states field (it could be a JSON string or already an array)
        let articleStates = [];
        try {
          if (typeof article.states === 'string') {
            articleStates = JSON.parse(article.states);
          } else if (Array.isArray(article.states)) {
            articleStates = article.states;
          }
        } catch (error) {
          console.warn('Error parsing states field for movie article', article.id, error);
          return true; // Show article if we can't parse states
        }
        
        // If article has "all" states, show to everyone
        if (articleStates.includes('all')) {
          return true;
        }
        
        // Map user states to state codes that match the backend using centralized mapping
        const userStateCodes = userStates.map(state => {
          return STATE_CODE_MAPPING[state] || state.toLowerCase();
        });
        
        // Check if any of the user's state codes match the article's target states
        return userStateCodes.some(userStateCode => 
          articleStates.includes(userStateCode) || 
          articleStates.includes(userStateCode.toLowerCase())
        );
      });
      
      return {
        movie_news: filteredMovieNewsArticles,
        bollywood_movies: data.bollywood // Bollywood is shown to all users without state filtering
      };
    } catch (error) {
      console.error('Error fetching movies data:', error);
      // Fallback to empty data
      return {
        movie_news: [],
        bollywood_movies: []
      };
    }
  },

  // Function to refresh state-related sections when user changes state preferences
  async refreshStateRelatedSections(userStates) {
    try {
      const politicsData = await this.getPoliticsData(userStates);
      const moviesData = await this.getMoviesData(userStates);
      
      return {
        politicsData,
        moviesData
      };
    } catch (error) {
      console.error('Error refreshing state-related sections:', error);
      return {
        politicsData: { state_politics: [], national_politics: [] },
        moviesData: { movie_news: [], bollywood_movies: [] }
      };
    }
  },

  // Fetch sports data from backend - cricket and other sports
  async getSportsData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/sports`);
      if (!response.ok) {
        throw new Error('Failed to fetch sports data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching sports data:', error);
      // Fallback to mock data structure
      return {
        cricket: [],
        other_sports: []
      };
    }
  },
  async getOTTMovieReviewsData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/ott-movie-reviews`);
      if (!response.ok) {
        throw new Error('Failed to fetch OTT reviews');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching OTT reviews:', error);
      // Fallback to empty data
      return {
        ott_movie_reviews: [],
        web_series: []
      };
    }
  },

  // Fetch events & press meets data from backend (aggregated by event name)
  async getEventsInterviewsData(userStateCodes = null) {
    try {
      console.log('🔍 getEventsInterviewsData called with userStateCodes:', userStateCodes);
      
      // Use aggregated endpoint
      let url = `${API_BASE_URL}/articles/sections/events-interviews-aggregated?limit=20`;
      
      // Add states parameter if available
      if (userStateCodes && userStateCodes.length > 0) {
        url += `&states=${userStateCodes.join(',')}`;
        console.log('🔍 Events & Press Meets URL with states:', url);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch events & press meets data');
      }
      const data = await response.json();
      console.log('Events & Press Meets data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching events & press meets data:', error);
      return { events_interviews: [], bollywood: [] };
    }
  },

  async getBigBossData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/big-boss?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch big boss data');
      }
      const data = await response.json();
      console.log('Big Boss data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching big boss data:', error);
      return { big_boss: [], bollywood: [] };
    }
  },

  // Fetch TV Today data from backend (aggregated by show/program name)
  async getTVTodayData(userStateCodes = null) {
    try {
      console.log('🔍 getTVTodayData called with userStateCodes:', userStateCodes);
      
      let url = `${API_BASE_URL}/articles/sections/tv-today-aggregated?limit=20`;
      
      if (userStateCodes && userStateCodes.length > 0) {
        url += `&states=${userStateCodes.join(',')}`;
        console.log('🔍 TV Today URL with states:', url);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch TV Today data');
      }
      const data = await response.json();
      console.log('TV Today data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching TV Today data:', error);
      return { tv_today: [], hindi: [] };
    }
  },

  // Fetch News Today data from backend (aggregated by news topic)
  async getNewsTodayData(userStateCodes = null) {
    try {
      console.log('🔍 getNewsTodayData called with userStateCodes:', userStateCodes);
      
      let url = `${API_BASE_URL}/articles/sections/news-today-aggregated?limit=20`;
      
      if (userStateCodes && userStateCodes.length > 0) {
        url += `&states=${userStateCodes.join(',')}`;
        console.log('🔍 News Today URL with states:', url);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch News Today data');
      }
      const data = await response.json();
      console.log('News Today data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching News Today data:', error);
      return { news_today: [], hindi: [] };
    }
  },

  async getHealthFoodData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/health-food?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch health & food data');
      }
      const data = await response.json();
      console.log('Health & Food data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching health & food data:', error);
      return { health: [], food: [] };
    }
  },

  async getFashionTravelData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/fashion-travel?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch fashion & travel data');
      }
      const data = await response.json();
      console.log('Fashion & Travel data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching fashion & travel data:', error);
      return { fashion: [], travel: [] };
    }
  },

  async getAiStockMarketData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/ai-stock?limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch AI & Stock Market data');
      }
      const data = await response.json();
      console.log('AI & Stock Market data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching AI & Stock Market data:', error);
      return { ai: [], stock_market: [], fashion: [], travel: [] };
    }
  },

  // Fetch tadka shorts data from backend - tadka shorts and bollywood with state filtering for tadka shorts
  async getViralShortsData(userStateCodes = null) {
    try {
      console.log('🔍 getViralShortsData (Tadka Shorts) called with userStateCodes:', userStateCodes);
      
      let url = `${API_BASE_URL}/articles/sections/tadka-shorts?limit=20`;
      
      // Add states parameter if available
      if (userStateCodes && userStateCodes.length > 0) {
        url += `&states=${userStateCodes.join(',')}`;
        console.log('🔍 Tadka Shorts URL with states:', url);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch tadka shorts data');
      }
      const data = await response.json();
      console.log('Tadka Shorts data:', data); // Debug log
      return data;
    } catch (error) {
      console.error('Error fetching tadka shorts data:', error);
      // Fallback to empty data structure
      return {
        tadka_shorts: [],
        bollywood: []
      };
    }
  },

  // Fetch hot topics data from backend - hot topics with user state filtering and bollywood hot topics
  async getHotTopicsData(userStates = ['Andhra Pradesh', 'Telangana']) {
    try {
      // Map user states to state codes that match the backend using centralized mapping
      const userStateCodes = userStates.map(state => {
        return STATE_CODE_MAPPING[state] || state.toLowerCase();
      });
      
      // Build API URL with state codes as query parameter for hot topics filtering
      const stateCodesParam = userStateCodes.length > 0 ? userStateCodes.join(',') : '';
      const apiUrl = `${API_BASE_URL}/articles/sections/hot-topics?limit=20${stateCodesParam ? `&states=${stateCodesParam}` : ''}`;
      
      console.log('🔥 HOT TOPICS BACKEND FILTERING:');
      console.log('- User states from localStorage:', userStates);
      console.log('- User state codes for backend:', userStateCodes);
      console.log('- API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch hot topics data');
      }
      const data = await response.json();
      
      console.log('- Backend returned hot topics articles:', data.hot_topics?.length || 0);
      console.log('- Backend returned bollywood articles:', data.bollywood?.length || 0);
      
      return {
        hot_topics: data.hot_topics || [],
        bollywood: data.bollywood || []
      };
    } catch (error) {
      console.error('Error fetching hot topics data:', error);
      // Fallback to empty data
      return {
        hot_topics: [],
        bollywood: []
      };
    }
  },

  // Fetch top stories data from backend
  async getTopStoriesData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/top-stories`);
      if (!response.ok) {
        throw new Error('Failed to fetch top stories');
      }
      const data = await response.json();
      console.log('✅ Top Stories fetched from database:', {
        state: data.top_stories?.length || 0,
        national: data.national?.length || 0
      });
      return data;
    } catch (error) {
      console.error('❌ Error fetching top stories:', error);
      // Return empty arrays instead of mock data
      return {
        top_stories: [],
        national: []
      };
    }
  },

  // Fetch NRI News data from backend with state filtering
  async getNRINewsData(userStates = ['Andhra Pradesh', 'Telangana']) {
    try {
      // Map user states to state codes that match the backend using centralized mapping
      const userStateCodes = userStates.map(state => {
        return STATE_CODE_MAPPING[state] || state.toLowerCase();
      });
      
      // Build API URL with state codes as query parameter for NRI news filtering
      const stateCodesParam = userStateCodes.length > 0 ? userStateCodes.join(',') : '';
      const apiUrl = `${API_BASE_URL}/articles/sections/nri-news?limit=10${stateCodesParam ? `&states=${stateCodesParam}` : ''}`;
      
      console.log('🌍 NRI NEWS BACKEND STATE FILTERING:');
      console.log('- User states from localStorage:', userStates);
      console.log('- Mapped to state codes:', userStateCodes);
      console.log('- API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch NRI News data');
      }
      const data = await response.json();
      
      console.log('- Backend returned NRI News articles:', data.length);
      
      return data;
    } catch (error) {
      console.error('Error fetching NRI News data:', error);
      return [];
    }
  },

  // Fetch World News data from backend
  async getWorldNewsData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/world-news?limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch World News data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching World News data:', error);
      return [];
    }
  },

  // Fetch Photoshoots data from backend
  async getPhotoshootsData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/photoshoots?limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch Photoshoots data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching Photoshoots data:', error);
      return [];
    }
  },

  // Fetch Travel Pics data from backend
  async getTravelPicsData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/travel-pics?limit=10`);
      if (!response.ok) {
        throw new Error('Failed to fetch Travel Pics data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching Travel Pics data:', error);
      return [];
    }
  },

  // Fetch Movie Schedules (Theater & OTT Releases) data from backend
  async getMovieSchedulesData() {
    try {
      const response = await fetch(`${API_BASE_URL}/releases`);
      if (!response.ok) {
        throw new Error('Failed to fetch Movie Schedules data');
      }
      const data = await response.json();
      // Format data for MovieSchedules component
      return {
        theater: data.theater || { this_week: [], coming_soon: [] },
        ott: data.ott || { this_week: [], coming_soon: [] }
      };
    } catch (error) {
      console.error('Error fetching Movie Schedules data:', error);
      return { theater: { this_week: [], coming_soon: [] }, ott: { this_week: [], coming_soon: [] } };
    }
  },

  // Fetch Box Office data from backend
  async getBoxOfficeData() {
    try {
      const response = await fetch(`${API_BASE_URL}/articles/sections/box-office?limit=4`);
      if (!response.ok) {
        throw new Error('Failed to fetch Box Office data');
      }
      const data = await response.json();
      console.log('Box Office data fetched:', data);
      // Return the data in the expected format for BoxOffice component
      return data;
    } catch (error) {
      console.error('Error fetching Box Office data:', error);
      return { box_office: [], bollywood: [] };
    }
  },

  // Get all data needed for the home page
  async getHomePageData() {
    try {
      // Get user's actual state preferences from localStorage
      const userStateString = localStorage.getItem('tadka_state') || JSON.stringify(DEFAULT_SELECTED_STATES);
      const userStates = this.parseUserStates(userStateString);
      
      // Convert state names to state codes
      const userStateCodes = userStates.map(state => STATE_CODE_MAPPING[state] || state.toLowerCase());
      
      console.log('🏠 Loading homepage data with states:', userStates, 'codes:', userStateCodes);

      // Fetch all data in parallel - no caching, CDN handles it
      const [
        topStoriesData,
        movieReviewsData,
        ottMovieReviewsData,
        politicsData,
        moviesData,
        sportsData,
        trendingVideosData,
        trailersData,
        nriNewsData,
        worldNewsData,
        viralShortsData,
        eventsInterviewsData,
        tvTodayData,
        newsTodayData,
        bigBossData,
        healthFoodData,
        fashionTravelData,
        aiStockMarketData,
        hotTopicsData,
        photoshootsData,
        travelPicsData,
        boxOfficeData,
        movieSchedulesData
      ] = await Promise.all([
        this.getTopStoriesData(),
        this.getMovieReviewsData(),
        this.getOTTMovieReviewsData(),
        this.getPoliticsData(userStates),
        this.getMoviesData(userStates),
        this.getSportsData(),
        this.getTrendingVideosData(userStateCodes),
        this.getTrailersData(userStateCodes),
        this.getNRINewsData(userStates),
        this.getWorldNewsData(),
        this.getViralShortsData(userStateCodes),
        this.getEventsInterviewsData(userStateCodes),
        this.getTVTodayData(userStateCodes),
        this.getNewsTodayData(userStateCodes),
        this.getBigBossData(),
        this.getHealthFoodData(),
        this.getFashionTravelData(),
        this.getAiStockMarketData(),
        this.getHotTopicsData(userStates),
        this.getPhotoshootsData(),
        this.getTravelPicsData(),
        this.getBoxOfficeData(),
        this.getMovieSchedulesData()
      ]);

      console.log('✅ Homepage data loaded successfully');

      // Viral videos data contains NRI and World news
      const viralVideosData = { 
        usa: nriNewsData, 
        row: worldNewsData 
      };

      // Combined Tadka Pics data
      const tadkaPicsData = {
        photoshoots: photoshootsData,
        travel_pics: travelPicsData
      };

      // Return combined data with API-driven content
      return {
        topStoriesData,
        movieReviewsData,
        ottMovieReviewsData,
        politicsData,
        moviesData,
        sportsData,
        trendingVideosData,
        trailersData,
        viralVideosData,
        viralShortsData,
        eventsInterviewsData,
        tvTodayData,
        newsTodayData,
        bigBossData,
        healthFoodData,
        fashionTravelData,
        aiStockMarketData,
        hotTopicsData,
        tadkaPicsData,
        boxOfficeData,
        bigStory: mockData.bigStory,
        featuredMovieReview: (movieReviewsData.movie_reviews && movieReviewsData.movie_reviews[0]) || mockData.movieReviews[0] || null,
        featuredEntertainmentStory: mockData.featuredEntertainmentStory,
        featuredReview: (movieReviewsData.movie_reviews && movieReviewsData.movie_reviews[0]) || mockData.movieReviews[0] || null,
        fourthStory: mockData.politicalNews[0] || {
          title: "Major Sports Championship Finals Begin",
          summary: "The championship finals kick off with record-breaking viewership and unprecedented excitement.",
          image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=320&h=180&fit=crop",
          author: "Sports Correspondent",
          publishedAt: "2026-06-30T10:00:00Z",
          category: "sports"
        },
        topNews: mockData.topNews,
        mostRead: mockData.topNews.slice(0, 15),
        teluguNews: mockData.topNews.slice(5, 20),
        talkOfTown: boxOfficeData,
        politicalNews: mockData.politicalNews,
        entertainmentNews: mockData.entertainmentNews,
        featuredImages: mockData.featuredImages,
        largeFeatureImage: mockData.largeFeatureImage,
        movieNews: mockData.movieNews,
        movieGossip: mockData.movieGossip,
        andhraNews: mockData.andhraNews,
        telanganaNews: mockData.telanganaNews,
        gossip: mockData.gossip,
        reviews: mockData.reviews,
        movieSchedules: movieSchedulesData,
        features: mockData.features,
        mostPopular: mockData.mostPopular
      };
    } catch (error) {
      console.error('Error loading home page data:', error);
      throw error;
    }
  },

  // Get articles by category for individual pages
  async getArticlesByCategory(categorySlug, limit = 20) {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Map category slugs to mock data
      const categoryMap = {
        'politics': mockData.politicalNews,
        'movies': mockData.movieNews,
        'entertainment': mockData.entertainmentNews,
        'education': mockData.educationNews,
        'talk-of-town': mockData.talkOfTown,
        'top-news': mockData.topNews,
        'reviews': mockData.reviews,
        'gossip': mockData.gossip,
        'features': mockData.features,
        'gallery': mockData.galleryPhotos
      };

      const articles = categoryMap[categorySlug] || mockData.topNews;
      
      return articles.slice(0, limit).map(article => ({
        id: article.id,
        title: article.title,
        summary: article.summary || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        image: article.image || "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=300&h=200&fit=crop",
        author: article.author || article.photographer || "Staff Writer",
        publishedAt: article.publishedAt,
        category: article.category || { name: categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1) },
        photographer: article.photographer,
        viewCount: Math.floor(Math.random() * 1000) + 100
      }));
    } catch (error) {
      console.error(`Error fetching ${categorySlug} articles:`, error);
      return [];
    }
  },

  // Get a single article by ID
  async getArticleById(articleId) {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Search through all categories to find the article
      const allArticles = [
        ...mockData.topNews,
        ...mockData.politicalNews,
        ...mockData.entertainmentNews,
        ...mockData.movieNews,
        ...mockData.educationNews,
        ...mockData.talkOfTown,
        ...mockData.reviews,
        ...mockData.gossip,
        ...mockData.features
      ];

      const article = allArticles.find(article => article.id === parseInt(articleId));
      
      if (!article) {
        return null;
      }

      // Return article with enhanced details
      return {
        id: article.id,
        title: article.title,
        summary: article.summary || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        content: article.content || `${article.summary || 'This is a comprehensive article about the topic.'}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nSed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.`,
        image: article.image || "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&h=600&fit=crop",
        author: article.author || "DesiTrends Editorial Team",
        published_at: article.publishedAt || new Date().toISOString(),
        category: this.determineCategory(article),
        view_count: Math.floor(Math.random() * 5000) + 100,
        section: article.section || 'article'
      };
    } catch (error) {
      console.error(`Error fetching article ${articleId}:`, error);
      return null;
    }
  },

  // Helper method to determine article category
  determineCategory(article) {
    if (mockData.politicalNews.includes(article)) return 'Politics';
    if (mockData.entertainmentNews.includes(article)) return 'Entertainment';
    if (mockData.movieNews.includes(article)) return 'Movies';
    if (mockData.educationNews.includes(article)) return 'Education';
    if (mockData.talkOfTown.includes(article)) return 'Talk of Town';
    if (mockData.reviews.includes(article)) return 'Reviews';
    if (mockData.gossip.includes(article)) return 'Gossip';
    if (mockData.features.includes(article)) return 'Features';
    return 'News';
  }
};

export default dataService;