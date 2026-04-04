import os
import json
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.parse import quote, urlencode
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Mongo Config
MONGODB_URI = os.environ.get("MONGODB_URI")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "lorenzodb")

def airtable_read(url, api_key):
    req = Request(url)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Accept", "application/json")
    with urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))

def migrate_table(api_key, base_id, table_id, collection_name, db):
    if not all([api_key, base_id, table_id]):
        print(f"Skipping {collection_name}: missing config.")
        return

    print(f"\nMigrating {collection_name} (Table: {table_id})")
    collection = db[collection_name]
    all_records = []
    offset = None
    
    while True:
        params = {"pageSize": "100"}
        if offset:
            params["offset"] = offset
        
        encoded_table = quote(table_id, safe='')
        url = f"https://api.airtable.com/v0/{base_id}/{encoded_table}?{urlencode(params)}"
        
        try:
            data = airtable_read(url, api_key)
            records = data.get("records", [])
            all_records.extend(records)
            print(f"  Fetched {len(records)} records (Total: {len(all_records)})")
            
            offset = data.get("offset")
            if not offset:
                break
            time.sleep(0.2)
        except Exception as e:
            print(f"  Error fetching from Airtable: {e}")
            break

    if not all_records:
        print(f"  No records found for {collection_name}.")
        return

    ops = []
    now = datetime.now(timezone.utc).isoformat()
    for r in all_records:
        record_id = r.get("id")
        fields = r.get("fields", {})
        
        # Preservation logic: keep everything. 
        # Airtable record data structure matches what frontend expects.
        doc = {
            "_id": record_id,
            "fields": fields,
            "created_at": r.get("createdTime") or now,
            "updated_at": now
        }
        ops.append(UpdateOne({"_id": record_id}, {"$set": doc}, upsert=True))

    if ops:
        print(f"  Updating {len(ops)} records in MongoDB...")
        # Chunking for bulk write
        chunk_size = 500
        for i in range(0, len(ops), chunk_size):
            collection.bulk_write(ops[i:i+chunk_size])
        print(f"  {collection_name} Migration Complete!")

def main():
    if not MONGODB_URI:
        print("MONGODB_URI is not set.")
        return

    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]

    # 1. Products Table (the main requested table)
    migrate_table(
        api_key=os.environ.get("AIRTABLE_PRODUCTS_API_KEY"),
        base_id=os.environ.get("AIRTABLE_PRODUCTS_BASE_ID"),
        table_id=os.environ.get("AIRTABLE_PRODUCTS_TABLE"), # tblEoHCAHBFBOLIbt
        collection_name="products",
        db=db
    )

    # 2. Product Assets (DAM) Table
    migrate_table(
        api_key=os.environ.get("AIRTABLE_API_KEY"),
        base_id=os.environ.get("AIRTABLE_BASE_ID"),
        table_id=os.environ.get("AIRTABLE_TABLE"), # tblT58oLMh3Y0EasO
        collection_name="dam_assets",
        db=db
    )
    
    # 3. Content Calendar Table (for full independence)
    migrate_table(
        api_key=os.environ.get("AIRTABLE_API_KEY"),
        base_id=os.environ.get("AIRTABLE_BASE_ID"),
        table_id="tblZjd1tbJMau2h9U", # Hardcoded or use metadata
        collection_name="content_calendar_airtable",
        db=db
    )

    client.close()

if __name__ == "__main__":
    main()
