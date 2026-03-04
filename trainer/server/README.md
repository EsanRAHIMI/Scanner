# Trainer Server (FastAPI)

Local dev:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

Storage layout:

- `storage/uploads/` uploaded images
- `storage/queue.json` labeling queue
- `storage/classes.json` class list
- `storage/datasets/` exported YOLO datasets
- `storage/runs/` training jobs and logs
