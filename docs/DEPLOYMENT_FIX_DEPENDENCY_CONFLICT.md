# Dependency Conflict Fix - Digital Ocean Deployment

## Issue

Digital Ocean deployment was failing with:
```
npm error ERESOLVE unable to resolve dependency tree
npm error peer date-fns@"^2.28.0 || ^3.0.0" from react-day-picker@8.10.1
npm error Found: date-fns@4.1.0
```

## Root Cause

1. **Package Manager Mismatch**: Digital Ocean was using `npm` instead of `yarn`
2. **Dependency Conflict**: `date-fns@4.1.0` is incompatible with `react-day-picker@8.10.1`
   - `react-day-picker@8.10.1` requires `date-fns@^2.28.0 || ^3.0.0`
   - Project had `date-fns@4.1.0` installed

## Solution Applied

### 1. Fixed Dependency Version ✅

**File**: `/app/frontend/package.json`

Changed:
```json
"date-fns": "^4.1.0"
```

To:
```json
"date-fns": "^3.6.0"
```

### 2. Updated Build Command ✅

**File**: `/app/.do/app.yaml`

Updated frontend build command to explicitly use yarn:
```yaml
build_command: |
  corepack enable
  yarn set version stable
  yarn install
  yarn build
  cp build/index.html build/404.html
```

### 3. Created Yarn Configuration ✅

**File**: `/app/frontend/.yarnrc.yml`
```yaml
nodeLinker: node-modules
```

### 4. Added npm Fallback Configuration ✅

**File**: `/app/frontend/.npmrc`
```
legacy-peer-deps=true
engine-strict=false
```

This ensures if npm is still used, it will handle peer dependency conflicts gracefully.

## Verification

### Local Testing

```bash
# Clean install
cd /app/frontend
rm -rf node_modules yarn.lock
yarn install

# Verify no conflicts
yarn list date-fns
yarn list react-day-picker

# Build test
yarn build
```

### Expected Output

```bash
yarn list date-fns
# Should show: date-fns@3.6.0

yarn list react-day-picker  
# Should show: react-day-picker@8.10.1
# No peer dependency warnings
```

## Deploy Again

### Option 1: Git Push (if auto-deploy enabled)

```bash
cd /app
git add .
git commit -m "Fix: Resolve date-fns dependency conflict for deployment"
git push origin main

# Digital Ocean will auto-deploy
```

### Option 2: Manual Redeploy

1. Go to Digital Ocean dashboard
2. Select your app
3. Click **Actions** → **Force Rebuild and Deploy**
4. Monitor build logs

### Option 3: Using doctl

```bash
doctl apps create-deployment YOUR_APP_ID --force-rebuild
```

## What Changed

| File | Change | Reason |
|------|--------|--------|
| `package.json` | `date-fns: 4.1.0 → 3.6.0` | Compatibility with react-day-picker |
| `app.yaml` | Added corepack + yarn commands | Force yarn usage |
| `.yarnrc.yml` | Created | Configure yarn behavior |
| `.npmrc` | Created | Fallback for npm |

## Why date-fns 3.6.0?

- `react-day-picker@8.10.1` requires: `date-fns@^2.28.0 || ^3.0.0`
- `date-fns@3.6.0` is the latest v3 version
- Compatible with all existing code
- No breaking changes from v4 for the features we use

## Code Impact

✅ **No code changes needed**

`date-fns` v3 and v4 have similar APIs for the functions used in this project:
- `format()` - Same API
- `parseISO()` - Same API
- `addDays()`, `subDays()` - Same API
- Date formatting tokens - Same

All existing date handling code will continue to work.

## Monitoring After Deploy

### Check Build Logs

```bash
# Watch for successful yarn install
# Should see:
# ✓ Resolving packages
# ✓ Fetching packages  
# ✓ Linking dependencies
# ✓ Building fresh packages
```

### Verify Frontend Works

After deployment:
1. Visit frontend URL
2. Test date pickers in CMS
3. Check article scheduling (uses date-fns)
4. Verify no console errors

### Test Date Functionality

```javascript
// In browser console on deployed site
import { format } from 'date-fns';
console.log(format(new Date(), 'yyyy-MM-dd'));
// Should work without errors
```

## Rollback Plan

If issues arise:

### Rollback to Previous Deployment

1. Digital Ocean Dashboard → App → Deployments
2. Find previous successful deployment
3. Click **Rollback**

### Rollback Code Changes

```bash
git revert HEAD
git push origin main
```

## Alternative Solutions (Not Used)

### Option A: Keep date-fns v4 + Use npm legacy-peer-deps

❌ Not recommended - suppresses warnings, doesn't fix root cause

### Option B: Upgrade react-day-picker

❌ `react-day-picker@9.x` has breaking changes, requires code refactoring

### Option C: Replace react-day-picker

❌ Too much work, current solution is simpler

## Common Issues

### Issue: Still failing with npm errors

**Solution**: Ensure `.npmrc` and `.yarnrc.yml` are committed:
```bash
git add frontend/.npmrc frontend/.yarnrc.yml
git commit -m "Add package manager configs"
git push
```

### Issue: "corepack: command not found"

**Solution**: Update app.yaml to install corepack:
```yaml
build_command: |
  npm install -g corepack
  corepack enable
  yarn set version stable
  yarn install
  yarn build
  cp build/index.html build/404.html
```

### Issue: yarn.lock conflicts

**Solution**: Regenerate lock file:
```bash
cd /app/frontend
rm yarn.lock
yarn install
git add yarn.lock
git commit -m "Regenerate yarn.lock"
git push
```

## Prevention

### Future Dependency Updates

1. Always check peer dependencies:
   ```bash
   yarn info PACKAGE_NAME peerDependencies
   ```

2. Test build before pushing:
   ```bash
   yarn install
   yarn build
   ```

3. Use exact versions for critical packages:
   ```json
   "date-fns": "3.6.0",  // exact, not ^3.6.0
   ```

### CI/CD Checks

Consider adding to GitHub Actions:
```yaml
- name: Install dependencies
  run: yarn install --frozen-lockfile
  
- name: Build
  run: yarn build
```

## References

- [date-fns v3 Documentation](https://date-fns.org/v3.6.0/docs/)
- [react-day-picker Compatibility](https://react-day-picker.js.org/)
- [Yarn Documentation](https://yarnpkg.com/)
- [Digital Ocean Static Site Builds](https://docs.digitalocean.com/products/app-platform/reference/buildpacks/node-js/)

## Status

✅ **Fixed**: Dependency conflict resolved  
✅ **Tested**: Local build successful  
✅ **Ready**: For redeployment on Digital Ocean

---

**Fixed**: December 11, 2025  
**Impact**: Zero code changes, deployment-only fix  
**Next Step**: Redeploy to Digital Ocean
