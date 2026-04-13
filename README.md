# MealSync - Recipe & Meal Planner

A full-stack recipe and meal planning application that supports both offline and cloud-connected deployment. Run locally with SQLite or connect to a live database server for team collaboration. Works on your machine with zero external dependencies, or scale to a hosted backend.

## Key Features

- **Flexible Deployment**: Run locally with SQLite (offline) or connect to a live database server
- **Offline-First Local Mode**: All data stored locally in SQLite—no cloud service required
- **Cloud-Ready**: Connect to a live database server for team collaboration and scalability
- **Vue 3 Frontend**: Modern, responsive UI with real-time state management
- **Express Backend**: Robust local API with authentication and data management
- **Household Sharing**: Create households and invite others to share meal plans and shopping lists
- **Meal Planning**: Plan meals across customizable meal periods
- **Recipe Management**: Import, create, and organize recipes
- **Shopping Lists**: Generate and manage shopping lists from meal plans
- **Pantry Tracking**: Track available ingredients in your household
- **Nutrition Insights**: View nutrition information for meals and recipes
- **Demo Accounts**: Includes pre-configured demo accounts for testing

## Tech Stack

**Frontend:**
- Vue 3 (with TypeScript)
- Vite (build tool)
- Tailwind CSS 4 (styling)
- Reka UI + shadcn/vue (component library)
- Pinia (state management)
- VeeValidate + Zod (form validation)
- Vue Router (routing)
- Lucide Vue Next (icons)
- Vue Sonner (notifications)

**Backend:**
- Express.js (API server)
- Node.js 18+
- SQLite via `better-sqlite3` (local database)
- Bcryptjs (password hashing)
- Helmet (security headers)
- CORS (cross-origin requests)
- Express Rate Limiting (API protection)

## Project Structure

```
recipe-meal-planner-front-end/
├── server/                    Express backend
│   ├── routes/               API route handlers
│   │   ├── auth.js          Authentication endpoints
│   │   ├── household.js      Household management
│   │   ├── recipes.js        Recipe CRUD operations
│   │   ├── planner.js        Meal planning endpoints
│   │   ├── shopping.js       Shopping list management
│   │   └── pantry.js         Pantry inventory endpoints
│   ├── data/
│   │   ├── mealsync.db       Main SQLite database
│   │   └── db.json           Fallback JSON snapshot
│   ├── db.js                 Database initialization
│   ├── seed.js               Default seed data
│   ├── index.js              Main server entry point
│   ├── config.js             Configuration
│   ├── helpers.js            Response helpers
│   ├── logger.js             Logging utilities
│   ├── rate-limit.js         Rate limiting config
│   ├── password.js           Password utilities
│   ├── nutrition.js          Nutrition calculations
│   ├── recipe-import.js      Recipe import utilities
│   ├── utils.js              General utilities
│   └── ai.js                 AI integration (optional)
├── src/                      Vue 3 frontend
│   ├── components/           Reusable components
│   │   ├── app/             App-specific components (cards, lists, etc.)
│   │   ├── layout/          Layout components (header, nav, etc.)
│   │   └── ui/              Base UI components (buttons, dialogs, etc.)
│   ├── stores/              Pinia state stores
│   │   ├── auth.ts
│   │   ├── household.ts
│   │   ├── recipes.ts
│   │   ├── planner.ts
│   │   ├── shopping.ts
│   │   ├── pantry.ts
│   │   ├── insights.ts
│   │   └── ui.ts
│   ├── views/               Page components
│   │   ├── auth/            Login/Register pages
│   │   ├── onboarding/      Household setup pages
│   │   ├── recipes/         Recipe-related pages
│   │   ├── DashboardPage.vue
│   │   ├── PlannerPage.vue
│   │   ├── ShoppingListPage.vue
│   │   ├── PantryPage.vue
│   │   ├── HouseholdPage.vue
│   │   ├── WeeklyReportPage.vue
│   │   └── SettingsPage.vue
│   ├── router/              Vue Router configuration
│   ├── services/            API and data services
│   │   ├── api/
│   │   ├── mock/
│   │   └── sync/
│   ├── composables/         Vue 3 composables
│   ├── utils/               Utility functions
│   ├── types/               TypeScript type definitions
│   ├── lib/                 Third-party integrations
│   ├── App.vue              Root component
│   ├── main.ts              Entry point
│   └── style.css            Global styles
├── public/                   Static assets
├── .env.example             Environment variables template
├── package.json
├── vite.config.js
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Quick Start

### Requirements

- Node.js 18 or newer
- npm 9 or newer
- Git

### Installation

#### 1. Clone the repository

```bash
git clone https://github.com/dtopio/recipe-meal-planner.git
cd recipe-meal-planner-front-end
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. (Optional) Configure environment variables

