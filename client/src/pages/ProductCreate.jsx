
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/http";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Quill from "quill";
import "quill/dist/quill.snow.css";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
const resolveImg = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url.startsWith("/") ? "" : "/"}${url}`;
};

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link", "blockquote", "code-block"],
    ["clean"],
  ],
};

const initialProduct = {
  SKU: "",
  ProductName: "",
  Description: "",
  ProductCategoryID: "",
  ProductBrandID: "",
  UnitID: "",
  CostPrice: "",
  SellingPrice: "",
  IsTaxable: 1,
  TaxRateID: "",
  IsService: 0,
  UsesLots: 0,
  UsesSerials: 0,
  Weight: "",
  WeightUnitID: "",
  Length: "",
  Width: "",
  Height: "",
  DimensionUnitID: "",
  ImageURL: "",
  Barcode: "",
};

export default function ProductCreate() {
  const { company } = useAuth();
  const { t } = useLanguage();
  const params = useParams();
  const idParam = params.id;
  const navigate = useNavigate();
  const isEdit = Boolean(idParam);
  const [currentProductId, setCurrentProductId] = useState(isEdit ? Number(idParam) : null);
  const fileInputRef = useRef(null);

  const [product, setProduct] = useState(initialProduct);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]); // [{file, preview}]
  const [primaryImageId, setPrimaryImageId] = useState(null);
  const quillRef = useRef(null);
  const quillContainerRef = useRef(null);
  const quillSetting = useRef(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [customDefs, setCustomDefs] = useState([]);
  const [customValues, setCustomValues] = useState({});
  const [selectedDefIds, setSelectedDefIds] = useState([]);
  const availableDefs = useMemo(
    () => customDefs.filter((d) => !selectedDefIds.includes(d.id)),
    [customDefs, selectedDefIds]
  );
  const [isPack, setIsPack] = useState(false);
  const [packComponents, setPackComponents] = useState([]);
  const [packSearch, setPackSearch] = useState("");
  const [packResults, setPackResults] = useState([]);
  const [packAutoPrice, setPackAutoPrice] = useState(true);
  const [hadPack, setHadPack] = useState(false);
  const packTotal = useMemo(
    () =>
      packComponents.reduce((sum, item) => {
        const qty = Number(item.ComponentQuantity || 0);
        const price = Number(item.SellingPrice || 0);
        return sum + price * qty;
      }, 0),
    [packComponents]
  );

  const addCustomField = (id) => {
    const numId = Number(id);
    if (!numId) return;
    setSelectedDefIds((prev) => (prev.includes(numId) ? prev : [...prev, numId]));
  };

  const removeCustomField = (id) => {
    setSelectedDefIds((prev) => prev.filter((pid) => pid !== id));
    setCustomValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  // For new products, stage custom values by token until we have a ProductID
  const pendingTokenRef = useRef(
    isEdit
      ? null
      : (() => {
          const stored = localStorage.getItem("akkj_pending_cf_token");
          if (stored) return stored;
          const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          localStorage.setItem("akkj_pending_cf_token", token);
          return token;
        })()
  );

  useEffect(() => {
    document.title = isEdit ? t("productForm.editTitle") ?? t("productForm.title") : t("productForm.title");
  }, [t, isEdit]);

  // Initialize Quill once
  useEffect(() => {
    if (!quillContainerRef.current || quillRef.current) return;
    quillRef.current = new Quill(quillContainerRef.current, {
      theme: "snow",
      modules: quillModules,
    });
    quillRef.current.on("text-change", () => {
      if (quillSetting.current) return;
      const html = quillRef.current.root.innerHTML;
      updateField("Description", html);
    });
    // set initial content
    quillSetting.current = true;
    quillRef.current.root.innerHTML = product.Description || "";
    quillSetting.current = false;
  }, []);

  // Sync quill when product.Description changes (e.g., load)
  useEffect(() => {
    if (!quillRef.current) return;
    const current = quillRef.current.root.innerHTML;
    if ((product.Description || "") !== current) {
      quillSetting.current = true;
      quillRef.current.root.innerHTML = product.Description || "";
      quillSetting.current = false;
    }
  }, [product.Description]);

  const loadImages = async (pid) => {
    if (!pid) return;
    try {
      const { data } = await api.get(`/api/products/${pid}/images`);
      const imgs = data || [];
      setExistingImages(imgs);
      const primary = imgs.find((i) => i.IsPrimary);
      setPrimaryImageId(primary ? primary.ProductImageID : null);
    } catch (err) {
      console.warn("Failed to load product images", err);
    }
  };

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [catRes, brandRes, unitRes, taxRes, customRes] = await Promise.all([
          api.get("/api/categories"),
          api.get("/api/brands"),
          api.get("/api/units"),
          api.get("/api/tax-rates").catch(() => ({ data: [] })),
          api.get("/api/custom-fields/product"),
        ]);
        setCategories(catRes.data || []);
        setBrands(brandRes.data || []);
        setUnits(unitRes.data || []);
        const rateList = Array.isArray(taxRes.data) ? taxRes.data : [];
        setTaxRates(rateList);
        // For new products, preset default tax rate if available
        if (!isEdit && rateList.length) {
          const def = rateList.find((r) => r.IsDefault) || rateList[0];
          setProduct((prev) => ({ ...prev, TaxRateID: def?.TaxRateID || "" }));
        }
        setCustomDefs(
          (customRes.data || [])
            .filter((d) => d.visible !== 0 && d.visible !== false)
            .map((d) => ({
              ...d,
              type: d.type === "JSON" ? "Select" : d.type,
            }))
        );
      } catch (err) {
        console.error("Failed to load options", err);
        setStatus({
          type: "error",
          message: t("productForm.loadError"),
        });
      }
    };
    loadOptions();
  }, [t]);

  // Load staged values for new products (pending token)
  useEffect(() => {
    const token = pendingTokenRef.current;
    if (isEdit || !token) return;
    const loadStaged = async () => {
      try {
        const { data } = await api.get(`/api/custom-fields/product/stage-values?token=${token}`);
        const staged = {};
        (data || []).forEach((v) => {
          staged[v.definitionId] = v.value;
        });
        setCustomValues((prev) => ({ ...prev, ...staged }));
        setSelectedDefIds((prev) => {
          const ids = new Set(prev);
          Object.keys(staged).forEach((k) => ids.add(Number(k)));
          return Array.from(ids);
        });
      } catch (err) {
        console.warn("No staged custom values", err.message || err);
      }
    };
    loadStaged();
  }, [isEdit]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!isEdit) return;
      setLoadingProduct(true);
      setStatus({ type: "", message: "" });
      try {
        const [prodRes, valuesRes, imagesRes, packRes] = await Promise.all([
          api.get(`/api/products/${idParam}`),
          api.get(`/api/custom-fields/product/values?productId=${idParam}`),
          api.get(`/api/products/${idParam}/images`),
          api.get(`/api/product-packs/${idParam}`).catch(() => ({ data: [] })),
        ]);
        const data = prodRes.data;
        setCurrentProductId(Number(idParam));
        setProduct({
          SKU: data.SKU || "",
          ProductName: data.ProductName || "",
          Description: data.Description || "",
          ProductCategoryID: data.ProductCategoryID || "",
          ProductBrandID: data.ProductBrandID || "",
          UnitID: data.UnitID || "",
          CostPrice: data.CostPrice ?? "",
          SellingPrice: data.SellingPrice ?? "",
          IsTaxable: data.IsTaxable ?? 1,
          IsService: data.IsService ?? 0,
          UsesLots: data.UsesLots ?? 0,
          UsesSerials: data.UsesSerials ?? 0,
          Weight: data.Weight ?? "",
          WeightUnitID: data.WeightUnitID || "",
          Length: data.Length ?? "",
          Width: data.Width ?? "",
          Height: data.Height ?? "",
          DimensionUnitID: data.DimensionUnitID || "",
          ImageURL: data.ImageURL || "",
          Barcode: data.Barcode || "",
          TaxRateID: data.TaxRateID || "",
        });
        const cv = {};
        (valuesRes.data || []).forEach((v) => {
          cv[v.definitionId] = v.value;
        });
        setCustomValues(cv);
        setSelectedDefIds(Object.keys(cv).map((k) => Number(k)));

        const imgs = imagesRes.data || [];
        setExistingImages(imgs);
        const primary = imgs.find((i) => i.IsPrimary);
        setPrimaryImageId(primary ? primary.ProductImageID : null);

        const packList = Array.isArray(packRes?.data) ? packRes.data : [];
        if (packList.length) {
          setIsPack(true);
          setHadPack(true);
          const mapped = packList.map((row) => ({
            ProductID: row.ComponentProductID,
            ProductName: row.ProductName,
            SKU: row.SKU,
            SellingPrice: Number(row.SellingPrice || 0),
            ComponentQuantity: Number(row.ComponentQuantity || 1),
          }));
          setPackComponents(mapped);
          const sum = mapped.reduce(
            (acc, item) => acc + Number(item.SellingPrice || 0) * Number(item.ComponentQuantity || 0),
            0
          );
          const currentPrice = Number(data.SellingPrice || 0);
          setPackAutoPrice(Math.abs(currentPrice - sum) < 0.01);
        } else {
          setIsPack(false);
          setHadPack(false);
          setPackComponents([]);
        }
      } catch (err) {
        console.error("Failed to load product", err);
        setStatus({ type: "error", message: t("products.loadError") });
      } finally {
        setLoadingProduct(false);
      }
    };
    loadProduct();
  }, [idParam, isEdit, t]);

  useEffect(() => {
    if (!isPack || !packAutoPrice) return;
    setProduct((prev) => ({
      ...prev,
      SellingPrice: Number(packTotal.toFixed(4)),
    }));
  }, [isPack, packAutoPrice, packTotal]);

  useEffect(() => {
    if (!isPack) {
      setPackResults([]);
      return;
    }
    const term = packSearch.trim();
    if (term.length < 2) {
      setPackResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/products?q=${encodeURIComponent(term)}`);
        const list = Array.isArray(res.data) ? res.data : [];
        const componentIds = new Set(
          packComponents.map((c) => Number(c.ProductID))
        );
        const filtered = list.filter((item) => {
          const pid = Number(item.ProductID || item.ProductId || item.id || 0);
          if (!pid) return false;
          if (componentIds.has(pid)) return false;
          if (currentProductId && pid === Number(currentProductId)) return false;
          return true;
        });
        setPackResults(filtered);
      } catch (err) {
        console.error("Failed to search products", err);
        setPackResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [packSearch, packComponents, isPack, currentProductId]);

  const updateField = (field, value) => {
    setProduct((prev) => ({ ...prev, [field]: value }));
  };

  const updateNumber = (field, value) => {
    const n = value === "" ? "" : Number(value);
    setProduct((prev) => ({ ...prev, [field]: n }));
  };

  const addPackComponent = (item) => {
    const productId = Number(item?.ProductID || item?.ProductId || item?.id || 0);
    if (!productId) return;
    if (packComponents.some((c) => Number(c.ProductID) === productId)) return;
    setPackComponents((prev) => [
      ...prev,
      {
        ProductID: productId,
        ProductName: item.ProductName || item.Name || "",
        SKU: item.SKU || item.sku || "",
        SellingPrice: Number(item.SellingPrice || 0),
        ComponentQuantity: 1,
      },
    ]);
    setPackSearch("");
    setPackResults([]);
  };

  const updatePackComponentQty = (productId, value) => {
    const qty = Math.max(0.0001, Number(value) || 0);
    setPackComponents((prev) =>
      prev.map((item) =>
        Number(item.ProductID) === Number(productId)
          ? { ...item, ComponentQuantity: qty }
          : item
      )
    );
  };

  const removePackComponent = (productId) => {
    setPackComponents((prev) =>
      prev.filter((item) => Number(item.ProductID) !== Number(productId))
    );
  };

  const buildFieldPayload = () =>
    customDefs
      .filter((d) => selectedDefIds.includes(d.id))
      .map((d) => ({
        definitionId: d.id,
        value: customValues[d.id] ?? null,
      }));

  const uploadAndSaveImages = async (targetId) => {
    if (!targetId) return;
    const combined = [
      ...existingImages.map((img) => ({ kind: "existing", data: img })),
      ...newImages.map((img, idx) => ({ kind: "new", data: img, newIndex: idx })),
    ];
    const desiredPrimary = combined[0] || null;
    const uploads = [];
    const newIndexToUploadId = new Map();

    for (let idx = 0; idx < newImages.length; idx += 1) {
      const file = newImages[idx].file || newImages[idx];
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post("/api/uploads/products", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (!data?.url) continue;
        const makePrimary = false; // set primary after all uploads to avoid constraint conflicts
        const res = await api.post(`/api/products/${targetId}/images`, {
          ImageUrl: data.url,
          AltText: file.name,
          IsPrimary: makePrimary ? 1 : 0,
        });
        uploads.push(res.data);
        newIndexToUploadId.set(idx, res.data.ProductImageID);
      } catch (err) {
        console.warn("Failed to upload image", err);
      }
    }

    let primaryId = null;
    if (desiredPrimary && desiredPrimary.kind === "existing") {
      primaryId = desiredPrimary.data.ProductImageID;
    } else if (desiredPrimary && desiredPrimary.kind === "new") {
      primaryId = newIndexToUploadId.get(desiredPrimary.newIndex) || null;
    } else if (existingImages[0]) {
      primaryId = existingImages[0].ProductImageID;
    } else if (uploads[0]) {
      primaryId = uploads[0].ProductImageID;
    }

    if (primaryId && currentProductId) {
      try {
        await api.put(`/api/products/${currentProductId}/images/${primaryId}`, { IsPrimary: 1 });
      } catch (err) {
        console.warn("Failed to set primary after upload", err);
      }
      setPrimaryImageId(primaryId);
    }

    if (uploads.length) {
      setExistingImages((prev) => [...prev, ...uploads]);
      setNewImages([]);
    }
  };

  const reorderImages = async (from, to) => {
    const combined = [
      ...existingImages.map((img) => ({ kind: "existing", data: img })),
      ...newImages.map((img, idx) => ({ kind: "new", data: img, newIndex: idx })),
    ];
    if (from < 0 || to < 0 || from >= combined.length || to >= combined.length || from === to) return;
    const [moved] = combined.splice(from, 1);
    combined.splice(to, 0, moved);
    const nextExisting = [];
    const nextNew = [];
    combined.forEach((item) => {
      if (item.kind === "existing") nextExisting.push(item.data);
      else nextNew.push(item.data);
    });
    setExistingImages(nextExisting);
    setNewImages(nextNew);

    const first = combined[0];
    const firstExisting = nextExisting[0];
    if (firstExisting) {
      setPrimaryImageId(firstExisting.ProductImageID);
    } else {
      setPrimaryImageId(null);
    }
    if (currentProductId && first && first.kind === "existing") {
      try {
        await api.put(`/api/products/${currentProductId}/images/${first.data.ProductImageID}`, { IsPrimary: 1 });
      } catch (err) {
        console.warn("Failed to update primary after reorder", err);
      }
    }
  };

  const persistCustomValues = async (targetId) => {
    if (customDefs.length === 0) return;
    // If we have a product ID, save directly; otherwise stage into pending table
    if (targetId) {
      await api.post("/api/custom-fields/product/values", {
        ProductID: targetId,
        fields: buildFieldPayload(),
      });
      if (pendingTokenRef.current) {
        try {
          await api.post("/api/custom-fields/product/attach-staged", {
            ProductID: targetId,
            token: pendingTokenRef.current,
          });
          localStorage.removeItem("akkj_pending_cf_token");
          pendingTokenRef.current = null;
        } catch (err) {
          console.warn("Failed to attach staged custom values", err);
        }
      }
    } else {
      const token =
        pendingTokenRef.current || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
      pendingTokenRef.current = token;
      localStorage.setItem("akkj_pending_cf_token", token);
      await api.post("/api/custom-fields/product/stage-values", {
        token,
        fields: buildFieldPayload(),
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    if (!product.SKU || !product.ProductName || !product.UnitID) {
      // Still stage custom values so user input isn't lost
      if (!isEdit && customDefs.length > 0) {
        try {
          await persistCustomValues(null);
        } catch (stageErr) {
          console.warn("Failed to stage custom values after validation error", stageErr);
        }
      }
      setStatus({
        type: "error",
        message: t("productForm.requiredError"),
      });
      return;
    }
    if (isPack && packComponents.length === 0) {
      setStatus({
        type: "error",
        message: "Add at least one pack component",
      });
      return;
    }
    setSaving(true);
    const payload = {
      ...product,
      UsesLots: product.UsesLots ? 1 : 0,
      UsesSerials: product.UsesSerials ? 1 : 0,
      ImageURL: product.ImageURL || null,
      ProductCategoryID: product.ProductCategoryID || null,
      ProductBrandID: product.ProductBrandID || null,
      UnitID: Number(product.UnitID),
      CostPrice: product.CostPrice === "" ? null : Number(product.CostPrice),
      SellingPrice: product.SellingPrice === "" ? null : Number(product.SellingPrice),
      Weight: product.Weight === "" ? null : Number(product.Weight),
      WeightUnitID: product.WeightUnitID === "" ? null : Number(product.WeightUnitID),
      Length: product.Length === "" ? null : Number(product.Length),
      Width: product.Width === "" ? null : Number(product.Width),
      Height: product.Height === "" ? null : Number(product.Height),
      DimensionUnitID: product.DimensionUnitID === "" ? null : Number(product.DimensionUnitID),
      Barcode: product.Barcode || null,
      IsTaxable: product.IsTaxable ? 1 : 0,
      IsService: product.IsService ? 1 : 0,
      TaxRateID: product.IsTaxable ? (product.TaxRateID || null) : null,
    };

    try {
      let savedId = isEdit ? Number(idParam) : null;
      if (isEdit) {
        await api.put(`/api/products/${idParam}`, { ...payload, CompanyID: company.CompanyID });
        setStatus({ type: "success", message: t("productForm.updateSuccess", "Product updated.") });
      } else {
        const res = await api.post("/api/products", { ...payload, CompanyID: company.CompanyID });
        const data = res?.data || {};
        savedId = Number(
          data.ProductID ||
          data.ProductId ||
          data.insertId ||
          data.id ||
          0
        ) || null;
        if (savedId) setCurrentProductId(savedId);
        setStatus({ type: "success", message: t("productForm.saveSuccess") });
        setProduct(initialProduct);
        setIsPack(false);
        setPackComponents([]);
        setPackSearch("");
        setPackResults([]);
        setPackAutoPrice(true);
      }

      const targetId = Number(savedId || idParam || 0);
      if (customDefs.length > 0) {
        try {
          await persistCustomValues(targetId || null);
          if (!targetId) {
            setStatus({
              type: "info",
              message: t(
                "customFields.pendingSaved",
                "Custom values staged. Save the product to attach them."
              ),
            });
          }
        } catch (err) {
          console.error("Failed to save custom field values", err);
          setStatus((prev) => ({
            type: "error",
            message: err.response?.data?.error || err.message || t("customFields.saveError"),
          }));
        }
      }

      if (targetId) {
        try {
          if (isPack) {
            await api.put(`/api/product-packs/${targetId}`, {
              PackProductID: targetId,
              components: packComponents.map((item) => ({
                componentProductId: Number(item.ProductID),
                componentQuantity: Number(item.ComponentQuantity || 0),
              })),
            });
            setHadPack(true);
          } else if (hadPack) {
            await api.delete(`/api/product-packs/${targetId}`);
            setHadPack(false);
          }
        } catch (err) {
          console.error("Failed to save pack components", err);
          setStatus({
            type: "error",
            message: err.response?.data?.error || "Failed to save pack components",
          });
        }
      }

      // Upload and attach images after we have a product ID
      if (targetId) {
        await uploadAndSaveImages(targetId);
        await loadImages(targetId);
        // Clear file input and new previews after successful upload
        if (fileInputRef.current) fileInputRef.current.value = "";
        setNewImages([]);
      }
      if (isEdit) {
        navigate("/products");
      }
    } catch (err) {
      console.error("Failed to save product", err);
      setStatus({
        type: "error",
        message: err.response?.data?.error || err.message || t("productForm.saveError"),
      });
      // If product save failed, at least stage custom values so they are not lost
      if (!isEdit && customDefs.length > 0) {
        try {
          await persistCustomValues(null);
        } catch (stageErr) {
          console.warn("Failed to stage custom values after product error", stageErr);
        }
      }
      // Even if product save failed, clear pending new images to avoid duplicate uploads on retry
      setNewImages((prev) => prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page product-page">
      <div className="page-header">
        <div>
          <h2>{isEdit ? t("productForm.editTitle") : t("productForm.title")}</h2>
          <p className="muted">
            {isEdit ? t("productForm.editDescription", "Update product details.") : t("productForm.description")}
          </p>
          {loadingProduct ? <p className="muted">{t("products.loading")}</p> : null}
        </div>
        <div className="form-actions inline-actions">
          <button className="btn primary" type="submit" form="productForm" disabled={saving || loadingProduct}>
            {saving ? t("productForm.saving") : isEdit ? t("productForm.update", "Update") : t("productForm.save")}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={saving}
            onClick={() => {
              setProduct(initialProduct);
              setIsPack(false);
              setPackComponents([]);
              setPackSearch("");
              setPackResults([]);
              setPackAutoPrice(true);
              setStatus({ type: "", message: "" });
            }}
          >
            {t("productForm.clear")}
          </button>
        </div>
      </div>
      <form id="productForm" className="form card product-form" onSubmit={handleSubmit}>
        <div className="grid two">
          <label>
            {t("productForm.sku")}
            <input
              value={product.SKU}
              onChange={(e) => updateField("SKU", e.target.value)}
              required
            />
          </label>
          <label>
            {t("productForm.name")}
            <input
              value={product.ProductName}
              onChange={(e) => updateField("ProductName", e.target.value)}
              required
            />
          </label>
        </div>

        <div className="grid three">
          <label>
            {t("productForm.category")}
            <select
              value={product.ProductCategoryID}
              onChange={(e) => updateField("ProductCategoryID", e.target.value)}
            >
              <option value="">{t("productForm.select")}</option>
              {categories.map((c) => (
                <option key={c.ProductCategoryID} value={c.ProductCategoryID}>
                  {c.CategoryName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("productForm.brand")}
            <select
              value={product.ProductBrandID}
              onChange={(e) => updateField("ProductBrandID", e.target.value)}
            >
              <option value="">{t("productForm.select")}</option>
              {brands.map((b) => (
                <option key={b.ProductBrandID} value={b.ProductBrandID}>
                  {b.BrandName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("productForm.unit")}
            <select
              value={product.UnitID}
              onChange={(e) => updateField("UnitID", e.target.value)}
              required
            >
              <option value="">{t("productForm.select")}</option>
              {units.map((u) => (
                <option key={u.UnitID} value={u.UnitID}>
                  {u.UnitName || u.Unit}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid three">
          <label>
            {t("productForm.costPrice")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={product.CostPrice}
              onChange={(e) => updateNumber("CostPrice", e.target.value)}
            />
          </label>
          <label>
            {t("productForm.sellingPrice")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={product.SellingPrice}
              onChange={(e) => {
                if (isPack) setPackAutoPrice(false);
                updateNumber("SellingPrice", e.target.value);
              }}
            />
          </label>
          <label>
            {t("productForm.barcode")}
            <input
              value={product.Barcode}
              onChange={(e) => updateField("Barcode", e.target.value)}
            />
          </label>
        </div>

        <label className="toggle inline-check">
          <span>Pack product</span>
          <input
            type="checkbox"
            checked={isPack}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsPack(checked);
              if (!checked) {
                setPackComponents([]);
                setPackSearch("");
                setPackResults([]);
                setPackAutoPrice(true);
              }
            }}
          />
        </label>

        {isPack && (
          <div className="card">
            <div className="inline-row">
              <label className="toggle inline-check">
                <span>Auto price from components</span>
                <input
                  type="checkbox"
                  checked={packAutoPrice}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setPackAutoPrice(next);
                    if (next) {
                      setProduct((prev) => ({
                        ...prev,
                        SellingPrice: Number(packTotal.toFixed(4)),
                      }));
                    }
                  }}
                />
              </label>
              <span className="muted small">
                Auto sum: {Number(packTotal || 0).toLocaleString()}
              </span>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setPackAutoPrice(true);
                  setProduct((prev) => ({
                    ...prev,
                    SellingPrice: Number(packTotal.toFixed(4)),
                  }));
                }}
              >
                Use auto sum
              </button>
            </div>

            <label>
              Find component product
              <div className="search-input">
                <input
                  value={packSearch}
                  onChange={(e) => setPackSearch(e.target.value)}
                  placeholder="Search by name, SKU, or barcode"
                />
              </div>
            </label>
            {packResults.length > 0 && (
              <ul className="list">
                {packResults.map((item) => (
                  <li key={item.ProductID} className="list-row">
                    <span>
                      {item.SKU ? `${item.SKU} - ` : ""}
                      {item.ProductName}
                    </span>
                    <div className="list-actions inline">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => addPackComponent(item)}
                      >
                        Add
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {packComponents.length === 0 ? (
              <p className="muted small">No components added yet.</p>
            ) : (
              <div className="entity-list">
                {packComponents.map((item) => (
                  <div key={item.ProductID} className="entity-row">
                    <div className="stack">
                      <span className="entity-name">
                        {item.SKU ? `${item.SKU} - ` : ""}
                        {item.ProductName}
                      </span>
                      <span className="muted small">
                        Price: {Number(item.SellingPrice || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="inline-inputs">
                      <input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={item.ComponentQuantity}
                        onChange={(e) =>
                          updatePackComponentQty(item.ProductID, e.target.value)
                        }
                        style={{ width: 90 }}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removePackComponent(item.ProductID)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid two">
          <label className="toggle inline-check">
            <span>{t("productForm.taxable")}</span>
            <input
              type="checkbox"
              checked={Boolean(product.IsTaxable)}
              onChange={(e) => {
                const isTaxable = e.target.checked ? 1 : 0;
                setProduct((prev) => ({
                  ...prev,
                  IsTaxable: isTaxable,
                  TaxRateID: isTaxable ? prev.TaxRateID : "",
                }));
              }}
            />
          </label>
          <label>
            {t("productForm.taxRate", "Tax rate")}
            <select
              value={product.TaxRateID}
              onChange={(e) => updateField("TaxRateID", e.target.value)}
              disabled={!product.IsTaxable}
            >
              <option value="">{t("productForm.select")}</option>
              {taxRates.map((r) => (
                <option key={r.TaxRateID} value={r.TaxRateID}>
                  {r.Name} ({Number(r.RatePercentage || 0)}%)
                </option>
              ))}
            </select>
          </label>
          <label className="toggle inline-check">
            <span>{t("productForm.serviceItem")}</span>
            <input
              type="checkbox"
              checked={Boolean(product.IsService)}
              onChange={(e) => {
                const checked = e.target.checked ? 1 : 0;
                updateField("IsService", checked);
                if (checked) updateField("UsesLots", 0);
              }}
            />
          </label>
          <label className="toggle inline-check">
            <span>{t("productForm.usesLots", "Track lots")}</span>
            <input
              type="checkbox"
              checked={Boolean(product.UsesLots)}
              onChange={(e) => {
                const checked = e.target.checked ? 1 : 0;
                updateField("UsesLots", checked);
                if (checked) updateField("UsesSerials", 0);
              }}
              disabled={Boolean(product.IsService) || Boolean(product.UsesSerials)}
            />
          </label>
          <label className="toggle inline-check">
            <span>{t("productForm.usesSerials", "Track serials")}</span>
            <input
              type="checkbox"
              checked={Boolean(product.UsesSerials)}
              onChange={(e) => {
                const checked = e.target.checked ? 1 : 0;
                updateField("UsesSerials", checked);
                if (checked) updateField("UsesLots", 0);
              }}
              disabled={Boolean(product.UsesLots)}
            />
          </label>
        </div>

        <div className="grid three">
          <label>
            {t("productForm.weight")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={product.Weight}
              onChange={(e) => updateNumber("Weight", e.target.value)}
            />
          </label>
          <label>
            {t("productForm.weightUnit")}
            <select
              value={product.WeightUnitID}
              onChange={(e) => updateField("WeightUnitID", e.target.value)}
            >
              <option value="">{t("productForm.select")}</option>
              {units.map((u) => (
                <option key={u.UnitID} value={u.UnitID}>
                  {u.UnitName || u.Unit}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("productForm.length")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={product.Length}
              onChange={(e) => updateNumber("Length", e.target.value)}
            />
          </label>
          <label>
            {t("productForm.width")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={product.Width}
              onChange={(e) => updateNumber("Width", e.target.value)}
            />
          </label>
          <label>
            {t("productForm.height")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={product.Height}
              onChange={(e) => updateNumber("Height", e.target.value)}
            />
          </label>
          <label>
            {t("productForm.dimensionUnit")}
            <select
              value={product.DimensionUnitID}
              onChange={(e) => updateField("DimensionUnitID", e.target.value)}
            >
              <option value="">{t("productForm.select")}</option>
              {units.map((u) => (
                <option key={u.UnitID} value={u.UnitID}>
                  {u.UnitName || u.Unit}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="rich-editor">
          <div className="rich-editor__label">{t("productForm.descriptionField")}</div>
          <div ref={quillContainerRef} />
        </label>

        {(existingImages.length > 0 || newImages.length > 0) && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <h3>{t("productForm.images", "Images")}</h3>
            <p className="muted small">{t("productForm.primaryHint", "First image will be primary; drag to reorder.")}</p>
            <div className="image-grid">
              {[...existingImages.map((img) => ({ kind: "existing", img })), ...newImages.map((img, idx) => ({ kind: "new", img, idx }))].map(
                (item, idx) => {
                  const isExisting = item.kind === "existing";
                  const isPrimary = idx === 0;
                  const src = isExisting ? resolveImg(item.img.ImageUrl) : item.img.preview;
                  const alt = isExisting ? item.img.AltText || "Product image" : item.img.file?.name || "image";
                  return (
                    <div
                      key={isExisting ? `ex-${item.img.ProductImageID}` : `new-${idx}`}
                      className="image-item draggable"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(idx));
                      }}
                      onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    const to = idx;
                    reorderImages(from, to);
                  }}
                >
                  <img src={src} alt={alt} />
                  <div className="image-actions">
                    {isPrimary && <span className="badge badge-primary">{t("productForm.primary", "Primary")}</span>}
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={async () => {
                        if (isExisting) {
                          try {
                            await api.delete(`/api/products/${currentProductId}/images/${item.img.ProductImageID}`);
                            setExistingImages((prev) => prev.filter((i) => i.ProductImageID !== item.img.ProductImageID));
                                if (primaryImageId === item.img.ProductImageID) {
                                  const next = existingImages.filter((i) => i.ProductImageID !== item.img.ProductImageID);
                                  if (next[0]) {
                                    setPrimaryImageId(next[0].ProductImageID);
                                    if (currentProductId) {
                                      await api.put(`/api/products/${currentProductId}/images/${next[0].ProductImageID}`, { IsPrimary: 1 });
                                    }
                                  } else {
                                    setPrimaryImageId(null);
                                  }
                                }
                              } catch (err) {
                                console.warn("Failed to delete image", err);
                              }
                            } else {
                              setNewImages((prev) =>
                                prev.filter((_, nIdx) => nIdx !== item.idx)
                              );
                            }
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        <label style={{ display: "block", marginTop: "1rem" }}>
          {t("productForm.uploadImage")}
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={(e) => {
              const files = Array.from(e.target.files || []).map((file) => ({
                file,
                preview: URL.createObjectURL(file),
              }));
              setNewImages(files);
            }}
          />
        </label>

        {customDefs.length > 0 && (
          <div className="card" style={{ marginTop: "1rem" }}>
            <h3>{t("nav.customFields")}</h3>
            <p className="muted small">
              {t("customFields.selectPrompt", "Select which custom fields to add to this product.")}
            </p>
            <div className="custom-field-picker">
              <select
                value=""
                onChange={(e) => addCustomField(e.target.value)}
              >
                <option value="">{t("productForm.select")}</option>
                {availableDefs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedDefIds.length === 0 ? (
              <p className="muted small">{t("customFields.empty", "No custom fields yet.")}</p>
            ) : (
              <div className="grid two">
                {selectedDefIds.map((defId) => {
                  const def = customDefs.find((d) => d.id === defId);
                  if (!def) return null;
                  const defType = def.type === "JSON" ? "Select" : def.type;
                  const rawVal = customValues[def.id];
                  const val = rawVal ?? "";
                  const handleChange = (v) =>
                    setCustomValues((prev) => ({
                      ...prev,
                      [def.id]: v,
                    }));

                  if (defType === "Boolean") {
                    return (
                      <label key={def.id} className="inline-check">
                        <span>{def.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleChange(e.target.checked)}
                        />
                        <button type="button" className="btn ghost danger" onClick={() => removeCustomField(def.id)}>
                          ×
                        </button>
                      </label>
                    );
                  }
                  if (defType === "Date") {
                    return (
                      <label key={def.id} className="inline-check">
                        <span>{def.label}</span>
                        <input
                          type="date"
                          value={val || ""}
                          onChange={(e) => handleChange(e.target.value)}
                        />
                        <button type="button" className="btn ghost danger" onClick={() => removeCustomField(def.id)}>
                          ×
                        </button>
                      </label>
                    );
                  }
                  if (defType === "Number") {
                    return (
                      <label key={def.id} className="inline-check">
                        <span>{def.label}</span>
                        <input
                          type="number"
                          value={val}
                          onChange={(e) =>
                            handleChange(e.target.value === "" ? "" : Number(e.target.value))
                          }
                        />
                        <button type="button" className="btn ghost danger" onClick={() => removeCustomField(def.id)}>
                          ×
                        </button>
                      </label>
                    );
                  }
                  if (defType === "Select") {
                    return (
                      <label key={def.id} className="inline-check">
                        <span>{def.label}</span>
                        <select
                          value={val || ""}
                          onChange={(e) => handleChange(e.target.value)}
                        >
                          <option value="">{t("productForm.select")}</option>
                          {(def.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn ghost danger" onClick={() => removeCustomField(def.id)}>
                          ×
                        </button>
                      </label>
                    );
                  }
                  return (
                    <label key={def.id} className="inline-check">
                      <span>{def.label}</span>
                      <input
                        value={val}
                        onChange={(e) => handleChange(e.target.value)}
                      />
                      <button type="button" className="btn ghost danger" onClick={() => removeCustomField(def.id)}>
                        ×
                      </button>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {status.message && <p className={`status ${status.type}`}>{status.message}</p>}
      </form>
    </div>
  );
}
