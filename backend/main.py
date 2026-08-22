import hashlib
import math
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# 1. Initialize the FastAPI app
app = FastAPI(title="Investment Planner API")

# 2. Only allow the browsers we actually serve to call this API.
#    A wildcard origin combined with credentials makes Starlette echo back
#    whatever Origin the caller sends, which lets any site on the internet
#    call this endpoint. Nothing here uses cookies or auth headers, so
#    credentials stay off and only the two methods in use are permitted.
#    Set ALLOWED_ORIGINS in the deployment environment, comma separated.
_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS = [origin.strip() for origin in _origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# 3. Define and validate expected user inputs.
#
#    Every money field needs an upper bound as well as a lower one. Without
#    one, "infinity" passes a `ge=0` check (inf >= 0 is True) and a merely
#    huge value overflows to infinity as it compounds. Either way the result
#    is a float JSON cannot represent, and the response crashes with a 500.
#    allow_inf_nan=False rejects inf/nan outright with a clean 422 instead.
#
#    The caps are far above anything a personal planner needs, but low
#    enough that 100 years at 100% cannot overflow a float.
MAX_INITIAL = 1_000_000_000
MAX_MONTHLY = 10_000_000


class InvestmentQuery(BaseModel):
    initial_amount: float = Field(
        ge=0, le=MAX_INITIAL, allow_inf_nan=False, description="Starting cash deposit"
    )
    monthly_contribution: float = Field(
        ge=0, le=MAX_MONTHLY, allow_inf_nan=False, description="Monthly recurring investment"
    )
    annual_rate: float = Field(
        ge=0, le=100, allow_inf_nan=False, description="Annual return rate in percent"
    )
    years: int = Field(gt=0, le=100, description="Total investment timeline in years")


# 4. Report validation failures without echoing the offending value back.
#    The default handler includes the raw input in the response body. JSON
#    permits 1e999, which Python parses to infinity, and infinity cannot be
#    serialized back out, so the error response itself would fail to render
#    and turn a clean 422 into a 500. Field name and message are enough.
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "field": ".".join(str(part) for part in error["loc"][1:]),
                    "message": error["msg"],
                }
                for error in exc.errors()
            ]
        },
    )


# 5. Simple health check route to confirm the server is running.
#    Deliberately not at "/" — the deployed app owns "/" itself, serving
#    the built frontend (see the mount below), so this needs its own path.
@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Investment API is alive"}


