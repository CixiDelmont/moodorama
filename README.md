# Moodorama 🌍

A live **heatmap of the world's moods**, inspired by the five core emotions from
*Inside Out*: **Joy, Sadness, Fear, Disgust, and Anger**.

Anyone can drop their current mood onto the map. Each mood is pinned to the user's
location, stays active for **12 hours**, and is rendered as part of a hexagonal
heatmap. Each hexagon shows the **most-represented mood** in its area. Hexagons keep
a constant on-screen size — zooming in or out simply changes how much land (and how
many moods) each hexagon aggregates, powered by [Uber's H3](https://h3geo.org/) grid.

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Frontend | React + TypeScript + Vite, [deck.gl](https://deck.gl) + H3, MapLibre |
| Backend  | Plain PHP 8 REST API (PDO), no framework                             |
| Database | MySQL 5.7+ / 8.0                                                      |

> Note: the original brief mentioned Prisma. Prisma is a Node.js/TypeScript ORM and
> can't run inside PHP, so per the chosen approach the backend is **pure PHP + PDO**
> and Prisma is not used.

## How it works

1. On first visit the browser generates an anonymous `userId` (a UUID stored in
   `localStorage`). No login required.
2. The user picks one of the five moods. The browser asks for the user's location and
   sends `{ userId, mood, latitude, longitude }` to the API.
3. The API **upserts** one row per user (`UNIQUE(user_id)`) and sets `expires_at` to
   `now + 12h`. Re-selecting a mood updates that same row and resets the 12h window.
4. The map fetches every **active** mood (`expires_at > NOW()`), bins the points into
   H3 cells at a resolution chosen from the current zoom, and colours each hexagon by
   the dominant mood. A flat **Map** view and a 3D **Globe** view are both available.

## Project layout

```
MoodFront/
├── backend/                 # PHP REST API
│   ├── public/
│   │   ├── router.php       # API router (entrypoint for php -S)
│   │   └── .htaccess        # Apache rewrite (not needed for php -S)
│   ├── src/                 # Config, Database, MoodRepository, Http, autoloader
│   ├── scripts/
│   │   ├── init_db.php      # create database + table
│   │   └── seed.php         # insert random demo moods
│   ├── sql/schema.sql       # reference schema
│   ├── config.example.php   # copy to config.php and edit
│   └── config.php           # local config (git-ignored)
└── frontend/                # React + deck.gl app
    └── src/
        ├── components/      # MoodPicker, MoodMap (map view), Legend
        ├── lib/             # h3 binning + zoom→resolution, geolocation
        ├── api.ts, user.ts, moods.ts, types.ts
        └── App.tsx
```

## Getting started

### Prerequisites

- PHP 8.1+ with `pdo_mysql` (check with `php -m`)
- MySQL server running
- Node.js 18+

### 1. Backend

```bash
cd backend
cp config.example.php config.php   # then edit DB credentials in config.php
php scripts/init_db.php             # or: php scripts/init_db2.php
php scripts/seed_moods.php 800      # optional: random demo moods so the map isn't empty

# Start the API (uses router.php — index.php may be blocked by some antivirus tools)
.\start.ps1
# or manually:
# php -S localhost:8000 -t public public/router.php
```

The API is now at `http://localhost:8000/api`.

You can also configure DB credentials via environment variables
(`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`) which override `config.php`.

### 2. Frontend

```bash
cd frontend
npm install
# optional: cp .env.example .env   (defaults to http://localhost:8000/api)
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Allow location access, pick a
mood, and explore the map.

## API reference

| Method | Path                    | Body / Query                                    | Returns                                  |
| ------ | ----------------------- | ----------------------------------------------- | ---------------------------------------- |
| GET    | `/api/health`           | —                                               | `{ "ok": true }`                         |
| GET    | `/api/moods`            | —                                               | array of active moods (mood, lat, lng…)  |
| GET    | `/api/moods/me`         | `?userId=…`                                     | the user's current mood, or `null`       |
| POST   | `/api/moods`            | `{ userId, mood, latitude, longitude }`         | the saved mood record                    |

`mood` must be one of `joy`, `fear`, `sadness`, `disgust`, `anger`.

## Notes & possible extensions

- Aggregation into hexagons happens client-side. For very large datasets you could
  move binning into MySQL or precompute H3 cells server-side.
- Expired moods stay in the table but are filtered out by `expires_at > NOW()`. Add a
  cron job to prune old rows if desired.
- CORS origins are configured in `config.php` (`cors_allowed_origins`).
