# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
QuantStudio Backend — FastAPI Application

Backend For Frontend (BFF) that integrates QuantStudio web IDE
with QuantSDK for circuit execution, per Phase1_Implementation.md Section 4.3.

API Routes:
    /api/run       — Submit circuit for execution
    /api/backends  — List available backends
    /api/circuits  — CRUD operations on saved circuits
    /api/results   — Fetch job results
    /health        — Health check

For v0.1, all circuit execution runs on the local CPU simulator.
Hardware backends (IBM, IonQ) and persistent storage (PostgreSQL, S3)
will be connected in Sprint 3.
"""

from __future__ import annotations

import logging

import quantsdk as qs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import backends, circuits, results, run

# ─── Logging ───

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("quantstudio")

# ─── FastAPI App ───

app = FastAPI(
    title="QuantStudio API",
    description=(
        "Backend API for QuantStudio — the quantum circuit web IDE "
        "by TheQuantCloud. Executes circuits via QuantSDK."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ───
# Allow the Next.js frontend (dev: localhost:3000, prod: studio.thequantcloud.com)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://studio.thequantcloud.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───

app.include_router(run.router)
app.include_router(backends.router)
app.include_router(circuits.router)
app.include_router(results.router)


# ─── Health Check ───


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    from backend.routers.backends import AVAILABLE_BACKENDS

    return {
        "status": "ok",
        "version": "0.1.0",
        "quantsdk_version": qs.__version__,
        "backends_available": len(AVAILABLE_BACKENDS),
    }


# ─── Startup / Shutdown Events ───


@app.on_event("startup")
async def startup() -> None:
    logger.info(
        "QuantStudio API v0.1.0 starting — QuantSDK v%s",
        qs.__version__,
    )
    # Warm up the local simulator
    c = qs.Circuit(1)
    c.h(0)
    c.measure_all()
    qs.run(c, shots=1)
    logger.info("Local simulator warmed up")


@app.on_event("shutdown")
async def shutdown() -> None:
    logger.info("QuantStudio API shutting down")
