# Disclaimer

This project was fully made with Github Copilot. It is provided as-is without any guarantees. Use at your own risk. I saw https://github.com/Pankajtanwarbanna/ping-perfect and got an idea to try something similar for Telegram. This website does not store or share any data; all analysis is done in-memory on the server.

## Telegram Chat Analytics

Upload a Telegram JSON export, pick a chat, and explore message activity, word usage, emoji frequency, participants, and per-word search. The backend API parses the export and returns aggregated stats only.

### MTProto (optional, server-side fetch)

Set environment variables in `.env.local` (do not commit secrets):

```
TELEGRAM_API_ID=YOUR_API_ID
TELEGRAM_API_HASH=YOUR_API_HASH
```

API routes:
- `POST /api/mtproto/send-code` — body `{ phone, testDc?: boolean }`
- `POST /api/mtproto/sign-in` — body `{ phone, code, password?: string }` (returns `session` string)
- `POST /api/mtproto/export` — body `{ phone, session, chat, limit?: number, testDc?: boolean }`; returns `exported` + `analysis`

Usage flow: send code → sign in (store session string securely) → export chat by username/link/id. Sessions are kept in-memory only; persist the returned session if you need reuse.

### Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

### Docker

```bash
# Create a .env file with your Telegram API credentials (optional)
echo "TELEGRAM_API_ID=YOUR_API_ID" >> .env
echo "TELEGRAM_API_HASH=YOUR_API_HASH" >> .env

# Build and run
docker compose up --build

# open http://localhost:3000
```

To run in detached mode:

```bash
docker compose up -d --build
```

### How it works

- Upload a Telegram export (Settings → Advanced → Export Data → JSON). The file is read in the browser and sent to `/api/analyze`.
- The API parses chats, flattens message text, counts words (with stop words filtered), emojis, per-day activity, and participants. It returns chat-level aggregates and word-frequency maps for on-page search.
- The UI lets you select a chat, search for a word, and view infographics for words, emojis, authors, and daily activity.

### Tech stack

- Next.js App Router, TypeScript, Tailwind CSS (v4)
- API route at `src/app/api/analyze/route.ts`
- Analysis utilities in `src/lib/telegram.ts`

### Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production server
- `npm run lint` — lint the project

### Notes

- Data stays in-memory; no persistence is implemented.
- Word search is case-insensitive and uses the aggregated frequency map returned per chat.
- MTProto endpoints run server-side (Node runtime) and require valid Telegram API credentials and an interactive sign-in. For production, add persistence/encryption for session strings.
