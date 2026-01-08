import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/btc" element={<App focusCoin="BTC" />} />
      <Route path="/eth" element={<App focusCoin="ETH" />} />
      <Route path="/sol" element={<App focusCoin="SOL" />} />
    </Routes>
  </BrowserRouter>
)
