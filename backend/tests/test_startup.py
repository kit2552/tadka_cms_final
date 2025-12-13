#!/usr/bin/env python3
"""
Test Backend Startup Script
Simulates the production startup to find issues
"""

import os
import sys
import asyncio
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

async def test_startup():
    """Test if the server can start"""
    
    print("\n" + "="*60)
    print("🧪 TESTING BACKEND STARTUP")
    print("="*60)
    
    # Test 1: Environment variables
    print("\n1️⃣  Checking environment variables...")
    required_vars = ['MONGO_URL', 'DB_NAME', 'JWT_SECRET_KEY']
    
    for var in required_vars:
        value = os.environ.get(var)
        if value:
            display_value = value[:20] + "..." if len(value) > 20 else value
            print(f"   ✅ {var}: {display_value}")
        else:
            print(f"   ❌ {var}: NOT SET")
    
    # Test 2: Import dependencies
    print("\n2️⃣  Testing imports...")
    try:
        print("   📦 Importing FastAPI...")
        from fastapi import FastAPI
        print("   ✅ FastAPI imported")
        
        print("   📦 Importing Motor (MongoDB)...")
        from motor.motor_asyncio import AsyncIOMotorClient
        print("   ✅ Motor imported")
        
        print("   📦 Importing database module...")
        from database import get_db, db
        print("   ✅ Database module imported")
        
        print("   📦 Importing schemas and crud...")
        import schemas, crud
        print("   ✅ Schemas and CRUD imported")
        
        print("   📦 Importing routes...")
        from routes.auth_routes import router as auth_router
        print("   ✅ Routes imported")
        
    except Exception as e:
        print(f"   ❌ Import failed: {e}")
        import traceback
        print(traceback.format_exc())
        return False
    
    # Test 3: MongoDB connection
    print("\n3️⃣  Testing MongoDB connection...")
    try:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        print("   ✅ MongoDB connection successful")
        
        db_name = os.environ.get('DB_NAME', 'tadka_cms')
        db_list = await client.list_database_names()
        if db_name in db_list:
            print(f"   ✅ Database '{db_name}' exists")
        else:
            print(f"   ⚠️  Database '{db_name}' not found")
            print(f"       Available: {', '.join(db_list)}")
        
        client.close()
    except Exception as e:
        print(f"   ❌ MongoDB connection failed: {e}")
        return False
    
    # Test 4: Try to import server
    print("\n4️⃣  Testing server import...")
    try:
        print("   📦 Importing server module...")
        # This will execute the module-level code
        import server
        print("   ✅ Server module imported")
        print(f"   ✅ App created: {server.app}")
    except Exception as e:
        print(f"   ❌ Server import failed: {e}")
        import traceback
        print("\n📋 Full Traceback:")
        print(traceback.format_exc())
        return False
    
    # Test 5: Check if app has routes
    print("\n5️⃣  Checking API routes...")
    try:
        routes = [route.path for route in server.app.routes]
        print(f"   ✅ Found {len(routes)} routes")
        
        # Check for health endpoint
        if '/api' in routes or '/api/' in routes:
            print("   ✅ Health endpoint (/api) exists")
        else:
            print("   ⚠️  Health endpoint not found")
            print(f"       Available routes: {', '.join(routes[:10])}")
    except Exception as e:
        print(f"   ❌ Route check failed: {e}")
    
    print("\n" + "="*60)
    print("✅ STARTUP TEST COMPLETED")
    print("="*60)
    print("\n💡 If all tests passed, the issue is likely:")
    print("   • Port 8000 not accessible in production")
    print("   • Docker container not binding correctly")
    print("   • Environment variables not set in Digital Ocean")
    
    return True

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║          Backend Startup Test for Tadka CMS                  ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    # Check if in production environment
    if os.environ.get('MONGO_URL'):
        print("\n📍 Production environment detected (MONGO_URL set)")
    else:
        print("\n📍 Local environment detected (using local MongoDB)")
        print("⚠️  Set MONGO_URL to test with production database")
    
    result = asyncio.run(test_startup())
    sys.exit(0 if result else 1)
