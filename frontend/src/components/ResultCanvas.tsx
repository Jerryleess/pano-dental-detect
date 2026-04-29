import { useRef, useEffect } from "react";
import { PredictionResult } from "../services/api";

// Color mapping is now dynamic based on pathology config

interface ResultCanvasProps {
  imageSrc: string | null;
  predictions: PredictionResult[] | null;
  pathologies: { name: string; color: string }[];
  imageSize?: [number, number];
  hiddenIndices?: Set<number>;
}

/**
 * ResultCanvas — 在原始 X 光片上繪製偵測結果 Bounding Box
 * 支援透過 hiddenIndices 控制個別框線的顯示/隱藏
 */
export default function ResultCanvas({
  imageSrc,
  predictions,
  pathologies,
  imageSize,
  hiddenIndices,
}: ResultCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!imageSrc) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();

    img.onload = () => {
      // 讓 canvas 尺寸與圖片一致
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      if (!predictions || predictions.length === 0) return;

      // 計算縮放比（如果後端回傳的尺寸與圖片不同）
      const scaleX = img.naturalWidth / (imageSize?.[0] || img.naturalWidth);
      const scaleY = img.naturalHeight / (imageSize?.[1] || img.naturalHeight);

      predictions.forEach(
        ({ class_name, pathology, confidence, bbox }, idx) => {
          // 如果該索引被隱藏，就跳過
          if (hiddenIndices?.has(idx)) return;

          const [x1, y1, x2, y2] = bbox;
          const sx = x1 * scaleX;
          const sy = y1 * scaleY;
          const sw = (x2 - x1) * scaleX;
          const sh = (y2 - y1) * scaleY;

          // Find matching pathology config's color or fallback
          const pInfo = pathologies.find((p) => p.name === pathology);
          const color = pInfo?.color || "#ab47bc";

          // 繪製半透明填充
          ctx.fillStyle = color + "22";
          ctx.fillRect(sx, sy, sw, sh);

          // 繪製邊框
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(sx, sy, sw, sh);

          // 標籤背景
          const label = `${class_name}  ${(confidence * 100).toFixed(1)}%`;
          ctx.font = "bold 14px Inter, sans-serif";
          const textW = ctx.measureText(label).width + 12;
          ctx.fillStyle = color;
          ctx.fillRect(sx, sy - 24, textW, 24);

          // 標籤文字
          ctx.fillStyle = "#fff";
          ctx.fillText(label, sx + 6, sy - 7);
        },
      );
    };

    img.src = imageSrc;
  }, [imageSrc, predictions, pathologies, imageSize, hiddenIndices]);

  return (
    <div className="result-canvas-wrapper">
      <canvas ref={canvasRef} className="result-canvas" />
    </div>
  );
}
