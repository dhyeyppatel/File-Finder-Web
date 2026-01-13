import os
import re
from flask import Flask, jsonify, request, send_from_directory, render_template, session, redirect, url_for
from pymongo import MongoClient
from dotenv import load_dotenv
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
SYSTEM_MONGO_URI = os.getenv("MONGO_URI")
# SYSTEM_DB_NAME = os.getenv("DB_NAME") # We might use a separate DB for users, or same one.
# For simplicity, let's use the same DB but a 'users' collection.
# If DB_NAME is strictly for files, we might want a separate one, but let's stick to what we have.
DB_NAME = os.getenv("DB_NAME") 
COLLECTION_NAME = os.getenv("COLLECTION_NAME") # Keeping this for legacy single-tenant fallback if needed, or reference
SEARCH_FIELD_NAME = os.getenv("SEARCH_FIELD_NAME", "file_name")

if not all([SYSTEM_MONGO_URI, DB_NAME]):
    raise SystemExit("❌ Missing system environment variables: MONGO_URI, DB_NAME")

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.secret_key = os.getenv("SECRET_KEY", "dev_secret_key_change_me") # vital for session
CORS(app)

# --- System Database Connection (Users) ---
try:
    system_client = MongoClient(SYSTEM_MONGO_URI)
    # User requested literal names: DB='commonthread', Collection='filefinder'
    system_db = system_client['commonthread']
    users_collection = system_db['filefinder']
    print("✅ System MongoDB connection successful.")
except Exception as e:
    raise SystemExit(f"❌ Failed to connect to System MongoDB: {e}")

# --- Helper Functions ---

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_user_db_connection(user_doc):
    """
    Returns a (client, collection) tuple for the user's configured MongoDB.
    Uses user's 'mongo_uri' or falls back to None if not set.
    """
    uri = user_doc.get('mongo_uri')
    if not uri:
        return None, None
    
    try:
        # We assume the URI includes the DB name or we default to the same DB_NAME structure?
        # A full URI usually has the DB. If not, we might need a separate field.
        # User instructions: "insert their own mongodb url".
        # We will parse the DB name from the URI or assume a default 'TelegramFiles' or similar if generic.
        # But wait, logic in original app used `DB_NAME` env.
        # For multi-tenant, let's assume the user's URI points to the right place or we use a standard name 'Cluster0'?
        # Actually, best validation is to try connecting.
        # Let's assume standard 'TelegramFiles' or the one from env if not specified? 
        # Safer: Just Connect and use the default database in the URI if present, else DB_NAME.
        
        client = MongoClient(uri)
        # Database Selection
        user_db_name = user_doc.get('db_name')
        if user_db_name:
            db = client.get_database(user_db_name)
        else:
            try:
                db = client.get_database()
            except Exception:
                db = client.get_database('TelegramFiles')

        # Collection Selection
        user_coll_name = user_doc.get('collection_name')
        target_coll_name = user_coll_name if user_coll_name else COLLECTION_NAME
        
        print(f"DEBUG: User {user_doc['username']} | DB: {db.name} | Collection: {target_coll_name}")
        coll = db[target_coll_name]
        
        doc_count = coll.estimated_document_count()
        print(f"DEBUG: Collection has {doc_count} docs (estimated)")
        return client, coll
    except Exception as e:
        print(f"Error connecting to user DB: {e}")
        return None, None

def _parse_int(val, default):
    try:
        return int(val)
    except Exception:
        return default

# --- Auth Routes ---

@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    
    if len(username) < 3 or not re.match(r'^\w+$', username):
        return jsonify({"error": "Invalid username (3+ chars, alphanumeric)"}), 400

    if users_collection.find_one({"username": username}):
        return jsonify({"error": "Username taken"}), 409

    users_collection.insert_one({
        "username": username,
        "password": generate_password_hash(password),
        "mongo_uri": "",
        "bot_username": ""
    })
    return jsonify({"success": True})

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = users_collection.find_one({"username": username})
    if user and check_password_hash(user['password'], password):
        session['user_id'] = str(user['_id'])
        session['username'] = user['username']
        return jsonify({"success": True, "username": user['username']})
    
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({"success": True})

@app.route('/api/auth/me', methods=['GET'])
@login_required
def auth_me():
    user = users_collection.find_one({"username": session['username']})
    if not user:
        session.clear()
        return jsonify({"error": "User not found"}), 404
    
    return jsonify({
        "username": user['username'],
        "mongo_uri": user.get('mongo_uri', ''),
        "bot_username": user.get('bot_username', ''),
        "db_name": user.get('db_name', ''),
        "collection_name": user.get('collection_name', '')
    })

