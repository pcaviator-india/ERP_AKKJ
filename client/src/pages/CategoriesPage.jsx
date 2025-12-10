import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/http";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragStartX = useRef(null);

  const load = async () => {
    try {
      const res = await api.get("/api/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to load categories" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setStatus({ type: "", message: "" });
    const payload = { CategoryName: name.trim(), ParentCategoryID: parentId || null };
    try {
      if (editingId) {
        await api.put(`/api/categories/${editingId}`, payload);
        setStatus({ type: "success", message: "Category updated" });
      } else {
        await api.post("/api/categories", payload);
        setStatus({ type: "success", message: "Category added" });
      }
      setName("");
      setParentId("");
      setEditingId(null);
      await load();
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to save category" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (category) => {
    setEditingId(category.ProductCategoryID || category.CategoryID);
    setName(category.CategoryName);
    setParentId(category.ParentCategoryID || "");
    setStatus({ type: "", message: "" });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/categories/${id}`);
      await load();
    } catch (err) {
      setStatus({ type: "error", message: "Failed to delete category" });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setParentId("");
    setStatus({ type: "", message: "" });
  };

  const categoryById = categories.reduce((acc, c) => {
    const id = c.ProductCategoryID || c.CategoryID;
    acc[id] = c;
    return acc;
  }, {});

  const selectableParents = categories.filter((c) => {
    const id = c.ProductCategoryID || c.CategoryID;
    return id !== editingId;
  });

  const buildTree = () => {
    const map = {};
    const roots = [];
    categories.forEach((c) => {
      const id = c.ProductCategoryID || c.CategoryID;
      map[id] = { ...c, id, children: [] };
    });
    Object.values(map).forEach((node) => {
      const parentId = node.ParentCategoryID;
      if (parentId && map[parentId]) {
        map[parentId].children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  };

  const isAncestor = (candidateAncestorId, targetId) => {
    let current = categoryById[targetId]?.ParentCategoryID;
    while (current) {
      if (current === candidateAncestorId) return true;
      current = categoryById[current]?.ParentCategoryID;
    }
    return false;
  };

  const handleMove = async (categoryId, newParentId) => {
    const current = categoryById[categoryId];
    if (!current) return;
    if (newParentId === categoryId) return;
    if (newParentId && isAncestor(categoryId, newParentId)) return; // prevent cycles
    const payload = {
      CategoryName: current.CategoryName,
      ParentCategoryID: newParentId || null,
      IsActive: current.IsActive ?? 1,
    };
    try {
      setSaving(true);
      await api.put(`/api/categories/${categoryId}`, payload);
      setCategories((prev) =>
        prev.map((c) => {
          const id = c.ProductCategoryID || c.CategoryID;
          if (id === categoryId) {
            return { ...c, ParentCategoryID: newParentId || null };
          }
          return c;
        })
      );
      setStatus({ type: "success", message: "Category moved" });
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: "Failed to move category" });
    } finally {
      setSaving(false);
      setDraggingId(null);
      setDragOverId(null);
    }
  };

  const renderNode = (node, depth = 0) => {
    const isDragOver = dragOverId === node.id;
    return (
      <div key={node.id} style={{ marginLeft: depth * 16 }}>
        <div
          className="entity-row"
          draggable
          onDragStart={(e) => {
            dragStartX.current = e.clientX;
            setDraggingId(node.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingId && draggingId !== node.id && !isAncestor(draggingId, node.id)) {
              setDragOverId(node.id);
            }
          }}
          onDragLeave={() => setDragOverId((prev) => (prev === node.id ? null : prev))}
          onDragEnd={(e) => {
            const deltaX = (dragStartX.current ?? e.clientX) - e.clientX;
            // If user drags left beyond threshold, promote to top level
            if (draggingId && deltaX > 40) {
              handleMove(draggingId, null);
            }
            dragStartX.current = null;
            setDraggingId(null);
            setDragOverId(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggingId && draggingId !== node.id && !isAncestor(draggingId, node.id)) {
              handleMove(draggingId, node.id);
            }
          }}
          style={{
            border: isDragOver ? "1px dashed #4a90e2" : undefined,
            background: isDragOver ? "#f0f6ff" : undefined,
          }}
        >
          <span className="entity-name">{node.CategoryName}</span>
          <div className="list-actions inline">
            <button
              className="icon-btn"
              title="Use as parent"
              onClick={() => setParentId(node.id)}
              disabled={node.id === editingId}
              style={{ minWidth: 110 }}
            >
              Use as parent
            </button>
            <button className="icon-btn" title="Edit" onClick={() => startEdit(node)}>
              Edit
            </button>
            <button className="icon-btn" title="Delete" onClick={() => handleDelete(node.id)}>
              Del
            </button>
          </div>
        </div>
        {node.children && node.children.length > 0
          ? node.children
              .sort((a, b) => a.CategoryName.localeCompare(b.CategoryName))
              .map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  const tree = buildTree().sort((a, b) => a.CategoryName.localeCompare(b.CategoryName));

  return (
    <div className="page">
      <header className="list-header">
        <div>
          <h2>Categories</h2>
          <p className="muted">View and manage categories.</p>
        </div>
        <div className="list-actions">
          <Link className="btn ghost" to="/products">
            Products
          </Link>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className="card">
        <form onSubmit={handleSave} className="form">
          <label>
            Category name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
          </label>
          <label>
            Parent category (optional)
            <select
              value={parentId}
              onChange={(e) => {
                const val = e.target.value;
                setParentId(val ? Number(val) : "");
              }}
            >
              <option value="">No parent</option>
              {selectableParents.map((c) => {
                const id = c.ProductCategoryID || c.CategoryID;
                return (
                  <option key={id} value={id}>
                    {c.CategoryName}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="form-actions" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update category" : "Add category"}
            </button>
            {editingId && (
              <button type="button" className="btn ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        {categories.length === 0 ? (
          <p className="muted">No categories.</p>
        ) : (
          <div className="entity-list">
            <div
              className="entity-row"
              style={{ fontStyle: "italic", opacity: 0.8 }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingId) setDragOverId("root");
              }}
              onDragLeave={() => setDragOverId((prev) => (prev === "root" ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) handleMove(draggingId, null);
              }}
            >
              <span>Drop here to make top-level</span>
            </div>
            {tree.map((node) => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}
