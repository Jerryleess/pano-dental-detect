"""
模型推論模組
封裝 YOLO 模型的載入與預測邏輯。
支援多病狀模型：每個病狀可擁有獨立的 YOLO 權重檔。

使用方式：
    predictor = DentalPredictor()                      # 伺服器啟動時載入
    results   = predictor.predict(image, "retain")     # 每次 API 呼叫（指定病狀）
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from app.core.config import (
    MODEL_WEIGHTS_DIR,
    MODEL_CONFIDENCE_THRESHOLD,
    DEFAULT_PATHOLOGY,
    PATHOLOGY_CONFIGS,
)

logger = logging.getLogger(__name__)


class DentalPredictor:
    """全口牙齒 X 光影像偵測器（多病狀架構）"""

    def __init__(self) -> None:
        # 儲存已載入的模型 {pathology_name: YOLO_model}
        self._models: dict[str, object] = {}
        self._load_all_models()

    # ── 內部方法 ──────────────────────────────────────────

    def _load_all_models(self) -> None:
        """根據 PATHOLOGY_CONFIGS 載入所有已設定的病狀模型。"""
        for name, cfg in PATHOLOGY_CONFIGS.items():
            weights_path = MODEL_WEIGHTS_DIR / cfg["weights"]
            self._load_model(name, weights_path)

    def _load_model(self, pathology: str, weights_path: Path) -> None:
        """載入指定病狀的 YOLO 模型權重。"""
        if not weights_path.exists():
            logger.warning(
                "⚠️  [%s] 找不到模型權重: %s — 該病狀將以 DEMO 模式運行",
                pathology,
                weights_path,
            )
            self._models[pathology] = None
            return

        try:
            from ultralytics import YOLO

            model = YOLO(str(weights_path))
            self._models[pathology] = model
            logger.info("✅ [%s] 模型已載入: %s", pathology, weights_path)
        except Exception as exc:
            logger.error("❌ [%s] 模型載入失敗: %s", pathology, exc)
            self._models[pathology] = None

    # ── 公開方法 ──────────────────────────────────────────

    def get_available_pathologies(self) -> list[dict]:
        """回傳所有已設定的病狀及其載入狀態。"""
        result = []
        for name, cfg in PATHOLOGY_CONFIGS.items():
            result.append(
                {
                    "name": name,
                    "label": cfg["label"],
                    "color": cfg.get("color", "#FFFFFF"),
                    "loaded": self._models.get(name) is not None,
                }
            )
        return result

    def predict(self, image: np.ndarray, pathologies: list[str] | None = None) -> list[dict]:
        """
        對輸入影像執行物件偵測。

        Args:
            image: NumPy 陣列 (RGB)
            pathologies: 要偵測的病狀名稱列表，不指定則使用預設值

        回傳格式：
        [
            {
                "class_name": "Retain",
                "confidence": 0.93,
                "bbox": [x_min, y_min, x_max, y_max]
            },
            ...
        ]
        """
        if not pathologies:
            pathologies = [DEFAULT_PATHOLOGY]

        predictions: list[dict] = []
        for pathology in pathologies:
            if pathology not in self._models:
                raise ValueError(f"不支援的病狀類型: {pathology}")

            model = self._models[pathology]
            if model is None:
                predictions.extend(self._demo_predict(image, pathology))
                continue

            results = model.predict(
                source=image,
                conf=MODEL_CONFIDENCE_THRESHOLD,
                verbose=False,
            )

            for result in results:
                for box in result.boxes:
                    # 使用設定的標籤名稱，避免畫面顯示出這包 YOLO 權重內部原本的標籤名稱
                    display_name = PATHOLOGY_CONFIGS.get(pathology, {}).get("label", result.names[int(box.cls[0])])
                    predictions.append(
                        {
                            "class_name": display_name,
                            "pathology": pathology,
                            "confidence": round(float(box.conf[0]), 4),
                            "bbox": [round(float(c), 1) for c in box.xyxy[0].tolist()],
                        }
                    )
                    
        return predictions

    # ── Demo 模式（模擬資料） ─────────────────────────────

    @staticmethod
    def _demo_predict(image: np.ndarray, pathology: str) -> list[dict]:
        """尚無真實模型時，回傳一組模擬的偵測結果供前端開發使用。"""
        h, w = image.shape[:2]
        return [
            {
                "class_name": PATHOLOGY_CONFIGS.get(pathology, {}).get("label", pathology),
                "pathology": pathology,
                "confidence": 0.92,
                "bbox": [int(w * 0.15), int(h * 0.30), int(w * 0.25), int(h * 0.50)],
            },
            {
                "class_name": PATHOLOGY_CONFIGS.get(pathology, {}).get("label", pathology),
                "pathology": pathology,
                "confidence": 0.87,
                "bbox": [int(w * 0.55), int(h * 0.35), int(w * 0.65), int(h * 0.55)],
            },
        ]
