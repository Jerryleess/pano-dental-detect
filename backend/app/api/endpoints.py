"""
API 路由 — 圖片上傳與推論端點
"""

from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel
import httpx
import json
import traceback

from app.model.predictor import DentalPredictor
from app.utils.image import read_image_from_bytes
from app.core.config import DEFAULT_PATHOLOGY, OLLAMA_BASE_URL, OLLAMA_MODEL

router = APIRouter(prefix="/api", tags=["prediction"])

# 模型實例會在 main.py lifespan 中設定
predictor: DentalPredictor | None = None

# ── Rate Limiter（從 main.py 取得同一實例） ──
limiter = Limiter(key_func=get_remote_address)


def set_predictor(p: DentalPredictor) -> None:
    """由 main.py 啟動時呼叫，將模型實例注入到此路由模組中。"""
    global predictor
    predictor = p


@router.post("/predict")
@limiter.limit("30/minute")
async def predict(
    request: Request,
    file: UploadFile = File(...),
    pathologies: list[str] = Form(default=[DEFAULT_PATHOLOGY]),
):
    """
    接收一張全口 X 光影像並回傳偵測結果。

    - **file**: 圖片檔案 (JPEG / PNG)
    - **pathologies**: 要偵測的病狀名稱列表
    """
    # ── 基本驗證 ──
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="僅接受圖片檔案 (image/*)")

    if predictor is None:
        raise HTTPException(status_code=503, detail="模型尚未載入，請稍後再試")

    # ── 讀取圖片 ──
    contents = await file.read()
    image = read_image_from_bytes(contents)
    h, w = image.shape[:2]

    # ── 執行推論 ──
    try:
        predictions = predictor.predict(image, pathologies=pathologies)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "status": "success",
        "data": {
            "filename": file.filename,
            "image_size": [w, h],
            "pathologies": pathologies,
            "predictions": predictions,
        },
    }


@router.get("/pathologies")
async def list_pathologies():
    """回傳所有可用的病狀偵測類型及其載入狀態。"""
    if predictor is None:
        raise HTTPException(status_code=503, detail="模型尚未載入，請稍後再試")

    return {
        "status": "success",
        "data": predictor.get_available_pathologies(),
    }


@router.get("/health")
async def health():
    """健康檢查端點"""
    return {
        "status": "ok",
        "model_loaded": predictor is not None,
    }


class ReportRequest(BaseModel):
    predictions: list[dict]
    pathologies: list[str]

@router.post("/report")
async def generate_report(request: ReportRequest):
    """根據預測結果向 Ollama 請求生成報告"""
    predictions = request.predictions
    pathologies = request.pathologies
    
    if not predictions:
        prompt = f"根據全口 X 光影像分析結果，未偵測到以下異常病狀：{', '.join(pathologies)}。請撰寫一份專業的牙科健康報告，建議保持良好的口腔衛生習慣並定期檢查。\n\n請使用 Markdown 格式回覆，包含適當的標題（##）、條列式清單、粗體重點等格式，使報告結構清晰易讀。"
    else:
        findings = []
        for p in predictions:
            # 取出預測結果，若有定義 pathology 優先顯示，否則顯示 class_name
            name = p.get("pathology") or p.get("class_name", "未知病狀")
            conf = p.get("confidence", 0)
            findings.append(f"- {name} (信心度: {conf:.2f})")
        
        findings_str = "\n".join(findings)
        prompt = f"根據全口 X 光影像分析結果，偵測到以下病狀：\n{findings_str}\n\n請根據以上結果撰寫一份專業的牙科診斷報告（使用繁體中文），解釋這些病狀可能帶來的影響，並提供適當的治療建議。\n\n請使用 Markdown 格式回覆，包含適當的標題（##）、條列式清單、粗體重點等格式，使報告結構清晰易讀。"

    async def _stream_report():
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": True
                    },
                    timeout=300.0
                ) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_lines():
                        if not chunk:
                            continue
                        try:
                            data = json.loads(chunk)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            pass
        except Exception as e:
            traceback.print_exc()
            yield f"\n[報告生成失敗: {str(e)}]"

    return StreamingResponse(_stream_report(), media_type="text/plain")

