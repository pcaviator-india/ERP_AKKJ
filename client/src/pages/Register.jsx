import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    CompanyName: "",
    AdminFirstName: "",
    AdminLastName: "",
    AdminEmail: "",
    Password: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      await register({
        CompanyName: form.CompanyName,
        AdminFirstName: form.AdminFirstName,
        AdminLastName: form.AdminLastName,
        AdminEmail: form.AdminEmail,
        Password: form.Password,
      });
      navigate("/company/setup", { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Registration failed";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page narrow">
      <h2>Create your AKKJ workspace</h2>
      <p className="muted">
        Provide primary company and administrator details. In production this maps to <code>/api/companies</code> and
        <code>/api/auth/register</code>.
      </p>
      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Company name
          <input
            type="text"
            name="CompanyName"
            value={form.CompanyName}
            onChange={handleChange}
            required
            placeholder="Comercial Ejemplo SpA"
          />
        </label>
        <label>
          Administrator first name
          <input
            type="text"
            name="AdminFirstName"
            value={form.AdminFirstName}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Administrator last name
          <input
            type="text"
            name="AdminLastName"
            value={form.AdminLastName}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Administrator email
          <input
            type="email"
            name="AdminEmail"
            value={form.AdminEmail}
            onChange={handleChange}
            required
            placeholder="admin@company.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="Password"
            value={form.Password}
            onChange={handleChange}
            required
            placeholder="********"
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </button>
        {status.message && (
          <p className={`status ${status.type}`}>
            {status.message} {status.type === "error" && "Please retry."}
          </p>
        )}
      </form>
    </div>
  );
}
