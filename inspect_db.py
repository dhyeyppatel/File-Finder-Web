import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
print(f"Connecting to URI: {MONGO_URI.split('@')[-1] if '@' in MONGO_URI else '...'}...")

try:
    client = MongoClient(MONGO_URI)
    dbs = client.list_database_names()
    print("\nAvailable Databases:")
    for db_name in dbs:
        print(f" - {db_name}")
        db = client[db_name]
        colls = db.list_collection_names()
        print(f"   Collections:")
        for coll in colls:
            count = db[coll].estimated_document_count()
            print(f"    * {coll} (docs: {count})")
            
except Exception as e:
    print(f"Error: {e}")
