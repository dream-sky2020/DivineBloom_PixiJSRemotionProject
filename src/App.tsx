import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AppSidebar } from './components/AppSidebar';
import { GamePage } from './pages/GamePage';
import { GameECSPage } from './pages/GameECSPage';
import { ReplayToVideoPage } from './pages/ReplayToVideoPage';
import { ImageAssetsPage } from './pages/ImageAssetsPage';
import { AudioAssetsPage } from './pages/AudioAssetsPage';
import { BezierEditorPage } from './pages/BezierEditorPage';
import { PythonToolsPage } from './pages/PythonToolsPage';

function App() {
  return (
    <Router>
      <div className="app-container">
        <AppSidebar />
        <main className="content-area">
          <Routes>
            <Route path="/simulation.html" element={<GamePage />} />
            <Route path="/game-ecs.html" element={<GameECSPage />} />
            <Route path="/dsl-to-image.html" element={<ReplayToVideoPage />} />
            <Route path="/image-assets.html" element={<ImageAssetsPage />} />
            <Route path="/audio-assets.html" element={<AudioAssetsPage />} />
            <Route path="/bezier-editor.html" element={<BezierEditorPage />} />
            <Route path="/python-tools.html" element={<PythonToolsPage />} />
            <Route path="/" element={<Navigate to="/simulation.html" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
