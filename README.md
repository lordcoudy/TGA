# Telegram Chat Analytics

Public multi-user Telegram chat analytics with privacy-first JSON uploads and optional server-side MTProto fetching.

## Privacy model

- Uploaded Telegram JSON exports are parsed in the browser and are never sent to the server.
- MTProto fetching temporarily processes messages on the server and returns only aggregates.
- Raw messages are never stored in Postgres.
- Reports are stored only after an explicit user action and can be deleted from the UI.
- MTProto session strings are encrypted with AES-256-GCM and never returned to the browser.

## Setup

Run the interactive setup script:

```bash
npm run setup
```

It creates or updates `.env`, generates the encryption key when needed, starts Postgres and Redis, installs dependencies, applies migrations, and launches either the local development server or the complete Docker stack.

Telegram credentials may be left blank when only browser-side JSON analysis is needed. Configure Telegram API credentials and Telegram OIDC credentials from BotFather to enable accounts, saved reports, and MTProto fetching.

Open `http://localhost:3000`.

## Services

- Next.js App Router UI and API
- Postgres with Drizzle ORM for users, web sessions, encrypted Telegram connections, and aggregate reports
- Redis for OIDC state, MTProto code state, and API rate limiting

## Scripts

- `npm run dev` - local development server
- `npm run lint` - ESLint
- `npm test` - Vitest unit tests
- `npm run test:e2e` - Playwright browser tests
- `npm run build` - production build
- `npm run db:migrate` - apply Drizzle migrations
- `npm run setup` - interactive configuration and launcher

The launcher can also be scripted:

```bash
./scripts/setup-and-run.sh --mode dev
./scripts/setup-and-run.sh --mode docker
./scripts/setup-and-run.sh --mode configure --dry-run
```

## Production notes

Set `TELEGRAM_OIDC_REDIRECT_URI` to the deployed HTTPS callback and register it in BotFather. Run migrations before starting the application. Put the app behind an HTTPS reverse proxy and back up Postgres. Rotate `TELEGRAM_SESSION_ENCRYPTION_KEY` only with a planned re-encryption migration.
