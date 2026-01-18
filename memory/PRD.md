# Tadka - Personalized News Application

## Original Problem Statement
Build and maintain "Tadka", a full-stack news application with AI-powered content agents, movie reviews, OTT reviews, and personalized content delivery based on user preferences (state, language, theme).

## Core Requirements
1. **Movie Review AI Agent** - Scrape and generate movie reviews from multiple sources
2. **OTT Review AI Agent** - Scrape OTT reviews from Binged.com with movie/series metadata
3. **Homepage Sections** - Various content sections (Top Stories, Trailers, Movie Reviews, OTT Reviews, Sports, etc.)
4. **Personalization** - Content filtering based on user's selected states and language preferences
5. **CMS** - Content management system for creating/editing articles

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, Motor (async MongoDB)
- **Database:** MongoDB
- **AI:** OpenAI via Emergent LLM Key
- **Scraping:** httpx with HTTP/2 support, BeautifulSoup4

## What's Been Implemented

### OTT Review AI Agent (Completed - January 18, 2026)
- ✅ Scrapes OTT reviews from binged.com/category/reviews/
- ✅ Extracts review content, rating, and verdict
- ✅ Fetches movie/series metadata (cast, director, platform) from OTT releases data
- ✅ Language support: Telugu, Tamil, Kannada, Malayalam, Hindi, English, etc.
- ✅ State-language mapping for regional content filtering
- ✅ Bollywood tab shows Hindi + English reviews
- ✅ Agent form with Review Language, Website Source, Reviews to Process, Content Workflow
- ✅ Rating display same as Movie Reviews (X/5 with stars, no tagline)
- ✅ Language badge shows "Dubbed" vs original language distinction
- ✅ HTTP/2 with proper headers to bypass binged.com scraping protection

### Movie Review AI Agent (Completed)
- ✅ Single review URL processing
- ✅ Listing page URL processing (scrape multiple movies from one URL)
- ✅ Duplicate detection to avoid re-creating existing reviews
- ✅ Auto-generated "Quick Verdict" based on movie rating
- ✅ Gulte scraper (Telugu reviews)
- ✅ Pinkvilla scraper (Hindi reviews with YouTube trailer extraction)
- ✅ Bollywood Hungama scraper
- ✅ GreatAndhra scraper
- ✅ Configurable max reviews from listing page
- ✅ Editable rating-to-verdict mapping in System Settings
- ✅ Action Needed workflow for reviews missing YouTube URL

### Homepage Features (Completed)
- ✅ Multiple content sections with tab navigation
- ✅ State-based content filtering
- ✅ Bollywood tab in Movie Reviews showing Hindi content
- ✅ OTT Reviews section with "OTT Reviews" (regional) and "Bollywood" (Hindi+English) tabs
- ✅ Theme selection (Light, Dark, Colorful, Blue, Red)

### CMS Features (Completed)
- ✅ Article creation and editing
- ✅ Movie review specific fields (rating, cast, what works/doesn't work)
- ✅ YouTube trailer support
- ✅ Image gallery support
- ✅ Action Needed tab for incomplete articles
- ✅ AI Agent management (Create, Edit, Run, Delete, Toggle)

## Known Issues / Backlog

### P1 - User Verification Pending
- **Movie Review Page Layout** - Bottom padding/spacing issue. Previous fix attempt needs user verification.

### P2 - Not Started
- **Article Status Bug** - When Movie Review Agent creates articles with `content_workflow="in_review"`, the `status` field is saved as `None` instead of `draft`.

### Technical Debt
- `movie_review_scraper_service.py` is large - should be modularized into per-site parsers
- `ArticlePage.jsx` and `SystemSettings.jsx` are over 1000+ lines - should be broken into sub-components
- Duplicate "Action Needed" logic in `server.py` PUT and PATCH endpoints - needs refactoring

## Key Files Reference
- `/app/backend/server.py` - Main FastAPI app and API routes
- `/app/backend/services/movie_review_agent_service.py` - Movie Review Agent logic
- `/app/backend/services/movie_review_scraper_service.py` - Web scraping (Gulte, Pinkvilla, etc.)
- `/app/backend/services/ott_review_agent_service.py` - OTT Review Agent logic
- `/app/backend/services/ott_review_scraper_service.py` - Binged.com OTT review scraping
- `/app/backend/services/binged_scraper_service.py` - Binged.com OTT releases scraping
- `/app/backend/routes/ai_agents_routes.py` - AI Agent API routes
- `/app/backend/crud.py` - Database operations
- `/app/frontend/src/components/MovieReviews.jsx` - Homepage Movie Reviews component
- `/app/frontend/src/components/OTTMovieReviews.jsx` - Homepage OTT Reviews component
- `/app/frontend/src/components/PostAgentForm.jsx` - AI Agent creation form
- `/app/frontend/src/components/CreateAgentModal.jsx` - Agent type selection modal
- `/app/frontend/src/pages/ArticlePage.jsx` - Movie review detail page
- `/app/frontend/src/pages/AIAgents.jsx` - AI Agents management page

## Database Schema (Articles)
```json
{
  "id": Number,
  "title": String,
  "slug": String,
  "content_type": "movie_review" | "ott_review" | "article" | ...,
  "content_language": "hi" | "te" | "en" | ...,
  "is_published": Boolean,
  "status": "draft" | "published" | ...,
  "movie_rating": String,
  "review_quick_verdict": String,
  "review_cast": String,
  "review_director": String,
  "review_what_works": String,
  "review_what_doesnt_work": String,
  "ott_platforms": String (JSON array),
  "languages": String (JSON array),
  "original_language": String,
  "action_needed": Boolean,
  "action_needed_reasons": Array,
  ...
}
```

## Last Updated
January 18, 2026
