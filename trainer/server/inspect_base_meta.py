import os
import json
import urllib.request
from urllib.parse import quote
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

def get_base_metadata(base_id, api_key):
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {api_key}")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}

def inspect_base():
    api_key1 = os.environ.get("AIRTABLE_API_KEY")
    api_key2 = os.environ.get("AIRTABLE_PRODUCTS_API_KEY")
    base_id = os.environ.get("AIRTABLE_PRODUCTS_BASE_ID") or os.environ.get("AIRTABLE_BASE_ID")

    print(f"Inspecting Base: {base_id}")
    
    # Try with both keys if necessary
    for ak in [api_key2, api_key1]:
        if not ak: continue
        metadata = get_base_metadata(base_id, ak)
        if "error" in metadata:
            print(f"  Error with API Key: {metadata['error']}")
            continue
        
        print(f"  Found {len(metadata.get('tables', []))} tables:")
        for t in metadata.get('tables', []):
            print(f"\n  - Table: {t.get('name')} ({t.get('id')})")
            fields = [f.get('name') for f in t.get('fields', [])]
            print(f"    Fields: {fields}")
        return # Success

if __name__ == "__main__":
    inspect_base()
