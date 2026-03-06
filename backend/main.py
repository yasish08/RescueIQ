"""
RescueIQ — FastAPI Backend Entry Point
"""
import os
import socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

load_dotenv()

from routers import predict, donations, ngos, nlp, impact, map as map_router, geocode, auth, profile, reviews
from ml.predictor import get_model  # warm up model at startup
from models import init_db
from services.scheduler import start_scheduler, stop_scheduler

app = FastAPI(
    title="RescueIQ API",
    description="AI-Driven Food Surplus Prediction & Smart Redistribution Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

cors_env = os.getenv("CORS_ORIGINS", "").strip()
default_origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.209.109.148",
    "http://10.209.109.148:5173",
    "http://10.209.109.148:3000",
]

if cors_env and cors_env != "*":
    allow_origins = [item.strip() for item in cors_env.split(",") if item.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # If '*' or empty, be fully permissive for development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,  # Must be False when origin is '*'
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register routers
app.include_router(auth.router)
app.include_router(predict.router)
app.include_router(donations.router)
app.include_router(ngos.router)
app.include_router(nlp.router)
app.include_router(impact.router)
app.include_router(map_router.router)
app.include_router(geocode.router)
app.include_router(profile.router)
app.include_router(reviews.router)


def _get_lan_ip() -> str:
    host_ip = os.getenv("HOST_IP", "").strip()
    if host_ip:
        return host_ip

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


@app.on_event("startup")
async def startup_event():
    lan_ip = _get_lan_ip()
    # Initialise PostgreSQL tables (Supabase)
    try:
        init_db()
        print("[RescueIQ] ✓ PostgreSQL tables initialised")
    except Exception as e:
        print(f"[RescueIQ] ⚠ DB init skipped ({e}). Backend may run in degraded mode.")
    print("[RescueIQ] Warming up XGBoost model...")
    get_model()
    start_scheduler()
    print("[RescueIQ] ✓ Backend ready at http://0.0.0.0:8000")
    print(f"[RescueIQ] ✓ Accessible on LAN at http://{lan_ip}:8000")
    print(f"[RescueIQ] ✓ API docs at http://{lan_ip}:8000/docs")


@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "RescueIQ API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "true").lower() == "true",
    )
