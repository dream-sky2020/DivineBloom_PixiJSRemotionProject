import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AppSidebar } from './components/AppSidebar';
import { GamePage } from './pages/GamePage';
import { DslToVideoPage } from './pages/DslToVideoPage';
import { ImageAssetsPage } from './pages/ImageAssetsPage';
import { AudioAssetsPage } from './pages/AudioAssetsPage';
import { BezierEditorPage } from './pages/BezierEditorPage';

function App() {
  return (
    <Router>
      <div className="app-container">
        <AppSidebar />
        <main className="content-area">
          <Routes>
            <Route path="/simulation.html" element={<GamePage />} />
            <Route path="/dsl-to-image.html" element={<DslToVideoPage />} />
            <Route path="/image-assets.html" element={<ImageAssetsPage />} />
            <Route path="/audio-assets.html" element={<AudioAssetsPage />} />
            <Route path="/bezier-editor.html" element={<BezierEditorPage />} />
            <Route path="/" element={<Navigate to="/simulation.html" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
