import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Dashboard() {
  const { company } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    sales: 0,
    suppliers: 0,
    products: 0,
  });
  const [checklist, setChecklist] = useState([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const [salesRes, supplierRes, productRes] = await Promise.all([
          api.get("/api/sales"),
          api.get("/api/suppliers"),
          api.get("/api/products"),
        ]);
        setStats({
          sales: salesRes.data.length,
          suppliers: supplierRes.data.length,
          products: productRes.data.length,
        });
      } catch (error) {
        console.warn("Unable to load stats yet", error);
      }
    }
    loadStats();
  }, []);

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const [whRes, unitRes, brandRes, catRes, payRes] = await Promise.all([
          api.get("/api/warehouses").catch(() => ({ data: [] })),
          api.get("/api/units").catch(() => ({ data: [] })),
          api.get("/api/brands").catch(() => ({ data: [] })),
          api.get("/api/categories").catch(() => ({ data: [] })),
          api.get("/api/payment-methods").catch(() => ({ data: [] })),
        ]);

        const hasCompany = Boolean(company?.CompanyName);
        const whList = Array.isArray(whRes.data) ? whRes.data : [];
        const unitList = Array.isArray(unitRes.data) ? unitRes.data : [];
        const brandList = Array.isArray(brandRes.data) ? brandRes.data : [];
        const catList = Array.isArray(catRes.data) ? catRes.data : [];
        const payList = Array.isArray(payRes.data) ? payRes.data : [];

        const items = [
          { key: "company", label: t("dashboard.chkCompany"), done: hasCompany },
          { key: "warehouse", label: t("dashboard.chkWarehouse"), done: whList.length > 0 },
          { key: "units", label: t("dashboard.chkUnits"), done: unitList.length > 0 },
          { key: "categories", label: t("dashboard.chkCategoriesBrands"), done: catList.length > 0 && brandList.length > 0 },
          { key: "payments", label: t("dashboard.chkPayments"), done: payList.length > 0 },
          { key: "products", label: t("dashboard.chkProducts"), done: stats.products > 0 },
        ];

        setChecklist(items);
      } catch (err) {
        console.warn("Checklist not fully loaded", err);
      }
    };
    loadChecklist();
  }, [company, stats.products, t]);

  return (
    <div className="grid">
      <section className="card">
        <h3>{t("dashboard.companyCardTitle")}</h3>
        <p>{company?.CompanyName}</p>
        <Link to="/company/setup" className="btn ghost">
          {t("dashboard.updateProfile")}
        </Link>
      </section>
      <section className="card">
        <h3>{t("dashboard.salesProcessed")}</h3>
        <p className="muted">
          {t("dashboard.documents", { count: stats.sales })}
        </p>
        <Link to="/pos" className="btn primary">
          {t("dashboard.openPos")}
        </Link>
      </section>
      <section className="card">
        <h3>{t("dashboard.suppliersTitle")}</h3>
        <p className="muted">
          {t("dashboard.registered", { count: stats.suppliers })}
        </p>
        <Link to="/purchase-orders" className="btn ghost">
          {t("dashboard.viewPurchaseOrders")}
        </Link>
      </section>
      <section className="card">
        <h3>{t("dashboard.productsTitle")}</h3>
        <p className="muted">
          {t("dashboard.activeSkus", { count: stats.products })}
        </p>
        <Link to="/inventory" className="btn ghost">
          {t("nav.inventory")}
        </Link>
      </section>
      <section className="card">
        <h3>{t("dashboard.preflightTitle")}</h3>
        <p className="muted small">{t("dashboard.preflightSubtitle")}</p>
        <ul className="checklist">
          {checklist.map((item) => (
            <li key={item.key} className={item.done ? "ok" : ""}>
              <span className="check-icon">{item.done ? "✓" : "•"}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
