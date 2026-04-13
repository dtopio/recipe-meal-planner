# MealSync Offline

This branch is the fully offline version of the app. It runs the frontend and backend locally on one machine and stores data in a local SQLite file instead of Supabase or any hosted database.

If someone clones this branch, they do not need Render or Supabase to use it.

## What This Branch Includes

- Vue 3 frontend
- Express backend
- SQLite local database
- Sample offline data already included in `server/data/mealsync.db`
- Fallback JSON snapshot in `server/data/db.json`

## Tech Stack

- Vue 3
- Vite
- Express
- SQLite via `better-sqlite3`
- Tailwind CSS
- Node.js

## Project Structure

```text
recipe-meal-planner/
|-- public/                 Static files
|-- server/                 Express backend
|   |-- data/
|   |   |-- mealsync.db     Main local SQLite database
|   |   `-- db.json         Fallback JSON snapshot
|   |-- routes/             API route handlers
|   |-- db.js               Local SQLite database loader
|   `-- seed.js             Default seed data
|-- src/                    Vue frontend
|-- .env.example            Optional environment template
|-- package.json
`-- README.md
```

## Requirements

- Node.js 18 or newer
- npm
- Git

## Run Offline Step By Step

### 1. Clone this branch

```bash
git clone --branch local-front-and-back-end-offline https://github.com/dtopio/recipe-meal-planner.git
cd recipe-meal-planner
```

### 2. Install dependencies

```bash
npm install
```

### 3. Optional: create local environment file

The app runs offline without API keys. The variables below are only for optional features like USDA nutrition lookup and OpenRouter AI features.

Create a `.env.local` file in the project root.

On Windows:

```bash
copy .env.example .env.local
```

On macOS or Linux:

```bash
cp .env.example .env.local
```

Example `.env.local`:

```env
APP_URL=http://localhost:3000
USDA_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.6-plus:free
```

Notes:

- You can leave `USDA_API_KEY` empty if you do not need nutrition lookup.
- You can leave `OPENROUTER_API_KEY` empty if you do not need AI features.
- If you want pure offline use, leaving both keys empty is fine.
- If you do not need any optional integrations, you can skip creating `.env.local` entirely.

### 4. Start the app

```bash
npm run dev
```

This starts the local backend and serves the frontend from the same app.

### 5. Open the app

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

## Important Offline Notes

- This branch does not use Supabase.
- This branch does not require Render.
- The backend and frontend are both started by `npm run dev`.
- The default local port is `3000`.

## Local Database Files

The local data lives here:

- `server/data/mealsync.db`
- `server/data/db.json`

What they do:

- `mealsync.db` is the real SQLite database used at runtime.
- `db.json` is a fallback snapshot the app can migrate from if the SQLite file is missing.
- `seed.js` contains the default collection structure and sample seed content.

## Demo Accounts

This branch includes seeded offline demo accounts:

- `sarah@example.com` / `Password123!`
- `mike@example.com` / `Password123!`
- `emma@example.com` / `Password123!`

Quick copy-paste login:

```text
Email: sarah@example.com
Password: Password123!
```

```text
Email: mike@example.com
Password: Password123!
```

```text
Email: emma@example.com
Password: Password123!
```

The local database file may also include additional accounts that were created later during local testing.

## Resetting The Offline Database

If you want to reset the app back to local sample data:

1. Stop the app.
2. Delete `server/data/mealsync.db`
3. Delete `server/data/mealsync.db-shm` if it exists.
4. Delete `server/data/mealsync.db-wal` if it exists.
5. Start the app again with `npm run dev`

What happens next:

- If `server/data/db.json` exists, the app rebuilds the SQLite database from that file.
- If both the SQLite file and `db.json` are missing, the app recreates the data from `server/seed.js`.

## Available Scripts

### Development

```bash
npm run dev
```

Starts the local offline app in development mode at `http://localhost:3000`.

### Production Build

```bash
npm run build
```

Builds the frontend assets.

### Local Production Preview

```bash
npm run preview
```

Runs the server in production mode locally.

### Production Start

```bash
npm start
```

Runs the production server locally.

## Optional Environment Variables

From `.env.example`:

- `APP_URL=http://localhost:3000`
- `USDA_API_KEY=...`
- `OPENROUTER_API_KEY=...`
- `OPENROUTER_MODEL=qwen/qwen3.6-plus:free`

If you leave these unset:

- the app still works offline
- USDA-based nutrition features may be unavailable
- AI summary and AI recipe helper features may be unavailable

Recommended local setup:

```env
APP_URL=http://localhost:3000
USDA_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.6-plus:free
```

## Troubleshooting

### Port 3000 already in use

Stop the other process using port `3000`, then run:

```bash
npm run dev
```

### Fresh reinstall

If dependencies get messy:

```bash
rm -rf node_modules
npm install
```

On Windows PowerShell:

```powershell
Remove-Item node_modules -Recurse -Force
npm install
```

### Database looks wrong

Reset the local database using the steps in the "Resetting The Offline Database" section above.

## Summary

To run this branch offline, the short version is:

1. Clone `local-front-and-back-end-offline`
2. Run `npm install`
3. Run `npm run dev`
4. Open `http://localhost:3000`

That is enough to use the app locally with the included SQLite database.
