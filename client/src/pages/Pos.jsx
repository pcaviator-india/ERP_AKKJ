import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { useLanguage } from "../context/LanguageContext";
import { printWithFallback } from "../services/printService";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const resolveImg = (url) => {
  if (!url) return "";
  const str = url.toString();
  if (/^https?:\/\//i.test(str)) return str;
  return `${apiBase}${str.startsWith("/") ? "" : "/"}${str}`;
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});
const broadcastDebounceMs = 200;
const debounce = (fn, wait = 0) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

const documentTypeOptions = [
  { value: "TICKET", label: "Ticket" },
  { value: "BOLETA", label: "Boleta" },
  { value: "FACTURA", label: "Factura" },
  { value: "FACTURA_EXENTA", label: "Factura Exenta" },
  { value: "BOLETA_EXENTA", label: "Boleta Exenta" },
  { value: "GUIA_DESPACHO", label: "Guía Despacho" },
  { value: "NOTA_DEBITO", label: "Nota Débito" },
  { value: "NOTA_CREDITO", label: "Nota Crédito" },
];

const UNCATEGORIZED_ID = "__UNCAT__";
const getCategoryKey = (val) =>
  val === null || val === undefined ? UNCATEGORIZED_ID : String(val);
const isUncategorizedKey = (key) => key === UNCATEGORIZED_ID;

const getProductId = (product) =>
  product?.ProductID ??
  product?.ProductId ??
  product?.id ??
  product?.ID ??
  null;
