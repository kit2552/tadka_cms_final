# MongoDB Database Import Guide

## Overview

This guide walks you through importing your local MongoDB database (`test_database`) to a remote MongoDB instance with the new database name `tadka_cms`.

## Prerequisites

- MongoDB Database Tools installed (includes `mongorestore`)
- Access to remote MongoDB connection string
- Database export files in `/app/mongodb_export/`

## Installation of MongoDB Database Tools

### macOS
```bash
brew tap mongodb/brew
brew install mongodb-database-tools
```

### Linux (Ubuntu/Debian)
```bash
wget https://fastdl.mongodb.org/tools/db/mongodb-database-tools-ubuntu2004-x86_64-100.9.4.deb
sudo dpkg -i mongodb-database-tools-ubuntu2004-x86_64-100.9.4.deb
```

### Windows
Download from: https://www.mongodb.com/try/download/database-tools

## Verify Export Files

First, check that the export exists:

```bash
ls -la /app/mongodb_export/test_database/
```

You should see `.bson` and `.metadata.json` files for each collection.

## Import Process

### Step 1: Get Your Remote MongoDB Connection String

Your connection string should look like one of these:

**Digital Ocean Managed MongoDB**:
```
mongodb+srv://doadmin:PASSWORD@cluster-xxxxx.mongo.ondigitalocean.com/admin?retryWrites=true&w=majority
```

**MongoDB Atlas**:
```
mongodb+srv://username:PASSWORD@cluster.mongodb.net/admin?retryWrites=true&w=majority
```

### Step 2: Import with Database Name Change

**Basic Import** (Recommended):
```bash
mongorestore \
  --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/tadka_cms?retryWrites=true&w=majority" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --drop \
  /app/mongodb_export/test_database/
```

**With Verbose Output**:
```bash
mongorestore \
  --uri="mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/tadka_cms?retryWrites=true&w=majority" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --drop \
  --verbose \
  /app/mongodb_export/test_database/
```

### Step 3: Verify Import

Connect to your remote MongoDB and verify:

```bash
# Connect using mongosh
mongosh "mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/tadka_cms"

# Once connected, run:
show dbs
use tadka_cms
show collections

# Count documents in main collections
db.users.countDocuments()
db.articles.countDocuments()
db.categories.countDocuments()
```

## Import Options Explained

| Option | Description |
|--------|-------------|
| `--uri` | MongoDB connection string with authentication |
| `--nsFrom` | Source namespace (database.collection pattern) |
| `--nsTo` | Target namespace (new database name) |
| `--drop` | Drop existing collections before import |
| `--verbose` | Show detailed progress information |
| `--dryRun` | Test import without actually writing data |

## Advanced Import Scenarios

### Import Specific Collections Only

```bash
mongorestore \
  --uri="YOUR_CONNECTION_STRING" \
  --nsFrom="test_database.users" \
  --nsTo="tadka_cms.users" \
  /app/mongodb_export/test_database/users.bson

mongorestore \
  --uri="YOUR_CONNECTION_STRING" \
  --nsFrom="test_database.articles" \
  --nsTo="tadka_cms.articles" \
  /app/mongodb_export/test_database/articles.bson
```

### Import Without Dropping Existing Data

Remove the `--drop` flag:

```bash
mongorestore \
  --uri="YOUR_CONNECTION_STRING" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  /app/mongodb_export/test_database/
```

### Test Import (Dry Run)

```bash
mongorestore \
  --uri="YOUR_CONNECTION_STRING" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --dryRun \
  /app/mongodb_export/test_database/
```

## Troubleshooting

### Error: "Connection refused"

**Cause**: Network access not configured.

**Fix**:
1. For Digital Ocean: Add your IP to Trusted Sources
2. For Atlas: Add IP to Network Access whitelist
3. Temporarily allow all IPs: `0.0.0.0/0` (not recommended for production)

### Error: "Authentication failed"

**Cause**: Wrong username or password.

**Fix**:
1. Verify credentials in connection string
2. Check database user permissions
3. Ensure user has read/write access to `tadka_cms` database

### Error: "Database not found"

**Cause**: Database doesn't exist yet.

**Fix**: This is normal! `mongorestore` will create it automatically.

### Import is Very Slow

**Cause**: Large dataset or slow network.

**Fix**:
- Use `--numParallelCollections` for parallel imports
- Import during off-peak hours
- Consider compressing data before transfer

```bash
mongorestore \
  --uri="YOUR_CONNECTION_STRING" \
  --nsFrom="test_database.*" \
  --nsTo="tadka_cms.*" \
  --numParallelCollections=4 \
  /app/mongodb_export/test_database/
```

## Post-Import Verification Checklist

- [ ] Database `tadka_cms` exists
- [ ] All collections imported successfully
- [ ] Document counts match source database
- [ ] Indexes are created
- [ ] Sample queries return expected data
- [ ] Application connects successfully
- [ ] Admin user can login

## Rollback

If you need to rollback:

```bash
# Drop the database
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; db.dropDatabase()"

# Re-import from backup
mongorestore --uri="YOUR_CONNECTION_STRING" ...
```

## Backup Considerations

### Before Import

If target database exists and has data:

```bash
# Backup existing remote database
mongodump \
  --uri="YOUR_CONNECTION_STRING" \
  --out=/path/to/backup_before_import
```

### After Import

Create immediate backup of successfully imported database:

```bash
mongodump \
  --uri="YOUR_CONNECTION_STRING" \
  --out=/path/to/backup_after_import
```

## Connection String Examples

### Digital Ocean Managed MongoDB

```bash
# Standard connection
mongodb+srv://doadmin:YOUR_PASSWORD@tadka-mongodb-xxxxx.mongo.ondigitalocean.com/admin

# With options
mongodb+srv://doadmin:YOUR_PASSWORD@tadka-mongodb-xxxxx.mongo.ondigitalocean.com/admin?retryWrites=true&w=majority
```

### MongoDB Atlas

```bash
# Standard connection
mongodb+srv://username:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/admin

# With options
mongodb+srv://username:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/admin?retryWrites=true&w=majority&authSource=admin
```

### Self-Hosted MongoDB

```bash
# Single server
mongodb://username:PASSWORD@your-server.com:27017/tadka_cms?authSource=admin

# Replica set
mongodb://username:PASSWORD@server1:27017,server2:27017,server3:27017/tadka_cms?replicaSet=rs0&authSource=admin
```

## Quick Reference Commands

```bash
# List all databases
mongosh "YOUR_CONNECTION_STRING" --eval "show dbs"

# List collections in tadka_cms
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; show collections"

# Count documents
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; db.COLLECTION.countDocuments()"

# Sample query
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; db.users.findOne()"

# Drop database (careful!)
mongosh "YOUR_CONNECTION_STRING" --eval "use tadka_cms; db.dropDatabase()"
```

## Security Best Practices

1. **Never commit connection strings to Git**
2. **Use strong passwords** (20+ characters, mixed case, numbers, symbols)
3. **Limit IP access** to only necessary addresses
4. **Use separate users** for application vs admin access
5. **Enable SSL/TLS** for connections
6. **Regular backups** before major operations
7. **Monitor access logs** for suspicious activity

## Support Resources

- MongoDB Restore Docs: https://www.mongodb.com/docs/database-tools/mongorestore/
- Digital Ocean MongoDB: https://docs.digitalocean.com/products/databases/mongodb/
- MongoDB Atlas: https://docs.atlas.mongodb.com/

---

**Note**: Replace `YOUR_CONNECTION_STRING`, `USERNAME`, `PASSWORD`, and `YOUR_CLUSTER` with your actual values throughout this guide.