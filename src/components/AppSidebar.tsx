import { NavLink } from 'react-router-dom';
import './AppSidebar.css';

export function AppSidebar() {
  return (
    <header className="app-sidebar">
      <div className="sidebar-header">
        <h2>New World</h2>
        <p className="sidebar-subtitle">Rendering Tools</p>
      </div>
      <nav className="sidebar-nav">
        <NavLink 
          to="/simulation.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">SIM</span>
          <span className="nav-label">游戏模拟</span>
        </NavLink>
        <NavLink 
          to="/dsl-to-image.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">DSL</span>
          <span className="nav-label">DSL 转图像</span>
        </NavLink>
        <NavLink 
          to="/image-assets.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">IMG</span>
          <span className="nav-label">图像资源</span>
        </NavLink>
        <NavLink 
          to="/audio-assets.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">AUD</span>
          <span className="nav-label">音频资源</span>
        </NavLink>
        <NavLink 
          to="/bezier-editor.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">CRV</span>
          <span className="nav-label">贝塞尔曲线</span>
        </NavLink>
      </nav>
    </header>
  );
}
