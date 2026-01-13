import requests
import time
import subprocess
import os
import sys
import threading
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env to get MONGO_URI for clean up if needed, though we will use the API to test.
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_NAME = os.getenv("COLLECTION_NAME")

PORT = 5009
BASE_URL = f"http://127.0.0.1:{PORT}"

def run_app():
    # Run flask app on custom port
    env = os.environ.copy()
    env["PORT"] = str(PORT)
    # Ensure dependencies are found
    subprocess.run([sys.executable, "app.py"], env=env)

def wait_for_server():
    for _ in range(30):
        try:
            requests.get(BASE_URL)
            return True
        except requests.ConnectionError:
            time.sleep(1)
    return False

def test_multitenancy():
    print(f"🔄 Starting Verification on Port {PORT}...")
    
    # 1. Start App in Thread (or subprocess)
    # Using Popen to kill it later
    env = os.environ.copy()
    env["PORT"] = str(PORT)
    # Redirecting to stdout/stderr so we can see what happens
    server_process = subprocess.Popen([sys.executable, "app.py"], env=env)
    
    try:
        if not wait_for_server():
            print("❌ Server failed to start.")
            return

        session = requests.Session()

        # 2. Test Registration
        username = f"testuser_{int(time.time())}"
        password = "password123"
        print(f"👤 Registering user: {username}")
        res = session.post(f"{BASE_URL}/api/auth/register", json={"username": username, "password": password})
        if res.status_code != 200:
            print(f"❌ Registration failed: {res.text}")
            return
        print("✅ Registration successful.")

        # 3. Test Login
        print("🔑 Logging in...")
        res = session.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
        if res.status_code != 200:
            print(f"❌ Login failed: {res.text}")
            return
        print("✅ Login successful.")

        # 4. Test Config Update (Using same Mongo URI from env for testing as requested)
        print("⚙️ Updating Configuration...")
        bot_username = "MyTestBot"
        res = session.post(f"{BASE_URL}/api/config", json={
            "mongo_uri": MONGO_URI,
            "bot_username": bot_username,
            "db_name": DB_NAME,
            "collection_name": COLLECTION_NAME
        })
        if res.status_code != 200:
            print(f"❌ Config update failed: {res.text}")
            return
        print("✅ Config updated.")

        # 5. Verify Dashboard/Me
        print("👀 Verifying Config Persistence...")
        res = session.get(f"{BASE_URL}/api/auth/me")
        data = res.json()
        if data.get("mongo_uri") != MONGO_URI or data.get("bot_username") != bot_username or data.get("db_name") != DB_NAME:
            print(f"❌ verification failed: Got {data}")
            return
        print("✅ Config verification successful.")

        # 6. Test User Public Page Injection
        print(f"🌍 Fetching User Page /{username}...")
        res = requests.get(f"{BASE_URL}/{username}")
        if res.status_code != 200:
            print(f"❌ Failed to fetch user page: {res.status_code}")
            return
        
        if f'window.USER_API_BASE = "/{username}/api";' not in res.text:
            print("❌ Context API_BASE injection missing.")
            return
        if f'window.BOT_USERNAME = "{bot_username}";' not in res.text:
            print("❌ Context BOT_USERNAME injection missing.")
            return
        print("✅ User Context Injected Correctly.")

        # 7. Test Stats API (Tests Connection)
        print(f"📊 Testing API Connection /{username}/api/stats...")
        res = requests.get(f"{BASE_URL}/{username}/api/stats")
        if res.status_code != 200:
            print(f"❌ API Stats failed: {res.text}")
            return
        data = res.json()
        print(f"✅ API Connection successful. File count: {data.get('total_files')}")

        print("\n🎉 ALL TESTS PASSED!")

    except Exception as e:
        print(f"❌ Exception: {e}")
    finally:
        server_process.kill()

if __name__ == "__main__":
    test_multitenancy()
