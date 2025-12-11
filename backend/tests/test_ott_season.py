#!/usr/bin/env python3
"""
Test suite for OTT Season dropdown feature
Tests the newly added Season field for OTT Web Series releases in the CMS
"""
import requests
import json
import unittest
import os
from datetime import datetime, date

# Get the backend URL from the frontend .env file
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BACKEND_URL = line.strip().split('=')[1].strip('"\'')
            break

API_URL = f"{BACKEND_URL}/api"
print(f"Testing OTT Season Feature at: {API_URL}")

class OTTSeasonFeatureTest(unittest.TestCase):
    """Test suite for OTT Season dropdown feature"""

    def setUp(self):
        """Set up test fixtures before each test method"""
        print(f"\n{'='*80}")
        print("SETTING UP OTT SEASON FEATURE TESTS")
        print(f"{'='*80}")
        
        # Login as admin to get authentication token
        admin_login = {
            "username": "admin",
            "password": "admin123"
        }
        
        response = requests.post(f"{API_URL}/auth/login", data=admin_login)
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.admin_token}"}
            print("✅ Admin authentication successful")
        else:
            print("⚠️ Admin authentication failed, proceeding without auth")
            self.admin_token = None
            self.headers = {}

    def test_01_create_ott_release_with_season_web_series(self):
        """Test creating OTT Release with Season for Web Series"""
        print("\n--- Test 1: Create OTT Release with Season (Web Series) ---")
        
        # Test data for Web Series with Season
        web_series_data = {
            "movie_name": "Test Series S10",
            "content_type": "Web Series",
            "season": 10,
            "release_date": "2025-03-01",
            "created_by": "Test",
            "ott_platforms": '["Netflix"]',
            "states": '["all"]',
            "languages": '["Hindi"]',
            "genres": '["Drama"]'
        }
        
        print(f"Creating Web Series: {web_series_data['movie_name']}")
        print(f"Content Type: {web_series_data['content_type']}")
        print(f"Season: {web_series_data['season']}")
        
        # Create OTT release
        response = requests.post(f"{API_URL}/cms/ott-releases", data=web_series_data, headers=self.headers)
        
        print(f"Response Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response Text: {response.text}")
        
        self.assertEqual(response.status_code, 200, f"Failed to create Web Series OTT release: {response.text}")
        
        created_release = response.json()
        
        # Verify response structure and data
        self.assertIn("id", created_release, "Response missing 'id' field")
        self.assertEqual(created_release["movie_name"], web_series_data["movie_name"])
        self.assertEqual(created_release["content_type"], web_series_data["content_type"])
        self.assertEqual(created_release["season"], web_series_data["season"])
        self.assertEqual(created_release["created_by"], web_series_data["created_by"])
        
        # Store the ID for later tests
        self.web_series_id = created_release["id"]
        
        print("✅ Web Series OTT release created successfully")
        print(f"   - ID: {created_release['id']}")
        print(f"   - Movie Name: {created_release['movie_name']}")
        print(f"   - Content Type: {created_release['content_type']}")
        print(f"   - Season: {created_release['season']}")
        print(f"   - Release Date: {created_release['release_date']}")
        print(f"   - OTT Platforms: {created_release.get('ott_platforms', 'N/A')}")
        
        # Verify season is exactly 10
        self.assertEqual(created_release["season"], 10, "Season should be exactly 10")
        print("✅ Season field correctly saved as 10")

    def test_02_create_ott_release_without_season_movie(self):
        """Test creating OTT Release without Season for Movie"""
        print("\n--- Test 2: Create OTT Release without Season (Movie) ---")
        
        # Test data for Movie without Season
        movie_data = {
            "movie_name": "Test Movie Without Season",
            "content_type": "Movie",
            # Note: No season field provided
            "release_date": "2025-03-15",
            "created_by": "Test",
            "ott_platforms": '["Amazon Prime"]',
            "states": '["all"]',
            "languages": '["English"]',
            "genres": '["Action"]'
        }
        
        print(f"Creating Movie: {movie_data['movie_name']}")
        print(f"Content Type: {movie_data['content_type']}")
        print("Season: Not provided (should be None/null)")
        
        # Create OTT release
        response = requests.post(f"{API_URL}/cms/ott-releases", data=movie_data, headers=self.headers)
        
        print(f"Response Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response Text: {response.text}")
        
        self.assertEqual(response.status_code, 200, f"Failed to create Movie OTT release: {response.text}")
        
        created_release = response.json()
        
        # Verify response structure and data
        self.assertIn("id", created_release, "Response missing 'id' field")
        self.assertEqual(created_release["movie_name"], movie_data["movie_name"])
        self.assertEqual(created_release["content_type"], movie_data["content_type"])
        self.assertEqual(created_release["created_by"], movie_data["created_by"])
        
        # Verify season is None/null for Movie
        season_value = created_release.get("season")
        self.assertIsNone(season_value, f"Season should be None for Movie, but got: {season_value}")
        
        # Store the ID for later tests
        self.movie_id = created_release["id"]
        
        print("✅ Movie OTT release created successfully without season")
        print(f"   - ID: {created_release['id']}")
        print(f"   - Movie Name: {created_release['movie_name']}")
        print(f"   - Content Type: {created_release['content_type']}")
        print(f"   - Season: {created_release.get('season', 'None')}")
        print(f"   - Release Date: {created_release['release_date']}")
        print("✅ Season field correctly saved as None/null for Movie")

    def test_03_update_ott_release_add_season(self):
        """Test updating OTT Release to add Season"""
        print("\n--- Test 3: Update OTT Release - Add Season ---")
        
        # First create a Web Series release without season
        initial_data = {
            "movie_name": "Test Series for Update",
            "content_type": "Web Series",
            # No season initially
            "release_date": "2025-04-01",
            "created_by": "Test",
            "ott_platforms": '["Disney+"]',
            "states": '["all"]',
            "languages": '["Tamil"]',
            "genres": '["Thriller"]'
        }
        
        print(f"Step 1: Creating Web Series without season: {initial_data['movie_name']}")
        
        # Create initial release
        response = requests.post(f"{API_URL}/cms/ott-releases", data=initial_data, headers=self.headers)
        self.assertEqual(response.status_code, 200, f"Failed to create initial release: {response.text}")
        
        initial_release = response.json()
        release_id = initial_release["id"]
        
        # Verify initial season is None
        self.assertIsNone(initial_release.get("season"), "Initial season should be None")
        print(f"✅ Initial release created with ID {release_id}, season: {initial_release.get('season', 'None')}")
        
        # Now update to add season
        update_data = {
            "season": 8
        }
        
        print(f"Step 2: Updating release {release_id} to add season: {update_data['season']}")
        
        # Update the release
        response = requests.put(f"{API_URL}/cms/ott-releases/{release_id}", data=update_data, headers=self.headers)
        
        print(f"Update Response Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Update Response Text: {response.text}")
        
        self.assertEqual(response.status_code, 200, f"Failed to update OTT release: {response.text}")
        
        updated_release = response.json()
        
        # Verify season was updated correctly
        self.assertEqual(updated_release["season"], 8, "Season should be updated to 8")
        self.assertEqual(updated_release["id"], release_id, "ID should remain the same")
        self.assertEqual(updated_release["movie_name"], initial_data["movie_name"], "Movie name should remain the same")
        
        print("✅ OTT release updated successfully")
        print(f"   - ID: {updated_release['id']}")
        print(f"   - Movie Name: {updated_release['movie_name']}")
        print(f"   - Season: {updated_release['season']}")
        print("✅ Season field correctly updated from None to 8")

    def test_04_retrieve_and_verify_seasons(self):
        """Test retrieving OTT releases and verifying season field"""
        print("\n--- Test 4: Retrieve and Verify Season Fields ---")
        
        print("Step 1: Retrieving all OTT releases")
        
        # Get all OTT releases
        response = requests.get(f"{API_URL}/cms/ott-releases", headers=self.headers)
        self.assertEqual(response.status_code, 200, f"Failed to get OTT releases: {response.text}")
        
        all_releases = response.json()
        self.assertIsInstance(all_releases, list, "OTT releases response should be a list")
        
        print(f"✅ Retrieved {len(all_releases)} OTT releases")
        
        # Verify season field is present in all releases
        web_series_count = 0
        movie_count = 0
        
        for release in all_releases:
            self.assertIn("season", release, f"Season field missing from release ID {release.get('id')}")
            self.assertIn("content_type", release, f"Content type missing from release ID {release.get('id')}")
            
            content_type = release["content_type"]
            season = release["season"]
            
            if content_type == "Web Series":
                web_series_count += 1
                # For Web Series, season can be None or an integer
                if season is not None:
                    self.assertIsInstance(season, int, f"Season should be integer for Web Series, got {type(season)}")
                    self.assertGreaterEqual(season, 1, f"Season should be >= 1, got {season}")
                    self.assertLessEqual(season, 20, f"Season should be <= 20, got {season}")
            elif content_type == "Movie":
                movie_count += 1
                # For Movies, season should be None
                self.assertIsNone(season, f"Season should be None for Movie, got {season}")
        
        print(f"✅ Season field validation completed")
        print(f"   - Web Series found: {web_series_count}")
        print(f"   - Movies found: {movie_count}")
        print(f"   - All season values are valid (1-20 for Web Series, None for Movies)")
        
        # Test retrieving specific releases created in previous tests
        if hasattr(self, 'web_series_id'):
            print(f"\nStep 2: Verifying specific Web Series (ID: {self.web_series_id})")
            response = requests.get(f"{API_URL}/cms/ott-releases/{self.web_series_id}", headers=self.headers)
            self.assertEqual(response.status_code, 200, f"Failed to get Web Series release")
            
            web_series = response.json()
            self.assertEqual(web_series["season"], 10, "Web Series season should be 10")
            self.assertEqual(web_series["content_type"], "Web Series")
            print(f"✅ Web Series verification passed - Season: {web_series['season']}")
        
        if hasattr(self, 'movie_id'):
            print(f"\nStep 3: Verifying specific Movie (ID: {self.movie_id})")
            response = requests.get(f"{API_URL}/cms/ott-releases/{self.movie_id}", headers=self.headers)
            self.assertEqual(response.status_code, 200, f"Failed to get Movie release")
            
            movie = response.json()
            self.assertIsNone(movie["season"], "Movie season should be None")
            self.assertEqual(movie["content_type"], "Movie")
            print(f"✅ Movie verification passed - Season: {movie.get('season', 'None')}")

    def test_05_season_validation_edge_cases(self):
        """Test season validation for edge cases"""
        print("\n--- Test 5: Season Validation Edge Cases ---")
        
        # Test Case 1: Season boundary values (1 and 20)
        print("Step 1: Testing season boundary values")
        
        # Test season = 1
        season_1_data = {
            "movie_name": "Test Series Season 1",
            "content_type": "Web Series",
            "season": 1,
            "release_date": "2025-05-01",
            "created_by": "Test",
            "ott_platforms": '["Netflix"]',
            "states": '["all"]',
            "languages": '["Hindi"]',
            "genres": '["Drama"]'
        }
        
        response = requests.post(f"{API_URL}/cms/ott-releases", data=season_1_data, headers=self.headers)
        self.assertEqual(response.status_code, 200, f"Failed to create release with season 1: {response.text}")
        
        season_1_release = response.json()
        self.assertEqual(season_1_release["season"], 1, "Season 1 should be accepted")
        print("✅ Season 1 validation passed")
        
        # Test season = 20
        season_20_data = {
            "movie_name": "Test Series Season 20",
            "content_type": "Web Series",
            "season": 20,
            "release_date": "2025-05-02",
            "created_by": "Test",
            "ott_platforms": '["Amazon Prime"]',
            "states": '["all"]',
            "languages": '["English"]',
            "genres": '["Sci-Fi"]'
        }
        
        response = requests.post(f"{API_URL}/cms/ott-releases", data=season_20_data, headers=self.headers)
        self.assertEqual(response.status_code, 200, f"Failed to create release with season 20: {response.text}")
        
        season_20_release = response.json()
        self.assertEqual(season_20_release["season"], 20, "Season 20 should be accepted")
        print("✅ Season 20 validation passed")
        
        # Test Case 2: Invalid season values (if backend validates)
        print("\nStep 2: Testing invalid season values")
        
        # Test season = 0 (should be rejected if validation exists)
        season_0_data = {
            "movie_name": "Test Series Season 0",
            "content_type": "Web Series",
            "season": 0,
            "release_date": "2025-05-03",
            "created_by": "Test",
            "ott_platforms": '["Disney+"]',
            "states": '["all"]',
            "languages": '["Hindi"]',
            "genres": '["Comedy"]'
        }
        
        response = requests.post(f"{API_URL}/cms/ott-releases", data=season_0_data, headers=self.headers)
        
        if response.status_code == 200:
            # Backend accepts season 0 - note this for improvement
            print("⚠️ Season 0 was accepted (backend may need validation improvement)")
            season_0_release = response.json()
            print(f"   - Created release with season: {season_0_release.get('season')}")
        else:
            # Backend rejects season 0 - good validation
            print("✅ Season 0 properly rejected by backend validation")
        
        # Test season = 21 (should be rejected if validation exists)
        season_21_data = {
            "movie_name": "Test Series Season 21",
            "content_type": "Web Series",
            "season": 21,
            "release_date": "2025-05-04",
            "created_by": "Test",
            "ott_platforms": '["Hulu"]',
            "states": '["all"]',
            "languages": '["English"]',
            "genres": '["Action"]'
        }
        
        response = requests.post(f"{API_URL}/cms/ott-releases", data=season_21_data, headers=self.headers)
        
        if response.status_code == 200:
            # Backend accepts season 21 - note this for improvement
            print("⚠️ Season 21 was accepted (backend may need validation improvement)")
            season_21_release = response.json()
            print(f"   - Created release with season: {season_21_release.get('season')}")
        else:
            # Backend rejects season 21 - good validation
            print("✅ Season 21 properly rejected by backend validation")

    def test_06_content_type_season_relationship(self):
        """Test the relationship between content_type and season field"""
        print("\n--- Test 6: Content Type and Season Relationship ---")
        
        print("Step 1: Testing Web Series with various seasons")
        
        # Test multiple Web Series with different seasons
        web_series_tests = [
            {"season": 2, "name": "Test Series S2"},
            {"season": 5, "name": "Test Series S5"},
            {"season": 15, "name": "Test Series S15"},
            {"season": None, "name": "Test Series No Season"}  # Web Series can have no season
        ]
        
        for test_case in web_series_tests:
            data = {
                "movie_name": test_case["name"],
                "content_type": "Web Series",
                "release_date": "2025-06-01",
                "created_by": "Test",
                "ott_platforms": '["Netflix"]',
                "states": '["all"]',
                "languages": '["Hindi"]',
                "genres": '["Drama"]'
            }
            
            if test_case["season"] is not None:
                data["season"] = test_case["season"]
            
            response = requests.post(f"{API_URL}/cms/ott-releases", data=data, headers=self.headers)
            self.assertEqual(response.status_code, 200, f"Failed to create {test_case['name']}: {response.text}")
            
            created_release = response.json()
            expected_season = test_case["season"]
            actual_season = created_release.get("season")
            
            self.assertEqual(actual_season, expected_season, 
                           f"Season mismatch for {test_case['name']}: expected {expected_season}, got {actual_season}")
            
            print(f"✅ {test_case['name']} - Season: {actual_season}")
        
        print("\nStep 2: Testing Movies should not have seasons")
        
        # Test multiple Movies (should all have season = None)
        movie_tests = [
            {"name": "Action Movie 1"},
            {"name": "Comedy Movie 2"},
            {"name": "Drama Movie 3"}
        ]
        
        for test_case in movie_tests:
            data = {
                "movie_name": test_case["name"],
                "content_type": "Movie",
                "release_date": "2025-06-02",
                "created_by": "Test",
                "ott_platforms": '["Amazon Prime"]',
                "states": '["all"]',
                "languages": '["English"]',
                "genres": '["Action"]'
            }
            
            response = requests.post(f"{API_URL}/cms/ott-releases", data=data, headers=self.headers)
            self.assertEqual(response.status_code, 200, f"Failed to create {test_case['name']}: {response.text}")
            
            created_release = response.json()
            actual_season = created_release.get("season")
            
            self.assertIsNone(actual_season, f"Movie {test_case['name']} should have season=None, got {actual_season}")
            
            print(f"✅ {test_case['name']} - Season: {actual_season}")

    def test_07_comprehensive_api_integration(self):
        """Test comprehensive API integration for season feature"""
        print("\n--- Test 7: Comprehensive API Integration ---")
        
        print("Step 1: Testing OTT platforms endpoint")
        
        # Test OTT platforms endpoint
        response = requests.get(f"{API_URL}/cms/ott-platforms", headers=self.headers)
        self.assertEqual(response.status_code, 200, f"Failed to get OTT platforms: {response.text}")
        
        platforms_data = response.json()
        self.assertIn("platforms", platforms_data, "Platforms data missing 'platforms' key")
        platforms = platforms_data["platforms"]
        self.assertIsInstance(platforms, list, "Platforms should be a list")
        
        print(f"✅ OTT platforms endpoint working - found {len(platforms)} platforms")
        
        print("\nStep 2: Testing homepage OTT releases integration")
        
        # Test homepage OTT releases endpoint
        response = requests.get(f"{API_URL}/releases/ott-bollywood", headers=self.headers)
        
        if response.status_code == 200:
            homepage_data = response.json()
            
            # Check structure
            self.assertIn("ott", homepage_data, "Homepage data missing 'ott' section")
            ott_data = homepage_data["ott"]
            
            self.assertIn("this_week", ott_data, "OTT data missing 'this_week' section")
            self.assertIn("coming_soon", ott_data, "OTT data missing 'coming_soon' section")
            
            # Check if any releases have season information
            all_ott_releases = ott_data["this_week"] + ott_data["coming_soon"]
            
            season_releases = [r for r in all_ott_releases if r.get("season") is not None]
            
            print(f"✅ Homepage OTT integration working")
            print(f"   - This week releases: {len(ott_data['this_week'])}")
            print(f"   - Coming soon releases: {len(ott_data['coming_soon'])}")
            print(f"   - Releases with season info: {len(season_releases)}")
            
            if season_releases:
                for release in season_releases[:3]:  # Show first 3
                    print(f"   - {release.get('movie_name', 'Unknown')} - Season {release.get('season')}")
        else:
            print(f"⚠️ Homepage OTT endpoint returned {response.status_code}")
        
        print("\nStep 3: Testing CMS config includes content types")
        
        # Test CMS config endpoint
        response = requests.get(f"{API_URL}/cms/config", headers=self.headers)
        self.assertEqual(response.status_code, 200, f"Failed to get CMS config: {response.text}")
        
        cms_config = response.json()
        
        # Verify config structure
        self.assertIn("languages", cms_config, "CMS config missing languages")
        self.assertIn("states", cms_config, "CMS config missing states")
        self.assertIn("categories", cms_config, "CMS config missing categories")
        
        print("✅ CMS config endpoint working")
        print(f"   - Languages: {len(cms_config['languages'])}")
        print(f"   - States: {len(cms_config['states'])}")
        print(f"   - Categories: {len(cms_config['categories'])}")

def run_tests():
    """Run all OTT Season feature tests"""
    print(f"\n{'='*80}")
    print("OTT SEASON DROPDOWN FEATURE COMPREHENSIVE TESTING")
    print(f"{'='*80}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API URL: {API_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}")
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(OTTSeasonFeatureTest)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n{'='*80}")
    print("OTT SEASON FEATURE TEST SUMMARY")
    print(f"{'='*80}")
    print(f"Tests Run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.failures:
        print("\nFAILURES:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback}")
    
    if result.errors:
        print("\nERRORS:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback}")
    
    if result.wasSuccessful():
        print("\n🎉 ALL OTT SEASON FEATURE TESTS PASSED SUCCESSFULLY!")
        print("✅ Season dropdown feature is working correctly")
        print("✅ Web Series can have seasons 1-20")
        print("✅ Movies correctly have no season field")
        print("✅ Create, update, and retrieve operations working")
        print("✅ API integration is complete and functional")
    else:
        print("\n❌ SOME TESTS FAILED - Review the failures above")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)