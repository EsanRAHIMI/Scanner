import os
import json
from urllib.request import Request, urlopen
from urllib.parse import quote
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

def airtable_read(url, api_key):
    req = Request(url)
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Accept", "application/json")
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))

def inspect():
    # Table 1 (DAM Assets?)
    api_key1 = os.environ.get("AIRTABLE_API_KEY")
    base_id1 = os.environ.get("AIRTABLE_BASE_ID")
    table1 = os.environ.get("AIRTABLE_TABLE")

    # Table 2 (Products Assets)
    api_key2 = os.environ.get("AIRTABLE_PRODUCTS_API_KEY")
    base_id2 = os.environ.get("AIRTABLE_PRODUCTS_BASE_ID")
    table2 = os.environ.get("AIRTABLE_PRODUCTS_TABLE")

    print(f"Table 1: {table1}")
    if api_key1 and base_id1 and table1:
        url1 = f"https://api.airtable.com/v0/{base_id1}/{quote(table1, safe='')}?pageSize=100"
        try:
            data = airtable_read(url1, api_key1)
            records = data.get("records", [])
            cols = set()
            for r in records:
                cols.update(r.get("fields", {}).keys())
            print(f"  Total records sampled: {len(records)}")
            print(f"  All column names: {sorted(list(cols))}")
        except Exception as e:
            print(f"  Error reading Table 1: {e}")

    print(f"\nTable 2: {table2}")
    if api_key2 and base_id2 and table2:
        url2 = f"https://api.airtable.com/v0/{base_id2}/{quote(table2, safe='')}?pageSize=100"
        try:
            data = airtable_read(url2, api_key2)
            records = data.get("records", [])
            cols = set()
            for r in records:
                cols.update(r.get("fields", {}).keys())
            print(f"  Total records sampled: {len(records)}")
            print(f"  All column names: {sorted(list(cols))}")
        except Exception as e:
            print(f"  Error reading Table 2: {e}")

if __name__ == "__main__":
    inspect()
