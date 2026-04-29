import { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import html2pdf from "html2pdf.js";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ImageUploader from "../components/ImageUploader";
import ResultCanvas from "../components/ResultCanvas";
import PredictionList from "../components/PredictionList";
import {
  predictImage,
  getPathologies,
  generateReport,
  PredictionResult,
  PathologyInfo,
} from "../services/api";

/**
 * Dashboard — 主頁面
 * 包含上傳區域 + 結果視覺化 + 偵測列表
 * 支援 Pan/Zoom 以及 Bbox 的顯示/隱藏切換
 */
export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionResult[] | null>(
    null,
  );
  const [imageSize, setImageSize] = useState<[number, number] | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 信心度門檻
  const [minConfidence, setMinConfidence] = useState<number>(0.25);

  // 報告狀態
  const [report, setReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // 病狀選擇
  const [pathologies, setPathologies] = useState<PathologyInfo[]>([]);
  const [selectedPathologies, setSelectedPathologies] = useState<string[]>([]);

  // 框線顯示/隱藏（以 prediction index 為粒度）
  const [hiddenIndices, setHiddenIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    getPathologies()
      .then((data) => {
        setPathologies(data);
        if (data.length > 0) {
          setSelectedPathologies(
            data.filter((p) => p.loaded).map((p) => p.name),
          );
        }
      })
      .catch(() => {
        // 後端可能尚未啟動，忽略錯誤
      });
  }, []);

  const handleFileSelected = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setImageSrc(URL.createObjectURL(selectedFile));
    setPredictions(null);
    setImageSize(undefined);
    setError(null);
    setHiddenIndices(new Set());
  }, []);

  const handleAnalyze = async () => {
    if (!file || selectedPathologies.length === 0) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setReportError(null);
    setIsGeneratingReport(false);
    
    try {
      const res = await predictImage(file, selectedPathologies);
      setPredictions(res.data.predictions);
      setImageSize(res.data.image_size);
      setHiddenIndices(new Set());

      // 觸發初始報告生成 (以目前的 minConfidence 過濾)
      setIsGeneratingReport(true);
      const initialVisible = res.data.predictions.filter(p => p.confidence >= minConfidence);
      generateReport(initialVisible, selectedPathologies, (chunk) => {
        setIsGeneratingReport(false);
        setReport((prev) => (prev ? prev + chunk : chunk));
      })
        .catch((err) => {
          setReportError(err instanceof Error ? err.message : "報告生成失敗");
        })
        .finally(() => {
          setIsGeneratingReport(false);
        });

    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "分析失敗，請稍後再試";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImageSrc(null);
    setPredictions(null);
    setImageSize(undefined);
    setError(null);
    setHiddenIndices(new Set());
    setReport(null);
    setReportError(null);
    setIsGeneratingReport(false);
  };

  const loadExampleImage = async () => {
    setLoading(true);
    setError(null);
    try {
      // 從 public 資料夾讀取範例照片 example.jpg
      const basePath = import.meta.env.BASE_URL || "/";
      const response = await fetch(`${basePath}0092.jpg`);
      if (!response.ok) {
        throw new Error("找不到範例圖片，請確認 frontend/public/ 裡面有 example.jpg");
      }
      const blob = await response.blob();
      const exampleFile = new File([blob], '0092.jpg', { type: blob.type });
      handleFileSelected(exampleFile);
    } catch (err: any) {
      setError(err.message || "載入範例圖片失敗");
    } finally {
      setLoading(false);
    }
  };

  // 根據門檻過濾後的預測結果
  const visiblePredictions = predictions
    ? predictions.filter((p) => p.confidence >= minConfidence)
    : null;

  const handleRegenerateReport = useCallback(() => {
    if (!visiblePredictions || selectedPathologies.length === 0) return;
    setReport(null);
    setReportError(null);
    setIsGeneratingReport(true);
    generateReport(visiblePredictions, selectedPathologies, (chunk) => {
      setIsGeneratingReport(false);
      setReport((prev) => (prev ? prev + chunk : chunk));
    })
      .catch((err) => {
        setReportError(err instanceof Error ? err.message : "報告生成失敗");
      })
      .finally(() => {
        setIsGeneratingReport(false);
      });
  }, [visiblePredictions, selectedPathologies]);

  // ── 框線顯示/隱藏切換 ──
  const handleToggle = useCallback((index: number) => {
    setHiddenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const allHidden =
    visiblePredictions !== null &&
    visiblePredictions.length > 0 &&
    hiddenIndices.size === visiblePredictions.length;

  const handleToggleAll = useCallback(() => {
    if (!visiblePredictions) return;
    if (allHidden) {
      // 全部顯示
      setHiddenIndices(new Set());
    } else {
      // 全部隱藏
      setHiddenIndices(new Set(visiblePredictions.map((_, i) => i)));
    }
  }, [visiblePredictions, allHidden]);

  // ── 報告 PDF 匯出 ──
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = useCallback(() => {
    if (!reportRef.current) return;

    // 建立列印用的容器（白底黑字，適合 PDF）
    const container = document.createElement("div");
    container.style.cssText = `
      padding: 24px 32px;
      font-family: "Inter", "Noto Sans TC", sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      background: #ffffff;
    `;

    // 加入標題
    const title = document.createElement("h1");
    title.textContent = "AI 牙科診斷報告";
    title.style.cssText = "font-size: 20px; margin-bottom: 4px; color: #111;";
    container.appendChild(title);

    const timestamp = document.createElement("p");
    timestamp.textContent = `報告產生時間：${new Date().toLocaleString("zh-TW")}`;
    timestamp.style.cssText = "font-size: 12px; color: #666; margin-bottom: 16px;";
    container.appendChild(timestamp);

    const hr = document.createElement("hr");
    hr.style.cssText = "border: none; border-top: 1px solid #ddd; margin-bottom: 16px;";
    container.appendChild(hr);

    // 複製報告內容
    const content = reportRef.current.cloneNode(true) as HTMLElement;
    content.style.cssText = "color: #1a1a1a;";
    // 將所有子元素重設為深色文字
    content.querySelectorAll("*").forEach((el) => {
      (el as HTMLElement).style.color = "#1a1a1a";
    });
    container.appendChild(content);

    document.body.appendChild(container);

    html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `dental_report_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save()
      .then(() => {
        document.body.removeChild(container);
      });
  }, []);

  return (
    <div className="dashboard">
      {/* ── 左側：上傳與控制 ── */}
      <aside className="dashboard-sidebar">
        <ImageUploader onFileSelected={handleFileSelected} disabled={loading} />

        <button
          className="btn btn-secondary"
          style={{ width: "100%", marginTop: "12px", border: "1px dashed var(--gray-400)" }}
          onClick={loadExampleImage}
          disabled={loading}
        >
          📄 載入範例照片測試
        </button>

        {/* 信心度篩選器 */}
        <div className="confidence-selector">
          <label className="selector-label">
            信心度篩選: {Math.round(minConfidence * 100)}%
          </label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="confidence-slider"
          />
          <div className="confidence-hint">
            自動隱藏低於此信心的偵測結果，報告也會依此重新過濾。
          </div>
        </div>

        {/* 病狀選擇 */}
        {pathologies.length > 0 && (
          <div className="pathology-selector">
            <label className="selector-label">偵測病狀</label>
            <div className="selector-options">
              {pathologies.map((p) => {
                const isActive = selectedPathologies.includes(p.name);
                return (
                  <button
                    key={p.name}
                    className={`selector-chip ${isActive ? "active" : ""} ${!p.loaded ? "unavailable" : ""}`}
                    onClick={() => {
                      if (!p.loaded) return;
                      setSelectedPathologies((prev) =>
                        prev.includes(p.name)
                          ? prev.filter((name) => name !== p.name)
                          : [...prev, p.name],
                      );
                    }}
                    disabled={!p.loaded || loading}
                    title={!p.loaded ? "模型尚未載入" : p.label}
                  >
                    <span className="chip-dot" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="action-buttons">
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={!file || loading || selectedPathologies.length === 0}
          >
            {loading ? (
              <>
                <span className="spinner" />
                分析中…
              </>
            ) : (
              "開始分析"
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={loading}
          >
            清除
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {visiblePredictions && (
          <PredictionList
            predictions={visiblePredictions}
            pathologies={pathologies}
            hiddenIndices={hiddenIndices}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
            allHidden={allHidden}
          />
        )}
      </aside>

      {/* ── 右側：結果視覺化 (支援 Pan & Zoom) ── */}
      <main className="dashboard-main">
        {predictions && imageSrc ? (
          <div className="main-content-wrapper">
            <div className="canvas-container">
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={8}
                centerOnInit
                wheel={{ step: 0.08 }}
                panning={{ velocityDisabled: true }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="zoom-controls">
                      <button onClick={() => zoomIn()} title="放大">
                        ＋
                      </button>
                      <button onClick={() => zoomOut()} title="縮小">
                        －
                      </button>
                      <button onClick={() => resetTransform()} title="重置">
                        ⟲
                      </button>
                    </div>
                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{ width: "100%", height: "100%" }}
                    >
                      <ResultCanvas
                        imageSrc={imageSrc}
                        predictions={visiblePredictions || []}
                        pathologies={pathologies}
                        imageSize={imageSize}
                        hiddenIndices={hiddenIndices}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>

            {/* 報告區塊 */}
            <div className="report-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
                <h3 style={{ margin: 0 }}>AI 診斷報告</h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto", margin: 0 }}
                    onClick={handleRegenerateReport}
                    disabled={isGeneratingReport || !visiblePredictions || visiblePredictions.length === 0}
                  >
                    依篩選重置
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "4px 8px", fontSize: "0.8rem", width: "auto", margin: 0 }}
                    onClick={handleExportPDF}
                    disabled={!report || isGeneratingReport}
                  >
                    📄 匯出 PDF
                  </button>
                </div>
              </div>
              {isGeneratingReport ? (
                <div className="report-loading">
                  <span className="spinner report-spinner" />
                  正在由 Ollama 生成專業報告...
                </div>
              ) : report ? (
                <div ref={reportRef} className="report-content markdown-body">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              ) : reportError ? (
                <div className="report-error">{reportError}</div>
              ) : (
                <div className="report-hint">報告生成失敗，請重試或檢查設定。</div>
              )}
            </div>
          </div>
        ) : imageSrc ? (
          <div className="preview-container">
            <img
              src={imageSrc}
              alt="Uploaded X-ray"
              className="preview-image"
            />
            <p className="preview-hint">點擊「開始分析」以執行 AI 偵測</p>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🦷</span>
            <h2>全口牙齒 X 光 AI 偵測系統</h2>
            <p>請從左側上傳一張全口 X 光片，系統將自動偵測牙齒異常。</p>
          </div>
        )}
      </main>
    </div>
  );
}
