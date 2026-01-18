"""
OTT Review Agent Tests
Tests for OTT Review Agent creation, API endpoints, and homepage display
"""
import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://movie-review-hub-1.preview.emergentagent.com')

class TestOTTReviewAgentAPI:
    """Test OTT Review Agent API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.created_agent_id = None
    
    def test_health_check(self):
        """Test API health check"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ API health check passed")
    
    def test_get_ai_agents_list(self):
        """Test getting list of AI agents"""
        response = self.session.get(f"{BASE_URL}/api/ai-agents")
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        print(f"✅ Found {len(data['agents'])} AI agents")
    
    def test_create_ott_review_agent(self):
        """Test creating a new OTT Review Agent"""
        agent_data = {
            "agent_name": "TEST_OTT_Review_Agent",
            "agent_type": "ott_review",
            "mode": "adhoc",
            "review_language": "Telugu",
            "review_website": "binged",
            "max_reviews_from_listing": 3,
            "content_workflow": "in_review",
            "is_active": True,
            "reference_urls": [{"url": "https://www.binged.com/category/reviews/", "url_type": "listing"}]
        }
        
        response = self.session.post(f"{BASE_URL}/api/ai-agents", json=agent_data)
        assert response.status_code == 200, f"Failed to create agent: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data.get("agent_name") == "TEST_OTT_Review_Agent"
        assert data.get("agent_type") == "ott_review"
        assert data.get("review_language") == "Telugu"
        
        self.created_agent_id = data["id"]
        print(f"✅ Created OTT Review Agent with ID: {self.created_agent_id}")
        
        return data["id"]
    
    def test_get_ott_review_agent(self):
        """Test getting a specific OTT Review Agent"""
        # First create an agent
        agent_id = self.test_create_ott_review_agent()
        
        response = self.session.get(f"{BASE_URL}/api/ai-agents/{agent_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("agent_type") == "ott_review"
        assert data.get("review_language") == "Telugu"
        print(f"✅ Retrieved OTT Review Agent: {data.get('agent_name')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/ai-agents/{agent_id}")
    
    def test_update_ott_review_agent(self):
        """Test updating an OTT Review Agent"""
        # First create an agent
        agent_id = self.test_create_ott_review_agent()
        
        update_data = {
            "agent_name": "TEST_OTT_Review_Agent_Updated",
            "agent_type": "ott_review",
            "mode": "adhoc",
            "review_language": "Hindi",
            "review_website": "binged",
            "max_reviews_from_listing": 5,
            "content_workflow": "ready_to_publish",
            "is_active": True
        }
        
        response = self.session.put(f"{BASE_URL}/api/ai-agents/{agent_id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("review_language") == "Hindi"
        assert data.get("max_reviews_from_listing") == 5
        print(f"✅ Updated OTT Review Agent: {data.get('agent_name')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/ai-agents/{agent_id}")
    
    def test_delete_ott_review_agent(self):
        """Test deleting an OTT Review Agent"""
        # First create an agent
        agent_id = self.test_create_ott_review_agent()
        
        response = self.session.delete(f"{BASE_URL}/api/ai-agents/{agent_id}")
        assert response.status_code == 200
        
        # Verify deletion
        response = self.session.get(f"{BASE_URL}/api/ai-agents/{agent_id}")
        assert response.status_code == 404
        print(f"✅ Deleted OTT Review Agent: {agent_id}")
    
    def test_toggle_ott_review_agent(self):
        """Test toggling OTT Review Agent active status"""
        # First create an agent
        agent_id = self.test_create_ott_review_agent()
        
        # Toggle status
        response = self.session.post(f"{BASE_URL}/api/ai-agents/{agent_id}/toggle")
        assert response.status_code == 200
        
        data = response.json()
        # Should be toggled from True to False
        assert data.get("is_active") == False
        print(f"✅ Toggled OTT Review Agent status to: {data.get('is_active')}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/ai-agents/{agent_id}")


class TestOTTMovieReviewsEndpoint:
    """Test OTT Movie Reviews section endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_get_ott_movie_reviews_basic(self):
        """Test basic OTT movie reviews endpoint"""
        response = self.session.get(f"{BASE_URL}/api/articles/sections/ott-movie-reviews")
        assert response.status_code == 200
        
        data = response.json()
        assert "ott_reviews" in data
        assert "bollywood" in data
        print(f"✅ OTT Reviews endpoint returned: {len(data['ott_reviews'])} ott_reviews, {len(data['bollywood'])} bollywood")
    
    def test_get_ott_movie_reviews_with_limit(self):
        """Test OTT movie reviews endpoint with limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/articles/sections/ott-movie-reviews?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data.get("ott_reviews", [])) <= 5
        assert len(data.get("bollywood", [])) <= 5
        print(f"✅ OTT Reviews with limit=5: {len(data['ott_reviews'])} ott_reviews, {len(data['bollywood'])} bollywood")
    
    def test_get_ott_movie_reviews_with_states(self):
        """Test OTT movie reviews endpoint with state filtering"""
        response = self.session.get(f"{BASE_URL}/api/articles/sections/ott-movie-reviews?states=ap,ts")
        assert response.status_code == 200
        
        data = response.json()
        assert "ott_reviews" in data
        assert "bollywood" in data
        print(f"✅ OTT Reviews with states=ap,ts: {len(data['ott_reviews'])} ott_reviews, {len(data['bollywood'])} bollywood")
    
    def test_ott_review_data_structure(self):
        """Test OTT review article data structure"""
        response = self.session.get(f"{BASE_URL}/api/articles/sections/ott-movie-reviews?limit=1")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check if we have any reviews
        all_reviews = data.get("ott_reviews", []) + data.get("bollywood", [])
        if all_reviews:
            review = all_reviews[0]
            # Check expected fields
            assert "id" in review
            assert "title" in review
            print(f"✅ OTT Review data structure valid: {review.get('title', 'Unknown')}")
            
            # Check for rating field
            if "movie_rating" in review:
                print(f"   Rating: {review.get('movie_rating')}")
        else:
            print("⚠️ No OTT reviews found in database")


class TestOTTReviewAgentFormFields:
    """Test OTT Review Agent form field validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_create_agent_with_all_languages(self):
        """Test creating OTT Review Agent with different languages"""
        languages = ["Telugu", "Tamil", "Kannada", "Malayalam", "Hindi", "English", "Marathi", "Bengali"]
        
        for lang in languages:
            agent_data = {
                "agent_name": f"TEST_OTT_{lang}_Agent",
                "agent_type": "ott_review",
                "mode": "adhoc",
                "review_language": lang,
                "review_website": "binged",
                "max_reviews_from_listing": 3,
                "content_workflow": "in_review",
                "is_active": True
            }
            
            response = self.session.post(f"{BASE_URL}/api/ai-agents", json=agent_data)
            assert response.status_code == 200, f"Failed to create agent for {lang}: {response.text}"
            
            data = response.json()
            assert data.get("review_language") == lang
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/ai-agents/{data['id']}")
            print(f"✅ Created and deleted OTT Review Agent for language: {lang}")
    
    def test_create_agent_with_different_workflows(self):
        """Test creating OTT Review Agent with different content workflows"""
        workflows = ["in_review", "ready_to_publish", "auto_post"]
        
        for workflow in workflows:
            agent_data = {
                "agent_name": f"TEST_OTT_Workflow_{workflow}",
                "agent_type": "ott_review",
                "mode": "adhoc",
                "review_language": "Telugu",
                "review_website": "binged",
                "max_reviews_from_listing": 3,
                "content_workflow": workflow,
                "is_active": True
            }
            
            response = self.session.post(f"{BASE_URL}/api/ai-agents", json=agent_data)
            assert response.status_code == 200, f"Failed to create agent for workflow {workflow}: {response.text}"
            
            data = response.json()
            assert data.get("content_workflow") == workflow
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/ai-agents/{data['id']}")
            print(f"✅ Created and deleted OTT Review Agent with workflow: {workflow}")
    
    def test_create_agent_with_max_reviews_range(self):
        """Test creating OTT Review Agent with different max_reviews values"""
        max_reviews_values = [1, 5, 10, 15, 20]
        
        for max_reviews in max_reviews_values:
            agent_data = {
                "agent_name": f"TEST_OTT_MaxReviews_{max_reviews}",
                "agent_type": "ott_review",
                "mode": "adhoc",
                "review_language": "Telugu",
                "review_website": "binged",
                "max_reviews_from_listing": max_reviews,
                "content_workflow": "in_review",
                "is_active": True
            }
            
            response = self.session.post(f"{BASE_URL}/api/ai-agents", json=agent_data)
            assert response.status_code == 200, f"Failed to create agent with max_reviews={max_reviews}: {response.text}"
            
            data = response.json()
            assert data.get("max_reviews_from_listing") == max_reviews
            
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/ai-agents/{data['id']}")
            print(f"✅ Created and deleted OTT Review Agent with max_reviews: {max_reviews}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
