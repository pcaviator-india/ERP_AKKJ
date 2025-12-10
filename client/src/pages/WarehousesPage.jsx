import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/http';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/api/products/warehouses');
      setWarehouses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to load warehouses' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setStatus({ type: '', message: '' });
    const payload = {
      WarehouseName: name.trim(),
      AddressLine1: address.trim() || null,
      City: city.trim() || null,
      IsDefault: isDefault,
      IsActive: isActive,
    };
    try {
      if (editingId) {
        await api.put(`/api/products/warehouses/${editingId}`, payload);
        setStatus({ type: 'success', message: 'Warehouse updated' });
      } else {
        await api.post('/api/products/warehouses', payload);
        setStatus({ type: 'success', message: 'Warehouse added' });
      }
      setName('');
      setAddress('');
      setCity('');
      setIsDefault(false);
      setIsActive(true);
      setEditingId(null);
      await load();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to save warehouse' });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (w) => {
    setEditingId(w.WarehouseID);
    setName(w.WarehouseName || '');
    setAddress(w.AddressLine1 || '');
    setCity(w.City || '');
    setIsDefault(!!w.IsDefault);
    setIsActive(w.IsActive !== 0);
    setStatus({ type: '', message: '' });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/products/warehouses/${id}`);
      await load();
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to delete warehouse' });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setAddress('');
    setCity('');
    setIsDefault(false);
    setIsActive(true);
    setStatus({ type: '', message: '' });
  };

  return (
    <div className='page'>
      <header className='list-header'>
        <div>
          <h2>Warehouses</h2>
          <p className='muted'>Create and manage warehouses.</p>
        </div>
        <div className='list-actions'>
          <Link className='btn ghost' to='/products'>
            Products
          </Link>
        </div>
      </header>

      {status.message && <p className={`status ${status.type}`}>{status.message}</p>}

      <div className='card'>
        <form onSubmit={handleSave} className='form'>
          <label>
            Warehouse name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Name' />
          </label>
          <label>
            Address
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder='Address' />
          </label>
          <div className='grid' style={{ gridTemplateColumns: "1fr 140px 140px", gap: "0.75rem" }}>
            <label>
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder='City' />
            </label>
            <label className='inline-check' style={{ alignItems: "center", marginTop: "22px" }}>
              <input type='checkbox' checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              <span>Default</span>
            </label>
            <label className='inline-check' style={{ alignItems: "center", marginTop: "22px" }}>
              <input type='checkbox' checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Active</span>
            </label>
          </div>
          <div className='form-actions' style={{ justifyContent: 'flex-end' }}>
            <button className='btn primary' type='submit' disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Update warehouse' : 'Add warehouse'}
            </button>
            {editingId && (
              <button type='button' className='btn ghost' onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className='card'>
        {warehouses.length === 0 ? (
          <p className='muted'>No warehouses.</p>
        ) : (
          <div className='entity-list'>
            {warehouses.map((w) => (
              <div key={w.WarehouseID || w.WarehouseName} className='entity-row'>
                <div>
                  <div className='entity-name'>{w.WarehouseName}</div>
                  <div className='entity-meta'>
                    {[w.AddressLine1, w.City].filter(Boolean).join(', ') || 'No address'}
                  </div>
                </div>
                <div className='list-actions inline'>
                  {w.IsDefault ? <span className='badge-primary'>Default</span> : null}
                  {w.IsActive === 0 ? <span className='badge-warning'>Inactive</span> : null}
                  <button className='icon-btn' title='Edit' onClick={() => startEdit(w)}>
                    Edit
                  </button>
                  <button className='icon-btn' title='Delete' onClick={() => handleDelete(w.WarehouseID)}>
                    Del
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
