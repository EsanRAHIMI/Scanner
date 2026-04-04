import os
import json
import time
import requests
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Config
AIRTABLE_API_KEY = os.environ.get("AIRTABLE_PRODUCTS_API_KEY") or os.environ.get("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_PRODUCTS_BASE_ID") or os.environ.get("AIRTABLE_BASE_ID")
AIRTABLE_TABLE = os.environ.get("AIRTABLE_PRODUCTS_TABLE")

MONGODB_URI = os.environ.get("MONGODB_URI")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "lorenzodb")

# LOCAL_URL_BASE = "http://localhost:8010/static/product_images"
# Better yet, use relative path if frontend allows, or absolute. 
# Since we are on a mac server, localhost:8010 is safe for now.
LOCAL_URL_BASE = "/static/product_images" # This is relative to the server root

STATIC_DIR = BASE_DIR / "static" / "product_images"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

def fetch_all_from_airtable():
    print("Fetching fresh records from Airtable to get valid image links...")
    records = []
    offset = None
    while True:
        url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE}"
        params = {"pageSize": 100}
        if offset:
            params["offset"] = offset
        
        headers = {"Authorization": f"Bearer {AIRTABLE_API_KEY}"}
        resp = requests.get(url, headers=headers, params=params)
        data = resp.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
        print(f"  Fetched {len(records)} records...")
        time.sleep(0.2)
    return records

def download_image(url, filename, record_id):
    local_name = f"{record_id}_{filename}"
    local_path = STATIC_DIR / local_name
    
    if local_path.exists():
        return local_name

    try:
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            local_path.write_bytes(resp.content)
            return local_name
        else:
            print(f"    Failed to download {url}: {resp.status_code}")
            return None
    except Exception as e:
        print(f"    Error downloading {url}: {e}")
        return None

def main():
    if not all([AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE, MONGODB_URI]):
        print("Missing environment variables.")
        return

    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    
    at_records = fetch_all_from_airtable()
    
    print(f"\nMirroring images for {len(at_records)} records...")
    
    for i, rec in enumerate(at_records):
        rid = rec.get("id")
        fields = rec.get("fields", {})
        images = fields.get("Image")
        
        if not images or not isinstance(images, list):
            continue
            
        print(f"[{i+1}/{len(at_records)}] Processing record: {rid}")
        
        updated_images = []
        changed = False
        
        for idx, img in enumerate(images):
            at_url = img.get("url")
            fname = img.get("filename")
            
            if not at_url:
                updated_images.append(img)
                continue
            
            # Download and get local filename
            local_filename = download_image(at_url, fname, rid)
            if local_filename:
                # Update the URL to local server
                new_img = img.copy()
                new_img["url"] = f"{LOCAL_URL_BASE}/{local_filename}"
                # Also update thumbnails if needed, but for now just the main URL
                if "thumbnails" in new_img:
                    for t_size in new_img["thumbnails"]:
                        new_img["thumbnails"][t_size]["url"] = f"{LOCAL_URL_BASE}/{local_filename}"
                
                updated_images.append(new_img)
                changed = True
            else:
                updated_images.append(img)
        
        if changed:
            # Update MongoDB
            db.products.update_one(
                {"_id": rid},
                {"$set": {"fields.Image": updated_images}}
            )
            print(f"    Updated MongoDB for {rid}")

    print("\nMirroring complete!")
    client.close()

if __name__ == "__main__":
    main()
