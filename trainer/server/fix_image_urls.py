import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.environ.get("MONGODB_URI")
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "lorenzodb")
NEW_PREFIX = "https://trainer.ehsanrahimi.com"

def main():
    if not MONGODB_URI:
        print("Missing MONGODB_URI")
        return
        
    client = MongoClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    
    print("Updating URLs to use absolute domain...")
    
    cursor = db.products.find({"fields.Image": {"$exists": True}})
    
    updated_count = 0
    
    for doc in cursor:
        rid = doc["_id"]
        images = doc.get("fields", {}).get("Image", [])
        
        if not images or not isinstance(images, list):
            continue
            
        changed = False
        new_images = []
        
        for img in images:
            new_img = img.copy()
            url = img.get("url", "")
            
            # If it starts with /static, then we should prepend the domain
            if url.startswith("/static/"):
                new_img["url"] = f"{NEW_PREFIX}{url}"
                changed = True
                
            if "thumbnails" in new_img:
                for t_size in new_img["thumbnails"]:
                    t_url = new_img["thumbnails"][t_size].get("url", "")
                    if t_url.startswith("/static/"):
                        new_img["thumbnails"][t_size]["url"] = f"{NEW_PREFIX}{t_url}"
                        changed = True
                        
            new_images.append(new_img)
            
        if changed:
            db.products.update_one(
                {"_id": rid},
                {"$set": {"fields.Image": new_images}}
            )
            updated_count += 1
            
    print(f"Updated {updated_count} records.")
    client.close()

if __name__ == "__main__":
    main()