const makeLineId = () =>
  `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const getLineId = (item) => item?.LineID || item?.ProductID;
const normalizeId = (v) => Number(v ?? 0);
const getProductName = (product) =>
  product?.ProductName ??
  product?.productName ??
  product?.Name ??
  product?.name ??
  "";
const getCustomerTaxId = (cust) =>
  cust?.TaxID ?? cust?.taxId ?? cust?.taxID ?? cust?.RUT ?? cust?.Rut ?? null;
const getProductSku = (product) =>
  product?.SKU ?? product?.Sku ?? product?.sku ?? "";
const getProductBarcode = (product) =>
  product?.Barcode ?? product?.barcode ?? product?.barcodeNumber ?? "";
const getProductCategoryId = (product) =>
  product?.ProductCategoryID ??
  product?.ProductCategoryId ??
  product?.categoryId ??
  null;
const getProductImageUrl = (product) => {
  const take = (val) => {
    if (!val) return null;
    if (typeof val === "object") {
      return (
        take(val.url) ||
        take(val.Url) ||
        take(val.uri) ||
        take(val.href) ||
        take(val.path) ||
        take(val.Path) ||
        null
      );
    }
    const str = (val ?? "").toString().trim();
    return str.length ? str : null;
  };

  const direct =
    take(product?.ImageUrl) ||
    take(product?.PrimaryImageURL) ||
    take(product?.PrimaryImageUrl) ||
    take(product?.imageUrl) ||
    take(product?.ImageURL) ||
    take(product?.imageURL) ||
    take(product?.image_url) ||
    take(product?.ThumbnailUrl) ||
    take(product?.thumbnailUrl) ||
    take(product?.ThumbUrl) ||
    take(product?.thumb_url) ||
    take(product?.PrimaryImageUrl) ||
    take(product?.primaryImageUrl) ||
    take(product?.ProductImageUrl) ||
    take(product?.ProductImageURL) ||
    take(product?.ProductImage) ||
    take(product?.ImagePath) ||
    take(product?.imagePath) ||
    take(product?.ImageObj) ||
    take(product?.PhotoUrl) ||
    take(product?.photoUrl) ||
    take(product?.Photo) ||
    take(product?.PictureUrl) ||
    take(product?.pictureUrl) ||
    take(product?.PictureURL) ||
    take(product?.pictureURL) ||
    take(product?.Picture) ||
    take(product?.Image) ||
    take(product?.image);
  if (direct) return direct;

  const imgs =
    product?.ProductImages ||
    product?.images ||
    product?.Images ||
    product?.productImages ||
    [];
  const primary =
    imgs.find?.(
      (img) =>
        img?.IsPrimary === true ||
        img?.isPrimary === true ||
        img?.IsPrimary === 1 ||
        img?.isPrimary === 1 ||
        img?.IsPrimary === "1" ||
        img?.isPrimary === "1"
    ) || null;
  if (primary) {
    const primaryUrl =
      take(primary.ImageUrl) ||
      take(primary.ImageURL) ||
      take(primary.PrimaryImageURL) ||
      take(primary.url) ||
      take(primary.Url) ||
      take(primary.Image) ||
      take(primary.Path) ||
      take(primary.image_url) ||
      take(primary.imageUrl);
    if (primaryUrl) return primaryUrl;
  }

  const firstImage =
    take(imgs?.[0]?.ImageUrl) ||
    take(imgs?.[0]?.url) ||
    take(imgs?.[0]?.Url) ||
    take(imgs?.[0]?.Image) ||
    take(imgs?.[0]?.Path) ||
    take(imgs?.[0]?.image_url) ||
    take(imgs?.[0]?.imageUrl);
  if (firstImage) return firstImage;

  return null;
};
const getProductPrice = (product) =>
  Number(
    product?.SellingPrice ??
      product?.sellingPrice ??
      product?.Price ??
      product?.price ??
      product?.UnitPrice ??
      product?.unitPrice ??
      0
  );
const normalizeQty = (value) => Math.max(1, Math.round(Number(value) || 0));
const formatShortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
};
const isTicketCode = (value = "") => {
  const term = value.toString().trim();
  return /^(tkt|cot|cotizacion)[-\s]?[a-z0-9_-]+$/i.test(term);
};
const normalizeTicketCode = (value = "") =>
  value.toString().trim().toUpperCase().replace(/\s+/g, "");

export default function Pos() {
  const navigate = useNavigate();
  const { user, company, loading: authLoading, token, logout } = useAuth();
  const { config, updateConfig, ready: configReady } = useConfig();
  const { t } = useLanguage();
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLookup, setCustomerLookup] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [defaultCustomer, setDefaultCustomer] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [ticketModal, setTicketModal] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const resultRefs = useRef([]);
  const searchInputRef = useRef(null);
  const skipFocusRef = useRef(true);
  const prevDocRef = useRef(null);
  const prevWarehouseRef = useRef(null);
  const prevPriceListRef = useRef(null);
  const prevModalsRef = useRef({
    customer: false,
    employee: false,
    ticket: false,
    pin: false,
    payment: false,
    lot: false,
  });
  const [actionsSheet, setActionsSheet] = useState(false);
  const [catalogSheet, setCatalogSheet] = useState(false);
  const [controlsSheet, setControlsSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const closeActionsSheet = () => {
    setActionsSheet(false);
    focusSearchSoon();
  };
  const closeCatalogSheet = () => {
    setCatalogSheet(false);
    focusSearchSoon();
  };
  const closeControlsSheet = () => {
    setControlsSheet(false);
    focusSearchSoon();
  };

  const focusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select?.();
    }
  };

  const focusSearchSoon = () => {
    setTimeout(focusSearch, 0);
  };
  const focusSearchDelayed = (ms = 200) => {
    setTimeout(focusSearch, ms);
  };

  const handleSurfaceMouseDown = (e) => {
    const target = e.target;
    if (
      target.closest(
        "input, select, button, textarea, [contenteditable], .dropdown, .modal, .category, .product-btn"
      )
    ) {
      return;
    }
    focusSearchSoon();
  };

  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (
        target.closest(
          "input, select, button, textarea, [contenteditable], .dropdown, .modal, .category, .product-btn"
        )
      ) {
        return;
      }
      focusSearchSoon();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, []);
  const [dismissedTicketIds, setDismissedTicketIds] = useState([]);
  const [loadedTicketId, setLoadedTicketId] = useState(null);
  const [categoryCollapsed, setCategoryCollapsed] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [companyLogo, setCompanyLogo] = useState(null);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [defaultCustomerFetched, setDefaultCustomerFetched] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [categoryWidth, setCategoryWidth] = useState(40); // percentage of grid for categories
  const [layoutReady, setLayoutReady] = useState(false);
  const [docInit, setDocInit] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [documentType, setDocumentType] = useState("BOLETA");
  const [priceLists, setPriceLists] = useState([]);
  const [activePriceListId, setActivePriceListId] = useState(null);
  const [priceTiers, setPriceTiers] = useState({});
  const [priceListInitialized, setPriceListInitialized] = useState(false);
  const [availableProductIds, setAvailableProductIds] = useState(new Set());
  const gridRef = useRef(null);
  const warehouseRef = useRef(null);
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const pendingEmployeeRef = useRef(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [payments, setPayments] = useState([
    { PaymentMethodID: "", Amount: "", ReferenceNumber: "" },
  ]);
  const [paymentError, setPaymentError] = useState("");
  const amountRefs = useRef([]);
  const [lastPaymentMethodId, setLastPaymentMethodId] = useState(null);
  const [focusedPaymentIndex, setFocusedPaymentIndex] = useState(0);
  const [overrideModal, setOverrideModal] = useState({
    open: false,
    productId: null,
    newPrice: "",
    managerId: "",
    pin: "",
    error: "",
    idx: null,
  });
  const [lotModal, setLotModal] = useState({
    open: false,
    mode: "single",
    lineId: null,
    packGroupId: null,
  });
  const [lotOptions, setLotOptions] = useState([]);
  const [lotOptionsByLine, setLotOptionsByLine] = useState({});
  const [lotModalLoading, setLotModalLoading] = useState(false);
  const [lotModalError, setLotModalError] = useState("");
  const [lotSearch, setLotSearch] = useState("");
  const [lotHighlight, setLotHighlight] = useState(0);
  const [serialModal, setSerialModal] = useState({
    open: false,
    lineId: null,
  });
  const [serialOptions, setSerialOptions] = useState([]);
  const [serialModalLoading, setSerialModalLoading] = useState(false);
  const [serialModalError, setSerialModalError] = useState("");
  const [serialSearch, setSerialSearch] = useState("");
  const [serialHighlight, setSerialHighlight] = useState(0);
  const [promotions, setPromotions] = useState([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const screenChannel = useMemo(
    () => (company?.CompanyID ? `company-${company.CompanyID}` : "default"),
    [company]
  );
  const swipeStartRef = useRef({ x: 0, y: 0, active: false });
  const [swipeOffsets, setSwipeOffsets] = useState({});
  const [swipingId, setSwipingId] = useState(null);
  const qtyTouchStartRef = useRef({});
  const publishCustomerScreen = useMemo(
    () =>
      debounce((payload) => {
        api
          .post("/api/customer-screen/broadcast", {
            channel: screenChannel,
            payload,
          })
          .catch(() => {});
      }, broadcastDebounceMs),
    [screenChannel]
  );

  const logoSource = (companyLogo || "").toString().trim();
  const hasLogo = logoSource.length > 0;
  const isAdminUser =
    (user?.Role && user.Role.toString().toLowerCase() === "admin") ||
    user?.IsAdmin === true;
  const companyLabel =
    company?.CompanyName ||
    company?.Name ||
    company?.companyName ||
    user?.CompanyName ||
    "AKKJ ERP";

  useEffect(() => {
    document.title = "AKKJ POS";
  }, []);

  useEffect(() => {
    const syncMobile = () => {
      const mobile = window.matchMedia("(max-width: 768px)").matches;
      setIsMobile(mobile);
      if (mobile) {
        setCategoryCollapsed(true);
      } else {
        setActionsSheet(false);
        setCatalogSheet(false);
        setControlsSheet(false);
      }
    };
    syncMobile();
    window.addEventListener("resize", syncMobile);
    return () => window.removeEventListener("resize", syncMobile);
  }, []);

  const openOverrideModal = (item, idx) => {
    setOverrideModal({
      open: true,
      productId: item.ProductID,
      newPrice: "",
      managerId: "",
      pin: "",
      error: "",
      idx,
    });
  };

  const applyManualOverride = async () => {
    const { newPrice, managerId, pin, idx } = overrideModal;
    const parsed = Number(newPrice);
    if (Number.isNaN(parsed) || parsed < 0) {
      setOverrideModal((prev) => ({ ...prev, error: "Enter a valid price." }));
      return;
    }
    if (!isAdminUser) {
      if (!managerId || !pin) {
        setOverrideModal((prev) => ({
          ...prev,
          error: "Manager EmployeeID and PIN are required for overrides.",
        }));
        return;
      }
      try {
        await api.post("/api/auth/verify-pin", {
          EmployeeID: managerId,
          Pin: pin,
        });
      } catch (err) {
        const msg = err.response?.data?.error || "PIN verification failed";
        setOverrideModal((prev) => ({ ...prev, error: msg }));
        return;
      }
    }

    setCart((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              OriginalUnitPrice: item.OriginalUnitPrice ?? item.UnitPrice,
              UnitPrice: parsed,
              ManualOverride: true,
              DiscountType: "amount",
              DiscountValue: 0,
            }
          : item
      )
    );
    setOverrideModal({
      open: false,
      productId: null,
      newPrice: "",
      managerId: "",
      pin: "",
      error: "",
      idx: null,
    });
  };

  const renderActionButtons = () => (
    <>
      <button
        className="btn ghost"
        onClick={handleClose}
        title={t("pos.dashboard")}
      >
        <span className="sidebar-icon" aria-hidden="true">
          🏠
        </span>
        <span>{t("pos.dashboard")}</span>
      </button>
      <button
        className="btn ghost"
        onClick={handleLogout}
        title={t("pos.logout")}
      >
        <span className="sidebar-icon logout-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            role="presentation"
            focusable="false"
            width="18"
            height="18"
          >
            <path
              d="M10.5 4.5a.75.75 0 0 0-.75-.75h-4a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h4a.75.75 0 0 0 .75-.75V17a.75.75 0 1 0-1.5 0v2H6a.5.5 0 0 1-.5-.5V5.75A.5.5 0 0 1 6 5.25h3v2a.75.75 0 0 0 1.5 0z"
              fill="currentColor"
            />
            <path
              d="M14.53 8.47a.75.75 0 0 0-1.06 1.06L15.94 12l-2.47 2.47a.75.75 0 1 0 1.06 1.06l3-3a.75.75 0 0 0 0-1.06z"
              fill="currentColor"
            />
            <path
              d="M9.25 12a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H10a.75.75 0 0 1-.75-.75"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>{t("pos.logout")}</span>
      </button>
      <button
        className="btn ghost"
        onClick={() => setCustomerModal(true)}
        onBlur={focusSearchSoon}
      >
        {selectedCustomer?.CustomerName || t("pos.defaultCustomer")}
      </button>
      <button
        className="btn ghost"
        onClick={() => setEmployeeModal(true)}
        onBlur={focusSearchSoon}
      >
        {t("pos.changeEmployee")}
      </button>
      <button
        className="btn ghost"
        onClick={parkTicket}
        disabled={!cart.length || documentType !== "TICKET"}
      >
        {t("pos.parkTicket")}
      </button>
      <button
        className="btn ghost"
        onClick={loadTickets}
        disabled={documentType !== "TICKET"}
        onBlur={focusSearchSoon}
      >
        {t("pos.loadTicket")}
      </button>
      <button
        className="btn ghost"
        onClick={() => {
          setCart([]);
          setStatus({ type: "", message: "" });
          focusSearchSoon();
        }}
        disabled={!cart.length}
      >
        Clear all
      </button>
    </>
  );

  const renderControlsContent = () => (
    <div className="pos-footer-row top-controls">
      <label className="control-inline">
        <span>Document</span>
        <select
          value={documentType}
          onChange={(e) => {
            setDocumentType(e.target.value);
            focusSearchSoon();
          }}
          onBlur={() => focusSearchDelayed(100)}
        >
          {documentTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="control-inline">
        <span>Warehouse</span>
        <select
          value={warehouseId || ""}
          onChange={(e) => {
            const newId = Number(e.target.value);
            if (cart.length > 0 && warehouseRef.current !== newId) {
              setStatus({
                type: "error",
                message: "Clear cart before changing warehouse.",
              });
              setWarehouseId(warehouseRef.current || "");
              focusSearchSoon();
              return;
            }
            setWarehouseId(newId);
            warehouseRef.current = newId;
            focusSearchSoon();
          }}
          onBlur={() => focusSearchDelayed(100)}
          disabled={cart.length > 0}
        >
          {warehouses.map((w) => (
            <option key={w.WarehouseID} value={w.WarehouseID}>
              {w.WarehouseName}
            </option>
          ))}
        </select>
      </label>
      <label className="control-inline">
        <span>Price list</span>
        <select
          value={activePriceListId || ""}
          onChange={(e) => {
            setActivePriceListId(
              e.target.value ? Number(e.target.value) : null
            );
            focusSearchSoon();
          }}
          onBlur={() => focusSearchDelayed(100)}
        >
          <option value="">Base price</option>
          {priceLists.map((pl) => (
            <option key={pl.PriceListID} value={pl.PriceListID}>
              {pl.Name}
            </option>
          ))}
        </select>
      </label>
      <div className="control-inline discount-inline">
        <span>Discount</span>
        <div className="discount-controls">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            disabled={
              Object.keys(promotionOverrides).length > 0 ||
              cart.some((c) => c.ManualOverride)
            }
            title={
              Object.keys(promotionOverrides).length > 0
                ? "Global discount disabled when promo price applies"
                : cart.some((c) => c.ManualOverride)
                ? "Global discount disabled when manual override is active"
                : ""
            }
          >
            <option value="amount">$</option>
            <option value="percent">%</option>
          </select>
          <input
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            min="0"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (searchInputRef.current) {
                  searchInputRef.current.focus();
                }
              }
            }}
            disabled={
              Object.keys(promotionOverrides).length > 0 ||
              cart.some((c) => c.ManualOverride)
            }
            title={
              Object.keys(promotionOverrides).length > 0
                ? "Global discount disabled when promo price applies"
                : cart.some((c) => c.ManualOverride)
                ? "Global discount disabled when manual override is active"
                : ""
            }
          />
        </div>
      </div>
    </div>
  );

  const renderCatalogContent = () => (
    <aside className="catalog-panel card">
      <div className="catalog-header">
        <div className="catalog-actions">
          {activeCategoryId && (
            <>
              <button
                type="button"
                className="icon-btn"
                title="Home"
                onClick={resetCategoryView}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 11L12 3l9 8" />
                  <path d="M9 21V12h6v9" />
                </svg>
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Back to categories"
                onClick={resetCategoryView}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </>
          )}
          <h3>{activeCategoryId ? "Products" : "Categories"}</h3>
        </div>
      </div>
      <div className="catalog-grid">
        {!activeCategoryId &&
          (() => {
            const categoriesToShow =
              (availableCategories && availableCategories.length
                ? availableCategories
                : categories) || [];
            return categoriesToShow.map((cat) => (
              <button
                key={cat.ProductCategoryID || cat.ProductCategoryId || cat.id}
                className="category"
                onClick={() => {
                  setActiveCategoryId(cat.ProductCategoryID || cat.id);
                  focusSearchSoon();
                }}
              >
                <div className="category-icon">📁</div>
                <div className="category-info">
                  <strong>{cat.CategoryName || cat.name}</strong>
                  <span className="muted small">{cat.Description}</span>
                </div>
              </button>
            ));
          })()}
        {activeCategoryId &&
          productsByCategory[activeCategoryId]?.length > 0 &&
          productsByCategory[activeCategoryId].map((product) => {
            const productImage = getProductImageUrl(product);
            const productName = getProductName(product);
            const fallbackInitial =
              (
                productName ||
                getProductSku(product) ||
                getProductBarcode(product) ||
                "?"
              )
                .toString()
                .trim()
                .charAt(0)
                .toUpperCase() || "?";
            return (
              <button
                key={product.ProductID || product.id}
                className="product-btn"
                onClick={() => addProductToCart(product)}
              >
                <div className="product-thumb">
                  {productImage ? (
                    <img src={resolveImg(productImage)} alt={productName} />
                  ) : (
                    <span className="thumb-fallback">{fallbackInitial}</span>
                  )}
                </div>
                <div className="product-info">
                  <strong>{productName}</strong>
                </div>
              </button>
            );
          })}
        {activeCategoryId &&
          productsByCategory[activeCategoryId]?.length === 0 && (
            <p className="muted small">No products in this category.</p>
          )}
      </div>
    </aside>
  );

  const handleRowTouchStart = (lineId, e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    swipeStartRef.current = {
      x: touch.pageX,
      y: touch.pageY,
      id: lineId,
      active: true,
    };
    setSwipingId(lineId);
  };

  const handleRowTouchMove = (lineId, e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const start = swipeStartRef.current;
    if (!start || !start.active || start.id !== lineId) return;
    const dx = touch.pageX - start.x;
    const dy = touch.pageY - start.y;
    if (Math.abs(dy) > 60) return; // vertical scroll, ignore
    // only track left swipe
    const clamped = Math.max(-140, Math.min(0, dx));
    setSwipeOffsets((prev) => ({ ...prev, [lineId]: clamped }));
  };

  const handleRowTouchEnd = (lineId, e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const start = swipeStartRef.current;
    if (!start || start.id !== lineId) return;
    const dx = touch.pageX - start.x;
    const dy = touch.pageY - start.y;
    const shouldDelete = dx < -90 && Math.abs(dy) < 40;
    swipeStartRef.current = { x: 0, y: 0, active: false };
    if (shouldDelete) {
      removeItem(lineId);
      setSwipeOffsets((prev) => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
    } else {
      setSwipeOffsets((prev) => ({ ...prev, [lineId]: 0 }));
    }
    setSwipingId(null);
  };

  // Mobile: swipe up/down on qty pill to adjust whole numbers
  const handleQtyTouchStart = (lineId, e) => {
    e.stopPropagation();
    const touch = e.touches?.[0];
    if (touch) {
      qtyTouchStartRef.current[lineId] = touch.clientY;
    }
  };

  const handleQtyTouchEnd = (lineId, e) => {
    e.stopPropagation();
    const startY = qtyTouchStartRef.current[lineId];
    const touch = e.changedTouches?.[0];
    if (startY === undefined || !touch) return;
    const deltaY = startY - touch.clientY;
    const threshold = 12;
    if (deltaY > threshold) {
      updateQuantity(lineId, 1);
    } else if (deltaY < -threshold) {
      updateQuantity(lineId, -1);
    }
    delete qtyTouchStartRef.current[lineId];
  };

  useEffect(() => {
    if (authLoading || !token || dataLoaded) return;
    loadInitialData();
  }, [authLoading, token, dataLoaded]);

  useEffect(() => {
    if (authLoading || !token || defaultCustomerFetched) return;
    // Use a local fallback without hitting the API to avoid 404 noise
    const fallback = { CustomerID: 1, CustomerName: "Default Customer" };
    setDefaultCustomer(fallback);
    setSelectedCustomer((prev) => prev || fallback);
    setDefaultCustomerFetched(true);
  }, [authLoading, token, defaultCustomerFetched]);

  useEffect(() => {
    if (authLoading || !token) return;
    const loadPromotions = async () => {
      setPromotionsLoading(true);
      try {
        const { data } = await api.get("/api/promotions");
        setPromotions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load promotions", err);
      } finally {
        setPromotionsLoading(false);
      }
    };
    loadPromotions();
  }, [authLoading, token]);

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const { data } = await api.get("/api/products", {
        params: { ts: Date.now() },
      });
      const list = Array.isArray(data)
        ? data
        : data?.items || data?.products || data?.data || [];
      setAllProducts(list);
      return list;
    } catch (error) {
      console.error("Failed to fetch products", error);
      return [];
    } finally {
      setProductsLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      const [
        productRes,
        categoryRes,
        taxRes,
        employeeRes,
        warehouseRes,
        priceListRes,
        paymentMethodsRes,
      ] = await Promise.all([
        api.get("/api/products", { params: { ts: Date.now() } }),
        api.get("/api/categories"),
        api.get("/api/tax-rates").catch(() => ({ data: [] })),
        api.get("/api/employees"),
        api.get("/api/warehouses"),
        api.get("/api/price-lists").catch(() => ({ data: [] })),
        api.get("/api/payment-methods").catch(() => ({ data: [] })),
      ]);
      const productList = Array.isArray(productRes.data)
        ? productRes.data
        : productRes.data?.items ||
          productRes.data?.products ||
          productRes.data?.data ||
          [];
      setAllProducts(productList);
      setCategories(categoryRes.data);
      const rateList = Array.isArray(taxRes?.data) ? taxRes.data : [];
      setTaxRates(rateList);
      setEmployees(employeeRes.data);
      setWarehouses(warehouseRes.data);
      setPaymentMethods(
        Array.isArray(paymentMethodsRes.data) ? paymentMethodsRes.data : []
      );
      const defaultWh = warehouseRes.data[0]?.WarehouseID || null;
      setWarehouseId(defaultWh);
      warehouseRef.current = defaultWh;
      setSelectedEmployee(
        employeeRes.data.find((e) => e.EmployeeID === user?.EmployeeID) ||
          employeeRes.data[0] ||
          null
      );
      const plList = Array.isArray(priceListRes.data) ? priceListRes.data : [];
      setPriceLists(plList);
      setActivePriceListId(null); // default to base price
      setPriceListInitialized(true);
      setDataLoaded(true);
      // default availability to all products until warehouse fetch runs
      setAvailableProductIds(
        new Set(
          productList
            .map((p) => normalizeId(getProductId(p)))
            .filter((id) => id)
        )
      );
    } catch (error) {
      console.error("Failed to load POS data", error);
      setStatus({
        type: "error",
        message: "Failed to load data. Please try reloading the POS.",
      });
      setDataLoaded(true);
    }
  };

  useEffect(() => {
    if (!configReady) {
      setCategoryWidth(40);
      setCategoryCollapsed(false);
      setLayoutReady(false);
      return;
    }
  }, [configReady]);

  useEffect(() => {
    if (!configReady) return;
    const width = Number(config?.pos?.categoryWidth);
    if (width >= 20 && width <= 60) {
      setCategoryWidth(width);
    }
    if (typeof config?.pos?.categoryCollapsed === "boolean") {
      setCategoryCollapsed(config.pos.categoryCollapsed);
    }
    setLayoutReady(true);
  }, [config, configReady]);

  useEffect(() => {
    if (!layoutReady || !configReady) return;
    const current = config?.pos || {};
    const unchanged =
      current.categoryWidth === categoryWidth &&
      current.categoryCollapsed === categoryCollapsed;
    if (unchanged) return;
    const handler = setTimeout(() => {
      updateConfig({
        pos: {
          categoryWidth,
          categoryCollapsed,
        },
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [
    categoryWidth,
    categoryCollapsed,
    layoutReady,
    configReady,
    config,
    updateConfig,
  ]);

  useEffect(() => {
    if (!configReady || docInit) return;
    const raw = config?.pos?.documentType;
    if (typeof raw === "string" && raw.trim()) {
      setDocumentType(raw.trim().toUpperCase());
    }
    setDocInit(true);
  }, [config, configReady, docInit]);

  useEffect(() => {
    if (!company) {
      setCompanyLogo(null);
      return;
    }
    const logo =
      company.LogoUrl ||
      company.CompanyLogo ||
      company.logo ||
      company.logoUrl ||
      "";
    const trimmed = logo ? logo.toString().trim() : "";
    setCompanyLogo(trimmed || null);
  }, [company]);

  useEffect(() => {
    if (!configReady || !documentType) return;
    const current = (config?.pos?.documentType || "").toUpperCase();
    if (current === documentType) return;
    updateConfig({
      pos: {
        documentType,
      },
    });
  }, [documentType, config, configReady, updateConfig]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (clientX) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const leftMin = 520;
      const rightMin = 280;
      const x = clientX - rect.left;
      const clampedLeft = Math.min(Math.max(x, leftMin), rect.width - rightMin);
      const rightPct = Math.round(
        ((rect.width - clampedLeft) / rect.width) * 100
      );
      const boundedPct = Math.min(60, Math.max(20, rightPct));
      setCategoryWidth(boundedPct);
    };
    const onMouseMove = (e) => handleMove(e.clientX);
    const onTouchMove = (e) => {
      if (e.touches?.[0]) handleMove(e.touches[0].clientX);
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isResizing]);

  useEffect(() => {
    let active = true;
    const normalize = (value) => (value ?? "").toString().trim().toLowerCase();
    const getName = (p) =>
      p.ProductName ?? p.productName ?? p.Name ?? p.name ?? "";
    const getSku = (p) => p.SKU ?? p.Sku ?? p.sku ?? "";
    const getBarcode = (p) => p.Barcode ?? p.barcode ?? "";

    const search = async () => {
      if (!searchTerm) {
        setSearchResults([]);
        return;
      }

      let products = availableProducts.length ? availableProducts : [];

      if (products.length === 0 && !productsLoading) {
        products = await fetchProducts();
      }

      const term = normalize(searchTerm);
      const localMatches = products
        .filter(
          (p) =>
            normalize(getName(p)).includes(term) ||
            normalize(getSku(p)).includes(term) ||
            normalize(getBarcode(p)).includes(term)
        )
        .slice(0, 20);

      if (localMatches.length > 0) {
        if (active) setSearchResults(localMatches);
      } else {
        try {
          const { data } = await api.get("/api/products", {
            params: { q: searchTerm, ts: Date.now() },
          });
          const list = Array.isArray(data)
            ? data
            : data?.items || data?.products || data?.data || [];
          const filtered = availableProducts.length
            ? list.filter((p) => isProductAvailable(getProductId(p)))
            : list;
          if (active) setSearchResults(filtered.slice(0, 20));
        } catch (error) {
          console.warn("Search failed", error);
          if (active) setSearchResults([]);
        }
      }
    };

    const handler = setTimeout(search, 200);
    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [searchTerm, allProducts, productsLoading]);

  useEffect(() => {
    setHighlightIndex(-1);
    resultRefs.current = [];
  }, [searchResults]);

  useEffect(() => {
    if (highlightIndex < 0) return;
    const el = resultRefs.current[highlightIndex];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  useEffect(() => {
    if (!customerLookup) {
      setCustomerResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        const { data } = await api.get(
          `/api/customers?q=${encodeURIComponent(customerLookup)}`
        );
        setCustomerResults(data.slice(0, 10));
      } catch (error) {
        console.warn("Failed to search customers", error);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [customerLookup]);

  useEffect(() => {
    const loadTiers = async () => {
      if (!activePriceListId) {
        setPriceTiers({});
        return;
      }
      try {
        const res = await api.get(
          `/api/price-lists/${activePriceListId}/items`
        );
        const list = Array.isArray(res.data) ? res.data : [];
        setPriceTiers(buildPriceTierMap(list));
      } catch (err) {
        console.warn("Failed to load price list items", err);
        setPriceTiers({});
      }
    };
    loadTiers();
  }, [activePriceListId]);

  useEffect(() => {
    // Recompute cart prices when tiers change
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        UnitPrice: item.IsPackComponent
          ? item.UnitPrice
          : computePrice(item.ProductID, item.Quantity),
      }))
    );
  }, [priceTiers]);

  const buildPriceTierMap = (items = []) => {
    const map = {};
    items.forEach((i) => {
      const pid = Number(i.ProductID);
      if (!map[pid]) map[pid] = [];
      map[pid].push({
        MinQty: Number(i.MinQty || 1),
        Price: Number(i.Price || 0),
      });
    });
    Object.keys(map).forEach((k) => {
      map[k] = map[k].sort((a, b) => Number(b.MinQty) - Number(a.MinQty));
    });
    return map;
  };

  const computePrice = (productId, qty) => {
    const tiers = priceTiers[productId];
    let price;
    if (tiers && tiers.length) {
      const match = tiers.find((t) => qty >= Number(t.MinQty));
      if (match) price = Number(match.Price);
    }
    if (price === undefined) {
      const product = allProducts.find((p) => getProductId(p) === productId);
      price = getProductPrice(product);
    }
    return Number(price || 0);
  };

  const computeTaxForProduct = (product) => {
    const taxable = product?.IsTaxable;
    if (!taxable) return { rateId: null, ratePerc: 0, isTaxable: 0 };
    const prodRateId = product?.TaxRateID || null;
    const prodRatePerc =
      product?.TaxRatePercentage != null
        ? Number(product.TaxRatePercentage)
        : null;
    const rate = taxRates.find(
      (r) => Number(r.TaxRateID) === Number(prodRateId)
    );
    if (rate)
      return {
        rateId: rate.TaxRateID,
        ratePerc: Number(rate.RatePercentage || 0),
        isTaxable: 1,
      };
    if (prodRatePerc != null)
      return { rateId: null, ratePerc: prodRatePerc, isTaxable: 1 };
    const defaultId = config?.tax?.defaultTaxRateId;
    if (defaultId) {
      const cfgRate = taxRates.find(
        (r) => Number(r.TaxRateID) === Number(defaultId)
      );
      if (cfgRate)
        return {
          rateId: cfgRate.TaxRateID,
          ratePerc: Number(cfgRate.RatePercentage || 0),
          isTaxable: 1,
        };
    }
    const def = taxRates.find((r) => r.IsDefault) || taxRates[0];
    if (def)
      return {
        rateId: def.TaxRateID,
        ratePerc: Number(def.RatePercentage || 0),
        isTaxable: 1,
      };
    return { rateId: null, ratePerc: 0, isTaxable: 1 };
  };

  const getEffectiveWarehouseId = () =>
    warehouseId || warehouseRef.current || warehouses[0]?.WarehouseID || null;

  const fetchFefoLot = async (productId) => {
    const effectiveWarehouseId = getEffectiveWarehouseId();
    if (!productId || !effectiveWarehouseId) return null;
    try {
      const { data } = await api.get("/api/product-lots/fefo", {
        params: { productId, warehouseId: effectiveWarehouseId },
      });
      return data || null;
    } catch (err) {
      return null;
    }
  };

  const fetchLotsForProduct = async (productId) => {
    const effectiveWarehouseId = getEffectiveWarehouseId();
    if (!productId || !effectiveWarehouseId) return [];
    try {
      const { data } = await api.get("/api/product-lots", {
        params: { productId, warehouseId: effectiveWarehouseId, includeZero: 1 },
      });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  };

  const fetchSerialsForProduct = async (productId) => {
    if (!productId) return [];
    try {
      const { data } = await api.get("/api/product-serials", {
        params: { productId, status: "InStock" },
      });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      return [];
    }
  };

  const applyLotToLine = (lineId, lot) => {
    setCart((prev) =>
      prev.map((item) =>
        item.LineID === lineId
          ? {
              ...item,
              ProductLotID: lot?.ProductLotID || null,
              LotNumber: lot?.LotNumber || null,
              LotExpirationDate: lot?.ExpirationDate || null,
            }
          : item
      )
    );
  };

  const applySerialToLine = (lineId, serial) => {
    setCart((prev) =>
      prev.map((item) =>
        item.LineID === lineId
          ? {
              ...item,
              ProductSerialID: serial?.ProductSerialID || null,
              SerialNumber: serial?.SerialNumber || null,
            }
          : item
      )
    );
  };

  const removeLineById = (lineId) => {
    setCart((prev) => {
      const target = prev.find((item) => getLineId(item) === lineId);
      if (!target) return prev;
      if (target.PackGroupId) {
        return prev.filter((item) => item.PackGroupId !== target.PackGroupId);
      }
      return prev.filter((item) => getLineId(item) !== lineId);
    });
  };

  const isProductAvailable = (productId) => {
    if (!availableProductIds || availableProductIds.size === 0) return true;
    return availableProductIds.has(normalizeId(productId));
  };

  useEffect(() => {
    // When warehouse changes, load inventory levels and restrict products to those with stock
    const loadAvailability = async () => {
      if (!warehouseId) {
        setAvailableProductIds(
          new Set(
            allProducts.map((p) => normalizeId(getProductId(p))).filter(Boolean)
          )
        );
        return;
      }
      try {
        const { data } = await api.get("/api/inventory/levels", {
          params: { warehouseId, includeZero: 1 },
        });
        const rows = Array.isArray(data) ? data : [];
        const withStock = rows.filter((r) => Number(r.StockQuantity || 0) > 0);
        const ids = withStock
          .map((r) => normalizeId(r.ProductID))
          .filter(Boolean);
        if (withStock.length > 0) {
          const idSet = new Set(ids);
          const filtered = allProducts.filter((p) =>
            idSet.has(normalizeId(getProductId(p)))
          );
          if (filtered.length === 0) {
            // if there is a mismatch, do not blank the UI
            const allIds = new Set(
              allProducts
                .map((p) => normalizeId(getProductId(p)))
                .filter(Boolean)
            );
            setAvailableProductIds(allIds);
            // keep allProducts so user can still sell
          } else {
            setAvailableProductIds(idSet);
          }
        } else {
          // fallback to all products if no stock rows returned
          const idSet = new Set(
            allProducts.map((p) => normalizeId(getProductId(p))).filter(Boolean)
          );
          setAvailableProductIds(idSet);
        }
      } catch (err) {
        console.warn("Failed to load warehouse availability", err);
        const idSet = new Set(
          allProducts.map((p) => normalizeId(getProductId(p))).filter(Boolean)
        );
        setAvailableProductIds(idSet);
      }
    };
    loadAvailability();
  }, [warehouseId, allProducts]);

  // Derive availableProducts from IDs + allProducts, fallback to all if no IDs
  const availableProducts = useMemo(() => {
    if (!availableProductIds || availableProductIds.size === 0)
      return allProducts;
    const filtered = allProducts.filter((p) =>
      availableProductIds.has(normalizeId(getProductId(p)))
    );
    return filtered.length > 0 ? filtered : allProducts;
  }, [allProducts, availableProductIds]);

  const availableCategories = useMemo(() => {
    const source = availableProducts.length ? availableProducts : allProducts;
    if (!categories || categories.length === 0) return [];
    const catIds = new Set(
      source.map((p) => getCategoryKey(getProductCategoryId(p)))
    );
    const hasUncategorized = catIds.has(UNCATEGORIZED_ID);
    // Prefer categories that have available products; if none matched, fall back to all known categories
    const filtered = categories.filter((c) =>
      catIds.size ? catIds.has(getCategoryKey(c.ProductCategoryID)) : true
    );
    const baseCategories = filtered.length ? filtered : categories;
    if (hasUncategorized) {
      return [
        ...baseCategories,
        { ProductCategoryID: UNCATEGORIZED_ID, CategoryName: "Uncategorized" },
      ];
    }
    return baseCategories;
  }, [availableProducts, allProducts, categories]);

  const productsByCategory = useMemo(() => {
    const map = {};
    (availableProducts.length ? availableProducts : allProducts).forEach(
      (product) => {
        const key = getCategoryKey(getProductCategoryId(product));
        if (!map[key]) map[key] = [];
        map[key].push(product);
      }
    );
    return map;
  }, [availableProducts, allProducts]);

  const buildCartItem = (product, quantity, options = {}) => {
    const productId = getProductId(product);
    const qty = normalizeQty(Number(quantity || 1));
    const tax = computeTaxForProduct(product);
    const usesLots = options.usesLots ?? Number(product?.UsesLots || 0);
    const usesSerials = options.usesSerials ?? Number(product?.UsesSerials || 0);
    const price =
      options.unitPriceOverride !== undefined && options.unitPriceOverride !== null
        ? Number(options.unitPriceOverride)
        : computePrice(productId, qty);
    return {
      LineID: options.lineId || makeLineId(),
      ProductID: productId,
      ProductName: getProductName(product),
      SKU: getProductSku(product),
      UnitPrice: price,
      Quantity: qty,
      DiscountType: "percent",
      DiscountValue: 0,
      TaxRateID: options.taxRateId ?? tax.rateId,
      TaxRatePercentage: options.taxRatePerc ?? tax.ratePerc,
      IsTaxable: options.isTaxable ?? tax.isTaxable,
      UsesLots: usesLots ? 1 : 0,
      ProductLotID: options.lotId || null,
      LotNumber: options.lotNumber || null,
      LotExpirationDate: options.lotExpiration || null,
      UsesSerials: usesSerials ? 1 : 0,
      ProductSerialID: options.serialId || null,
      SerialNumber: options.serialNumber || null,
      IsPack: options.isPack || false,
      IsPackComponent: options.isPackComponent || false,
      PackGroupId: options.packGroupId || null,
      PackParentId: options.packParentId || null,
      PackParentName: options.packParentName || null,
      PackComponentQty: options.packComponentQty || null,
    };
  };

  const addLineItem = (product, quantity, options = {}) => {
    const productId = getProductId(product);
    if (!productId) {
      setStatus({
        type: "error",
        message: "Unable to add product (missing ID).",
      });
      return null;
    }
    if (!isProductAvailable(productId)) {
      setStatus({
        type: "error",
        message: "Product not available in this warehouse.",
      });
      return null;
    }
    const qty = normalizeQty(Number(quantity || 1));
    const usesLots = options.usesLots ?? Number(product?.UsesLots || 0);
    const usesSerials = options.usesSerials ?? Number(product?.UsesSerials || 0);
    const lotId = options.lotId || null;
    const serialNumber = options.serialNumber || null;
    let createdLine = null;
    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.ProductID === productId &&
          !item.PackGroupId &&
          (!usesLots || item.ProductLotID === lotId) &&
          (!usesSerials || item.SerialNumber === serialNumber)
      );
      if (existing) {
        const nextQty = normalizeQty(existing.Quantity + qty);
        const updated = prev.map((item) =>
          item.LineID === existing.LineID
            ? {
                ...item,
                Quantity: nextQty,
                UnitPrice: computePrice(productId, nextQty),
              }
            : item
        );
        createdLine = { ...existing, Quantity: nextQty };
        return updated;
      }
      const newLine = buildCartItem(product, qty, {
        ...options,
        usesLots,
        lotId,
        usesSerials,
        serialNumber,
      });
      createdLine = newLine;
      return [...prev, newLine];
    });
    return createdLine;
  };

  const addPackToCart = async (product, components) => {
    const productId = getProductId(product);
    if (!productId) {
      setStatus({
        type: "error",
        message: "Unable to add product (missing ID).",
      });
      return;
    }
    const effectiveWarehouseId = getEffectiveWarehouseId();
    if (!effectiveWarehouseId) {
      setStatus({
        type: "error",
        message: "Select a warehouse before adding items.",
      });
      return;
    }
    if (!isProductAvailable(productId)) {
      setStatus({
        type: "error",
        message: "Product not available in this warehouse.",
      });
      return;
    }
    const unavailable = components.find(
      (row) => !isProductAvailable(row.ComponentProductID)
    );
    if (unavailable) {
      setStatus({
        type: "error",
        message: "Pack component not available in this warehouse.",
      });
      return;
    }

    let packLot = null;
    if (Number(product?.UsesLots || 0) === 1) {
      packLot = await fetchFefoLot(productId);
      if (!packLot) {
        setStatus({
          type: "error",
          message: "No available lot for this pack product.",
        });
        return;
      }
    }

    const componentLotMap = new Map();
    for (const row of components) {
      const componentProduct =
        allProducts.find((p) => getProductId(p) === Number(row.ComponentProductID)) ||
        null;
      if (!componentProduct || Number(componentProduct?.UsesLots || 0) !== 1) continue;
      const lot = await fetchFefoLot(Number(row.ComponentProductID));
      if (!lot) {
        setStatus({
          type: "error",
          message: `No available lot for ${componentProduct.ProductName || "component"}.`,
        });
        return;
      }
      componentLotMap.set(Number(row.ComponentProductID), lot);
    }

    setCart((prev) => {
      const existingPack = prev.find(
        (item) => item.IsPack && item.ProductID === productId
      );
      if (existingPack) {
        const nextQty = normalizeQty(existingPack.Quantity + 1);
        return prev
          .map((item) => {
            if (item.LineID === existingPack.LineID) {
              return {
                ...item,
                Quantity: nextQty,
                UnitPrice: computePrice(productId, nextQty),
              };
            }
            if (item.PackGroupId === existingPack.PackGroupId) {
              return {
                ...item,
                Quantity: normalizeQty(nextQty * (item.PackComponentQty || 1)),
              };
            }
            return item;
          })
          .filter((item) => item.Quantity > 0);
      }

      const packGroupId = makeLineId();
      const packLine = buildCartItem(product, 1, {
        packGroupId,
        isPack: true,
        usesLots: Number(product?.UsesLots || 0) === 1,
        usesSerials: Number(product?.UsesSerials || 0) === 1,
        lotId: packLot?.ProductLotID || null,
        lotNumber: packLot?.LotNumber || null,
        lotExpiration: packLot?.ExpirationDate || null,
      });
      const componentLines = components
        .map((row) => {
          const componentProduct =
            allProducts.find(
              (p) => getProductId(p) === Number(row.ComponentProductID)
            ) || {
              ProductID: row.ComponentProductID,
              ProductName: row.ProductName,
              SKU: row.SKU,
              IsTaxable: row.IsTaxable,
              TaxRateID: row.TaxRateID,
              TaxRatePercentage: row.TaxRatePercentage,
            };
          const qty = Number(row.ComponentQuantity || 0);
          if (qty <= 0) return null;
          const componentLot = componentLotMap.get(Number(row.ComponentProductID));
          const usesLots = Number(componentProduct?.UsesLots || 0) === 1;
          const usesSerials = Number(componentProduct?.UsesSerials || 0) === 1;
          return buildCartItem(componentProduct, qty, {
            packGroupId,
            packParentId: productId,
            packParentName: getProductName(product),
            packComponentQty: qty,
            isPackComponent: true,
            unitPriceOverride: 0,
            isTaxable: 0,
            taxRateId: null,
            taxRatePerc: 0,
            usesLots,
            usesSerials,
            lotId: componentLot?.ProductLotID || null,
            lotNumber: componentLot?.LotNumber || null,
            lotExpiration: componentLot?.ExpirationDate || null,
          });
        })
        .filter(Boolean);
      return [...prev, packLine, ...componentLines];
    });
  };

  const addProductToCart = async (product) => {
    const productId = getProductId(product);
    if (!productId) {
      setStatus({
        type: "error",
        message: "Unable to add product (missing ID).",
      });
      return;
    }

    let components = [];
    try {
      const res = await api.get(`/api/product-packs/${productId}`);
      components = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      components = [];
    }

    if (components.length) {
      await addPackToCart(product, components);
    } else {
      const usesLots = Number(product?.UsesLots || 0) === 1;
      const usesSerials = Number(product?.UsesSerials || 0) === 1;
      if (usesLots || usesSerials) {
        if (!getEffectiveWarehouseId()) {
          setStatus({
            type: "error",
            message: "Select a warehouse before adding items.",
          });
          return;
        }
        const addedLine = addLineItem(product, 1, {
          usesLots,
          usesSerials,
        });
        if (!addedLine) return;
        if (usesLots) {
          await openLotModalForItem({ ...addedLine, UsesLots: 1 });
        } else if (usesSerials) {
          await openSerialModalForLine({ ...addedLine, UsesSerials: 1 });
        }
      } else {
        const added = addLineItem(product, 1);
        if (!added) return;
      }
    }
    setSearchTerm("");
    setSearchResults([]);
    focusSearchSoon();
  };

  const updateQuantity = (lineId, delta) => {
    setCart((prev) => {
      const target = prev.find((item) => getLineId(item) === lineId);
      if (!target || target.IsPackComponent) return prev;
      if (target.UsesSerials && delta > 0) {
        setStatus({
          type: "error",
          message: "Add another serial by adding the item again.",
        });
        return prev;
      }
      const nextQty = normalizeQty((target.Quantity || 0) + delta);
      if (nextQty <= 0 && target.PackGroupId) {
        return prev.filter((item) => item.PackGroupId !== target.PackGroupId);
      }
      return prev
        .map((item) => {
          if (target.PackGroupId && item.PackGroupId === target.PackGroupId) {
            if (item.IsPack) {
              return {
                ...item,
                Quantity: nextQty,
                UnitPrice: computePrice(item.ProductID, nextQty),
              };
            }
            if (item.IsPackComponent) {
              return {
                ...item,
                Quantity: normalizeQty(nextQty * (item.PackComponentQty || 1)),
              };
            }
          }
          if (!target.PackGroupId && getLineId(item) === lineId) {
            return {
              ...item,
              Quantity: nextQty,
              UnitPrice: computePrice(item.ProductID, nextQty),
            };
          }
          return item;
        })
        .filter((item) => item.Quantity > 0);
    });
  };

  const setQuantityValue = (lineId, value) => {
    const qty = Math.max(0, Math.floor(Number(value) || 0));
    setCart((prev) => {
      const target = prev.find((item) => getLineId(item) === lineId);
      if (!target || target.IsPackComponent) return prev;
      if (target.UsesSerials && qty > 1) {
        setStatus({
          type: "error",
          message: "Serial-tracked items must be 1 per line.",
        });
        return prev;
      }
      if (qty <= 0 && target.PackGroupId) {
        return prev.filter((item) => item.PackGroupId !== target.PackGroupId);
      }
      return prev
        .map((item) => {
          if (target.PackGroupId && item.PackGroupId === target.PackGroupId) {
            if (item.IsPack) {
              return {
                ...item,
                Quantity: normalizeQty(qty),
                UnitPrice: computePrice(item.ProductID, normalizeQty(qty)),
              };
            }
            if (item.IsPackComponent) {
              return {
                ...item,
                Quantity: normalizeQty(qty * (item.PackComponentQty || 1)),
              };
            }
          }
          if (!target.PackGroupId && getLineId(item) === lineId) {
            return {
              ...item,
              Quantity: normalizeQty(qty),
              UnitPrice: computePrice(item.ProductID, normalizeQty(qty)),
            };
          }
          return item;
        })
        .filter((item) => item.Quantity > 0);
    });
  };

  const updateLineDiscountValue = (lineId, value) => {
    const val = Math.max(0, Number(value) || 0);
    setCart((prev) =>
      prev.map((item) =>
        getLineId(item) === lineId ? { ...item, DiscountValue: val } : item
      )
    );
  };

  const updateLineDiscountType = (lineId, type) => {
    const nextType = type === "amount" ? "amount" : "percent";
    setCart((prev) =>
      prev.map((item) =>
        getLineId(item) === lineId ? { ...item, DiscountType: nextType } : item
      )
    );
  };

  const openLotModalForItem = async (item) => {
    const effectiveWarehouseId = getEffectiveWarehouseId();
    if (!effectiveWarehouseId) {
      setStatus({ type: "error", message: "Select a warehouse first." });
      return;
    }
    setLotModalError("");
    setLotModalLoading(true);
    try {
      if (item.IsPack) {
        const packLines = cart.filter(
          (line) => line.PackGroupId === item.PackGroupId && line.UsesLots
        );
        if (packLines.length === 0) {
          setLotModalError("No lot-tracked items in this pack.");
          return;
        }
        const optionsByLine = {};
        for (const line of packLines) {
          optionsByLine[line.LineID] = await fetchLotsForProduct(line.ProductID);
        }
        setLotOptionsByLine(optionsByLine);
        setLotOptions([]);
        setLotModal({
          open: true,
          mode: "pack",
          lineId: null,
          packGroupId: item.PackGroupId,
        });
        return;
      }
      const options = await fetchLotsForProduct(item.ProductID);
      setLotOptions(options);
      setLotOptionsByLine({});
      setLotSearch("");
      setLotHighlight(0);
      setLotModal({
        open: true,
        mode: "single",
        lineId: item.LineID,
        packGroupId: null,
      });
      if (options.length === 0) {
        setLotModalError("No lots found for this product.");
      }
    } finally {
      setLotModalLoading(false);
    }
  };

  const openSerialModalForLine = async (line) => {
    setSerialModalError("");
    setSerialModalLoading(true);
    try {
      const options = await fetchSerialsForProduct(line.ProductID);
      setSerialOptions(options);
      setSerialSearch("");
      setSerialHighlight(0);
      setSerialModal({ open: true, lineId: line.LineID });
      if (options.length === 0) {
        setSerialModalError("No serials found for this product.");
        removeLineById(line.LineID);
        setSerialModal({ open: false, lineId: null });
        setStatus({
          type: "error",
          message: "No serials available for this product.",
        });
      }
    } catch (err) {
      console.error("Failed to load serials", err);
      setSerialModalError("Failed to load serials.");
    } finally {
      setSerialModalLoading(false);
    }
  };

  const closeSerialModal = () => {
    setSerialModal({ open: false, lineId: null });
    setSerialOptions([]);
    setSerialModalError("");
  };

  const closeLotModal = () => {
    setLotModal({ open: false, mode: "single", lineId: null, packGroupId: null });
    setLotOptions([]);
    setLotOptionsByLine({});
    setLotModalError("");
  };

  const removeItem = (lineId) => {
    setCart((prev) => {
      const target = prev.find((item) => getLineId(item) === lineId);
      if (!target) return prev;
      if (target.PackGroupId) {
        return prev.filter((item) => item.PackGroupId !== target.PackGroupId);
      }
      return prev.filter((item) => getLineId(item) !== lineId);
    });
  };

  const loadTicketByNumber = async (code) => {
    const normalizedCode = normalizeTicketCode(code);
    try {
      const { data } = await api.get(
        `/api/sales/tickets/by-number/${encodeURIComponent(normalizedCode)}`
      );
      if (data?.items) {
        setCart(
          data.items.map((item) => {
            const prod =
              allProducts.find((p) => getProductId(p) === item.ProductID) ||
              item;
            const tax = computeTaxForProduct(prod);
            return {
              LineID: makeLineId(),
              ProductID: item.ProductID,
              ProductName: item.Description || getProductName(item),
              SKU: getProductSku(item),
              UnitPrice: computePrice(
                item.ProductID,
                normalizeQty(item.Quantity)
              ),
              Quantity: normalizeQty(item.Quantity),
              TaxRateID: item.TaxRateID || tax.rateId || null,
              TaxRatePercentage: item.TaxRatePercentage ?? tax.ratePerc ?? 0,
              IsTaxable: item.IsTaxable ?? tax.isTaxable ?? 0,
            };
          })
        );
      }
      if (data?.header?.CustomerID) {
        setSelectedCustomer({
          CustomerID: data.header.CustomerID,
          CustomerName: data.header.CustomerName || "Ticket Customer",
        });
      }
      if (data?.header?.DiscountAmountTotal != null) {
        setDiscountType("amount");
        setDiscountValue(Number(data.header.DiscountAmountTotal) || 0);
      }
      if (data?.header?.WarehouseID) {
        setWarehouseId(Number(data.header.WarehouseID));
      }
      setLoadedTicketId(data?.header?.TicketID || null);
      setStatus({ type: "success", message: "Ticket loaded from scan." });
      setSearchResults([]);
      setSearchTerm("");
      setHighlightIndex(-1);
    } catch (error) {
      const message =
        error.response?.data?.error || "Ticket not found for this code.";
      setStatus({ type: "error", message });
    }
  };

  const priceIncludesTax = !!config?.tax?.priceIncludesTax;

  const computeLineDiscountAmount = (item) => {
    const gross = Number(item.UnitPrice) * Number(item.Quantity);
    if (gross <= 0) return 0;
    if (item.DiscountType === "amount") {
      return Math.min(gross, Math.max(0, Number(item.DiscountValue) || 0));
    }
    const pct = Math.max(0, Math.min(100, Number(item.DiscountValue) || 0));
    return (gross * pct) / 100;
  };

  const computePromotionsDiscount = useMemo(() => {
    const normalizeList = (val) => {
      if (!val) return [];
      if (Array.isArray(val))
        return val.map((v) => String(v).trim()).filter(Boolean);
      return String(val)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    };

    const eq = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
    const dayCodes = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayCode = dayCodes[new Date().getDay()];
    const channel = "POS";

    const lineNet = (item) => {
      const gross = Number(item.UnitPrice) * Number(item.Quantity);
      const lineDisc = computeLineDiscountAmount(item);
      return Math.max(0, gross - lineDisc);
    };

    const parsedPromos = (promotions || []).map((p) => {
      const scopes = p.scopes || p.scope || {};
      return {
        id: p.id || p.PromotionID,
        name: p.name || p.Name || "Promotion",
        enabled: p.enabled ?? p.Enabled ?? true,
        type: p.type || p.Type || "percent",
        value: Number(p.value ?? p.Value ?? 0),
        unitPrice: p.unitPrice ?? p.UnitPrice ?? null,
        priority: p.priority ?? p.Priority ?? 0,
        stackable: p.stackable ?? p.Stackable ?? true,
        minQuantity: p.minQuantity ?? p.MinQuantity ?? null,
        perOrderLimit: p.perOrderLimit ?? null,
        perCustomerLimit: p.perCustomerLimit ?? null,
        totalRedemptions: p.totalRedemptions ?? null,
        startAt: p.startAt || p.StartAt || null,
        endAt: p.endAt || p.EndAt || null,
        timezone: p.timezone || p.Timezone || null,
        scopes: {
          categories: normalizeList(scopes.categories),
          products: normalizeList(scopes.products),
          customers: normalizeList(scopes.customers),
          brands: normalizeList(scopes.brands),
          employees: normalizeList(scopes.employees),
          customFields: normalizeList(scopes.customFields),
          channels: normalizeList(scopes.channels),
          days: normalizeList(scopes.days),
        },
      };
    });

    const cartLines = (cart || []).map((line, idx) => ({
      ...line,
      __idx: idx,
    }));
    const customerName =
      selectedCustomer?.CustomerName ||
      selectedCustomer?.Name ||
      selectedCustomer?.name ||
      selectedCustomer?.Email ||
      null;
    const employeeName =
      selectedEmployee?.FirstName ||
      selectedEmployee?.Name ||
      selectedEmployee?.name ||
      selectedEmployee?.Email ||
      null;

    const now = new Date();
    const applied = [];
    const ordered = parsedPromos
      .filter((p) => p.enabled)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const matchLine = (line, scopes) => {
      const productName =
        line.ProductName ||
        line.productName ||
        line.Name ||
        line.name ||
        line.SKU ||
        line.Sku ||
        "";
      const categoryName =
        line.CategoryName || line.categoryName || line.Category || "";
      const brandName = line.BrandName || line.brandName || "";

      const checks = [];
      if (scopes.categories.length)
        checks.push(scopes.categories.some((c) => eq(c, categoryName)));
      if (scopes.products.length)
        checks.push(scopes.products.some((p) => eq(p, productName)));
      if (scopes.brands.length)
        checks.push(scopes.brands.some((b) => eq(b, brandName)));
      return checks.length ? checks.some(Boolean) : true;
    };

    let totalDiscount = 0;
    const overrides = {};
    for (const promo of ordered) {
      if (promo.startAt && now < new Date(promo.startAt)) continue;
      if (promo.endAt && now > new Date(promo.endAt)) continue;
      if (promo.scopes.days.length && !promo.scopes.days.includes(todayCode))
        continue;
      if (
        promo.scopes.channels.length &&
        !promo.scopes.channels.includes(channel)
      )
        continue;
      if (promo.scopes.customers.length) {
        if (!customerName) continue;
        if (!promo.scopes.customers.some((c) => eq(c, customerName))) continue;
      }
      if (promo.scopes.employees.length) {
        if (!employeeName) continue;
        if (!promo.scopes.employees.some((e) => eq(e, employeeName))) continue;
      }

      const eligibleLines = cartLines.filter((line) =>
        matchLine(line, promo.scopes)
      );
      if (!eligibleLines.length) continue;

      const qtyTotal = eligibleLines.reduce(
        (sum, line) => sum + Number(line.Quantity || 0),
        0
      );
      if (promo.minQuantity && qtyTotal < promo.minQuantity) continue;

      const eligibleSubtotal = eligibleLines.reduce(
        (sum, line) => sum + lineNet(line),
        0
      );
      if (eligibleSubtotal <= 0) continue;

      let promoDiscount = 0;
      let overrideSavings = 0;
      if (promo.unitPrice !== null && promo.unitPrice !== undefined) {
        const target = Number(promo.unitPrice) || 0;
        overrideSavings = eligibleLines.reduce((sum, line) => {
          const qty = Number(line.Quantity || 0);
          if (qty <= 0) return sum;
          const unitNet = lineNet(line) / qty;
          const perUnitSavings = Math.max(0, unitNet - target);
          const savings = perUnitSavings * qty;
          if (perUnitSavings > 0) {
            const existing = overrides[line.__idx];
            if (!existing || target < existing.targetPrice) {
              overrides[line.__idx] = { targetPrice: target, savings };
            } else if (existing && target === existing.targetPrice) {
              overrides[line.__idx].savings = (existing.savings || 0) + savings;
            }
          }
          return sum + savings;
        }, 0);
        promoDiscount = 0; // handled via price override
      } else if (promo.type === "percent") {
        const pct = Math.max(0, Math.min(100, promo.value || 0));
        promoDiscount = (eligibleSubtotal * pct) / 100;
      } else if (promo.type === "amount") {
        promoDiscount = Math.min(
          eligibleSubtotal,
          Math.max(0, promo.value || 0)
        );
      } else {
        promoDiscount = 0;
      }

      if (promoDiscount > 0 || overrideSavings > 0) {
        if (promoDiscount > 0) {
          totalDiscount += promoDiscount;
        }
        applied.push({
          id: promo.id,
          name: promo.name,
          amount: promoDiscount || overrideSavings,
        });
        if (!promo.stackable) break;
      }
    }

    return { discount: totalDiscount, applied, overrides };
  }, [cart, promotions, selectedCustomer, selectedEmployee]);

  const {
    discount: promotionDiscountAmount = 0,
    applied: appliedPromotions = [],
    overrides: promotionOverrides = {},
  } = computePromotionsDiscount;

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, item, idx) => {
        const effectivePrice =
          promotionOverrides &&
          promotionOverrides[idx]?.targetPrice !== undefined
            ? Number(promotionOverrides[idx].targetPrice)
            : Number(item.UnitPrice);
        const qty = Number(item.Quantity) || 0;
        const gross = effectivePrice * qty;
        let lineDisc = 0;
        if (item.DiscountType === "amount") {
          lineDisc = Math.min(
            gross,
            Math.max(0, Number(item.DiscountValue) || 0)
          );
        } else if (item.DiscountType === "percent") {
          const pct = Math.max(
            0,
            Math.min(100, Number(item.DiscountValue) || 0)
          );
          lineDisc = (gross * pct) / 100;
        }
        const netWithTax = Math.max(0, gross - lineDisc);
        const rate = item.IsTaxable ? Number(item.TaxRatePercentage || 0) : 0;
        if (rate > 0 && priceIncludesTax) {
          const base = netWithTax / (1 + rate / 100);
          return sum + base;
        }
        return sum + netWithTax;
      }, 0),
    [cart, priceIncludesTax, promotionOverrides]
  );

  const globalDiscountAmount = useMemo(() => {
    const value = Number(discountValue) || 0;
    if (discountType === "percent") {
      return Math.min((subtotal * value) / 100, subtotal);
    }
    return Math.min(value, subtotal);
  }, [discountType, discountValue, subtotal]);

  const lineDiscountTotal = useMemo(() => {
    return cart.reduce((sum, item, idx) => {
      const effectivePrice =
        promotionOverrides && promotionOverrides[idx]?.targetPrice !== undefined
          ? Number(promotionOverrides[idx].targetPrice)
          : Number(item.UnitPrice);
      const qty = Number(item.Quantity) || 0;
      const gross = effectivePrice * qty;
      let lineDisc = 0;
      if (item.DiscountType === "amount") {
        lineDisc = Math.min(
          gross,
          Math.max(0, Number(item.DiscountValue) || 0)
        );
      } else if (item.DiscountType === "percent") {
        const pct = Math.max(0, Math.min(100, Number(item.DiscountValue) || 0));
        lineDisc = (gross * pct) / 100;
      }
      return sum + lineDisc;
    }, 0);
  }, [cart, promotionOverrides]);

  const taxTotal = useMemo(() => {
    return cart.reduce((sum, item, idx) => {
      const effectivePrice =
        promotionOverrides && promotionOverrides[idx]?.targetPrice !== undefined
          ? Number(promotionOverrides[idx].targetPrice)
          : Number(item.UnitPrice);
      const qty = Number(item.Quantity) || 0;
      const gross = effectivePrice * qty;
      let lineDisc = 0;
      if (item.DiscountType === "amount") {
        lineDisc = Math.min(
          gross,
          Math.max(0, Number(item.DiscountValue) || 0)
        );
      } else if (item.DiscountType === "percent") {
        const pct = Math.max(0, Math.min(100, Number(item.DiscountValue) || 0));
        lineDisc = (gross * pct) / 100;
      }
      const netBeforeTax = Math.max(0, gross - lineDisc);
      const rate = item.IsTaxable ? Number(item.TaxRatePercentage || 0) : 0;
      if (rate <= 0) return sum;
      if (priceIncludesTax) {
        const base = netBeforeTax / (1 + rate / 100);
        return sum + (netBeforeTax - base);
      }
      return sum + (netBeforeTax * rate) / 100;
    }, 0);
  }, [cart, priceIncludesTax, promotionOverrides]);

  const finalTotal = Math.max(
    subtotal - globalDiscountAmount - promotionDiscountAmount + taxTotal,
    0
  );
  const totalDiscounts =
    lineDiscountTotal + globalDiscountAmount + promotionDiscountAmount;

  const getReceiptPrefs = () => {
    const defaults = {
      defaultSize: "80mm",
      sizes: {},
    };
    const rc = config?.receipts || defaults;
    return {
      defaultSize: rc.defaultSize || "80mm",
      sizes: rc.sizes || {},
    };
  };

  const buildReceiptHtml = () => {
    const { defaultSize, sizes } = getReceiptPrefs();
    const sizeCfg = sizes[defaultSize] || {
      showLogo: true,
      showTax: true,
      showDiscount: true,
      footerText: "",
      fontScale: 1,
      lineSpacing: "normal",
    };
    const widthPx =
      defaultSize === "57mm" ? 240 : defaultSize === "80mm" ? 320 : 720;
    const fontSize = 14 * (sizeCfg.fontScale || 1);
    const lineHeight = sizeCfg.lineSpacing === "compact" ? 1.2 : 1.45;
    const itemsRows = cart
      .map((item) => {
        const lineTotal =
          item.__lineParts?.total ??
          Number(item.UnitPrice) * Number(item.Quantity);
        const tax = item.__lineParts?.tax ?? 0;
        const discount =
          item.DiscountType === "amount"
            ? Number(item.DiscountValue) || 0
            : ((Number(item.UnitPrice) * Number(item.Quantity) || 0) *
                Math.max(0, Math.min(100, Number(item.DiscountValue) || 0))) /
              100;
        return `
          <div class="row">
            <span class="name">${item.ProductName || ""}</span>
            <span class="qty">${Number(item.Quantity) || 0}</span>
            <span class="price">${currencyFormatter.format(
              item.UnitPrice || 0
            )}</span>
            ${
              sizeCfg.showTax
                ? `<span class="tax">${currencyFormatter.format(tax)}</span>`
                : ""
            }
            ${
              sizeCfg.showDiscount
                ? `<span class="disc">${currencyFormatter.format(
                    discount
                  )}</span>`
                : ""
            }
            <span class="total">${currencyFormatter.format(lineTotal)}</span>
          </div>`;
      })
      .join("");

    const styles = `
      <style>
        body { font-family: "Courier New", monospace; font-size:${fontSize}px; line-height:${lineHeight}; color:#000; margin:0; padding:8px; width:${widthPx}px; }
        .receipt { width:100%; }
        .header { text-align:center; margin-bottom:6px; }
        .logo { font-weight:800; margin-bottom:4px; }
        .row.head { font-weight:700; border-bottom:1px dashed #000; padding-bottom:4px; }
        .row { display:grid; grid-template-columns:${
          sizeCfg.showTax || sizeCfg.showDiscount
            ? "2fr 0.6fr 1fr 0.8fr 0.8fr 1fr"
            : "2fr 0.6fr 1fr 1fr"
        }; gap:4px; margin:2px 0; }
        .row span { text-align:right; }
        .row .name { text-align:left; }
        .promo-line { display:flex; justify-content:space-between; margin:2px 0; padding-left:12px; font-size:${
          fontSize - 1
        }px; }
        .totals { border-top:1px dashed #000; margin-top:6px; padding-top:4px; }
        .totals .row { grid-template-columns: 1fr 1fr; }
        .footer { text-align:center; margin-top:8px; }
      </style>
    `;

    const taxLine = sizeCfg.showTax
      ? `<div class="row"><span>Tax</span><span>${currencyFormatter.format(
          taxTotal
        )}</span></div>`
      : "";
    const discountLine =
      sizeCfg.showDiscount && totalDiscounts > 0
        ? `<div class="row"><span>Discount</span><span>-${currencyFormatter.format(
            totalDiscounts
          )}</span></div>`
        : "";

    const promosLine = appliedPromotions.length
      ? appliedPromotions
          .map(
            (p) =>
              `<div class="promo-line"><span>Promo: ${
                p.name || "Promotion"
              }</span><span>-${currencyFormatter.format(p.amount)}</span></div>`
          )
          .join("")
      : "";

    return `
      ${styles}
      <div class="receipt">
        <div class="header">
          ${sizeCfg.showLogo ? `<div class="logo">${companyLabel}</div>` : ""}
          <div>${documentType}</div>
          <div>${new Date().toLocaleString()}</div>
          <div>${selectedCustomer?.CustomerName || "Customer"}</div>
        </div>
        <div class="row head">
          <span>Item</span>
          <span>Qty</span>
          <span>Price</span>
          ${sizeCfg.showTax ? `<span>Tax</span>` : ""}
          ${sizeCfg.showDiscount ? `<span>Disc</span>` : ""}
          <span>Total</span>
        </div>
        ${itemsRows}
        ${promosLine}
        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${currencyFormatter.format(
            subtotal
          )}</span></div>
          ${taxLine}
          ${discountLine}
          <div class="row" style="font-weight:800;"><span>Total</span><span>${currencyFormatter.format(
            finalTotal
          )}</span></div>
        </div>
        ${
          sizeCfg.footerText
            ? `<div class="footer">${sizeCfg.footerText}</div>`
            : ""
        }
      </div>
    `;
  };

  const handlePrintReceipt = () => {
    if (!cart.length) {
      setStatus({ type: "error", message: "Add items before printing." });
      return;
    }
    const html = buildReceiptHtml();
    const accessories = config?.accessories || {};
    const { defaultSize } = getReceiptPrefs();
    const printerName = accessories.defaultPrinters?.[defaultSize] || "";
    const agentUrl = accessories.agentUrl || "";
    const headers = {
      "Content-Type": "application/json",
      ...(accessories.token ? { "X-Print-Token": accessories.token } : {}),
    };
    if (accessories.qzEnabled) {
      handleQzPrint({
        html,
        printerName,
        qzScriptUrl: accessories.qzScriptUrl,
        cert: accessories.qzCertificate,
        key: accessories.qzPrivateKey,
        signatureAlgorithm: accessories.qzSignatureAlgorithm || "SHA512",
      });
      return;
    }
    if (agentUrl) {
      fetch(`${agentUrl.replace(/\/$/, "")}/print`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          printerName,
          size: defaultSize,
          contentType: "html",
          data: html,
        }),
      })
        .then(() =>
          setStatus({ type: "success", message: "Print job sent to agent." })
        )
        .catch(() => {
          setStatus({
            type: "error",
            message: "Print agent unreachable. Using browser print.",
          });
          const printWindow = window.open("", "print-receipt");
          if (!printWindow) return;
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        });
    } else {
      const printWindow = window.open("", "print-receipt");
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleQzPrint = async ({
    html,
    printerName,
    qzScriptUrl,
    cert,
    key,
    signatureAlgorithm,
  }) => {
    try {
      // Use the print service with fallback to browser print
      const result = await printWithFallback(html, {
        printerName: printerName,
        method: "qz", // Can be 'qz', 'thermal', or 'browser'
        qzConfig: {
          qzScriptUrl,
          certificate: cert,
          privateKey: key,
          signatureAlgorithm: signatureAlgorithm || "SHA512",
        },
      });

      console.log("Print job sent successfully:", result);
      const methodLabel =
        result?.method === "qz" ? "QZ Tray" : result?.method || "browser";
      setStatus({
        type: "success",
        message: `Receipt printed via ${methodLabel}.`,
      });
    } catch (err) {
      console.warn("Print failed:", err);
      setStatus({ type: "error", message: `Print failed: ${err?.message}` });
    }
  };

  useEffect(() => {
    const itemsPayload = cart.map((item) => ({
      name: item.ProductName,
      qty: item.Quantity,
      price: item.UnitPrice,
      lineTotal: item.__lineParts?.total ?? item.UnitPrice * item.Quantity,
    }));
    publishCustomerScreen({
      customer: selectedCustomer?.CustomerName || "Cliente",
      documentType: documentType,
      items: itemsPayload,
      totals: {
        subtotal,
        tax: taxTotal,
        discount: totalDiscounts,
        total: finalTotal,
      },
      status: status?.message || "",
    });
    // If nothing in cart, still push an update once so screens get cleared state
  }, [
    cart,
    selectedCustomer,
    documentType,
    subtotal,
    taxTotal,
    lineDiscountTotal,
    globalDiscountAmount,
    finalTotal,
    status?.message,
    publishCustomerScreen,
  ]);

  const computeLineParts = (item, idx) => {
    const effectivePrice =
      promotionOverrides && promotionOverrides[idx]?.targetPrice !== undefined
        ? Number(promotionOverrides[idx].targetPrice)
        : Number(item.UnitPrice);
    const qty = Number(item.Quantity) || 0;
    const gross = effectivePrice * qty;
    let lineDisc = 0;
    if (item.DiscountType === "amount") {
      lineDisc = Math.min(gross, Math.max(0, Number(item.DiscountValue) || 0));
    } else if (item.DiscountType === "percent") {
      const pct = Math.max(0, Math.min(100, Number(item.DiscountValue) || 0));
      lineDisc = (gross * pct) / 100;
    }
    const netWithTax = Math.max(0, gross - lineDisc);
    const rate = item.IsTaxable ? Number(item.TaxRatePercentage || 0) : 0;
    if (rate > 0 && priceIncludesTax) {
      const base = netWithTax / (1 + rate / 100);
      const tax = netWithTax - base;
      return { rate, tax, base, total: netWithTax };
    }
    const base = netWithTax;
    const tax = rate > 0 ? (base * rate) / 100 : 0;
    return { rate, tax, base, total: base + tax };
  };

  const buildItemsPayload = () =>
    cart.map((item, idx) => {
      const effectivePrice =
        promotionOverrides && promotionOverrides[idx]?.targetPrice !== undefined
          ? Number(promotionOverrides[idx].targetPrice)
          : Number(item.UnitPrice);
      const qty = Number(item.Quantity) || 0;
      const gross = effectivePrice * qty;
      const discountPct =
        item.DiscountType === "percent"
          ? Math.max(0, Math.min(100, Number(item.DiscountValue) || 0))
          : (() => {
              if (gross <= 0) return 0;
              return Math.max(
                0,
                Math.min(100, ((Number(item.DiscountValue) || 0) / gross) * 100)
              );
            })();
      const discountAmount =
        item.DiscountType === "amount"
          ? Math.max(0, Math.min(Number(item.DiscountValue) || 0, gross))
          : 0;

        return {
          ProductID: item.ProductID,
          Description: item.ProductName,
          Quantity: qty,
          UnitPrice: effectivePrice,
        DiscountPercentage: discountPct,
        DiscountAmountItem: discountAmount,
        TaxRatePercentage: item.TaxRatePercentage || 0,
          TaxRateID: item.TaxRateID || null,
          IsLineExenta: item.IsTaxable ? 0 : 1,
          ProductLotID: item.ProductLotID || null,
          ProductSerialID: null,
        };
      });

  const parkTicket = async () => {
    if (documentType !== "TICKET") {
      setStatus({
        type: "error",
        message: "Park Ticket is only available when document type is Ticket.",
      });
      return;
    }
    if (!cart.length) {
      setStatus({
        type: "error",
        message: "Add items before parking a ticket.",
      });
      return;
    }
    try {
      await api.post("/api/sales/tickets", {
        CustomerID: selectedCustomer?.CustomerID || null,
        Items: buildItemsPayload(),
        Notes: "POS Ticket",
        ReadyForBilling: false,
      });
      setStatus({ type: "success", message: "Ticket parked successfully." });
      setCart([]);
      loadTickets();
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Failed to park ticket";
      setStatus({ type: "error", message });
    }
  };

  const saveTicketForBilling = async () => {
    if (documentType !== "TICKET") {
      setStatus({
        type: "error",
        message: "Save Ticket is only available when document type is Ticket.",
      });
      return;
    }
    if (!cart.length) {
      setStatus({
        type: "error",
        message: "Add items before saving the ticket.",
      });
      return;
    }
    const effectiveCustomer =
      selectedCustomer?.CustomerID || defaultCustomer?.CustomerID || null;
    if (!effectiveCustomer) {
      setStatus({
        type: "error",
        message: "Select a customer before saving the ticket.",
      });
      setCustomerModal(true);
      return;
    }
    try {
      await api.post("/api/sales/tickets", {
        CustomerID: effectiveCustomer,
        Items: buildItemsPayload(),
        Notes: "POS Ticket",
        ReadyForBilling: true,
        IntendedDocumentType: "TICKET",
      });
      setStatus({ type: "success", message: "Ticket saved for billing." });
      setCart([]);
      loadTickets();
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Failed to save ticket";
      setStatus({ type: "error", message });
    }
  };

  const loadTickets = async () => {
    if (documentType !== "TICKET") {
      setStatus({
        type: "error",
        message: "Load Ticket is only available when document type is Ticket.",
      });
      return;
    }
    try {
      const { data } = await api.get("/api/sales/tickets", {
        params: { status: "draft" },
      });
      const filtered = Array.isArray(data)
        ? data.filter((t) => !dismissedTicketIds.includes(t.TicketID))
        : [];
      setTickets(filtered);
      setTicketModal(true);
    } catch (error) {
      setStatus({
        type: "error",
        message: "Failed to load tickets.",
      });
    }
  };

  const loadTicketItems = async (ticketId) => {
    try {
      const { data } = await api.get(`/api/sales/tickets/${ticketId}`);
      if (data.items) {
        setCart(
          data.items.map((item) => {
            const prod =
              allProducts.find((p) => getProductId(p) === item.ProductID) ||
              item;
            const tax = computeTaxForProduct(prod);
            return {
              LineID: makeLineId(),
              ProductID: item.ProductID,
              ProductName: item.Description,
              SKU: getProductSku(item),
              UnitPrice: item.UnitPrice,
              Quantity: normalizeQty(item.Quantity),
              TaxRateID: item.TaxRateID || tax.rateId || null,
              TaxRatePercentage: item.TaxRatePercentage ?? tax.ratePerc ?? 0,
              IsTaxable: item.IsTaxable ?? tax.isTaxable ?? 0,
              UsesLots: Number(prod?.UsesLots || 0),
              ProductLotID: item.ProductLotID || null,
              LotNumber: item.LotNumber || null,
              LotExpirationDate: item.ExpirationDate || null,
            };
          })
        );
      }
      setTicketModal(false);
    } catch (error) {
      setStatus({
        type: "error",
        message: "Failed to load ticket content.",
      });
    }
  };

  const dismissTicket = async (ticketId) => {
    try {
      await api.delete(`/api/sales/tickets/${ticketId}`);
      setTickets((prev) => prev.filter((t) => t.TicketID !== ticketId));
      setDismissedTicketIds((prev) =>
        prev.includes(ticketId) ? prev : [...prev, ticketId]
      );
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to cancel ticket";
      setStatus({ type: "error", message });
    }
  };

  const performSale = async (paymentsPayload = []) => {
    if (!cart.length) {
      setStatus({ type: "error", message: "Add items before charging." });
      return;
    }
    const effectiveWarehouseId =
      warehouseId || warehouseRef.current || warehouses[0]?.WarehouseID || null;
    if (!effectiveWarehouseId) {
      setStatus({
        type: "error",
        message: "Select a warehouse before charging.",
      });
      return;
    }
    const effectiveCustomer =
      selectedCustomer?.CustomerID || defaultCustomer?.CustomerID || null;
    const docRequiresCustomer = !["TICKET", "BOLETA", "BOLETA_EXENTA"].includes(
      documentType
    );
    if (docRequiresCustomer) {
      const hasCustomer = !!effectiveCustomer;
      const hasName = !!(
        selectedCustomer?.CustomerName || selectedCustomer?.Name
      );
      const hasRut = !!getCustomerTaxId(selectedCustomer);
      if (!hasCustomer || !hasName || !hasRut) {
        setStatus({
          type: "error",
          message:
            "Select a customer with RUT and name for this document type.",
        });
        setCustomerModal(true);
        return;
      }
    } else {
      // For tickets/boletas we still require a concrete customer (default)
      if (!effectiveCustomer) {
        setStatus({
          type: "error",
          message: "Select a customer before charging.",
        });
        setCustomerModal(true);
        return;
      }
    }
    setCheckoutLoading(true);
    try {
      await api.post("/api/sales", {
        CustomerID: effectiveCustomer,
        EmployeeID: selectedEmployee?.EmployeeID || null,
        WarehouseID: effectiveWarehouseId,
        DocumentType: documentType,
        Items: buildItemsPayload(),
        DiscountType: discountType,
        DiscountValue: Number(discountValue) || 0,
        FinalAmount: finalTotal,
        Notes: "POS Sale",
        Payments: paymentsPayload,
      });
      setStatus({ type: "success", message: "Sale completed successfully." });
      setCart([]);
      setSelectedCustomer(defaultCustomer || null);
      setDiscountValue(0);
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        "Failed to complete sale";
      setStatus({ type: "error", message });
    } finally {
      setCheckoutLoading(false);
      if (loadedTicketId) {
        try {
          await api.post(`/api/sales/tickets/${loadedTicketId}/mark-billed`);
        } catch (err) {
          console.warn("Failed to mark ticket billed", err);
        }
        setLoadedTicketId(null);
      }
    }
  };

  const handleSave = async () => {
    setPaymentError("");
    await performSale([]);
  };

  const paymentTotal = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.Amount) || 0), 0),
    [payments]
  );

  const matchMethodByKeywords = (method, keywords = []) =>
    keywords.some((kw) =>
      String(method.MethodName || "")
        .toLowerCase()
        .includes(kw)
    );

  const getMethodIdsByKeywords = (keywords = []) =>
    paymentMethods
      .filter((m) => matchMethodByKeywords(m, keywords))
      .map((m) => m.PaymentMethodID);

  const findMethodId = (name) => {
    if (!name) return null;
    const keywords = [name.toLowerCase()];
    // add common synonyms
    if (name.toLowerCase() === "cash") keywords.push("efectivo");
    if (name.toLowerCase() === "card") keywords.push("tarjeta");
    if (name.toLowerCase() === "transfer")
      keywords.push("transferencia", "bank");
    if (name.toLowerCase() === "credit") keywords.push("credito", "crédito");
    const match = paymentMethods.find((m) =>
      matchMethodByKeywords(m, keywords)
    );
    return match ? match.PaymentMethodID : null;
  };

  const remainingDue = (excludeIndex = null) => {
    const paidExcluding =
      paymentTotal -
      payments.reduce((sum, p, idx) => {
        if (idx === excludeIndex) return sum + (Number(p.Amount) || 0);
        return sum;
      }, 0);
    return Math.max(0, finalTotal - paidExcluding);
  };

  const cashMethodIds = useMemo(
    () => getMethodIdsByKeywords(["cash", "efectivo"]),
    [paymentMethods]
  );
  const isCashMethod = (methodOrId) => {
    if (!methodOrId) return false;
    if (typeof methodOrId === "object") {
      return matchMethodByKeywords(methodOrId, ["cash", "efectivo"]);
    }
    return cashMethodIds.some((id) => Number(id) === Number(methodOrId));
  };
  const rowIsCash = (idx) => {
    const mid = payments[idx]?.PaymentMethodID;
    if (isCashMethod(mid)) return true;
    const methodObj = paymentMethods.find(
      (m) => Number(m.PaymentMethodID) === Number(mid)
    );
    return isCashMethod(methodObj);
  };
  const paymentRowIsCash = (row) => {
    if (!row) return false;
    const mid = row.PaymentMethodID;
    if (isCashMethod(mid)) return true;
    const methodObj = paymentMethods.find(
      (m) => Number(m.PaymentMethodID) === Number(mid)
    );
    return isCashMethod(methodObj);
  };
  const primaryCashIndex = useMemo(
    () => payments.findIndex((p) => paymentRowIsCash(p)),
    [payments, cashMethodIds, paymentMethods]
  );
  const cashUsed = primaryCashIndex !== -1;
  const isCashUsedElsewhere = (idx) =>
    cashUsed && payments.some((p, i) => i !== idx && paymentRowIsCash(p));

  const firstNonCashMethodId = useMemo(() => {
    const m = paymentMethods.find((pm) => !isCashMethod(pm));
    return m ? m.PaymentMethodID : "";
  }, [paymentMethods, cashMethodIds]);

  const addPaymentRow = () => {
    const remaining = Math.max(0, finalTotal - paymentTotal);
    let methodId =
      (lastPaymentMethodId && (!cashUsed || !isCashMethod(lastPaymentMethodId))
        ? lastPaymentMethodId
        : null) ||
      payments[payments.length - 1]?.PaymentMethodID ||
      "";
    if (cashUsed && isCashMethod(methodId)) {
      methodId = firstNonCashMethodId || "";
    }
    if (!methodId) {
      methodId = cashUsed
        ? firstNonCashMethodId || ""
        : cashMethodIds[0] || firstNonCashMethodId || "";
    }
    setPayments((prev) => [
      ...prev,
      {
        PaymentMethodID: methodId,
        Amount: remaining > 0 ? remaining : "",
        ReferenceNumber: "",
      },
    ]);
    setTimeout(() => {
      const newIndex = payments.length;
      setFocusedPaymentIndex(newIndex);
      const lastRef = amountRefs.current[newIndex];
      if (lastRef) {
        lastRef.focus();
        lastRef.select();
      }
    }, 0);
  };

  const handleCharge = () => {
    setPaymentError("");
    // default to a single cash payment prefilled with remaining
    const cashId = findMethodId("cash") || "";
    setPayments([
      { PaymentMethodID: cashId, Amount: finalTotal, ReferenceNumber: "" },
    ]);
    setPaymentModal(true);
    setTimeout(() => {
      if (amountRefs.current[0]) {
        amountRefs.current[0].focus();
        amountRefs.current[0].select();
      }
    }, 0);
  };

  const submitPayments = async () => {
    const payload = payments
      .filter((p) => Number(p.Amount) > 0)
      .map((p) => ({
        PaymentMethodID: p.PaymentMethodID ? Number(p.PaymentMethodID) : null,
        Amount: Number(p.Amount) || 0,
        ReferenceNumber: p.ReferenceNumber || null,
      }));
    if (!payload.length) {
      setPaymentError("Add at least one payment.");
      return;
    }
    if (paymentTotal > finalTotal) {
      setPaymentError("Payment exceeds total.");
      return;
    }
    setPaymentModal(false);
    await performSale(payload);
  };

  const handleClose = () => {
    navigate("/dashboard");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredCategoryProducts = (categoryId) => {
    const source = availableProducts.length ? availableProducts : allProducts;
    if (isUncategorizedKey(categoryId)) {
      return source.filter((p) => !getProductCategoryId(p));
    }
    return source.filter(
      (p) => getCategoryKey(getProductCategoryId(p)) === categoryId
    );
  };

  const resetCategoryView = () => setActiveCategoryId(null);

  useEffect(() => {
    focusSearchSoon();
  }, []);

  useEffect(() => {
    if (skipFocusRef.current) {
      skipFocusRef.current = false;
      return;
    }
    focusSearchSoon();
  }, [
    selectedCustomer,
    selectedEmployee,
    documentType,
    activePriceListId,
    warehouseId,
    loadedTicketId,
  ]);

  useEffect(() => {
    const prev = prevModalsRef.current;
    if (prev.customer && !customerModal) focusSearchSoon();
    if (prev.employee && !employeeModal) focusSearchSoon();
    if (prev.ticket && !ticketModal) focusSearchSoon();
    if (prev.pin && !pinModal) focusSearchSoon();
    if (prev.payment && !paymentModal) focusSearchSoon();
    if (prev.lot && !lotModal.open) focusSearchSoon();
    if (prev.serial && !serialModal.open) focusSearchSoon();
    prevModalsRef.current = {
      customer: customerModal,
      employee: employeeModal,
      ticket: ticketModal,
      pin: pinModal,
      payment: paymentModal,
      lot: lotModal.open,
      serial: serialModal.open,
    };
  }, [customerModal, employeeModal, ticketModal, pinModal, paymentModal, lotModal.open, serialModal.open]);

  useEffect(() => {
    if (lotModal.open || serialModal.open) return;
    const pendingLot = cart.find((line) => line.UsesLots && !line.ProductLotID);
    if (pendingLot) {
      openLotModalForItem(pendingLot);
      return;
    }
    const pendingSerial = cart.find((line) => line.UsesSerials && !line.SerialNumber);
    if (pendingSerial) {
      openSerialModalForLine(pendingSerial);
    }
  }, [cart, lotModal.open, serialModal.open]);

  useEffect(() => {
    focusSearchSoon();
  }, [activeCategoryId, categoryCollapsed]);
  const MIN_MAIN_PERCENT = 70;
  const mainPercent = Math.max(MIN_MAIN_PERCENT, 100 - categoryWidth);
  const sidePercent = Math.max(0, 100 - mainPercent);
  const lotModalLine =
    lotModal.open && lotModal.mode === "single"
      ? cart.find((item) => item.LineID === lotModal.lineId)
      : null;
  const packLotLines =
    lotModal.open && lotModal.mode === "pack"
      ? cart.filter(
          (item) => item.PackGroupId === lotModal.packGroupId && item.UsesLots
        )
      : [];

  return (
    <div
      ref={gridRef}
      className="pos-grid"
      onMouseDown={handleSurfaceMouseDown}
      style={{
        gridTemplateColumns: isMobile
          ? "1fr"
          : categoryCollapsed
          ? "minmax(0, 1fr) 44px"
          : `minmax(520px, ${mainPercent}%) 8px minmax(280px, ${sidePercent}%)`,
        width: "100%",
      }}
    >
      <section className="order-panel card">
        <header className="order-header">
          <div className="pos-header-top">
            <div className="company-brand">
              {hasLogo && (
                <img src={logoSource} alt="Company" className="company-logo" />
              )}
              <strong className="company-name">{companyLabel}</strong>
            </div>
            <div className="pos-header-details">
              {selectedEmployee && (
                <span className="muted small">
                  {t("pos.cashier")}: {selectedEmployee.FirstName}{" "}
                  {selectedEmployee.LastName}
                </span>
              )}
              <span className="muted small">
                {t("pos.customerLabel")}:{" "}
                {selectedCustomer?.CustomerName || t("pos.defaultCustomer")}
              </span>
            </div>
            <div className="mobile-actions mobile-inline">
              <button className="btn ghost" onClick={() => setActionsSheet(true)}>
                <span className="btn-icon" aria-hidden="true">⚡</span>
              </button>
              <button className="btn ghost" onClick={() => setCatalogSheet(true)}>
                <span className="btn-icon" aria-hidden="true">📦</span>
              </button>
              <button className="btn ghost" onClick={() => setControlsSheet(true)}>
                <span className="btn-icon" aria-hidden="true">🎛</span>
              </button>
            </div>
          </div>
          <div className="order-actions desktop-actions">
            {renderActionButtons()}
          </div>
        </header>

        <div className="order-search">
          <input
            ref={searchInputRef}
            placeholder={t("pos.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightIndex((prev) =>
                  Math.min(prev === -1 ? 0 : prev + 1, searchResults.length - 1)
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightIndex((prev) => Math.max(prev - 1, -1));
                return;
              }
              if (e.key === "Escape") {
                setSearchResults([]);
                setHighlightIndex(-1);
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (documentType !== "TICKET" && isTicketCode(searchTerm)) {
                  await loadTicketByNumber(searchTerm);
                  return;
                }
                const normalize = (value) =>
                  (value ?? "").toString().trim().toLowerCase();
                const getName = (p) =>
                  p.ProductName ?? p.productName ?? p.Name ?? p.name ?? "";
                const getSku = (p) => p.SKU ?? p.Sku ?? p.sku ?? "";
                const getBarcode = (p) =>
                  p.Barcode ?? p.barcode ?? p.barcodeNumber ?? "";

                const term = normalize(searchTerm);
                const match =
                  (highlightIndex >= 0 && searchResults[highlightIndex]) ||
                  searchResults.find((p) =>
                    isProductAvailable(getProductId(p))
                  ) ||
                  allProducts.find(
                    (p) =>
                      isProductAvailable(getProductId(p)) &&
                      (normalize(getSku(p)) === term ||
                        normalize(getBarcode(p)) === term ||
                        normalize(getName(p)) === term)
                  );
                if (match) {
                  addProductToCart(match);
                  setSearchTerm("");
                  setSearchResults([]);
                  setHighlightIndex(-1);
                } else {
                  setStatus({
                    type: "error",
                    message: t("pos.emptyState"),
                  });
                }
              }
            }}
          />
          {searchResults.length > 0 && (
            <ul className="dropdown">
              {searchResults.map((product, idx) => (
                <li
                  key={product.ProductID}
                  ref={(node) => {
                    resultRefs.current[idx] = node;
                  }}
                  className={highlightIndex === idx ? "active" : ""}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseLeave={() => setHighlightIndex(-1)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addProductToCart(product)}
                >
                  <span>{getProductName(product)}</span>
                  <span className="muted">{getProductSku(product)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      <div className="order-list">
          {cart.length === 0 && <p className="muted">{t("pos.emptyState")}</p>}
          {cart.length > 0 && (
            <div className="order-row order-head">
              <span>Product</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Disc</span>
              <span>Tax</span>
              <span>Line Total (incl. tax)</span>
              <span>Actions</span>
            </div>
          )}
          {cart.map((item, idx) => {
            const lineId = getLineId(item) || `${item.ProductID}-${idx}`;
            return (
            <div className="swipe-container" key={lineId}>
              <div
                className="swipe-delete-bar"
                style={{
                  width: `${Math.min(
                    80,
                    Math.max(0, -(swipeOffsets[lineId] || 0))
                  )}px`,
                }}
              >
                🗑
              </div>
              <div
                className={`order-item order-row swipe-row ${
                  item.IsPackComponent ? "pack-component" : item.IsPack ? "pack-line" : ""
                }`}
                onTouchStart={(e) => handleRowTouchStart(lineId, e)}
                onTouchMove={(e) => handleRowTouchMove(lineId, e)}
                onTouchEnd={(e) => handleRowTouchEnd(lineId, e)}
                style={{
                  transform: `translateX(${swipeOffsets[lineId] || 0}px)`,
                  transition:
                    swipingId === lineId
                      ? "none"
                      : "transform 0.15s ease",
                }}
              >
              {(() => {
                const parts = computeLineParts(item, idx);
                item.__lineParts = parts; // cache for render below
                return null;
              })()}
                <div className="order-product">
                  <strong>{item.ProductName}</strong>
                  {!item.IsPackComponent && (
                    <p className="muted small sku-mobile">{item.SKU}</p>
                  )}
                  {!item.IsPackComponent && item.UsesLots ? (
                    <p className="muted small">
                      Lot: {item.LotNumber || "Select lot"}
                      {item.LotExpirationDate
                        ? ` · Exp ${formatShortDate(item.LotExpirationDate)}`
                        : ""}
                    </p>
                  ) : null}
                  {item.UsesSerials ? (
                    <p className="muted small">
                      Serial: {item.SerialNumber || "Select serial"}
                    </p>
                  ) : null}
                </div>
              <div className="qty-controls">
                {item.IsPackComponent ? (
                  <span className="qty-static">{item.Quantity}</span>
                ) : isMobile ? (
                  <select
                    className="qty-wheel-select"
                    value={item.Quantity}
                    onChange={(e) =>
                      setQuantityValue(lineId, e.target.value)
                    }
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                  >
                    {Array.from({ length: 201 }, (_, i) => i).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <button onClick={() => updateQuantity(lineId, -1)}>-</button>
                    <span
                      onTouchStart={(e) => handleQtyTouchStart(lineId, e)}
                      onTouchEnd={(e) => handleQtyTouchEnd(lineId, e)}
                    >
                      {item.Quantity}
                    </span>
                    <button onClick={() => updateQuantity(lineId, 1)}>+</button>
                  </>
                )}
              </div>
              {!item.IsPackComponent && (
                <div className="price">
                  {promotionOverrides[idx] ? (
                    <>
                      <div
                        style={{
                          textDecoration: "line-through",
                          color: "#999",
                          fontSize: 12,
                        }}
                      >
                        {currencyFormatter.format(item.UnitPrice)}
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {currencyFormatter.format(
                          promotionOverrides[idx].targetPrice
                        )}
                      </div>
                      <div className="muted small">Promo</div>
                    </>
                  ) : item.ManualOverride &&
                    item.OriginalUnitPrice !== undefined ? (
                    <>
                      <div
                        style={{
                          textDecoration: "line-through",
                          color: "#999",
                          fontSize: 12,
                        }}
                      >
                        {currencyFormatter.format(item.OriginalUnitPrice)}
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {currencyFormatter.format(item.UnitPrice)}
                      </div>
                      <div className="muted small">Manual</div>
                    </>
                  ) : (
                    currencyFormatter.format(item.UnitPrice)
                  )}
                </div>
              )}
              {!item.IsPackComponent && (
                <div className="discount-cell">
                  <select
                    value={item.DiscountType || "percent"}
                    onChange={(e) =>
                      updateLineDiscountType(lineId, e.target.value)
                    }
                    disabled={
                      Boolean(promotionOverrides[idx]) || item.ManualOverride
                    }
                    title={
                      promotionOverrides[idx]
                        ? "Line discounts disabled when promo price applies"
                        : item.ManualOverride
                        ? "Line discounts disabled when manually overridden"
                        : ""
                    }
                  >
                    <option value="amount">$</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={item.DiscountValue || 0}
                    onChange={(e) =>
                      updateLineDiscountValue(lineId, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (searchInputRef.current) {
                          searchInputRef.current.focus();
                        }
                      }
                    }}
                    disabled={
                      Boolean(promotionOverrides[idx]) || item.ManualOverride
                    }
                  />
                </div>
              )}
              {!item.IsPackComponent && (
                <div className="tax muted small">
                  {item.__lineParts?.rate
                    ? `${Number(item.__lineParts.rate).toFixed(2)}%`
                    : "0%"}
                </div>
              )}
              {!item.IsPackComponent && (
                <div className="price">
                  {currencyFormatter.format(item.__lineParts?.total || 0)}
                </div>
              )}
                {!item.IsPackComponent && (
                  <div
                    className="actions"
                    style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}
                  >
                    {!!(item.IsPack
                      ? cart.some(
                          (line) =>
                            line.PackGroupId === item.PackGroupId && line.UsesLots
                        )
                      : item.UsesLots) && (
                      <button
                        className="btn ghost small"
                        type="button"
                        onClick={() => openLotModalForItem(item)}
                        title="Change lot"
                        aria-label="Change lot"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="btn ghost small override-btn"
                      type="button"
                      onClick={() => openOverrideModal(item, idx)}
                      title="Override price"
                      aria-label="Override price"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                        <path d="M14.06 4.94l3.75 3.75" />
                      </svg>
                    </button>
                    {!!item.UsesSerials && (
                      <button
                        className="btn ghost small"
                        type="button"
                        onClick={() => openSerialModalForLine(item)}
                        title="Change serial"
                        aria-label="Change serial"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="8" cy="8" r="3" />
                          <circle cx="16" cy="16" r="3" />
                          <path d="M11 11l2 2" />
                          <path d="M12 8h8" />
                          <path d="M4 16h8" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="delete-item desktop-delete"
                      onClick={() => removeItem(lineId)}
                    aria-label="Remove item"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              )}
              </div>
            </div>
            );
          })}
          {appliedPromotions.length > 0 && (
            <div
              className="order-item order-row"
              style={{
                gridTemplateColumns: "1fr",
                alignItems: "flex-start",
                paddingLeft: 24,
                background: "rgba(0,0,0,0.015)",
              }}
            >
              <div
                className="muted small"
                style={{ display: "flex", flexDirection: "column", gap: 2 }}
              >
                {appliedPromotions.map((p) => (
                  <div
                    key={p.id || p.name}
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Promo: {p.name || "Promotion"}</span>
                    <span>-{currencyFormatter.format(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="order-footer">
          {renderControlsContent()}

          <div className="pos-footer-row totals-row">
            <div>
              <p>Subtotal</p>
              <strong>{currencyFormatter.format(subtotal)}</strong>
            </div>
            <div>
              <p>Tax</p>
              <strong>{currencyFormatter.format(taxTotal)}</strong>
            </div>
            <div>
              <p>Discount</p>
              <strong>-{currencyFormatter.format(totalDiscounts)}</strong>
            </div>
            {appliedPromotions.length > 0 && (
              <div className="promotions-summary">
                <p>Promotions</p>
                <div className="muted small">
                  {appliedPromotions.map((p) => (
                    <div key={p.id || p.name}>
                      {p.name || "Promotion"}: -
                      {currencyFormatter.format(p.amount)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="order-total">
              <p>Total</p>
              <strong>{currencyFormatter.format(finalTotal)}</strong>
            </div>
            <div className="order-actions charge-area">
              <button
                className="btn ghost"
                onClick={handlePrintReceipt}
                disabled={!cart.length || checkoutLoading}
              >
                <span className="btn-icon" aria-hidden="true">🖨️</span>
                <span className="btn-label">Print receipt</span>
              </button>
              {documentType === "TICKET" ? (
                <button
                  className="btn primary save-icon-btn"
                  onClick={saveTicketForBilling}
                  disabled={!cart.length || checkoutLoading}
                  title="Save Ticket"
                >
                  <span className="btn-icon" aria-hidden="true">💾</span>
                  <span className="btn-label">Save</span>
                </button>
              ) : (
                <>
                  <button
                    className="btn ghost"
                    onClick={handleSave}
                    disabled={!cart.length || checkoutLoading}
                  >
                    <span className="btn-icon" aria-hidden="true">💾</span>
                    <span className="btn-label">Save</span>
                  </button>
                  <button
                    className="btn primary"
                    onClick={handleCharge}
                    disabled={!cart.length || checkoutLoading}
                  >
                    <span className="btn-icon" aria-hidden="true">⚡</span>
                    <span className="btn-label">
                      {checkoutLoading ? "Processing..." : "Charge"}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {status.message && (
          <p className={`status ${status.type}`}>{status.message}</p>
        )}
      </section>

      {!categoryCollapsed && (
        <div
          className={`splitter ${isResizing ? "active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        />
      )}

      <div
        className={`catalog-container ${categoryCollapsed ? "collapsed" : ""}`}
      >
        {!categoryCollapsed && renderCatalogContent()}
        <button
          className={`category-toggle ${categoryCollapsed ? "show" : "hide"}`}
          onClick={() => {
            setCategoryCollapsed((prev) => !prev);
            focusSearchSoon();
          }}
          aria-label={categoryCollapsed ? "Show categories" : "Hide categories"}
        >
          {categoryCollapsed ? ">" : "<"}
        </button>
      </div>

      {actionsSheet && (
        <div className="sheet-backdrop" onClick={closeActionsSheet}>
          <div
            className="mobile-sheet left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-header">
              <h3>Quick actions</h3>
              <button className="btn ghost" onClick={closeActionsSheet}>
                Close
              </button>
            </div>
            <div className="sheet-body">
              <div className="order-actions vertical">{renderActionButtons()}</div>
            </div>
          </div>
        </div>
      )}

      {catalogSheet && (
        <div className="sheet-backdrop" onClick={closeCatalogSheet}>
          <div
            className="mobile-sheet right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-header">
              <h3>Products</h3>
              <button className="btn ghost" onClick={closeCatalogSheet}>
                Close
              </button>
            </div>
            <div className="sheet-body">{renderCatalogContent()}</div>
          </div>
        </div>
      )}

      {controlsSheet && (
        <div className="sheet-backdrop" onClick={closeControlsSheet}>
          <div
            className="mobile-sheet bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-header">
              <h3>Controls</h3>
              <button className="btn ghost" onClick={closeControlsSheet}>
                Close
              </button>
            </div>
            <div className="sheet-body">{renderControlsContent()}</div>
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Parked Tickets</h3>
            <ul className="ticket-list">
              {tickets.map((ticket) => (
                <li key={ticket.TicketID} className="ticket-row">
                  <button
                    className="ticket-btn"
                    onClick={() => loadTicketItems(ticket.TicketID)}
                  >
                    #{ticket.TicketID} - {ticket.CustomerName || "Walk-in"} -{" "}
                    {currencyFormatter.format(ticket.FinalAmount)}
                  </button>
                  <button
                    className="delete-item small"
                    onClick={() => dismissTicket(ticket.TicketID)}
                    aria-label="Remove ticket from list"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn ghost" onClick={() => setTicketModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {lotModal.open && (
        <div className="modal">
          <div className="modal-content">
            <h3>Lots</h3>
            {lotModalError && <p className="status error">{lotModalError}</p>}
            {lotModalLoading && <p className="muted">Loading lots...</p>}
            {lotModal.mode === "single" && lotModalLine && (
              <>
                <div className="stack">
                  <strong>{lotModalLine.ProductName}</strong>
                  <span className="muted small">{lotModalLine.SKU}</span>
                </div>
                <label>
                  Lot
                  <input
                    value={lotSearch}
                    onChange={(e) => {
                      setLotSearch(e.target.value);
                      setLotHighlight(0);
                    }}
                    placeholder="Search lot number"
                    onKeyDown={(e) => {
                      const filtered = lotOptions.filter((lot) =>
                        (lot.LotNumber || "").toLowerCase().includes(lotSearch.toLowerCase())
                      );
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setLotHighlight((prev) =>
                          filtered.length === 0 ? 0 : (prev + 1) % filtered.length
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setLotHighlight((prev) =>
                          filtered.length === 0
                            ? 0
                            : prev <= 0
                              ? filtered.length - 1
                              : prev - 1
                        );
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const pick = filtered[lotHighlight];
                        if (pick) {
                          applyLotToLine(lotModalLine.LineID, pick);
                          closeLotModal();
                        }
                      }
                    }}
                  />
                </label>
                <ul className="list" style={{ maxHeight: 240, overflowY: "auto" }}>
                  {lotOptions
                    .filter((lot) =>
                      (lot.LotNumber || "").toLowerCase().includes(lotSearch.toLowerCase())
                    )
                    .map((lot, idx) => (
                      <li
                        key={lot.ProductLotID}
                        className="list-row"
                        style={{
                          cursor: "pointer",
                          background: idx === lotHighlight ? "#eef2ff" : "transparent",
                        }}
                        onClick={() => {
                          applyLotToLine(lotModalLine.LineID, lot);
                          closeLotModal();
                        }}
                      >
                        <div className="stack">
                          <span className="entity-name">{lot.LotNumber}</span>
                          <span className="muted small">
                            Qty {Number(lot.Quantity || 0)}
                            {lot.ExpirationDate
                              ? ` · Exp ${formatShortDate(lot.ExpirationDate)}`
                              : ""}
                          </span>
                        </div>
                      </li>
                    ))}
                  {lotOptions.filter((lot) =>
                    (lot.LotNumber || "").toLowerCase().includes(lotSearch.toLowerCase())
                  ).length === 0 && <li className="muted small list-row">No lots</li>}
                </ul>
              </>
            )}
            {lotModal.mode === "pack" && (
              <>
                {packLotLines.length === 0 ? (
                  <p className="muted">No lot-tracked items in this pack.</p>
                ) : (
                  <div className="entity-list">
                    {packLotLines.map((line) => {
                      const options = lotOptionsByLine[line.LineID] || [];
                      return (
                        <div key={line.LineID} className="entity-row">
                          <div className="stack">
                            <span className="entity-name">{line.ProductName}</span>
                            <span className="muted small">{line.SKU}</span>
                          </div>
                          <div className="inline-inputs">
                            <select
                              value={line.ProductLotID || ""}
                              onChange={(e) => {
                                const selected = options.find(
                                  (lot) =>
                                    String(lot.ProductLotID) === e.target.value
                                );
                                applyLotToLine(line.LineID, selected || null);
                              }}
                            >
                              <option value="">Select lot</option>
                              {options.map((lot) => (
                                <option key={lot.ProductLotID} value={lot.ProductLotID}>
                                  {lot.LotNumber} (qty {Number(lot.Quantity || 0)}
                                  {lot.ExpirationDate
                                    ? `, exp ${formatShortDate(lot.ExpirationDate)}`
                                    : ""}
                                  )
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <button className="btn ghost" onClick={closeLotModal}>
              Close
            </button>
          </div>
        </div>
      )}
      {serialModal.open && (
        <div className="modal">
          <div className="modal-content">
            <h3>Select serial</h3>
            {serialModalError && <p className="status error">{serialModalError}</p>}
            {serialModalLoading ? (
              <p className="muted">Loading serials...</p>
            ) : (
              <>
                <label>
                  Serial
                  <input
                    value={serialSearch}
                    onChange={(e) => {
                      setSerialSearch(e.target.value);
                      setSerialHighlight(0);
                    }}
                    placeholder="Search serial"
                    onKeyDown={(e) => {
                      const filtered = serialOptions.filter((s) =>
                        (s.SerialNumber || "").toLowerCase().includes(serialSearch.toLowerCase())
                      );
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSerialHighlight((prev) =>
                          filtered.length === 0 ? 0 : (prev + 1) % filtered.length
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSerialHighlight((prev) =>
                          filtered.length === 0
                            ? 0
                            : prev <= 0
                              ? filtered.length - 1
                              : prev - 1
                        );
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const pick = filtered[serialHighlight];
                        if (pick) {
                          applySerialToLine(serialModal.lineId, pick);
                          closeSerialModal();
                        }
                      }
                    }}
                  />
                </label>
                <ul className="list" style={{ maxHeight: 240, overflowY: "auto" }}>
                  {serialOptions
                    .filter((s) =>
                      (s.SerialNumber || "").toLowerCase().includes(serialSearch.toLowerCase())
                    )
                    .map((s, idx) => (
                      <li
                        key={s.ProductSerialID}
                        className="list-row"
                        style={{
                          cursor: "pointer",
                          background: idx === serialHighlight ? "#eef2ff" : "transparent",
                        }}
                        onClick={() => {
                          applySerialToLine(serialModal.lineId, s);
                          closeSerialModal();
                        }}
                      >
                        <div className="stack">
                          <span className="entity-name">{s.SerialNumber}</span>
                          <span className="muted small">{s.Status}</span>
                        </div>
                      </li>
                    ))}
                  {serialOptions.filter((s) =>
                    (s.SerialNumber || "").toLowerCase().includes(serialSearch.toLowerCase())
                  ).length === 0 && <li className="muted small list-row">No serials</li>}
                </ul>
              </>
            )}
            <button className="btn ghost" onClick={closeSerialModal}>
              Close
            </button>
          </div>
        </div>
      )}

      {customerModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Select Customer</h3>
            <input
              placeholder="Search customer"
              value={customerLookup}
              onChange={(e) => setCustomerLookup(e.target.value)}
            />
            <ul>
              {customerResults.map((customer) => (
                <li key={customer.CustomerID}>
                  <button
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerModal(false);
                      setCustomerLookup("");
                      focusSearchSoon();
                    }}
                  >
                    {customer.CustomerName} - {customer.Email}
                  </button>
                </li>
              ))}
            </ul>
              <button
                className="btn ghost"
                onClick={() => {
                  setCustomerModal(false);
                  focusSearchSoon();
                }}
              >
                Close
              </button>
            </div>
          </div>
      )}

      {employeeModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Select Employee</h3>
            <ul>
              {employees.map((emp) => (
                <li key={emp.EmployeeID}>
                  <button
                    onClick={() => {
                      pendingEmployeeRef.current = emp;
                      setPinInput("");
                      setPinError("");
                      setPinModal(true);
                    }}
                  >
                    {emp.FirstName} {emp.LastName} - {emp.Role}
                  </button>
                </li>
              ))}
            </ul>
              <button
                className="btn ghost"
                onClick={() => {
                  setEmployeeModal(false);
                  focusSearchSoon();
                }}
              >
                Close
              </button>
            </div>
          </div>
      )}
      {paymentModal && (
        <div className="modal">
          <div className="modal-content payment-modal">
            <h3>Charge</h3>
            <p className="muted small">
              Add one or more payments. Total due:{" "}
              {currencyFormatter.format(finalTotal)}.
            </p>
            {paymentError && <p className="status error">{paymentError}</p>}
            <div className="payment-modes">
              <button
                className={`pay-mode ${
                  rowIsCash(focusedPaymentIndex) ? "active" : ""
                }`}
                type="button"
                onClick={() => {
                  if (!rowIsCash(focusedPaymentIndex) && cashUsed) return;
                  const cashId =
                    cashMethodIds[0] ||
                    payments[focusedPaymentIndex]?.PaymentMethodID;
                  setLastPaymentMethodId(cashId);
                  setPayments((prev) =>
                    prev.map((p, idx) =>
                      idx === focusedPaymentIndex
                        ? { ...p, PaymentMethodID: cashId }
                        : p
                    )
                  );
                  const targetRef = amountRefs.current[focusedPaymentIndex];
                  if (targetRef) {
                    targetRef.focus();
                    targetRef.select();
                  }
                }}
              >
                💵 Cash
              </button>
              <button
                className={`pay-mode ${
                  payments[focusedPaymentIndex]?.PaymentMethodID ===
                  findMethodId("card")
                    ? "active"
                    : ""
                }`}
                type="button"
                onClick={() => {
                  const cardId =
                    findMethodId("card") ||
                    payments[focusedPaymentIndex]?.PaymentMethodID;
                  const remaining = remainingDue(focusedPaymentIndex);
                  setLastPaymentMethodId(cardId);
                  setPayments((prev) =>
                    prev.map((p, idx) =>
                      idx === focusedPaymentIndex
                        ? { ...p, PaymentMethodID: cardId, Amount: remaining }
                        : p
                    )
                  );
                  const targetRef = amountRefs.current[focusedPaymentIndex];
                  if (targetRef) {
                    targetRef.focus();
                    targetRef.select();
                  }
                }}
              >
                💳 Card
              </button>
              <button
                className={`pay-mode ${
                  payments[focusedPaymentIndex]?.PaymentMethodID ===
                  findMethodId("transfer")
                    ? "active"
                    : ""
                }`}
                type="button"
                onClick={() => {
                  const trId =
                    findMethodId("transfer") ||
                    payments[focusedPaymentIndex]?.PaymentMethodID;
                  const remaining = remainingDue(focusedPaymentIndex);
                  setLastPaymentMethodId(trId);
                  setPayments((prev) =>
                    prev.map((p, idx) =>
                      idx === focusedPaymentIndex
                        ? { ...p, PaymentMethodID: trId, Amount: remaining }
                        : p
                    )
                  );
                  const targetRef = amountRefs.current[focusedPaymentIndex];
                  if (targetRef) {
                    targetRef.focus();
                    targetRef.select();
                  }
                }}
              >
                🏦 Transfer
              </button>
              <button
                className={`pay-mode ${
                  payments[focusedPaymentIndex]?.PaymentMethodID ===
                  findMethodId("credit")
                    ? "active"
                    : ""
                }`}
                type="button"
                onClick={() => {
                  const creditId =
                    findMethodId("credit") ||
                    payments[focusedPaymentIndex]?.PaymentMethodID;
                  setLastPaymentMethodId(creditId);
                  setPayments((prev) =>
                    prev.map((p, idx) =>
                      idx === focusedPaymentIndex
                        ? { ...p, PaymentMethodID: creditId }
                        : p
                    )
                  );
                  const targetRef = amountRefs.current[focusedPaymentIndex];
                  if (targetRef) {
                    targetRef.focus();
                    targetRef.select();
                  }
                }}
              >
                🧾 Credit
              </button>
            </div>

            <div className="table payment-table">
              <div className="table-head payment-grid">
                <span>Method</span>
                <span>Amount</span>
                <span>Reference</span>
                <span />
              </div>
              {payments.map((p, idx) => (
                <div key={idx} className="table-row payment-grid">
                  <select
                    value={p.PaymentMethodID}
                    onChange={(e) =>
                      setPayments((prev) => {
                        const val =
                          e.target.value === "" ? "" : Number(e.target.value);
                        return prev.map((row, i) =>
                          i === idx ? { ...row, PaymentMethodID: val } : row
                        );
                      })
                    }
                    onFocus={() => setFocusedPaymentIndex(idx)}
                  >
                    <option value="">Select method</option>
                    {paymentMethods
                      .filter((m) => {
                        const isCash = isCashMethod(m);
                        if (!isCash) return true;
                        // cash option: show only if no cash yet or this row is the cash row
                        return (
                          !cashUsed ||
                          primaryCashIndex === idx ||
                          rowIsCash(idx)
                        );
                      })
                      .map((m) => (
                        <option
                          key={m.PaymentMethodID}
                          value={m.PaymentMethodID}
                        >
                          {m.MethodName}
                        </option>
                      ))}
                  </select>
                  <input
                    ref={(el) => {
                      amountRefs.current[idx] = el;
                    }}
                    onFocus={() => setFocusedPaymentIndex(idx)}
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.Amount}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, Amount: e.target.value } : row
                        )
                      )
                    }
                  />
                  <input
                    value={p.ReferenceNumber || ""}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? { ...row, ReferenceNumber: e.target.value }
                            : row
                        )
                      )
                    }
                    onFocus={() => setFocusedPaymentIndex(idx)}
                    placeholder="Reference (optional)"
                  />
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      setPayments((prev) => {
                        if (prev.length === 1) {
                          return [
                            {
                              PaymentMethodID: cashMethodIds[0] || "",
                              Amount: "",
                              ReferenceNumber: "",
                            },
                          ];
                        }
                        const removedAmount = Number(prev[idx]?.Amount) || 0;
                        const next = prev.filter((_, i) => i !== idx);
                        const lastIndex = next.length - 1;
                        const paidExcludingLast = next.reduce((sum, row, i) => {
                          if (i === lastIndex) return sum;
                          return sum + (Number(row.Amount) || 0);
                        }, 0);
                        const needed = Math.max(
                          0,
                          finalTotal - paidExcludingLast
                        );
                        const newLastAmount =
                          needed > 0
                            ? needed
                            : (Number(next[lastIndex].Amount) || 0) +
                              removedAmount;
                        next[lastIndex] = {
                          ...next[lastIndex],
                          Amount: newLastAmount,
                        };
                        setFocusedPaymentIndex(lastIndex);
                        return next;
                      });
                      setTimeout(() => {
                        const ref =
                          amountRefs.current[Math.max(0, payments.length - 2)];
                        if (ref) {
                          ref.focus();
                          ref.select();
                        }
                      }, 0);
                    }}
                    disabled={payments.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div
              className="list-actions"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <div className="muted small">
                Total payments: {currencyFormatter.format(paymentTotal)} /{" "}
                {currencyFormatter.format(finalTotal)}
              </div>
              <div className="list-actions">
                <button
                  className="btn ghost"
                  type="button"
                  onClick={addPaymentRow}
                >
                  Add payment
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setPaymentModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  type="button"
                  onClick={submitPayments}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? "Processing..." : "Charge"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {pinModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Enter PIN</h3>
            <p className="muted small">
              Enter the 4-6 digit PIN for the selected employee.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!pendingEmployeeRef.current || !pinInput || pinLoading)
                  return;
                setPinLoading(true);
                setPinError("");
                try {
                  await api.post("/api/auth/verify-pin", {
                    EmployeeID: pendingEmployeeRef.current.EmployeeID,
                    Pin: pinInput,
                  });
                  setSelectedEmployee(pendingEmployeeRef.current);
                  setEmployeeModal(false);
                  setPinModal(false);
                  setStatus({ type: "success", message: "Employee switched." });
                } catch (err) {
                  const message =
                    err.response?.data?.error ||
                    "Invalid PIN. Please try again.";
                  setPinError(message);
                } finally {
                  setPinLoading(false);
                  setPinInput("");
                }
              }}
            >
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D+/g, "");
                  setPinInput(next);
                }}
                autoFocus
              />
              {pinError && <p className="status error">{pinError}</p>}
              <div
                className="form-actions"
                style={{ justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setPinModal(false);
                    setPinError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  disabled={!pinInput || pinLoading}
                  type="submit"
                >
                  {pinLoading ? "Verifying..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {overrideModal.open && (
        <div className="modal">
          <div className="modal-content">
            <h3>Override price</h3>
            <p className="muted small">
              Set a custom unit price for this line.{" "}
              {isAdminUser
                ? "Admin override"
                : "Manager PIN required for non-admins."}
            </p>
            <label>
              New unit price
              <input
                type="number"
                min="0"
                step="0.01"
                value={overrideModal.newPrice}
                onChange={(e) =>
                  setOverrideModal((prev) => ({
                    ...prev,
                    newPrice: e.target.value,
                    error: "",
                  }))
                }
              />
            </label>
            {!isAdminUser && (
              <div className="form-grid two-col gap">
                <label>
                  Manager EmployeeID
                  <input
                    value={overrideModal.managerId}
                    onChange={(e) =>
                      setOverrideModal((prev) => ({
                        ...prev,
                        managerId: e.target.value,
                        error: "",
                      }))
                    }
                  />
                </label>
                <label>
                  PIN
                  <input
                    type="password"
                    value={overrideModal.pin}
                    onChange={(e) =>
                      setOverrideModal((prev) => ({
                        ...prev,
                        pin: e.target.value,
                        error: "",
                      }))
                    }
                  />
                </label>
              </div>
            )}
            {overrideModal.error && (
              <p className="status error">{overrideModal.error}</p>
            )}
            <div
              className="form-actions"
              style={{ justifyContent: "flex-end" }}
            >
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  setOverrideModal({
                    open: false,
                    productId: null,
                    newPrice: "",
                    managerId: "",
                    pin: "",
                    error: "",
                    idx: null,
                  })
                }
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={applyManualOverride}
              >
                Apply override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

