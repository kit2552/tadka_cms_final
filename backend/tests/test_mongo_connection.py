#!/usr/bin/env python3
"""
Test MongoDB Connection Script
Tests if MongoDB is accessible and the database exists
"""

import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def test_mongodb_connection():
    """Test MongoDB connection and database"""
    
    # Get MongoDB URL from environment or prompt
    mongo_url = os.environ.get('MONGO_URL')
    
    if not mongo_url:
        print("\n⚠️  MONGO_URL not found in environment variables")
        print("Please provide your MongoDB connection string:")
        mongo_url = input("MongoDB URL: ").strip()
    
    if not mongo_url:
        print("❌ No MongoDB URL provided. Exiting.")
        sys.exit(1)
    
    db_name = os.environ.get('DB_NAME', 'tadka_cms')
    
    print("\n" + "="*60)
    print("🔍 TESTING MONGODB CONNECTION")
    print("="*60)
    print(f"\n📍 Connection URL: {mongo_url[:20]}...{mongo_url[-20:]}")
    print(f"📍 Database Name: {db_name}")
    print("\n" + "="*60)
    
    try:
        # Step 1: Create client
        print("\n1️⃣  Creating MongoDB client...")
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        print("   ✅ Client created")
        
        # Step 2: Ping server
        print("\n2️⃣  Pinging MongoDB server...")
        await client.admin.command('ping')
        print("   ✅ Server is reachable")
        
        # Step 3: List databases
        print("\n3️⃣  Listing all databases...")
        db_list = await client.list_database_names()
        print(f"   📚 Found {len(db_list)} databases:")
        for db in db_list:
            marker = "👉" if db == db_name else "  "
            print(f"      {marker} {db}")
        
        # Step 4: Check if our database exists
        print(f"\n4️⃣  Checking if '{db_name}' database exists...")
        if db_name in db_list:
            print(f"   ✅ Database '{db_name}' EXISTS")
            
            # Step 5: List collections
            db = client[db_name]
            collections = await db.list_collection_names()
            print(f"\n5️⃣  Collections in '{db_name}' ({len(collections)}):")
            
            if collections:
                for coll in sorted(collections):
                    count = await db[coll].count_documents({})
                    print(f"      📁 {coll}: {count} documents")
            else:
                print("      ⚠️  No collections found (database might be empty)")
            
            # Step 6: Test a simple query
            print(f"\n6️⃣  Testing query on 'users' collection...")
            if 'users' in collections:
                user_count = await db.users.count_documents({})
                print(f"   ✅ Query successful: {user_count} users found")
                
                # Try to get one user
                sample_user = await db.users.find_one({})
                if sample_user:
                    print(f"   📄 Sample user ID: {sample_user.get('id', 'N/A')}")
                    print(f"   📄 Sample username: {sample_user.get('username', 'N/A')}")
            else:
                print("   ⚠️  'users' collection not found")
        
        else:
            print(f"   ❌ Database '{db_name}' DOES NOT EXIST")
            print(f"\n   💡 Available databases: {', '.join(db_list)}")
            print(f"   💡 Make sure to import your data to '{db_name}'")
        
        # Step 7: Test write permission
        print(f"\n7️⃣  Testing write permissions...")
        test_collection = client[db_name]['_connection_test']
        test_doc = {"test": "connection", "timestamp": "test"}
        result = await test_collection.insert_one(test_doc)
        print(f"   ✅ Write successful (inserted ID: {result.inserted_id})")
        
        # Cleanup test document
        await test_collection.delete_one({"_id": result.inserted_id})
        print(f"   🧹 Cleanup successful")
        
        # Summary
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED - MONGODB CONNECTION IS WORKING")
        print("="*60)
        print("\n📌 Connection Summary:")
        print(f"   • Server: Reachable ✓")
        print(f"   • Database '{db_name}': {'EXISTS ✓' if db_name in db_list else 'NOT FOUND ✗'}")
        print(f"   • Collections: {len(collections) if db_name in db_list else 0}")
        print(f"   • Read/Write: Working ✓")
        print("\n" + "="*60)
        
        return True
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ CONNECTION TEST FAILED")
        print("="*60)
        print(f"\n🔴 Error: {str(e)}")
        print(f"\n🔍 Error Type: {type(e).__name__}")
        
        # Provide helpful suggestions
        print("\n💡 Possible Issues:")
        print("   1. MongoDB URL is incorrect")
        print("   2. MongoDB server is not running")
        print("   3. Network/firewall blocking connection")
        print("   4. IP address not whitelisted in MongoDB")
        print("   5. Authentication credentials are wrong")
        
        print("\n🔧 How to Fix:")
        print("   • Check MongoDB connection string format")
        print("   • Verify MongoDB Atlas/DO network access settings")
        print("   • Add your IP to trusted sources")
        print("   • Check username/password in connection string")
        
        import traceback
        print(f"\n📋 Full Traceback:")
        print(traceback.format_exc())
        
        return False
    
    finally:
        if 'client' in locals():
            client.close()
            print("\n🔌 Connection closed")

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║          MongoDB Connection Test for Tadka CMS               ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    # Run the async test
    result = asyncio.run(test_mongodb_connection())
    
    sys.exit(0 if result else 1)
