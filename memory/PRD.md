# Tadka CMS - Product Requirements Document

## Original Problem Statement
Build an "OTT Release Agent" to scrape binged.com, a "Theater Release Agent" to scrape IMDb for movie release information, and a "Movie Review Agent" to scrape and aggregate movie reviews from websites.

## What's Been Implemented

### OTT Release Agent (Complete)
- Scrapes binged.com for OTT release information
- Creates entries in `ott_releases` collection
- Full CMS management in Dashboard

### Theater Release Agent (Complete)
- **Date**: January 2025
- Scrapes IMDb calendar pages (e.g., `https://www.imdb.com/calendar/?region=IN`)
- Extracts: Title, Year, Release Date, Languages, Genres, Director, Cast, YouTube Trailer URL
- Agent configuration form with dropdowns and checkboxes
- Creates entries in `theater_releases` collection

### Movie Review Agent (Complete)
- **Date**: January 2026
- Scrapes movie reviews from multiple websites (GreatAndhra, Gulte, IdleBrain, 123Telugu, etc.)
- Extracts: Movie details, rating, cast, director, all review sections
- Uses LLM (from System Settings) to rewrite and format content
- **Rating Strategy**: Supports lowest/highest/average when multiple URLs provided
- **Language dropdown**: For state-language mapping on homepage
- Creates Movie Review posts in existing reviews section

### Homepage Display (Complete)
- Theater Releases section with tabs (Theater/Bollywood)
- OTT Releases section with tabs (OTT/Bollywood)
- State-to-language filtering based on user preferences
- Language display with (Dubbed)/(Original) labels
- Genre and Cast display for each movie
- Scrollable sections showing up to 20 releases
- Past 10 days filter + ascending date sort

## Prioritized Backlog

### P1 - YouTube Trailer Search Function
Implement the checkbox-enabled feature to search YouTube for trailers when Theater Agent runs.

### P2 - API Refactoring
Rename `/api/articles/sections/big-boss` → `/api/articles/sections/tv-reality-shows`

### P3 - Code Cleanup
Delete unused files:
- `release_sources_routes.py`
- `release_scraper_service.py`

## Key Database Collections
- `ai_agents`: Agent configurations (includes movie_review type)
- `theater_releases`: `{ movie_name, release_date, languages, genres, director, cast, youtube_url, status, is_published }`
- `ott_releases`: `{ movie_name, release_date, languages, ott_platforms, director, cast, synopsis, status }`
- `articles`: Movie reviews stored with `content_type: 'movie_review'`

## Tech Stack
- **Frontend**: React, Tailwind CSS
- **Backend**: FastAPI
- **Database**: MongoDB
- **Scraping**: BeautifulSoup4, httpx
- **LLM**: OpenAI/Gemini/Anthropic (configurable via System Settings)

## Key Files
- `/app/backend/services/movie_review_scraper_service.py` - Generic review scraper
- `/app/backend/services/movie_review_agent_service.py` - Agent orchestration + LLM
- `/app/frontend/src/components/PostAgentForm.jsx` - Agent configuration form
- `/app/frontend/src/components/CreateAgentModal.jsx` - Agent type selection
