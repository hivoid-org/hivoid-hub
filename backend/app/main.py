from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.v1.endpoints import nodes, users, stats, auth, sub, sessions, geoip
from app.core.database import engine, Base

# Create tables matching models (including new columns)
Base.metadata.create_all(bind=engine)

# Enhanced Logging Configuration
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')

# Console Handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# File Handler (hub.log)
file_handler = logging.FileHandler("hub.log")
file_handler.setFormatter(log_formatter)

# Root Logger
logger = logging.getLogger()
logger.setLevel(logging.DEBUG)
logger.addHandler(console_handler)
logger.addHandler(file_handler)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Centralized Subscription & Node Management Hub for HiVoid.",
    version="1.1.0",
)

# Request Logging Middleware
@app.middleware("http")
async def log_requests(request, call_next):
    import time
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"
    
    # Log the incoming request
    logging.info(f"Incoming Request: {request.method} {request.url.path} from {client_ip}")
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logging.info(f"Response: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.2f}ms")
        return response
    except Exception as e:
        logging.error(f"Request Failed: {request.method} {request.url.path} - Error: {str(e)}")
        raise e

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router,  prefix=f"{settings.API_V1_STR}/auth",  tags=["Authentication"])
app.include_router(nodes.router, prefix=f"{settings.API_V1_STR}/node",  tags=["Node Sync"])
app.include_router(nodes.router, prefix=f"{settings.API_V1_STR}/nodes", tags=["Nodes API"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(stats.router, prefix=f"{settings.API_V1_STR}/stats", tags=["Stats"])
app.include_router(sessions.router, prefix=f"{settings.API_V1_STR}/sessions", tags=["Sessions"])
app.include_router(sub.router,   prefix=f"{settings.API_V1_STR}/sub",   tags=["Public Subscription"])
app.include_router(geoip.router, prefix=f"{settings.API_V1_STR}/geoip", tags=["GeoIP"])

@app.on_event("startup")
async def startup_event():
    import asyncio
    from app.services.telegram_bot import bot_poll_loop
    # Run the Telegram bot poller in the background
    asyncio.create_task(bot_poll_loop())

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to HiVoid Subscription Hub API v1.1.0",
        "websocket_endpoint": f"wss://<your-domain>{settings.API_V1_STR}/nodes/ws"
    }
