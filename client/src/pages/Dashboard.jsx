import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { useLanguage } from "../context/LanguageContext";

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const candidates = [
    payload.items,
    payload.data,
    payload.customers,
    payload.promotions,
    payload.priceLists,
    payload.products,
  ];
  return candidates.find(Array.isArray) || [];
};

export default function Dashboard() {
  const { company } = useAuth();
  const { config } = useConfig();
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
        const productList = normalizeList(productRes?.data);
        setStats({
          sales: salesRes.data.length,
          suppliers: supplierRes.data.length,
          products: productList.length,
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
        const [
          whRes,
          unitRes,
          catRes,
          custRes,
          employeeRes,
          taxRes,
          promoRes,
          priceRes,
        ] = await Promise.all([
          api.get("/api/warehouses").catch(() => ({ data: [] })),
          api.get("/api/units").catch(() => ({ data: [] })),
          api.get("/api/categories").catch(() => ({ data: [] })),
          api.get("/api/customers").catch(() => ({ data: [] })),
          api.get("/api/employees").catch(() => ({ data: [] })),
          api.get("/api/tax-rates").catch(() => ({ data: [] })),
          api.get("/api/promotions").catch(() => ({ data: [] })),
          api.get("/api/price-lists").catch(() => ({ data: [] })),
        ]);

        const hasCompany = Boolean(company?.CompanyName);
        const whList = normalizeList(whRes?.data);
        const unitList = normalizeList(unitRes?.data);
        const catList = normalizeList(catRes?.data);
        const customerList = normalizeList(custRes?.data);
        const employeeList = normalizeList(employeeRes?.data);
        const taxList = normalizeList(taxRes?.data);
        const promoList = normalizeList(promoRes?.data);
        const priceList = normalizeList(priceRes?.data);
        const accessories = config?.accessories || {};
        const printerList = Object.values(accessories.defaultPrinters || {}).filter(
          Boolean
        );
        const hasPrinterSettings =
          printerList.length > 0 ||
          Boolean(accessories.agentUrl) ||
          Boolean(accessories.qzEnabled);

        const items = [
          {
            key: "company",
            label: t("dashboard.chkCompanyDetails"),
            done: hasCompany,
          },
          {
            key: "taxRates",
            label: t("dashboard.chkTaxRates"),
            done: taxList.length > 0,
          },
          {
            key: "customers",
            label: t("dashboard.chkCustomers"),
            done: customerList.length > 0,
          },
          {
            key: "categories",
            label: t("dashboard.chkCategories"),
            done: catList.length > 0,
          },
          {
            key: "warehouse",
            label: t("dashboard.chkWarehouse"),
            done: whList.length > 0,
          },
          {
            key: "units",
            label: t("dashboard.chkUnits"),
            done: unitList.length > 0,
          },
          {
            key: "products",
            label: t("dashboard.chkProducts"),
            done: stats.products > 0,
          },
          {
            key: "employees",
            label: t("dashboard.chkEmployees"),
            done: employeeList.length > 0,
          },
          {
            key: "promotions",
            label: t("dashboard.chkPromotions"),
            done: promoList.length > 0,
          },
          {
            key: "priceLists",
            label: t("dashboard.chkPriceLists"),
            done: priceList.length > 0,
          },
          {
            key: "printers",
            label: t("dashboard.chkPrinterSettings"),
            done: hasPrinterSettings,
          },
        ];

        setChecklist(items);
      } catch (err) {
        console.warn("Checklist not fully loaded", err);
      }
    };
    loadChecklist();
  }, [company, stats.products, t, config]);

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
