#!/usr/bin/env python3
"""
Backend API Testing for Tadka Pics Agent
Tests the Tadka Pics agent functionality including Instagram image extraction and gallery creation
"""
import requests
import sys
import json
from datetime import datetime

class TadkaPicsAgentTester:
    def __init__(self, base_url="https://binged-scraper.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        self.test_results.append({
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except Exception as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_get_tadka_pics_agent(self, agent_id):
        """Test getting the Tadka Pics agent"""
        success, response = self.run_test(
            "Get Tadka Pics Agent",
            "GET",
            f"api/ai-agents/{agent_id}",
            200
        )
        
        if success:
            # Verify it's a tadka_pics agent
            agent_type = response.get('agent_type')
            if agent_type == 'tadka_pics':
                print(f"   ✓ Agent type is 'tadka_pics'")
                return True, response
            else:
                self.log_test("Verify Agent Type", False, f"Expected 'tadka_pics', got '{agent_type}'")
                return False, {}
        
        return False, {}

    def test_run_tadka_pics_agent(self, agent_id):
        """Test running the Tadka Pics agent"""
        print(f"\n🚀 Running Tadka Pics Agent: {agent_id}")
        print("   This may take 30-60 seconds to complete...")
        
        success, response = self.run_test(
            "Run Tadka Pics Agent",
            "POST",
            f"api/ai-agents/{agent_id}/run",
            200
        )
        
        if success:
            # Verify response structure
            required_fields = ['success', 'gallery_id', 'title', 'artist', 'images_count']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                self.log_test("Verify Response Structure", False, f"Missing fields: {missing_fields}")
                return False, {}
            
            # Verify success
            if not response.get('success'):
                self.log_test("Verify Success Flag", False, "success field is False")
                return False, {}
            
            # Verify images count > 0
            images_count = response.get('images_count', 0)
            if images_count == 0:
                self.log_test("Verify Images Count", False, "No images found")
                return False, {}
            
            print(f"   ✓ Gallery created: {response.get('gallery_id')}")
            print(f"   ✓ Title: {response.get('title')}")
            print(f"   ✓ Artist: {response.get('artist')}")
            print(f"   ✓ Images count: {images_count}")
            
            self.log_test("Verify Response Structure", True)
            self.log_test("Verify Success Flag", True)
            self.log_test("Verify Images Count", True, f"Found {images_count} images")
            
            return True, response
        
        return False, {}

    def test_verify_gallery_created(self, gallery_id):
        """Test that the gallery was actually created and has tadka_pics_enabled=true"""
        if not gallery_id:
            self.log_test("Verify Gallery Creation", False, "No gallery_id provided")
            return False
        
        # Try to get gallery details using the gallery ID endpoint
        success, response = self.run_test(
            "Get Created Gallery by ID",
            "GET",
            f"api/galleries/by-id/{gallery_id}",
            200
        )
        
        if success:
            # Verify tadka_pics_enabled is True
            tadka_pics_enabled = response.get('tadka_pics_enabled')
            if tadka_pics_enabled is True:
                print(f"   ✓ tadka_pics_enabled: {tadka_pics_enabled}")
                self.log_test("Verify Tadka Pics Enabled", True)
            else:
                self.log_test("Verify Tadka Pics Enabled", False, f"Expected True, got {tadka_pics_enabled}")
            
            # Verify no article was created (should not have article_id or content)
            has_article = 'article_id' in response or 'content' in response
            if not has_article:
                print(f"   ✓ No article created (gallery only)")
                self.log_test("Verify No Article Created", True)
            else:
                self.log_test("Verify No Article Created", False, "Gallery has article content")
            
            return True
        
        return False

    def test_agent_status(self, agent_id):
        """Test agent status endpoint"""
        success, response = self.run_test(
            "Get Agent Status",
            "GET",
            f"api/ai-agents/{agent_id}/status",
            200
        )
        
        if success:
            is_running = response.get('is_running')
            print(f"   ✓ Agent running status: {is_running}")
            return True
        
        return False

def main():
    # Test configuration
    AGENT_ID = "331b8a1e-1f6d-4968-9cad-211774eb0ae9"  # Test agent ID from context
    
    print("🧪 Starting Tadka Pics Agent Backend Tests")
    print("=" * 60)
    
    tester = TadkaPicsAgentTester()
    
    # Test 1: Get the Tadka Pics agent
    agent_success, agent_data = tester.test_get_tadka_pics_agent(AGENT_ID)
    if not agent_success:
        print("❌ Cannot proceed without valid agent")
        return 1
    
    # Test 2: Check agent status
    tester.test_agent_status(AGENT_ID)
    
    # Test 3: Run the Tadka Pics agent
    run_success, run_response = tester.test_run_tadka_pics_agent(AGENT_ID)
    
    if run_success:
        gallery_id = run_response.get('gallery_id')
        
        # Test 4: Verify the gallery was created properly
        tester.test_verify_gallery_created(gallery_id)
    
    # Print summary
    print("\n" + "=" * 60)
    print(f"📊 Test Summary:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    # Save detailed results
    results = {
        "test_summary": {
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": round(tester.tests_passed/tester.tests_run*100, 1) if tester.tests_run > 0 else 0,
            "timestamp": datetime.now().isoformat()
        },
        "test_details": tester.test_results
    }
    
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/test_reports/backend_test_results.json")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())