# Tech Stack: Containerization

Docker and Docker Compose setup for local development and production builds.

## Docker Compose (Development)

Two services for local development:

```yaml
services:
  postgres:
    image: postgres:18.1-bookworm
    environment:
      POSTGRES_USER: kanban
      POSTGRES_PASSWORD: kanban
      POSTGRES_DB: kanban
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kanban"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    environment:
      DATABASE_URL: postgresql://kanban:kanban@postgres:5432/kanban
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
```

## Dockerfile (Production)

```dockerfile
FROM denoland/deno:latest

WORKDIR /app

# Copy dependency files first for layer caching
COPY deno.json deno.lock* ./
RUN deno install

# Copy source
COPY . .

# Build
RUN deno task build

EXPOSE 8000

CMD ["deno", "run", "-A", ".deno-deploy/server.ts"]
```

## Dockerfile.dev (Development)

```dockerfile
FROM denoland/deno:latest

WORKDIR /app

COPY deno.json deno.lock* ./
RUN deno install

COPY . .

EXPOSE 5173

CMD ["deno", "task", "dev", "--host", "0.0.0.0"]
```

## Workflow

### Local Development (Preferred)

Run just the database in Docker, app natively:

```bash
docker compose up postgres       # Start DB only
deno task dev                     # Start Vite dev server
```

### Full Stack Docker

Run everything in containers:

```bash
docker compose up --build
```

### Database Reset

```bash
docker compose down -v           # Remove volumes (deletes data)
docker compose up postgres       # Fresh database
deno task db:push                # Re-create schema
```
