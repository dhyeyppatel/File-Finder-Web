# app.py (cleaned: only Mongo + search + link)
import os
import re
from flask import Flask, jsonify, request, send_from_directory
from pymongo import MongoClient
from dotenv import load_dotenv
from flask_cors import CORS

# Load environment variables from .env file
load_dotenv()

# --- Configuration ---
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")
COLLECTION_NAME = os.getenv("COLLECTION_NAME")
SEARCH_FIELD_NAME = os.getenv("SEARCH_FIELD_NAME", "file_name")

# Basic env check
if not all([MONGO_URI, DB_NAME, COLLECTION_NAME]):
    raise SystemExit("❌ Missing one or more critical environment variables: MONGO_URI, DB_NAME, COLLECTION_NAME")

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)  # allow cross origin for frontend to call API

# --- Database Connection ---
try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    collection = db[COLLECTION_NAME]
    mongo_client.server_info()  # Test connection
    print("✅ MongoDB connection successful.")
except Exception as e:
    raise SystemExit(f"❌ Failed to connect to MongoDB: {e}")

# --- Frontend route: serve index.html ---
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# --- API Routes used by frontend ---

def _parse_int(val, default):
    try:
        return int(val)
    except Exception:
        return default

@app.route('/api/latest', methods=['GET'])
def api_latest():
    """Returns paginated latest records."""
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
        return jsonify({"page": page, "per_page": per_page, "items": items})
    except Exception as e:
        print(f"/api/latest error: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/api/search', methods=['GET'])
def api_search():
    """Search endpoint with optional filters."""
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

        return jsonify({"page": page, "per_page": per_page, "items": items})
    except Exception as e:
        print(f"/api/search error: {e}")
        return jsonify({"error": "Database error"}), 500

@app.route('/api/send_link/<file_id>', methods=['GET'])
def api_send_link(file_id):
    """Constructs and returns the Telegram deep link (frontend opens it)."""
    if not file_id:
        return jsonify({"error": "file_id required"}), 400
    link = f"https://t.me/dhyeyautofilterbot?start=file_1123135015_{file_id}"
    return jsonify({"link": link})

@app.route('/api/stats', methods=['GET'])
def api_stats():
    """Returns total file count (fast estimation)."""
    try:
        count = collection.estimated_document_count()
        return jsonify({"total_files": count})
    except Exception as e:
        print(f"/api/stats error: {e}")
        return jsonify({"total_files": 0})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 8080)))
