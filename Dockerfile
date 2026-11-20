# Etapa 1: la SPA. Mientras frontend/ no tenga package.json, queda vacía.
FROM node:22-alpine AS spa
WORKDIR /spa
COPY frontend/ ./
RUN if [ -f package.json ]; then npm ci && npm run build; else mkdir -p dist; fi

# Etapa 2: el monolito, con la API y la SPA en una sola imagen (ADR-0001)
FROM python:3.11-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=spa /spa/dist /app/frontend/dist
ENV ENTORNO=produccion
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