# 6. The calculation route that accepts input and returns growth projections
@app.post("/calculate")
def calculate_growth(data: InvestmentQuery):
    balance = data.initial_amount
    total_contributed = data.initial_amount
    monthly_rate = (data.annual_rate / 100) / 12
    total_months = data.years * 12

    # Round once, then derive interest from the rounded pair, so the three
    # numbers in a row always add up. Rounding each independently could
    # leave interest a cent off from balance minus contributions.
    def row(year, balance, contributed):
        balance = round(balance, 2)
        contributed = round(contributed, 2)
        return {
            "year": year,
            "balance": balance,
            "total_contributed": contributed,
            "interest_earned": round(balance - contributed, 2),
        }

    # Initialize the timeline list starting at Year 0
    breakdown = [row(0, balance, total_contributed)]

    # Loop through every month, apply interest, and record values each full year
    for month in range(1, total_months + 1):
        balance = (balance + data.monthly_contribution) * (1 + monthly_rate)
        total_contributed += data.monthly_contribution

        if month % 12 == 0:
            breakdown.append(row(month // 12, balance, total_contributed))

    # Return final results and the yearly breakdown as JSON
    final = breakdown[-1]
    return {
        "final_balance": final["balance"],
        "total_contributed": final["total_contributed"],
        "total_interest": final["interest_earned"],
        "yearly_breakdown": breakdown,
    }


# 7. The Monte Carlo route.
#
#    /calculate above answers "what if the return is exactly this every single
#    year", which never happens. This answers the question people actually
#    have: given that returns vary, what is the spread of outcomes, and how
#    likely is the one I care about?
#
#    Each month's growth is a multiplicative factor exp(drift + shock) with a
#    normally distributed shock, i.e. geometric Brownian motion. Two reasons
#    that beats perturbing the rate additively: a multiplicative factor can
#    never drive the balance below zero, and log-normal terminal values are
#    the standard model for a diversified portfolio.
#
#    drift is pinned to log1p(monthly_rate) - sigma^2*dt/2 rather than the
#    textbook (mu - sigma^2/2)*dt so that the two endpoints agree. It makes the
#    expected monthly growth factor exactly 1 + monthly_rate, so this
#    simulation's mean matches what /calculate returns for the same
#    annual_rate, and the two agree to the cent when volatility is zero and
#    there is nothing left to average over.
#
#    That match is in expectation, not per run. The sample mean of a
#    right-skewed distribution is carried by its rare best paths, so the
#    realised mean wanders further from the deterministic figure as volatility
#    climbs — a fraction of a percent at 15%, but tens of percent at 60%, where
#    ten thousand draws are no longer enough to pin a mean that a handful of
#    outcomes dominate. The median is the stable statistic here, which is why
#    it, not the mean, is what the UI leads with.
#
#    The gap between the two is the point of the whole mode: a right-skewed
#    distribution has its mean above its middle, so the single-rate projection
#    is a luckier outcome than the typical one, and increasingly so the more
#    volatile the portfolio.
N_PATHS = 10_000
N_SAMPLE_PATHS = 12
N_BINS = 36
BAND_PERCENTILES = (5, 25, 50, 75, 95)


class SimulationQuery(BaseModel):
    initial_amount: float = Field(ge=0, le=MAX_INITIAL, allow_inf_nan=False)
    monthly_contribution: float = Field(ge=0, le=MAX_MONTHLY, allow_inf_nan=False)
    annual_rate: float = Field(
        ge=0, le=100, allow_inf_nan=False, description="Expected annual return in percent"
    )
    volatility: float = Field(
        ge=0, le=100, allow_inf_nan=False, description="Annual standard deviation in percent"
    )
    years: int = Field(gt=0, le=100)
    target: float = Field(
        ge=0, le=MAX_INITIAL, allow_inf_nan=False, description="Balance to report odds against"
    )


def _seed(data: SimulationQuery) -> int:
    """
    Same assumptions in, same paths out. Without this, re-applying an unchanged
    form would reshuffle every squiggle on the chart and read as a glitch.

    target is deliberately left out of the hash: it is measured against a
    finished simulation rather than being an input to one, so dragging it
    should slide the threshold line across a fixed picture instead of
    redrawing the picture underneath it.
    """
    raw = "|".join(
        str(value)
        for value in (
            data.initial_amount,
            data.monthly_contribution,
            data.annual_rate,
            data.volatility,
            data.years,
        )
    )
    return int.from_bytes(hashlib.sha256(raw.encode()).digest()[:8], "big")


@app.post("/simulate")
def simulate_growth(data: SimulationQuery):
    rng = np.random.default_rng(_seed(data))

    dt = 1 / 12
    monthly_rate = (data.annual_rate / 100) / 12
    sigma = data.volatility / 100
    drift = math.log1p(monthly_rate) - 0.5 * sigma**2 * dt
    shock_scale = sigma * math.sqrt(dt)
    total_months = data.years * 12

    balances = np.full(N_PATHS, data.initial_amount, dtype=np.float64)
    contributed = data.initial_amount

    # Yearly snapshots only. Every month of every path would be twelve times
    # the memory to carry detail no chart draws, and the shocks are generated
    # a month at a time for the same reason: the full (months, paths) matrix
    # of normals reaches ~100 MB at the input caps, while one month of them
    # is 80 KB.
    snapshots = [balances.copy()]
    contributions = [contributed]

    for month in range(1, total_months + 1):
        shocks = rng.standard_normal(N_PATHS)
        balances = (balances + data.monthly_contribution) * np.exp(
            drift + shock_scale * shocks
        )
        contributed += data.monthly_contribution

        if month % 12 == 0:
            snapshots.append(balances.copy())
            contributions.append(contributed)

    # (years + 1, N_PATHS)
    matrix = np.stack(snapshots)
    final = matrix[-1]

    # (5, years + 1): one row per percentile in BAND_PERCENTILES.
    bands = np.percentile(matrix, BAND_PERCENTILES, axis=1)

    # A plain random sample rather than one spread evenly across the outcome
    # range. These are drawn as individual paths to show that a real future is
    # jagged rather than smooth, and picking one from each percentile bracket
    # would suggest extremes turn up far more often than they do. The bands
    # behind them are what communicate the range.
    sample = rng.choice(N_PATHS, size=min(N_SAMPLE_PATHS, N_PATHS), replace=False)
    paths = matrix[:, sample].T

    # Bins are spaced geometrically, not evenly, because the thing being
    # binned is roughly log-normal: on a linear axis the entire distribution
    # piles into the leftmost few bars while a thin tail stretches the rest of
    # the axis across empty space. Log spacing is the display this shape asks
    # for, and it comes out as a readable near-bell instead.
    #
    # The ends are trimmed to the half-percentiles for the same reason the
    # bins are geometric: one extreme run should not set the scale for all ten
    # thousand. Trimmed values fold into the end bars rather than being
    # dropped, so the counts still total N_PATHS. The floors keep geomspace
    # defined when every path lands on the same number, which happens whenever
    # volatility is zero.
    axis_low = max(float(np.percentile(final, 0.5)), 1.0)
    axis_high = max(float(np.percentile(final, 99.5)), axis_low * 1.001)
    edges = np.geomspace(axis_low, axis_high, N_BINS + 1)
    counts, _ = np.histogram(np.clip(final, axis_low, axis_high), bins=edges)

    def cash(value) -> float:
        return round(float(value), 2)

    return {
        "paths_simulated": N_PATHS,
        "yearly_breakdown": [
            {
                "year": year,
                "total_contributed": cash(contributions[year]),
                "p5": cash(bands[0][year]),
                "p25": cash(bands[1][year]),
                "p50": cash(bands[2][year]),
                "p75": cash(bands[3][year]),
                "p95": cash(bands[4][year]),
            }
            for year in range(len(contributions))
        ],
        "sample_paths": [[cash(value) for value in path] for path in paths],
        "total_contributed": cash(contributed),
        "target": cash(data.target),
        "final": {
            "mean": cash(final.mean()),
            "p5": cash(bands[0][-1]),
            "p25": cash(bands[1][-1]),
            "p50": cash(bands[2][-1]),
            "p75": cash(bands[3][-1]),
            "p95": cash(bands[4][-1]),
        },
        "probability_target": round(float((final >= data.target).mean()) * 100, 1),
        "probability_below_contributed": round(float((final < contributed).mean()) * 100, 1),
        "histogram": {
            "edges": [cash(edge) for edge in edges],
            "counts": [int(count) for count in counts],
        },
    }


# 8. Serve the built frontend for everything the routes above don't claim.
#    Registered last: FastAPI matches routes in registration order, so the
#    routes above always take priority over this mount, regardless of what
#    path a request comes in on.
#
#    Only mounted when the build actually exists. Locally that's the Vite
#    dev server's job (npm run dev on :5173), not this API — frontend/dist
#    is a production build artifact this file otherwise has no reason to
#    expect, and StaticFiles raises at import time if the directory is
#    missing, which would break `uvicorn main:app` for local development.
#    Cache headers are set here rather than left at the default, because the
#    default treats the HTML and the hashed assets the same and both end up
#    revalidated on every load.
#
#    Vite fingerprints every asset filename, so a given /assets/... URL can
#    never change content: those are safe to keep for a year and never ask
#    about again. index.html is the opposite. It is the file that names which
#    asset hashes to fetch, so a stale copy points at filenames a deploy has
#    already replaced, every one of them 404s, and the page renders blank with
#    no script alive to explain why. no-store keeps a browser from ever
#    answering that request from its own cache.
ONE_YEAR = 60 * 60 * 24 * 365


class FrontendFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        path = scope.get("path", "")
        if path.startswith("/assets/"):
            response.headers["Cache-Control"] = f"public, max-age={ONE_YEAR}, immutable"
        else:
            response.headers["Cache-Control"] = "no-store, must-revalidate"
        return response


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", FrontendFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
