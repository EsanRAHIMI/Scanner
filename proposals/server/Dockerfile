# Playwright base image ships Chromium + all OS deps needed for PDF export.
FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
  # Keep the browser in sync with the installed playwright python package.
  && python -m playwright install chromium

COPY . .

# Generated PDFs / uploaded assets persist on a mounted volume (or S3 if configured).
ENV PROPOSALS_STORAGE_ROOT=/data/storage

EXPOSE 8030

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8030"]
