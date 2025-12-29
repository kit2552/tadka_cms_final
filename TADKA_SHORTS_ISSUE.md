# Tadka Shorts Not Showing - Content Issue

## 🔍 Root Cause

The endpoint `/api/articles/sections/tadka-shorts` is **CORRECT**. It filters by `content_language` field based on user's selected states.

**The Problem**: The Tadka Shorts articles in the database are missing the `content_language` field!

## 📊 Current State

**Article #158 (Rashmika)**:
- `states`: `["ts"]` ✅ 
- `article_language`: `"en"` ❌ (wrong)
- `content_language`: **NOT SET** ❌ (missing!)

**Expected**:
- `states`: `["ts"]` ✅
- `article_language`: `"en"` ✅ (for UI/interface)
- `content_language`: `"te"` ✅ (Telugu - for filtering)

## 🔧 How the Filtering Works

1. User selects states: `["Telangana", "Andhra Pradesh"]`
2. Frontend converts to codes: `["ts", "ap"]`
3. Backend maps to languages: `["Telugu"]`
4. Backend converts to codes: `["te"]`
5. Backend filters: `content_language IN ["te"]`

## ✅ Solution

Update the Tadka Shorts article to set `content_language`:

```javascript
// For Telugu article
content_language: "te"

// For Tamil article
content_language: "ta"

// For Hindi article  
content_language: "hi"
```

## 🎯 Language Codes Reference

- Telugu: `te`
- Tamil: `ta`
- Hindi: `hi`
- Kannada: `kn`
- Malayalam: `ml`
- Bengali: `bn`
- Marathi: `mr`
- Punjabi: `pa`
- Gujarati: `gu`

## 📝 State to Language Mapping

- Telangana (ts) → Telugu (te)
- Andhra Pradesh (ap) → Telugu (te)
- Tamil Nadu (tn) → Tamil (ta)
- Karnataka (ka) → Kannada (kn)
- Kerala (kl) → Malayalam (ml)
- Maharashtra (mh) → Hindi (hi), Marathi (mr)

Once you set the `content_language` field on the articles, they will appear in the Tadka Shorts section!

