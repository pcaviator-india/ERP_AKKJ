import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const money = (val) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(Number(val || 0));

export default function CustomerScreen() {
  const params = new URLSearchParams(window.location.search);
  const channel = params.get("channel") || "default";
  const [connected, setConnected] = useState(false);
  const [payload, setPayload] = useState({ items: [], totals: {} });
  const { lang } = useLanguage();
  const wsRef = useRef(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const wsUrl = apiBase.replace(/^http/i, "ws") + `/customer-screen?channel=${encodeURIComponent(channel)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "update") {
          setPayload(msg.payload || {});
        }
      } catch (err) {
        console.warn("Invalid WS message", err);
      }
    };
    return () => {
      ws.close();
    };
  }, [channel]);

  const items = useMemo(() => payload.items || [], [payload]);
  const totals = payload.totals || {};
  const customerName = payload.customer || "Cliente";
  const status = payload.status || "";
  const docType = payload.documentType || "";
  const labels = useMemo(
    () => ({
      product: lang === "es" ? "Producto" : "Product",
      qty: lang === "es" ? "Cant." : "Qty",
      price: lang === "es" ? "Precio" : "Price",
      total: lang === "es" ? "Total" : "Total",
      subtotal: lang === "es" ? "Subtotal" : "Subtotal",
      tax: lang === "es" ? "Impuestos" : "Tax",
      discount: lang === "es" ? "Descuento" : "Discount",
      waiting: lang === "es" ? "Esperando productos..." : "Waiting for products...",
      connected: lang === "es" ? "Conectado" : "Connected",
      disconnected: lang === "es" ? "Desconectado" : "Disconnected",
    }),
    [lang]
  );

  return (
    <div className="customer-screen">
      <header className="cs-header">
        <div>
          <h1>{customerName}</h1>
          <p className="muted">{docType}</p>
        </div>
        <div className={`status-dot ${connected ? "online" : "offline"}`}>
          {connected ? labels.connected : labels.disconnected}
        </div>
      </header>

      <div className="cs-totals compact">
        <div>
          <span className="label">{labels.subtotal}</span>
          <strong>{money(totals.subtotal)}</strong>
        </div>
        <div>
          <span className="label">{labels.tax}</span>
          <strong>{money(totals.tax)}</strong>
        </div>
        <div>
          <span className="label">{labels.discount}</span>
          <strong>{money(totals.discount)}</strong>
        </div>
        <div className="grand">
          <span className="label">{labels.total}</span>
          <strong className="big-total">{money(totals.total)}</strong>
        </div>
      </div>

      <main className="cs-body">
        {items.length === 0 ? (
          <div className="cs-empty">{labels.waiting}</div>
        ) : (
          <table className="cs-table">
            <thead>
              <tr>
                <th>{labels.product}</th>
                <th>{labels.qty}</th>
                <th>{labels.price}</th>
                <th>{labels.total}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`${item.name}-${idx}`}>
                  <td>{item.name}</td>
                  <td className="right">{item.qty}</td>
                  <td className="right">{money(item.price)}</td>
                  <td className="right">{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      {status && <div className="cs-status floating">{status}</div>}
    </div>
  );
}
