import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const resolveImg = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function ProductList() {
  const { company } = useAuth();
  const { t } = useLanguage();

  const optionalFields = useMemo(
    () => [
      { key: "CategoryName", label: t("products.category"), width: "1.2fr" },
      { key: "BrandName", label: t("products.brand"), width: "1.2fr" },
      { key: "CostPrice", label: t("products.cost"), width: "0.9fr" },
      { key: "IsTaxable", label: t("products.taxable"), width: "0.8fr" },
      { key: "TaxRateName", label: t("products.taxRate", "Tax rate"), width: "1.2fr" },
      { key: "TaxRatePercentage", label: t("products.taxRatePerc", "Rate %"), width: "0.8fr" },
      { key: "IsService", label: t("products.service"), width: "0.9fr" },
      { key: "Barcode", label: t("products.barcode"), width: "1.2fr" },
      { key: "Weight", label: t("products.weight"), width: "0.8fr" },
      { key: "WeightUnitID", label: t("products.weightUnit"), width: "1fr" },
      { key: "Length", label: t("products.length"), width: "0.8fr" },
      { key: "Width", label: t("products.width"), width: "0.8fr" },
      { key: "Height", label: t("products.height"), width: "0.8fr" },
      { key: "DimensionUnitID", label: t("products.dimensionUnit"), width: "1fr" },
      { key: "CreatedAt", label: t("products.createdAt"), width: "1.1fr" },
      { key: "UpdatedAt", label: t("products.updatedAt"), width: "1.1fr" },
      { key: "Description", label: t("products.descriptionField"), width: "1.5fr" },
    ],
    [t]
  );
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortField, setSortField] = useState("ProductName");
  const [sortDir, setSortDir] = useState("asc");
  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState(
    new Set(["CategoryName", "BrandName"])
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const [prodRes, catRes] = await Promise.all([
          api.get("/api/products"),
          api.get("/api/categories"),
        ]);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
        setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      } catch (err) {
        console.error("Failed to load products", err);
        setStatus({ type: "error", message: t("products.loadError") });
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, [t]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = products
      .filter((p) => {
        if (categoryFilter && String(p.ProductCategoryID) !== categoryFilter) {
          return false;
        }
        if (typeFilter === "active" && !p.IsActive) return false;
        if (typeFilter === "inactive" && p.IsActive) return false;
        if (!term) return true;
        return (
          (p.ProductName || "").toLowerCase().includes(term) ||
          (p.SKU || "").toLowerCase().includes(term) ||
          (p.Barcode || "").toLowerCase().includes(term)
        );
      })
      .slice(0, 500);
    const sorted = [...base].sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal != null) return -1 * dir;
      if (aVal != null && bVal == null) return 1 * dir;
      if (aVal == null && bVal == null) return 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return aVal === bVal ? 0 : aVal > bVal ? dir : -dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
    return sorted;
  }, [products, search, categoryFilter, typeFilter, sortField, sortDir]);

  return (
    <div className="page product-list-page">
      <header className="list-header">
        <div>
          <h2>
            {t("products.title")} {company?.CompanyName ? `- ${company.CompanyName}` : ""}
          </h2>
          <p className="muted">{t("products.description")}</p>
        </div>
        <div className="list-actions">
          <div className="field-select">
            <button
              type="button"
              className="btn ghost"
              onClick={() => setFieldDropdownOpen((prev) => !prev)}
            >
              {t("products.fields")}
            </button>
            {fieldDropdownOpen && (
              <div className="field-dropdown">
                {optionalFields.map((f) => (
                  <label key={f.key} className="field-option">
                    <input
                      type="checkbox"
                      checked={selectedFields.has(f.key)}
                      onChange={(e) => {
                        setSelectedFields((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.add(f.key);
                          } else {
                            next.delete(f.key);
                          }
                          return next;
                        });
                      }}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            )}
        </div>
          <Link className="btn ghost" to="/products/import">
            {t("products.import")}
          </Link>
          <Link
            className="btn ghost"
            to={`/products/export?category=${categoryFilter}&type=${typeFilter}&q=${encodeURIComponent(
              search.trim()
            )}`}
          >
            {t("products.export")}
          </Link>
          <Link className="btn secondary" to="/products/new">
            {t("products.add")}
          </Link>
        </div>
      </header>

      {status.message && (
        <p className={`status ${status.type}`}>{status.message}</p>
      )}

      <div className="card product-filter-card">
        <div className="product-filters">
          <div className="search-input">
            <input
              placeholder={t("products.search")}
              aria-label={t("products.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">{t("products.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.ProductCategoryID} value={c.ProductCategoryID}>
                {c.CategoryName}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t("products.filterAll")}</option>
            <option value="active">{t("products.filterActive")}</option>
            <option value="inactive">{t("products.filterInactive")}</option>
          </select>
        </div>
        <p className="muted small">{t("products.count", { count: filtered.length })}</p>
      </div>

      <div className="card product-table-card">
        {loading ? (
          <p className="muted">{t("products.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="muted">{t("products.empty")}</p>
        ) : (
          <div className="product-table">
            {(() => {
              const visibleFields = optionalFields.filter((f) =>
                selectedFields.has(f.key)
              );
              const template = [
                "40px",
                "3fr",
                "1fr",
                "1fr",
                "1fr",
                ...visibleFields.map((f) => f.width || "1fr"),
              ].join(" ");
              return (
                <div className="product-table-head" style={{ gridTemplateColumns: template }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filtered.map((p) => p.ProductID)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    checked={
                      selectedIds.size > 0 &&
                      filtered.every((p) => selectedIds.has(p.ProductID))
                    }
                  />
                  <button
                    type="button"
                    className="table-sort"
                    onClick={() => handleSort("ProductName")}
                  >
                    Nombre {sortField === "ProductName" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                  <button
                    type="button"
                    className="table-sort"
                    onClick={() => handleSort("SKU")}
                  >
                    SKU {sortField === "SKU" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                  <button
                    type="button"
                    className="table-sort"
                    onClick={() => handleSort("Stock")}
                  >
                    Stock {sortField === "Stock" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                  <button
                    type="button"
                    className="table-sort"
                    onClick={() => handleSort("SellingPrice")}
                  >
                    Precio {sortField === "SellingPrice" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                  {visibleFields.map((f) => (
                    <button
                      type="button"
                      key={f.key}
                      className="table-sort"
                      onClick={() => handleSort(f.key)}
                    >
                      {f.label} {sortField === f.key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  ))}
                </div>
              );
            })()}
            {filtered.map((p) => (
              <div
                className="product-table-row"
                key={p.ProductID}
                style={{
                  gridTemplateColumns: `40px 3fr 1fr 1fr 1fr ${optionalFields
                    .filter((f) => selectedFields.has(f.key))
                    .map((f) => f.width || "1fr")
                    .join(" ")}`.trim(),
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.ProductID)}
                  onChange={(e) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) {
                        next.add(p.ProductID);
                      } else {
                        next.delete(p.ProductID);
                      }
                      return next;
                    });
                  }}
                />
                <div className="product-info">
                  <div className="product-thumb">
                    <Link to={`/products/${p.ProductID}`}>
                      {p.PrimaryImageURL || p.ImageURL ? (
                        <img src={resolveImg(p.PrimaryImageURL || p.ImageURL)} alt={p.ProductName} />
                      ) : (
                        <div className="thumb-placeholder" />
                      )}
                    </Link>
                  </div>
                  <div className="product-meta">
                    <div className="product-name">
                      <span className="status-dot" />
                      <Link to={`/products/${p.ProductID}`}>{p.ProductName}</Link>
                    </div>
                    <div className="muted small">{p.CategoryName || "-"}</div>
                  </div>
                </div>
                <span className="muted">{p.SKU || "-"}</span>
                <span className={Number(p.Stock || 0) > 0 ? "" : "error-text"}>
                  {p.Stock != null ? p.Stock : "-"}
                </span>
                <span>
                  {Number(p.SellingPrice || 0).toLocaleString("es-CL", {
                    style: "currency",
                    currency: "CLP",
                  })}
                </span>
                {optionalFields
                  .filter((f) => selectedFields.has(f.key))
                  .map((f) => {
                    let value = p[f.key];
                    if (f.key === "IsTaxable" || f.key === "IsService") {
                      value = value ? t("productForm.yes") : t("productForm.no");
                    } else if (f.key === "TaxRatePercentage") {
                      value = value != null ? `${Number(value).toFixed(2)}%` : "-";
                    } else if (f.key === "CostPrice" || f.key === "SellingPrice") {
                      value = Number(value || 0).toLocaleString("es-CL", {
                        style: "currency",
                        currency: "CLP",
                      });
                    } else if (
                      f.key === "CreatedAt" ||
                      f.key === "UpdatedAt"
                    ) {
                      value = value ? new Date(value).toLocaleDateString() : "-";
                    } else if (
                      f.key === "Weight" ||
                      f.key === "Length" ||
                      f.key === "Width" ||
                      f.key === "Height"
                    ) {
                      value = value != null ? value : "-";
                    } else if (value == null || value === "") {
                      value = "-";
                    }
                    return (
                      <span key={f.key} className="muted">
                        {value}
                      </span>
                    );
                  })}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
