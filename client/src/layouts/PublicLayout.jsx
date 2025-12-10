import { Link, Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/" className="logo">
          AKKJ ERP
        </Link>
        <nav>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <p>© {new Date().getFullYear()} AKKJ ERP · Unified Back Office</p>
      </footer>
    </div>
  );
}
