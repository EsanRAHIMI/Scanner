import os
import json
import urllib.request
from urllib.parse import quote
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

def airtable_read(url, ak):
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {ak}")
    req.add_header("Accept", "application/json")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def research():
    api_key1 = os.environ.get("AIRTABLE_API_KEY")
    base_id1 = os.environ.get("AIRTABLE_BASE_ID")
    table1 = os.environ.get("AIRTABLE_TABLE")

    api_key2 = os.environ.get("AIRTABLE_PRODUCTS_API_KEY")
    base_id2 = os.environ.get("AIRTABLE_PRODUCTS_BASE_ID")
    table2 = os.environ.get("AIRTABLE_PRODUCTS_TABLE")

    print(f"Base: {base_id1}")
    
    # Check Table 1
    if api_key1 and base_id1 and table1:
        print(f"Table 1 ({table1}):")
        url = f"https://api.airtable.com/v0/{base_id1}/{quote(table1, safe='')}?pageSize=1"
        try:
            data = airtable_read(url, api_key1)
            recs = data.get("records", [])
            if recs:
                print(f"  Field names present in first record: {sorted(list(recs[0].get('fields', {}).keys()))}")
            else:
                print("  No records found in Table 1.")
        except Exception as e:
            print(f"  Error Table 1: {e}")

    # Check Table 2
    if api_key2 and base_id2 and table2:
        print(f"Table 2 ({table2}):")
        url = f"https://api.airtable.com/v0/{base_id2}/{quote(table2, safe='')}?pageSize=100"
        try:
            data = airtable_read(url, api_key2)
            recs = data.get("records", [])
            all_keys = set()
            for r in recs:
                all_keys.update(r.get("fields", {}).keys())
            print(f"  All field names present in first 100 records: {sorted(list(all_keys))}")
        except Exception as e:
            print(f"  Error Table 2: {e}")

if __name__ == "__main__":
    research()
