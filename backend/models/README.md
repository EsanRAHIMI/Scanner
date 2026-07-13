# YOLO Model Directory

Place the YOLOv8 weights file at:

```
backend/models/best.pt
```

## Docker

The backend container mounts this path as:

```
/models/best.pt
```

Set `MODEL_PATH=/models/best.pt` in the container environment.

## Local Development

Set:

```
MODEL_PATH=./models/best.pt
```

If the file is missing, the API responds with `{ "error": "MODEL_NOT_FOUND" }`.
