# ── Backend Dockerfile ──
# 使用輕量版 Python 映像，安裝 OpenCV 系統依賴與 Python 套件

FROM python:3.11-slim

# 安裝 OpenCV 所需的系統套件
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先複製 requirements 以利用 Docker 快取
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 複製應用程式原始碼
COPY . .

# 建立 uploads 目錄
RUN mkdir -p /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
