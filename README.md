# Investment Planner

A compound interest projection tool. Enter a starting amount, a monthly
contribution, an expected return and an age range, and it charts how the
balance grows, splitting out how much of the total is your own contributions
versus market growth.

Live at [eamoncobb.com/investmentplanner](https://eamoncobb.com/investmentplanner).

## How it works

A React frontend talks to a FastAPI backend that runs the month by month
compounding and returns a year by year breakdown.

The chart is hand written SVG rather than a charting library, which keeps the
bundle small and makes the scrubbing behaviour easy to control. It scales
through a `viewBox` instead of measuring pixels, so it stays correct at any
screen size, and pointer events cover mouse and touch with the same code path.

Numbers only recalculate when you press Apply, so dragging a slider does not
fire a request per frame. Each request cancels the previous one and carries a
sequence number, so a slow earlier response cannot overwrite a newer one.

## Layout

```
backend/main.py          FastAPI app: validation and the projection endpoint
frontend/src/App.jsx     Page composition and the draft vs applied state
frontend/src/components  Chart (SVG) and Field (numeric input + slider)
frontend/src/lib         API client, formatting, and the two hooks
```

## Running it locally

The backend needs Python 3.12 or newer:

```bash
uv sync --extra dev
uv run uvicorn main:app --port 8000 --app-dir backend
```

The frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. The frontend points at
`http://localhost:8000` in development and at a relative path in production,
so no configuration is needed either way. Set `VITE_API_URL` to override it.

## Deployment

Vercel builds the frontend and serves the FastAPI app as a single function,
with the built frontend mounted underneath the API routes. `pyproject.toml`
points Vercel at the app, since it lives in `backend/` rather than one of the
locations Vercel checks by default.

The API restricts CORS to the origins in `ALLOWED_ORIGINS`, defaulting to the
local dev server.
