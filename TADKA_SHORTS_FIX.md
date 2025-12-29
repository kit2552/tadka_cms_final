# Tadka Shorts Not Showing - Fix

## ✅ What's Working

1. **Backend API** - Returns data correctly:
   ```bash
   curl "http://localhost:8000/api/articles/sections/tadka-shorts?limit=20"
   # Returns: 1 Tadka Short (state: ts), 2 Bollywood shorts
   ```

2. **Component Registered** - `ViralShorts` is imported and registered in `SectionRegistry.jsx` (line 160-171)

3. **Section Order** - `viral-shorts` is in the default section order in `DragDropContext.jsx` (line 31)

4. **Data Fetching** - `viralShortsData` is being fetched in `dataService.getHomePageData()`

## ❌ The Problem

**User's localStorage has an OLD section order** that doesn't include `'viral-shorts'`.

The code checks localStorage first:
```javascript
// DragDropContext.jsx line 43
const savedOrder = localStorage.getItem('tadka_section_order');
if (savedOrder) {
  setSectionOrder(parsedOrder); // Uses old saved order
}
```

## ✅ The Fix

**Option 1: Clear localStorage (User needs to do this)**
Open browser console and run:
```javascript
localStorage.removeItem('tadka_section_order');
location.reload();
```

**Option 2: Force update the default (Code fix)**
Update the `DragDropContext.jsx` to force-merge new sections into saved order.

## 🔧 Quick Test

To verify this is the issue, check the browser console:
```javascript
console.log(JSON.parse(localStorage.getItem('tadka_section_order')));
// If 'viral-shorts' is missing from this array, that's the problem!
```

## 📝 Recommended Solution

Tell the user to:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run: `localStorage.removeItem('tadka_section_order'); location.reload();`
4. The Tadka Shorts section should now appear!

