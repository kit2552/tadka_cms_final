# Tadka - Personalized News Application

## Original Problem Statement
Build and maintain "Tadka", a full-stack news application with AI-powered content agents, movie reviews, and personalized content delivery based on user preferences (state, language, theme).

## Core Requirements
1. **Movie Review AI Agent** - Scrape and generate movie reviews from multiple sources
2. **Homepage Sections** - Various content sections (Top Stories, Trailers, Movie Reviews, OTT, Sports, etc.)
3. **Personalization** - Content filtering based on user's selected states and language preferences
4. **CMS** - Content management system for creating/editing articles

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI
- **Backend:** FastAPI, Motor (async MongoDB)
- **Database:** MongoDB
- **AI:** OpenAI via Emergent LLM Key

## What's Been Implemented

### Movie Review AI Agent (Completed)
- ✅ Single review URL processing
- ✅ Listing page URL processing (scrape multiple movies from one URL)
- ✅ Duplicate detection to avoid re-creating existing reviews
- ✅ Auto-generated "Quick Verdict" based on movie rating
- ✅ Gulte scraper (Telugu reviews)
- ✅ Pinkvilla scraper (Hindi reviews with YouTube trailer extraction)
- ✅ Configurable max reviews from listing page
- ✅ Editable rating-to-verdict mapping in System Settings

### Homepage Features (Completed)
- ✅ Multiple content sections with tab navigation
- ✅ State-based content filtering
- ✅ Bollywood tab in Movie Reviews showing Hindi content (`content_type=movie_review` + `content_language=hi`)
- ✅ Theme selection (Light, Dark, Colorful, Blue, Red)

### CMS Features (Completed)
- ✅ Article creation and editing
- ✅ Movie review specific fields (rating, cast, what works/doesn't work)
- ✅ YouTube trailer support
- ✅ Image gallery support

## Known Issues / Backlog

### P1 - User Verification Pending
- **Movie Review Page Layout** - Bottom padding/spacing issue. Previous fix attempt needs user verification.

### P2 - Not Started
- **Article Status Bug** - When Movie Review Agent creates articles with `content_workflow="in_review"`, the `status` field is saved as `None` instead of `draft`. Needs investigation in `movie_review_agent_service.py` and `crud.py`.

### Technical Debt
- `movie_review_scraper_service.py` is large - should be modularized into per-site parsers
- `ArticlePage.jsx` and `SystemSettings.jsx` are over 1000+ lines - should be broken into sub-components

## Key Files Reference
- `/app/backend/server.py` - Main FastAPI app and API routes
- `/app/backend/services/movie_review_agent_service.py` - Movie Review Agent logic
- `/app/backend/services/movie_review_scraper_service.py` - Web scraping (Gulte, Pinkvilla)
- `/app/backend/crud.py` - Database operations
- `/app/frontend/src/components/MovieReviews.jsx` - Homepage Movie Reviews component
- `/app/frontend/src/pages/ArticlePage.jsx` - Movie review detail page
- `/app/frontend/src/pages/SystemSettings.jsx` - System settings page

## Database Schema (Articles)
```json
{
  "id": Number,
  "title": String,
  "slug": String,
  "content_type": "movie_review" | "article" | ...,
  "content_language": "hi" | "te" | "en" | ...,
  "is_published": Boolean,
  "status": "draft" | "published" | ...,
  "movie_rating": String,
  "review_quick_verdict": String,
  "review_cast": String,
  "review_what_works": String,
  "review_what_doesnt_work": String,
  ...
}
```

## Last Updated
January 18, 2026
