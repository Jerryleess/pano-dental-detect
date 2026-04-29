import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <div className="header-brand">
            <h1>牙科 X 光影像分析系統</h1>
          </div>
          <p className="header-subtitle">
            阻生齒自動偵測輔助工具
          </p>
        </div>
      </header>

      <Dashboard />

      <footer className="app-footer">
        <p>
          Pano Dental Detect &copy; {new Date().getFullYear()} —
          僅供研究使用，不可作為臨床診斷依據
        </p>
      </footer>
    </div>
  );
}
