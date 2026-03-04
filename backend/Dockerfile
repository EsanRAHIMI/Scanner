FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
  && pip uninstall -y opencv-python opencv-contrib-python opencv-contrib-python-headless || true \
  && pip install --no-cache-dir --force-reinstall opencv-python-headless==4.10.0.84

COPY app.py ./
COPY products.json ./

EXPOSE 8000

ENV MODEL_PATH=/models/best.pt

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
