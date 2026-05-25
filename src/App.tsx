import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AppSidebar } from './components/AppSidebar';
import { SimulationPage } from './pages/SimulationPage';
import { DslToImagePage } from './pages/DslToImagePage';
import { ImageAssetsPage } from './pages/ImageAssetsPage';
import { AudioAssetsPage } from './pages/AudioAssetsPage';

function App() {
  return (
    <Router>
      <div className="app-container">
        <AppSidebar />
        <main className="content-area">
          <Routes>
            <Route path="/simulation.html" element={<SimulationPage />} />
            <Route path="/dsl-to-image.html" element={<DslToImagePage />} />
            <Route path="/image-assets.html" element={<ImageAssetsPage />} />
            <Route path="/audio-assets.html" element={<AudioAssetsPage />} />
            <Route path="/" element={<Navigate to="/simulation.html" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
