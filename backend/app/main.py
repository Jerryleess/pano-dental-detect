"""
FastAPI 應用程式入口點

啟動指令：
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import ALLOWED_ORIGINS
from app.model.predictor import DentalPredictor
from app.api.endpoints import router as api_router, set_predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s")
logger = logging.getLogger(__name__)

# ── Rate Limiter ──
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期：啟動時載入模型，關閉時釋放資源。"""
    logger.info("🚀 正在啟動 Pano-Dental-Detect 後端…")
    predictor = DentalPredictor()
    set_predictor(predictor)
    logger.info("✅ 後端就緒！")
    yield
    logger.info("👋 後端關閉中…")


app = FastAPI(
    title="Pano Dental Detect API",
    description="全口牙齒 X 光影像 AI 偵測系統後端",
    version="0.1.0",
    lifespan=lifespan,
)

# ── 將 limiter 掛載到 app 上 ──
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS Middleware ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 掛載路由 ──
app.include_router(api_router)
