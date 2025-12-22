# Tadka News - Application Handoff Summary

## Application Overview
Tadka News is a comprehensive news and entertainment content management system with AI-powered content generation. It features a React frontend, FastAPI backend, and MongoDB database.

## Core Features

### 1. Content Management System (CMS)
- Article creation, editing, and publishing
- Photo galleries management
- Movie and OTT reviews
- Category-based content organization

### 2. AI Agents for Automated Content Generation
- **Post Agent**: Generates news articles using AI
- **Video Agent**: Curates video content from YouTube RSS feeds
- **Photo Gallery Agent**: Creates photo galleries
- **Tadka Pics Agent**: Manages entertainment images
- **Review Agent**: Generates movie/OTT reviews

### 3. YouTube Video Integration
- YouTube channel management via RSS feeds
- Automatic video fetching (Videos and/or Shorts)
- Multi-language channel support with manual language assignment
- Video content filtering (include/exclude keywords)

### 4. User Preferences
- State-based content preferences
- Language mapping (states → languages)
- Personalized content delivery

## Technical Architecture

### Backend (FastAPI)
```
/app/backend/
├── server.py                 # Main FastAPI application
├── crud.py                   # Database operations
├── auth.py                   # Authentication
├── database.py               # MongoDB connection
├── scheduler_service.py      # Agent scheduling
├── state_language_mapping.py # State to language mappings
├── routes/
│   ├── ai_agents_routes.py   # AI agent CRUD & execution
│   ├── youtube_channels_routes.py
│   ├── articles_routes.py
│   └── ... (other route files)
├── services/
│   ├── video_agent_service.py    # Video content generation (NO YouTube API fallback)
│   ├── youtube_rss_service.py    # RSS feed fetching
│   ├── post_agent_service.py     # Article generation
│   └── ... (other services)
└── models/
```

### Frontend (React)
```
/app/frontend/src/
├── pages/
│   ├── AIAgents.jsx          # Agent dashboard
│   ├── SystemSettings.jsx    # System configuration (~2600 lines - needs refactor)
│   ├── ManagePosts.jsx       # Content management
│   └── ... (other pages)
├── components/
│   ├── PostAgentForm.jsx     # Agent configuration form (~1300 lines)
│   ├── ManageVideosModal.jsx # Video management modal
│   └── ... (other components)
└── services/
    └── dataService.js        # API calls with state→language mapping
```

### Database (MongoDB)
Key Collections:
- `articles`: News articles, video posts, galleries
- `ai_agents`: Agent configurations
- `youtube_channels`: Channel settings
- `youtube_videos`: Cached video data from RSS
- `categories`: Content categories
- `users`: User accounts
- `system_settings`: App configuration

## Key Technical Decisions

### 1. Video Agent Targeting
- **Uses `target_language`** (NOT `target_state`)
- Frontend maps user's preferred states → languages
- Queries content by language, not geography

### 2. Content Source for Video Agent
- **RSS feeds ONLY** - No YouTube API fallback
- Videos stored in `youtube_videos` collection
- If no matching videos found, agent reports "no videos found"

### 3. Category Naming
- `latest-video-songs` (was `trending-videos`)
- `latest-video-songs-bollywood` (was `trending-videos-bollywood`)
- `tadka-shorts`, `tadka-shorts-bollywood`

### 4. Multi-Language Channels
- Videos from multi-language channels flagged for manual review
- User can assign language or "Skip" the video
- Skipped videos excluded from all agent processing

## Database Schema (Key Fields)

### ai_agents
```javascript
{
  id: string,
  agent_name: string,
  agent_type: "post" | "video" | "photo_gallery" | "tadka_pics" | "review",
  target_language: string,  // e.g., "Telugu", "Hindi"
  include_keywords: string[],
  exclude_keywords: string[],
  content_filter: "videos" | "shorts" | "both",
  is_active: boolean,
  mode: "recurring" | "adhoc",
  schedule_selection: string,
  post_time: string
}
```

### youtube_channels
```javascript
{
  id: string,
  channel_id: string,
  channel_name: string,
  language: string,
  is_multi_language: boolean,
  fetch_videos: boolean,  // default: true
  fetch_shorts: boolean,  // default: false
  is_active: boolean
}
```

### youtube_videos
```javascript
{
  id: string,
  video_id: string,
  title: string,
  channel_id: string,
  language: string,
  is_short: boolean,
  is_skipped: boolean,
  published_at: datetime
}
```

### articles (for video posts)
```javascript
{
  id: string,
  title: string,
  slug: string,
  category: string,  // e.g., "latest-video-songs"
  video_language: string,
  video_url: string,
  status: "published" | "draft"
}
```

## API Endpoints (Key)

### AI Agents
- `GET /api/ai-agents` - List all agents
- `POST /api/ai-agents` - Create agent
- `PUT /api/ai-agents/{id}` - Update agent
- `DELETE /api/ai-agents/{id}` - Delete agent
- `POST /api/ai-agents/{id}/run` - Execute agent
- `POST /api/ai-agents/{id}/toggle` - Toggle active status

### YouTube Channels
- `GET /api/youtube-channels` - List channels
- `POST /api/youtube-channels` - Add channel
- `PUT /api/youtube-channels/{id}` - Update channel
- `DELETE /api/youtube-channels/{id}` - Delete channel
- `POST /api/youtube-channels/{id}/fetch` - Fetch videos from RSS

### YouTube Videos
- `GET /api/youtube-rss/videos` - List cached videos
- `PUT /api/youtube-rss/videos/{id}/skip` - Skip video
- `PUT /api/youtube-rss/videos/{id}/language` - Set language

### Articles
- `GET /api/articles/sections/latest-video-songs?languages=Telugu,Hindi`
- `GET /api/articles/sections/tadka-shorts?languages=Telugu`

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://...
DB_NAME=tadka_news
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
OPENAI_API_KEY=...  (for AI content generation)
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://...
```

## Known Issues / Technical Debt

1. **SystemSettings.jsx** (~2600 lines) - Needs component breakdown
2. **PostAgentForm.jsx** (~1300 lines) - Complex, needs refactor
3. **Multi-language detection** - Relies on manual user intervention
4. **Historical data** - Some old articles may have deprecated category slugs

## Third-Party Integrations

1. **YouTube RSS Feeds** - Video content sourcing
2. **YouTube Data API v3** - Channel URL resolution only
3. **OpenAI API** - AI content generation
4. **AWS S3** - Image storage
5. **MongoDB** - Database

## Running the Application

Services managed by Supervisor:
- Backend: Port 8001
- Frontend: Port 3000

```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# View logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/frontend.err.log
```

## Quick Start for New Session

When starting a new Emergent chat session, provide this context:

```
This is a news/entertainment CMS called Tadka News with:
- React frontend + FastAPI backend + MongoDB
- AI agents for automated content generation
- YouTube video integration via RSS feeds
- Multi-language content support

Key files to reference:
- /app/backend/server.py (main API)
- /app/backend/services/video_agent_service.py (video content generation)
- /app/frontend/src/pages/AIAgents.jsx (agent dashboard)
- /app/frontend/src/pages/SystemSettings.jsx (system config)
- /app/frontend/src/components/PostAgentForm.jsx (agent form)

Important: Video agents use target_language (not target_state). 
Content comes from local youtube_videos collection only (no YouTube API fallback).
```
