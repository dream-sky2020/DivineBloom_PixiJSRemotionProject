import { NavLink } from 'react-router-dom';
import './AppSidebar.css';

export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <h2>New World</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink 
          to="/simulation.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">🎮</span>
          <span className="nav-label">物理模拟</span>
        </NavLink>
        <NavLink 
          to="/dsl-to-image.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">🖼️</span>
          <span className="nav-label">DSL 转图像</span>
        </NavLink>
        <NavLink 
          to="/image-assets.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">📷</span>
          <span className="nav-label">图像资源</span>
        </NavLink>
        <NavLink 
          to="/audio-assets.html" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <span className="nav-icon">🎵</span>
          <span className="nav-label">音频资源</span>
        </NavLink>
      </nav>
    </aside>
  );
}
