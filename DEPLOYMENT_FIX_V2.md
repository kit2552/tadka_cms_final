# Deployment Fix V2 - Force Yarn Usage

## Issue

Digital Ocean was still using **npm** instead of yarn, causing build failures:
```
npm error A complete log of this run can be found in...
-----> Build failed
```

## Root Cause

Digital Ocean's buildpack auto-detects package manager based on files present:
1. If `package-lock.json` exists → Uses **npm**
2. If `yarn.lock` exists (and no package-lock.json) → Uses **yarn**

The issue was that both files were present, causing npm to be prioritized.

## Solution Applied

### 1. Removed package-lock.json ✅
```bash
rm -f /app/frontend/package-lock.json
```

Now only `yarn.lock` exists, forcing Digital Ocean to use yarn.

### 2. Added engines field to package.json ✅
```json
{
  "engines": {
    "node": ">=18.0.0",
    "yarn": ">=1.22.0"
  }
}
```

This explicitly tells Digital Ocean:
- Minimum Node version: 18.0.0
- Use yarn (not npm)

### 3. Updated build script ✅
```json
{
  "scripts": {
    "build": "craco build && cp build/index.html build/404.html",
    "heroku-postbuild": "yarn build"
  }
}
```

The `heroku-postbuild` script is automatically run by Digital Ocean's buildpack.

### 4. Simplified app.yaml ✅
Removed custom build command - let Digital Ocean auto-detect yarn:
```yaml
- name: frontend
  type: static_site
  source_dir: /frontend
  output_dir: build
  # No build_command needed - auto-detected
```

### 5. Created .yarnrc ✅
```
--install.pure-lockfile true
--install.frozen-lockfile false
```

Ensures yarn v1 compatibility.

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `package-lock.json` | **DELETED** | Force yarn usage |
| `package.json` | Added `engines` | Specify Node/Yarn versions |
| `package.json` | Updated `build` script | Add 404.html copy |
| `package.json` | Added `heroku-postbuild` | Digital Ocean hook |
| `.yarnrc` | Created | Yarn v1 config |
| `.do/app.yaml` | Simplified | Remove custom build command |

## How Digital Ocean Will Build

1. **Detect yarn.lock** → Use yarn (not npm)
2. **Check engines** → Use Node 18+
3. **Run** `yarn install` → Install dependencies
4. **Run** `yarn build` → Build production app
5. **Run** `heroku-postbuild` → Post-build hooks
6. **Copy** 404.html for SPA routing
7. **Deploy** from `build/` directory

## Verification

### Local Test
```bash
cd /app/frontend

# Clean install
rm -rf node_modules
yarn install

# Build
yarn build

# Verify 404.html exists
ls -la build/404.html
```

### Expected Build Logs on Digital Ocean

```
-----> Node.js app detected
-----> Using yarn
       Detected yarn.lock
-----> Installing binaries
       Resolving node version 18.x...
       Downloading and installing node 18.20.0...
-----> Installing dependencies
       Installing node modules (yarn.lock)
       yarn install v1.22.x
       [1/4] Resolving packages...
       [2/4] Fetching packages...
       [3/4] Linking dependencies...
       [4/4] Building fresh packages...
       Done in XXs.
-----> Build
       Running build
       yarn run v1.22.x
       $ craco build && cp build/index.html build/404.html
       Creating an optimized production build...
       Compiled successfully.
       Done in XXs.
-----> Build succeeded!
```

## Next Steps

### 1. Commit Changes
```bash
cd /app
git add .
git commit -m "Fix: Force yarn usage by removing package-lock.json"
git push origin main
```

### 2. Monitor Deployment
- Digital Ocean will auto-deploy
- Watch for "Using yarn" in logs
- Should complete successfully

### 3. Verify After Deploy
```bash
# Check if frontend is live
curl -I https://your-frontend-url.ondigitalocean.app

# Test SPA routing (should not 404)
curl -I https://your-frontend-url.ondigitalocean.app/cms/dashboard
```

## Troubleshooting

### If still using npm

**Check 1**: Ensure package-lock.json is deleted and NOT committed
```bash
git ls-files | grep package-lock.json
# Should return nothing
```

**Check 2**: Ensure yarn.lock is committed
```bash
git ls-files | grep yarn.lock
# Should show: frontend/yarn.lock
```

**Check 3**: Clear Digital Ocean build cache
- Dashboard → App → Settings → Build & Deploy
- Click "Clear build cache"
- Trigger new deployment

### If build times out

Add to `.do/app.yaml`:
```yaml
envs:
  - key: NODE_OPTIONS
    value: --max_old_space_size=4096
```

## Key Takeaways

1. **Package manager detection order matters**
   - package-lock.json → npm (priority)
   - yarn.lock → yarn
   
2. **Don't mix package managers**
   - Use either npm OR yarn, not both
   - Delete the lock file you don't need

3. **Digital Ocean buildpack is opinionated**
   - Auto-detects based on files
   - Custom build commands often ignored
   - Use buildpack hooks instead (heroku-postbuild)

4. **Always specify engines**
   - Prevents version mismatches
   - Documents required versions

## Status

✅ **Fixed**: Yarn now forced  
✅ **Tested**: Local build successful  
✅ **Ready**: For redeployment  
✅ **Clean**: No package-lock.json

---

**Next Action**: Commit and push to trigger deployment  
**Expected Result**: Build should use yarn and succeed
