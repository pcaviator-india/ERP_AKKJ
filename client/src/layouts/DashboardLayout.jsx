import { useMemo, useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const navItems = [
  { labelKey: "nav.dashboard", path: "/dashboard", icon: "\u{1F3E0}" },
  { labelKey: "nav.launchPos", path: "/pos", icon: "\u{1F4B3}", perm: "pos.use" },
  { labelKey: "nav.company", path: "/company/setup", icon: "\u{1F3E2}", perm: "config.manage" },
  { labelKey: "nav.taxRates", path: "/tax-rates", icon: "\u{0025}", perm: "config.manage" },
  { labelKey: "nav.employees", path: "/employees/onboarding", icon: "\u{1F465}", perm: "employees.manage" },
  { labelKey: "nav.customers", path: "/customers", icon: "\u{1F91D}", perm: "customers.manage" }, // handshake to distinguish from employees
  { labelKey: "nav.roles", path: "/roles", icon: "\u{1F510}", perm: "roles.manage" },
  { labelKey: "nav.promotions", path: "/promotions", icon: "\u{1F381}", perm: "config.manage" },
  {
    labelKey: "nav.products",
    icon: "\u{1F6CD}",
    perm: "products.manage",
    children: [
      { labelKey: "nav.products", path: "/products", icon: "\u{1F4E6}", perm: "products.manage" },
      { labelKey: "nav.addProduct", path: "/products/new", icon: "\u2795", perm: "products.manage" },
      { labelKey: "nav.customFields", path: "/products/custom-fields", icon: "\u2699", perm: "products.manage" },
      { labelKey: "nav.brands", path: "/brands", icon: "\u{1F3F7}", perm: "products.manage" },
      { labelKey: "nav.categories", path: "/categories", icon: "\u{1F4C2}", perm: "products.manage" },
      { labelKey: "nav.units", path: "/units", icon: "\u2696", perm: "products.manage" },
      { labelKey: "nav.inventory", path: "/inventory", icon: "\u{1F4CA}", perm: "inventory.view" },
      { labelKey: "nav.priceLists", path: "/price-lists", icon: "\u{1F3F7}", perm: "priceLists.manage" },
    ],
  },
  {
    labelKey: "nav.warehouses",
    icon: "\u{1F3E2}",
    children: [
      { labelKey: "nav.manageWarehouses", path: "/warehouses", icon: "\u{1F4C1}", perm: "warehouses.manage" },
      { labelKey: "nav.addToWarehouse", path: "/warehouses/add-stock", icon: "\u2795", perm: "inventory.adjust" },
    ],
  },
  {
    labelKey: "nav.settings",
    icon: "\u2699",
    perm: "config.manage",
    children: [
      {
        labelKey: "nav.receipts",
        path: "/settings/receipts",
        icon: "\u{1F4C4}",
        perm: "config.manage",
      },
      {
        labelKey: "nav.accessories",
        path: "/settings/accessories",
        icon: "\u{1F5A8}",
        perm: "config.manage",
      },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "akkj-sidebar-collapsed";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    }
  }, [collapsed]);
  const { user, company, permissions, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState({});
  const { t, lang, setLang } = useLanguage();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const hasPerm = useMemo(
    () => (perm) => !perm || permissions.includes(perm),
    [permissions]
  );

  const visibleNavItems = useMemo(() => {
    return navItems
      .map((item) => {
        if (item.children) {
          const visibleChildren = item.children.filter((child) => hasPerm(child.perm));
          if (visibleChildren.length === 0 && !hasPerm(item.perm)) return null;
          return { ...item, children: visibleChildren };
        }
        if (!hasPerm(item.perm)) return null;
        return item;
      })
      .filter(Boolean);
  }, [hasPerm]);

  const launchPos = () => {
    const w = window.screen?.availWidth || 1920;
    const h = window.screen?.availHeight || 1080;
    const features = `width=${w},height=${h},left=0,top=0,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`;
    const win = window.open("/pos", "akkj-pos", features);
    if (win) {
      win.focus();
      try {
        win.moveTo(0, 0);
        win.resizeTo(w, h);
      } catch (_) {
        // ignore if blocked
      }
    }
  };

  return (
    <div className="dashboard-shell wide-content">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          {!collapsed && <span>{company?.CompanyName || "AKKJ ERP"}</span>}
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▶" : "◀"}
          </button>
        </div>
        <nav className="sidebar-nav">
          {visibleNavItems.map((item) =>
            item.children ? (
              <SidebarGroup
                key={item.labelKey}
                label={t(item.labelKey)}
                icon={item.icon}
                labelKey={item.labelKey}
                childrenItems={item.children}
                open={openGroups[item.labelKey]}
                onToggle={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [item.labelKey]: !prev[item.labelKey],
                  }))
                }
                t={t}
                collapsed={collapsed}
              />
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon">{item.icon || "?"}</span>
              <span className="sidebar-label">{t(item.labelKey)}</span>
            </NavLink>
          )
          )}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && <p>{user?.Email}</p>}
          <button className="btn ghost" type="button" onClick={handleLogout}>
            <span className="sidebar-icon logout-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <path
                  d="M10.5 4.5a.75.75 0 0 0-.75-.75h-4a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h4a.75.75 0 0 0 .75-.75V17a.75.75 0 1 0-1.5 0v2H6a.5.5 0 0 1-.5-.5V5.75A.5.5 0 0 1 6 5.25h3v2a.75.75 0 0 0 1.5 0z"
                  fill="currentColor"
                />
                <path
                  d="M14.53 8.47a.75.75 0 0 0-1.06 1.06L15.94 12l-2.47 2.47a.75.75 0 1 0 1.06 1.06l3-3a.75.75 0 0 0 0-1.06z"
                  fill="currentColor"
                />
                <path d="M9.25 12a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H10a.75.75 0 0 1-.75-.75" fill="currentColor" />
              </svg>
            </span>
            <span className="sidebar-label">Logout</span>
          </button>
        </div>
      </aside>
      <section className="dashboard-content">
        {location.pathname === "/dashboard" && (
          <header className="dashboard-header">
            <div>
              <h2>
                {t("dashboard.welcome")}, {user?.FirstName || user?.FirstName || "Admin"}
              </h2>
              <p className="muted">{t("dashboard.subtitle")}</p>
            </div>
            <div className="dashboard-shortcuts" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span role="img" aria-label="Language">??</span>
              <select
                className="lang-switch"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={{ width: 70, padding: "6px 8px" }}
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            </div>
          </header>
        )}
        <div className="dashboard-body">
          <Outlet />
        </div>
      </section>
    </div>
  );
}

function SidebarGroup({ label, labelKey, childrenItems, open, onToggle, t, icon, collapsed }) {
  const location = useLocation();
  const expanded = useMemo(() => {
    const activeChild = childrenItems.some((child) =>
      location.pathname.startsWith(child.path)
    );
    return open || activeChild;
  }, [childrenItems, location.pathname, open]);

  return (
    <div className="sidebar-group">
      <button type="button" className="sidebar-group-label-row" onClick={onToggle}>
        <span className="sidebar-icon">{icon || "?"}</span>
        {!collapsed && <span className="sidebar-group-label">{label}</span>}
        {!collapsed && <span className="sidebar-group-caret">{expanded ? "▾" : "▸"}</span>}
      </button>
      {(expanded || collapsed) && (
        <div className="sidebar-subnav">
          {childrenItems.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end={child.path === "/products"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon">{child.icon || "?"}</span>
              <span className="sidebar-label">{child.labelKey ? t(child.labelKey) : child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