Create a `.env.local` file in the project root to customize the app behavior:

On macOS/Linux:
```bash
cp .env.example .env.local
```

On Windows:
```bash
copy .env.example .env.local
```

**Local SQLite Mode (Offline):**
```env
APP_URL=http://localhost:3000
DATABASE_MODE=sqlite
USDA_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.6-plus:free
```

**Live Server Mode (Remote Database):**
To connect to a live database server (Supabase, PostgreSQL, etc.), use:
```env
APP_URL=http://localhost:3000
DATABASE_MODE=remote
DATABASE_URL=postgresql://user:password@host:port/database
USDA_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.6-plus:free
```

**Environment Variable Reference:**
- `APP_URL`: The URL where the app will be accessed (default: `http://localhost:3000`)
- `DATABASE_MODE`: Either `sqlite` (local) or `remote` (live server) - default is `sqlite`
- `DATABASE_URL`: Connection string for remote database (required when `DATABASE_MODE=remote`)
- `USDA_API_KEY`: Optional. For USDA nutrition data lookup
- `OPENROUTER_API_KEY`: Optional. For AI-powered recipe helpers
- `OPENROUTER_MODEL`: AI model to use (default: `qwen/qwen3.6-plus:free`)

**Notes:**
- For pure offline use with SQLite, you can skip `.env.local` entirely
- When using `DATABASE_MODE=remote`, ensure `DATABASE_URL` is properly configured
- Leave optional API keys empty if not using those features

#### 4. Start the development server

```bash
npm run dev
```

Both the backend and frontend will start at:
```
http://localhost:3000
```

#### 5. Verify installation

Health check endpoint:
```
http://localhost:3000/api/health
```

## Demo Accounts

Test accounts are pre-seeded in the local database:

```
Email: sarah@example.com
Password: Password123!
```

```
Email: mike@example.com
Password: Password123!
```

```
Email: emma@example.com
Password: Password123!
```

All accounts belong to shared households for testing household features.

## Database

### Two Deployment Modes

The app supports two database modes:

#### Local SQLite Mode (Default - Offline)
- Data stored in `server/data/mealsync.db`
- No internet connection required
- Perfect for single-user or testing
- Configured with `DATABASE_MODE=sqlite`

#### Remote Server Mode (Live Database)
- Connects to a hosted database (Supabase, PostgreSQL, etc.)
- Requires `DATABASE_URL` environment variable
- Enables team collaboration and scaling
- Configured with `DATABASE_MODE=remote` and `DATABASE_URL=your_connection_string`

### Local SQLite Data Storage

When using SQLite locally, data is stored in:

- **`server/data/mealsync.db`**: Main SQLite database (runtime data)
- **`server/data/mealsync.db-shm`**: Shared memory file for WAL mode
- **`server/data/mealsync.db-wal`**: Write-ahead log for reliability
- **`server/data/db.json`**: Fallback JSON snapshot
- **`server/seed.js`**: Default seed data and schema

### How Database Initialization Works

**SQLite Mode:**
1. App checks for `mealsync.db`
2. If missing, checks for `db.json` and migrates from it
3. If neither exists, creates a fresh database from `seed.js`

**Remote Mode:**
1. Connects to database specified in `DATABASE_URL`
2. Initializes schema if needed
3. Uses existing data if present

### Reset Local SQLite Database

To reset the app to the original demo data (SQLite mode only):

#### 1. Stop the application

#### 2. Delete local database files

On macOS/Linux:
```bash
rm server/data/mealsync.db
rm server/data/mealsync.db-shm
rm server/data/mealsync.db-wal
```

On Windows:
```powershell
Remove-Item server/data/mealsync.db -ErrorAction SilentlyContinue
Remove-Item server/data/mealsync.db-shm -ErrorAction SilentlyContinue
Remove-Item server/data/mealsync.db-wal -ErrorAction SilentlyContinue
```

#### 3. Restart the application

```bash
npm run dev
```

