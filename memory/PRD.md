# Tadka CMS - Product Requirements Document

## Original Problem Statement
Build an "OTT Release Agent" to scrape binged.com, and a "Theater Release Agent" to scrape IMDb for movie release information.

## What's Been Implemented

### OTT Release Agent (Complete)
- Scrapes binged.com for OTT release information
- Creates entries in `ott_releases` collection
- Full CMS management in Dashboard

### Theater Release Agent (Complete)
- **Date**: January 2025
- Scrapes IMDb calendar pages (e.g., `https://www.imdb.com/calendar/?region=IN`)
- Extracts: Title, Year, Release Date, Languages, Genres, Director, Cast, YouTube Trailer URL
- Agent configuration form with:
  - Dropdown for number of posts to fetch
  - Checkbox to exclude English movies
  - Checkbox for YouTube trailer search (placeholder)
  - Workflow status selection
- Creates entries in `theater_releases` collection

### Homepage Display (Complete)
- Theater Releases section with tabs (Theater/Bollywood)
- State-to-language filtering based on user preferences
- Language display with (Dubbed)/(Original) labels
- **Genre and Cast display** for each movie

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
- `ai_agents`: Agent configurations
- `theater_releases`: `{ movie_name, release_date, languages, genres, director, cast, youtube_url, status, is_published }`
- `ott_releases`: `{ movie_name, release_date, languages, ott_platforms, director, cast, synopsis, status }`

## Tech Stack
- **Frontend**: React, Tailwind CSS
- **Backend**: FastAPI
- **Database**: MongoDB
- **Scraping**: BeautifulSoup4, httpx