@app.route('/api/config', methods=['POST'])
@login_required
def update_config():
    data = request.json
    try:
        users_collection.update_one(
            {"username": session['username']},
            {"$set": {
                "mongo_uri": data.get('mongo_uri', '').strip(),
                "bot_username": data.get('bot_username', '').strip().replace('@', ''),
                "db_name": data.get('db_name', '').strip(),
                "collection_name": data.get('collection_name', '').strip()
            }}
        )
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Frontend Routes ---

@app.route('/')
def index():
    # Redirect to dashboard aka login page
    return render_template('dashboard.html') # Was send_from_directory('static', 'index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/<username>')
def user_search_page(username):
    # Check if user exists
    user = users_collection.find_one({"username": username})
    if not user:
        return "User not found", 404
    
    return render_template(
        'user_search.html', 
        api_base=f"/{username}/api",
        bot_username=user.get('bot_username', ''),
        username=username
    )

# --- API Routes (Dynamic) ---

@app.route('/<username>/api/latest', methods=['GET'])
def api_latest(username):
    user = users_collection.find_one({"username": username})
    if not user: return jsonify({"error": "User not found"}), 404

    client, collection = get_user_db_connection(user)
    if collection is None:
        return jsonify({"error": "User database not configured"}), 500

    page = max(1, _parse_int(request.args.get('page', 1), 1))
    per_page = max(1, _parse_int(request.args.get('per_page', 20), 20))
    skip = (page - 1) * per_page

    try:
        cursor = collection.find(
            {},
            {"_id": 1, "file_name": 1, "file_size": 1, "caption": 1, "year": 1, "file_type": 1}
        ).sort([("_id", -1)]).skip(skip).limit(per_page)

        items = []
        for doc in cursor:
            items.append({
                "id": str(doc.get("_id")),
                "file_name": doc.get("file_name", "N/A"),
                "file_size": doc.get("file_size", 0),
                "caption": doc.get("caption", ""),
                "year": doc.get("year", None),
                "file_type": doc.get("file_type", None)
            })
        client.close() # Close connection to avoid pooling up too many different user clients? 
        # Actually PyMongo connection pooling handles this but we are creating new clients per request potentially if we don't cache them.
        # For MVP low traffic, this is fine. Ideally we cache clients.
        return jsonify({"page": page, "per_page": per_page, "items": items})
    except Exception as e:
        print(f"Error in {username} latest: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/<username>/api/search', methods=['GET'])
def api_search(username):
    user = users_collection.find_one({"username": username})
    if not user: return jsonify({"error": "User not found"}), 404

    client, collection = get_user_db_connection(user)
    if collection is None:
        return jsonify({"error": "User database not configured"}), 500

    q = request.args.get('q', '')
    year = request.args.get('year')
    ftype = request.args.get('type')
    sort = request.args.get('sort', 'desc')
    page = max(1, _parse_int(request.args.get('page', 1), 1))
    per_page = max(1, _parse_int(request.args.get('per_page', 50), 50))
    skip = (page - 1) * per_page

    try:
        query = {}
        if q:
            safe_q = re.escape(q)
            query[SEARCH_FIELD_NAME] = {"$regex": safe_q, "$options": "i"}

        if year:
            try:
                query["year"] = int(year)
            except Exception:
                query["year"] = year

        if ftype:
            query["$or"] = [
                {"file_type": {"$regex": re.escape(ftype), "$options": "i"}},
                {SEARCH_FIELD_NAME: {"$regex": r"\." + re.escape(ftype) + r"$", "$options": "i"}}
            ]

        sort_dir = -1 if sort.lower() == 'desc' else 1

        cursor = collection.find(
            query,
            {"_id": 1, "file_name": 1, "file_size": 1, "caption": 1, "year": 1, "file_type": 1}
        ).sort([("_id", sort_dir)]).skip(skip).limit(per_page)

        items = []
        for doc in cursor:
            items.append({
                "id": str(doc.get("_id")),
                "file_name": doc.get("file_name", "N/A"),
                "file_size": doc.get("file_size", 0),
                "caption": doc.get("caption", ""),
                "year": doc.get("year", None),
                "file_type": doc.get("file_type", None)
            })
        client.close()
        return jsonify({"page": page, "per_page": per_page, "items": items})
    except Exception as e:
        print(f"Error in {username} search: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/<username>/api/stats', methods=['GET'])
def api_stats(username):
    user = users_collection.find_one({"username": username})
    if not user: return jsonify({"error": "User not found"}), 404

    client, collection = get_user_db_connection(user)
    if collection is None:
        return jsonify({"total_files": 0})
    
    try:
        count = collection.estimated_document_count()
        client.close()
        return jsonify({"total_files": count})
    except Exception as e:
        return jsonify({"total_files": 0})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 8080)), debug=True)
