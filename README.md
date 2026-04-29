# Pano Dental Detect

全口牙齒 X 光影像 AI 偵測系統。  
醫生可上傳全口 X 光片，系統透過 AI 模型自動偵測牙齒異常（支援多病狀架構，目前預設為阻生齒 Retain），並將結果視覺化呈現於網頁上。

---

## 🛠 技術棧

| 層級    | 技術                                  |
| ------- | ------------------------------------- |
| 前端    | React + TypeScript + Vite             |
| 後端    | FastAPI + Uvicorn (Docker 容器化部署) |
| AI 模型 | YOLOv12 (Ultralytics)                 |
| 語言    | TypeScript / Python 3.11              |

## 📂 專案結構

```
pano-dental-detect/
├── frontend/              # React 前端
│   ├── src/
│   │   ├── components/    # 拖曳上傳、結果畫布、偵測列表等 UI 元件
│   │   ├── pages/         # 儀表板主頁面
│   │   └── services/      # API 通訊層
│   └── index.css          # 全域樣式與 Tailwind/自訂 CSS
├── backend/               # FastAPI 後端
│   ├── app/
│   │   ├── api/           # API 路由 (支援 pathology 參數)
│   │   ├── core/          # 核心設定與病狀模型支援列表
│   │   ├── model/         # AI 推論模組，按病狀分開載入 YOLO
│   │   │   └── weights/   # [掛載目錄] 依病狀放置模型權重檔 (如 retain/yolov12n.pt)
│   │   └── utils/         # 工具函式
│   └── Dockerfile         # 後端 Docker 映像檔定義
├── uploads/               # [掛載目錄] 使用者上傳的測試影像
├── docker-compose.yml     # 後端容器運行腳本
└── README.md
```

## 🚀 部署與執行步驟 (從 GitHub 下載後)

### 1. 運行 Docker Ollama 模型

本系統的報告生成功能依賴 Ollama。透過 Docker 啟動服務及下載模型（若伺服器支援 GPU，請保留 `--gpus=all`，否則請移除並確保本機已有支援設定）：

```bash
docker run -d --gpus '"device=0"' \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  ollama/ollama

docker exec -it ollama ollama run qwen3.5:9b
```

_(註：後端從 Docker 連線至外部的容器服務使用 `http://host.docker.internal:11434` 來連線，已配置於預設環境變數中)_

### 2. 設定後端環境變數

複製設定檔並準備修改：

```bash
cd backend
cp .env.example .env
```

接著請根據您的需求修改 `.env` 檔案中的設定（例如確認 `ALLOWED_ORIGINS` 包含您的網域設定）。

### 3. 部署與啟動後端

回到專案根目錄，透過 Docker Compose 建置與啟動後端（與 Cloudflare 臨時隧道）：

```bash
cd ..
docker compose up -d --build
```

### 4. 查看狀態與即時日誌

您可以使用以下指令來確認後端是否順利執行：

```bash
docker compose ps      # 查看容器狀態
docker compose logs -f # 查看即時日誌
```

### 5. 取得臨時外部 API 網址

因為前端可能部署於 GitHub Pages 上，為了讓前端能夠打到你的後端 API，專案中已準備了 Cloudflare 臨時隧道 (Temp Tunnel)：

```bash
docker compose logs tunnel
```

在輸出的日誌中，請找到類似 `https://XXXXXXXXXX.trycloudflare.com` 的網址，這是您的後端臨時對外 API 存取點，請先將其複製起來備用。

### 6. 前端網頁部署 (發布至 GitHub Pages)

進入前端資料夾準備打包與部署：

```bash
cd frontend
```

1. **更新 API 端點設定**  
   如果您準備發布到線上，請修改前端環境變數綁定。將 `frontend/.env.production` 裡面的 `VITE_API_BASE` 修改為上方啟動的 Tunnel 網址：

   ```env
   VITE_API_BASE=https://XXXXXXXXXX.trycloudflare.com
   ```

2. **(重要)** 確認 `frontend/public/` 中有提供給首頁「範例測試功能」的圖片相片資源（預設為 `0092.jpg`）。

3. **安裝依賴並一鍵發布**  
   確保您已有設定好 GitHub 權限。此指令會編譯 React 程式碼並自動推送到 `gh-pages` 分支。

   ```bash
   npm install
   npm run deploy
   ```

4. **GitHub 網頁設定**：
   - 前往 GitHub Repository 頁面 ➡️ **Settings** ➡️ **Pages**
   - 確保 **Build and deployment** 的 Source 選擇為 `Deploy from a branch`
   - 將 Branch 設定為 `gh-pages` 分支與 `/(root)`，點擊 Save。
   - 等待約 1~2 分鐘後，即可在您的專案 GitHub Pages 頁面上測試最新發布版本！

## ⚙️ API 端點說明

| Method | Endpoint           | 說明                                                              |
| ------ | ------------------ | ----------------------------------------------------------------- |
| POST   | `/api/predict`     | 上傳圖片，並可指定 `pathology` 參數，回傳 Bounding Box 偵測結果。 |
| GET    | `/api/pathologies` | 回傳系統目前可支援的病狀列表及其模型是否已成功載入。              |
| GET    | `/api/health`      | 系統基礎健康檢查，確認 FastAPI 是否連線與模型實例狀況。           |

## 🧬 多病狀架構 (Multi-Pathology) 擴充方式

系統已經設計成易於擴充不同病狀的檢測模型：

1. 開啟 `backend/app/core/config.py`
2. 在 `PATHOLOGY_CONFIGS` 字典中新增病狀設定（如 `caries` 或 `periapical`）
3. 將對應的 YOLO 模型放到 `backend/app/model/weights/<病狀名稱>/` 底下
4. 重啟 Docker 容器 (`docker compose restart backend`)，前端頁面即會自動出現新的病狀選項按鈕供使用者切換。