The app will automatically rebuild the SQLite database from `db.json` or `seed.js`.

## NPM Scripts

```bash
# Start development server (frontend + backend)
npm run dev

# Build frontend assets for production
npm run build

# Preview production build locally
npm run preview

# Start production server
npm start
```

## Architecture

### Frontend (`/src`)

- **Vue 3**: Modern, reactive UI
- **Pinia Stores**: Centralized state management for auth, recipes, pantry, planner, etc.
- **Vue Router**: Client-side routing
- **TypeScript**: Type-safe development
- **Tailwind CSS + Reka UI**: Responsive, accessible components

### Backend (`/server`)

- **Express**: RESTful API
- **Database Support**: 
  - Local SQLite for offline-first development and single-machine deployments
  - Remote database connections (PostgreSQL, Supabase, etc.) for cloud deployments
- **Authentication**: JWT-based auth with email/password
- **Rate Limiting**: Protection against abuse
- **Security**: Helmet headers, CORS, password hashing with bcryptjs

### Key Features

**Authentication**
- Email/password registration and login
- JWT token-based sessions
- Password hashing with bcryptjs

**Household Management**
- Create and manage households
- Invite users to join
- Default demo households included

**Recipe Management**
- Create, read, update, delete recipes
- Import recipes from external sources
- Nutrition information per recipe

**Meal Planning**
- Plan meals across customizable periods (breakfast, lunch, dinner, etc.)
- Multiple meal slots per period
- Weekly view

**Shopping Lists**
- Generate from meal plans
- Track purchased items
- Collaborative management

**Pantry**
- Track household inventory
- Add/remove/update items
- Use in meal planning

## Troubleshooting

### Port 3000 is already in use

If port 3000 is in use by another process:

**macOS/Linux:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Then restart
npm run dev
```

**Windows (PowerShell):**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with the process ID)
taskkill /PID <PID> /F
```

### Database appears corrupted or has old data

Reset the database to the original demo state:

```bash
# Stop the app (Ctrl+C)

# Remove database files
rm server/data/mealsync.db server/data/mealsync.db-shm server/data/mealsync.db-wal

# Restart
npm run dev
```

### Dependencies not installing correctly

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Start again
npm run dev
```

### App won't start or shows errors

1. Ensure Node.js 18+ is installed: `node --version`
2. Check all dependencies installed: `npm list`
3. Try a clean install as shown above
4. Check port 3000 is available
5. Look at server logs in the terminal for specific error messages

### Styles not loading correctly

Clear your browser cache or do a hard refresh:
- **Chrome/Firefox**: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
- **Safari**: `Cmd+Option+E` then `Cmd+R`

### API requests failing

1. Ensure both frontend and backend are running (`npm run dev`)
2. Check browser console (F12) for CORS errors
3. Verify `APP_URL` in `.env.local` matches your setup
4. Check Network tab in browser dev tools to see actual requests

## Development

### Code Structure

- **Frontend**: Vue 3 SFC (Single File Components) in TypeScript
- **Backend**: Express routes with modular organization
- **Database**: SQLite with better-sqlite3
- **Styling**: Tailwind CSS 4 with PostCSS

### Running in Development Mode

```bash
npm run dev
```

This runs both the backend server and Vite dev server with hot module replacement (HMR).

### Building for Production

```bash
npm run build
```

Creates optimized frontend bundle in `/dist`.

### Production Deployment

```bash
npm run preview
# or
npm start
```

Both start the server in production mode, serving built static assets and the API.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is part of the CSCI 441 Final Project for Spring 2026.

## Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review existing issues on GitHub
3. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (Node version, OS, etc.)
   - Which database mode you're using (SQLite or remote)

## Summary

MealSync is a flexible, full-stack meal planning application that works both offline and cloud-connected:

**Local Mode:**
- Run entirely offline with SQLite
- Perfect for personal use or testing
- Zero external dependencies required
- Start with `npm install && npm run dev`

**Live Server Mode:**
- Connect to Supabase, PostgreSQL, or other hosted databases
- Enable team collaboration with shared households
- Scale for production deployment
- Configure with `DATABASE_MODE=remote` and `DATABASE_URL`

Choose the mode that fits your needs:
- **Development/Testing**: Use local SQLite mode (default)
- **Team Collaboration**: Use live server mode with a hosted database
- **Production**: Deploy with a managed database service

To get started, simply run:
```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser!
