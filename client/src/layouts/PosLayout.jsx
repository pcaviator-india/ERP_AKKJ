import { Outlet } from "react-router-dom";

export default function PosLayout() {
  return (
    <div className="pos-shell">
      <Outlet />
    </div>
  );
}
