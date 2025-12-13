from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get MongoDB URL from environment variable
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DATABASE_NAME = os.environ.get('DB_NAME', 'tadka_cms')

# Synchronous client for non-async operations
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DATABASE_NAME]

# Async client for FastAPI async endpoints
async_mongo_client = AsyncIOMotorClient(MONGO_URL)
async_db = async_mongo_client[DATABASE_NAME]

def get_db():
    """
    Dependency for synchronous database operations.
    Returns the MongoDB database instance.
    """
    return db

def get_async_db():
    """
    Dependency for async database operations.
    Returns the async MongoDB database instance.
    """
    return async_db