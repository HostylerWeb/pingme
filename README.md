# PingMe

Proximity social app — monorepo.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Start Postgres (port 5435) + Redis (port 6381)
#    Note: default ports 5432/6379 may already be in use on your machine.
pnpm docker:up

# 4. Wait for database (optional)
chmod +x infrastructure/scripts/wait-for-db.sh
./infrastructure/scripts/wait-for-db.sh

# 5. Generate Prisma client & run migrations
pnpm db:generate
pnpm db:migrate

# 6. Seed test users (optional)
pnpm db:seed

# 7. Start API in dev mode
pnpm --filter @pingme/api dev
```

API: http://localhost:3000/v1/health  
Swagger: http://localhost:3000/docs

### Test auth flow (curl)

```bash
# Register
curl -X POST http://localhost:3000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"Password123!","dateOfBirth":"1995-01-01"}'

# OTP is printed in the API terminal in development mode
```

## Mobile (Expo dev client)

```bash
cd apps/mobile
pnpm install
pnpm start
```

For a device build:

```bash
cd apps/mobile
pnpm eas:build:dev
```

## Project structure

```
apps/
  api/       NestJS backend
  mobile/    Expo React Native app
packages/
  config/    Shared TS + ESLint config
  shared/    Types, Zod schemas, constants
  db/        Prisma schema + migrations
docs/
  getting-started/  How to run locally / staging
  product/          Strategy + development plan
  engineering/      Audit fixes + UI gaps
  testing/          Device test checklist
  spikes/           Technical spike notes
```

## Test users (after seed)

- Email: `user1@pingme.test` … `user10@pingme.test`
- Password: `Password123!`

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers (turbo) |
| `pnpm build` | Build all packages |
| `pnpm docker:up` | Start local Postgres + Redis |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed 10 test users |

See [docs/getting-started/howtorun.md](./docs/getting-started/howtorun.md) for a fuller runbook and [docs/product/development.md](./docs/product/development.md) for the phased plan.
