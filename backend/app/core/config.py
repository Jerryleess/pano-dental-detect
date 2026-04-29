"""
核心設定模組
管理 CORS、環境變數、模型病狀設定等應用程式層級設定。
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# ── 路徑設定 ──
BASE_DIR = Path(__file__).resolve().parent.parent.parent        # backend/

# 載入 .env 檔案
load_dotenv(BASE_DIR / ".env")

MODEL_WEIGHTS_DIR = BASE_DIR / "app" / "model" / "weights"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ── Ollama 設定 ──
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:9b")

# ── CORS 白名單（開發期間允許前端本地端口） ──
ALLOWED_ORIGINS: list[str] = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

# ── 模型設定 ──
MODEL_CONFIDENCE_THRESHOLD: float = float(os.getenv("MODEL_CONF", "0.25"))

# ── 病狀設定 ──
# 每個病狀對應一個子資料夾下的權重檔案
# 例如: weights/retain/yolov12n.pt
# 未來新增病狀時，只需在此處加入設定並放入對應的權重檔案即可
DEFAULT_PATHOLOGY = "retain"

PATHOLOGY_CONFIGS: dict[str, dict] = {
    "retain": {
        "label": "Retained dental root",
        "weights": "retain/retain.pt",
        "description": "偵測 Retained dental root",
        "color": "#FF4B4B", # Red
    },
    # ── 未來病狀範例（取消註解並放入對應權重即可啟用） ──
    "caries": {
        "label": "蛀牙 (Caries)",
        "weights": "caries/caries.pt",
        "description": "偵測蛀牙 (Caries)" ,
        "color": "#4B7BFF", # Blue
    },
    "periapical": {
        "label": "根尖病變 (Periapical Lesion)",
        "weights": "periapical/periapical.pt",
        "description": "偵測根尖病變 (Periapical Lesion)",
        "color": "#2E7D32", # Darker Green
    },
    "impact": {
        "label": "阻生牙 (Impaction)",
        "weights": "impact/impact.pt",
        "description": "偵測阻生牙 (Impaction)",
        "color": "#FFB84B", # Orange
    },
}
