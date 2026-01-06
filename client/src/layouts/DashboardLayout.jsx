import { useMemo, useState, useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  Buildings,
  ChartLine,
  Clipboard,
  ClipboardText,
  Coins,
  Desktop,
  Gear,
  Gift,
  Globe,
  Handshake,
  House,
  Lock,
  Package,
  Percent,
  Plugs,
  PlusCircle,
  Scroll,
  ShoppingBag,
  SignOut,
  SquaresFour,
  TagSimple,
  Truck,
  UsersThree,
  Factory,
  Scales,
  SlidersHorizontal,
} from "phosphor-react";

const navIconSize = 20;

const renderIcon = (IconComp) =>
  IconComp ? <IconComp size={navIconSize} weight="bold" /> : null;

const navItems = [
  { labelKey: "nav.dashboard", path: "/dashboard", icon: House },
  { labelKey: "nav.reports", path: "/reports", icon: ChartLine },
  {
    labelKey: "nav.launchPos",
    path: "/pos",
    icon: Desktop,
    perm: "pos.use",
  },
  {
    labelKey: "nav.company",
    path: "/company/setup",
    icon: Buildings,
    perm: "config.manage",
  },
  {
    labelKey: "nav.taxRates",
    path: "/tax-rates",
    icon: Percent,
    perm: "config.manage",
  },
  {
    labelKey: "nav.employees",
    path: "/employees/onboarding",
    icon: UsersThree,
    perm: "employees.manage",
  },
  {
    labelKey: "nav.customers",
    path: "/customers",
    icon: Handshake,
    perm: "customers.manage",
  }, // handshake to distinguish from employees
  {
    labelKey: "nav.suppliers",
    path: "/suppliers",
    icon: Truck,
    perm: "inventory.view",
  },
  {
    labelKey: "nav.roles",
    path: "/roles",
    icon: Lock,
    perm: "roles.manage",
  },
  {
    labelKey: "nav.promotions",
    path: "/promotions",
    icon: Gift,
    perm: "config.manage",
  },
  {
    labelKey: "nav.products",
    icon: ShoppingBag,
    perm: "products.manage",
    children: [
      {
        labelKey: "nav.products",
        path: "/products",
        icon: Package,
        perm: "products.manage",
      },
      {
        labelKey: "nav.addProduct",
        path: "/products/new",
        icon: PlusCircle,
        perm: "products.manage",
      },
      {
        labelKey: "nav.customFields",
        path: "/products/custom-fields",
        icon: SlidersHorizontal,
        perm: "products.manage",
      },
      {
        labelKey: "nav.brands",
        path: "/brands",
        icon: TagSimple,
        perm: "products.manage",
      },
      {
        labelKey: "nav.categories",
        path: "/categories",
        icon: SquaresFour,
        perm: "products.manage",
      },
      {
        labelKey: "nav.units",
        path: "/units",
        icon: Scales,
        perm: "products.manage",
      },
      {
        labelKey: "nav.inventory",
        path: "/inventory",
        icon: ChartLine,
        perm: "inventory.view",
      },
      {
        labelKey: "nav.purchaseOrders",
        path: "/purchase-orders",
        icon: ClipboardText,
        perm: "inventory.view",
      },
      {
        labelKey: "nav.directPurchases",
        path: "/direct-purchases",
        icon: Clipboard,
        perm: "inventory.view",
      },
      {
        labelKey: "nav.priceLists",
        path: "/price-lists",
        icon: Coins,
        perm: "priceLists.manage",
      },
    ],
  },
  {
    labelKey: "nav.manageWarehouses",
    path: "/warehouses",
    icon: Factory,
    perm: "warehouses.manage",
  },
  {
    labelKey: "nav.settings",
    icon: Gear,
    perm: "config.manage",
    children: [
      {
        labelKey: "nav.receipts",
        path: "/settings/receipts",
        icon: Scroll,
        perm: "config.manage",
      },
      {
        labelKey: "nav.accessories",
        path: "/settings/accessories",
        icon: Plugs,
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
          const visibleChildren = item.children.filter((child) =>
            hasPerm(child.perm)
          );
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
                aria-label={t(item.labelKey)}
              >
                <span className="sidebar-icon" aria-hidden="true">
                  {renderIcon(item.icon)}
                </span>
                <span className="sidebar-label">{t(item.labelKey)}</span>
                {collapsed && (
                  <span className="sidebar-tooltip">{t(item.labelKey)}</span>
                )}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && <p>{user?.Email}</p>}
          <button className="btn ghost" type="button" onClick={handleLogout}>
            <span className="sidebar-icon logout-icon" aria-hidden="true">
              {renderIcon(SignOut)}
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
                {t("dashboard.welcome")},{" "}
                {user?.FirstName || user?.FirstName || "Admin"}
              </h2>
              <p className="muted">{t("dashboard.subtitle")}</p>
            </div>
            <div
              className="dashboard-shortcuts"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span className="sidebar-icon" aria-hidden="true">
                {renderIcon(Globe)}
              </span>
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

function SidebarGroup({
  label,
  labelKey,
  childrenItems,
  open,
  onToggle,
  t,
  icon,
  collapsed,
}) {
  const location = useLocation();
  const expanded = useMemo(() => {
    const activeChild = childrenItems.some((child) =>
      location.pathname.startsWith(child.path)
    );
    return open || activeChild;
  }, [childrenItems, location.pathname, open]);

  return (
    <div className="sidebar-group">
      <button
        type="button"
        className="sidebar-group-label-row"
        onClick={onToggle}
        aria-label={label}
      >
        <span className="sidebar-icon" aria-hidden="true">
          {renderIcon(icon)}
        </span>
        {!collapsed && <span className="sidebar-group-label">{label}</span>}
        {!collapsed && (
          <span className="sidebar-group-caret">{expanded ? "▾" : "▸"}</span>
        )}
      </button>
      {(expanded || collapsed) && (
        <div className="sidebar-subnav">
          {collapsed && (
            <div className="sidebar-subnav-heading" aria-hidden="true">
              {label}
            </div>
          )}
          {childrenItems.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end={child.path === "/products"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-icon" aria-hidden="true">
                {renderIcon(child.icon)}
              </span>
              <span className="sidebar-label">
                {child.labelKey ? t(child.labelKey) : child.label}
              </span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
