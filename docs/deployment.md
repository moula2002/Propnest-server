# Deployment & Operational Runbook

## 1. Environment Requirements
- **Node.js**: >= 20.x LTS
- **PostgreSQL**: >= 15.x (Tested with PostgreSQL 19)
- **Container Runtime**: Docker & Docker Compose (optional for local, standard for containerized production)

## 2. Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and configure secrets
cp .env.example .env

# 3. Run database migrations
npm run prisma:migrate

# 4. Seed development data
npm run seed

# 5. Start development server
npm run dev
```

## 3. Docker Deployment
```bash
# Build and run backend and PostgreSQL
docker-compose up --build -d
```

