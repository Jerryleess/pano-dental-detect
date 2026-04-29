"""
圖片前處理與輔助工具
"""

from io import BytesIO
from PIL import Image
import numpy as np


def read_image_from_bytes(data: bytes) -> np.ndarray:
    """將上傳的二進位資料轉成 NumPy 陣列 (RGB)"""
    image = Image.open(BytesIO(data)).convert("RGB")
    return np.array(image)


def clamp_bbox(bbox: list[float], img_w: int, img_h: int) -> list[int]:
    """將 bbox 限制在圖片邊界內，並轉為整數"""
    x_min, y_min, x_max, y_max = bbox
    return [
        max(0, int(x_min)),
        max(0, int(y_min)),
        min(img_w, int(x_max)),
        min(img_h, int(y_max)),
    ]
