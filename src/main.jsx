import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import BacktestPage from './pages/BacktestPage.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App focusCoin="BTC" />} />
      <Route path="/eth" element={<App focusCoin="ETH" />} />
      <Route path="/sol" element={<App focusCoin="SOL" />} />
      <Route path="/backtest" element={<BacktestPage />} />
    </Routes>
  </BrowserRouter>
)

