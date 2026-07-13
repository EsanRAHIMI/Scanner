# Trainer Server (FastAPI)

Dataset storage, labeling queue management, YOLO export, training orchestration, and model publishing for the Lorenzo Scanner training pipeline.

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8010 --reload
```

> 🟥 **IMPORTANT (Current Production Mode = CPU-only):**  
> `requirements.txt` is intentionally set to CPU-only PyTorch for non-GPU servers.  
> When you migrate this service to a GPU server, switch install target to:
>
> ```bash
> pip install -r requirements.gpu.txt
> ```
>
> This enables CUDA wheels for better YOLO inference/training performance.

Health check:

```bash
curl http://127.0.0.1:8010/health
```

## Storage Layout

| Path | Description |
|------|-------------|
| `storage/uploads/` | Uploaded source images |
| `storage/queue.json` | Labeling queue state |
| `storage/classes.json` | Class definitions |
| `storage/datasets/` | Exported YOLO datasets |
| `storage/runs/` | Training jobs, artifacts, and logs |

Published models are copied to `backend/models/best.pt` via the Publish endpoint.
