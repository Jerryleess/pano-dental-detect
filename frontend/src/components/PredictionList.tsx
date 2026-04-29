import { PredictionResult } from "../services/api";

/**
 * PredictionList — 以表格 / 列表形式呈現所有偵測結果
 * 每張卡片有獨立的顯示/隱藏按鈕，並支援全域切換
 */

// Color mapping is now dynamic based on pathology config

interface PredictionListProps {
  predictions: PredictionResult[] | null;
  pathologies: { name: string; color: string }[];
  hiddenIndices: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  allHidden: boolean;
}

export default function PredictionList({
  predictions,
  pathologies,
  hiddenIndices,
  onToggle,
  onToggleAll,
  allHidden,
}: PredictionListProps) {
  if (!predictions || predictions.length === 0) {
    return <p className="no-results">尚無偵測結果</p>;
  }

  return (
    <div className="prediction-list">
      <div className="prediction-list-header">
        <h3>偵測結果 ({predictions.length})</h3>
        <button
          className={`toggle-all-btn ${allHidden ? "all-hidden" : ""}`}
          onClick={onToggleAll}
          title={allHidden ? "全部顯示" : "全部隱藏"}
        >
          <span className="eye-icon">{allHidden ? "🙈" : "👁"}</span>
          {allHidden ? "全部顯示" : "全部隱藏"}
        </button>
      </div>
      <div className="prediction-cards">
        {predictions.map((pred, idx) => {
          const isHidden = hiddenIndices.has(idx);
          const pInfo = pathologies.find((p) => p.name === pred.pathology);
          const itemColor = pInfo?.color || "#ab47bc";

          return (
            <div
              key={idx}
              className={`prediction-card ${isHidden ? "card-hidden" : ""}`}
              style={{ borderLeftColor: itemColor }}
            >
              <div className="prediction-card-header">
                <span
                  className="prediction-dot"
                  style={{ backgroundColor: itemColor }}
                />
                <strong>{pred.class_name}</strong>
                <button
                  className={`toggle-vis-btn ${isHidden ? "is-hidden" : ""}`}
                  onClick={() => onToggle(idx)}
                  title={isHidden ? "顯示此框線" : "隱藏此框線"}
                >
                  {isHidden ? "🙈" : "👁"}
                </button>
              </div>
              <div className="prediction-card-body">
                <span className="confidence-badge">
                  {(pred.confidence * 100).toFixed(1)}%
                </span>
                <span className="bbox-info">
                  ({pred.bbox.map((v) => Math.round(v)).join(", ")})
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
