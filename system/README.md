# ImaginAItion

A multiplayer web game for studying how people prompt text-to-image models.
Players are shown a reference image, write a prompt to recreate it with an AI
image generator, and vote on each other's results across several themed rounds.

Built as a research platform: gameplay events (prompts, votes, generated images)
can be logged for later analysis.

## Stack

- **Backend:** FastAPI + Socket.IO (Python)
- **Frontend:** React + Vite + Tailwind CSS
- **Image generation:** OpenAI API — **each room provides its own API key at runtime**
  (no key is bundled with the project)

## Quick Start (Local Dev)

```bash
cp .env.example .env   # then set BACKEND_HOST to your machine's LAN IP
```

| Task | Command |
| --- | --- |
| Frontend | `cd frontend && npm install && npm run dev -- --host` |
| Backend  | `cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python main.py` |

You may need to do `conda deactivate` before the backend command if you run
into `ModuleNotFoundError`.

Both commands read the single `.env` at the repo root (`system/.env`) for
`BACKEND_HOST`/`BACKEND_PORT`, so the backend's port only needs to be set in
one place — there's no separate `--port` flag to remember, and the frontend
automatically proxies to wherever the backend actually starts. Players on the
same WiFi (e.g. testing on a phone) can then reach the frontend at
`http://<BACKEND_HOST>:5173`.

## Configuration

Environment variables (see `.env.example`):

- `BACKEND_HOST` / `BACKEND_PORT` — where the backend binds to; also used to
  build `VITE_API_URL` so the frontend always points at the same place
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credentials for the admin log-export
  dashboard. Set these to strong values before any public deployment.

By default each player supplies their own key in the UI; if you'd rather host the game with a single server-side key, you should adapt the system.  

## Admin / Data Export

An admin dashboard (`/admin`) allows exporting collected game logs for analysis.
Access is gated by the `ADMIN_USERNAME` / `ADMIN_PASSWORD` environment variables.

## 👥 Contributors

- **Megan Chai** — Designer ([LinkedIn](https://www.linkedin.com/in/megan-chai/))
- **Yike Tan (LikeGiver)** — Developer ([GitHub](https://github.com/LikeGiver))
- **Jihun Choi (cjh1212)** — Developer ([GitHub](https://github.com/cjh1212))
