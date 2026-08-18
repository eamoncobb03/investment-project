import os
from pathlib import Path

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


# 7. Serve the built frontend for everything the routes above don't claim.
#    Registered last: FastAPI matches routes in registration order, so
#    /calculate and /health above always take priority over this mount,
#    regardless of what path a request comes in on.
#
#    Only mounted when the build actually exists. Locally that's the Vite
#    dev server's job (npm run dev on :5173), not this API — frontend/dist
#    is a production build artifact this file otherwise has no reason to
#    expect, and StaticFiles raises at import time if the directory is
#    missing, which would break `uvicorn main:app` for local development.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
