import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ Email: "", Password: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      await login(form);
      const destination = location.state?.from?.pathname || "/dashboard";
      navigate(destination, { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.error || error.message || "Login failed";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page narrow">
      <h2>Welcome back</h2>
      <p className="muted">
        Use your administrator credentials. This form posts directly to{" "}
        <code>/api/auth/login</code> and stores the token for subsequent requests.
      </p>
      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            name="Email"
            value={form.Email}
            onChange={handleChange}
            placeholder="admin@company.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="Password"
            value={form.Password}
            onChange={handleChange}
            placeholder="********"
            required
          />
        </label>
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Log In"}
        </button>
        {status.message && (
          <p className={`status ${status.type}`}>{status.message}</p>
        )}
        <p className="muted">
          Need an account? <Link to="/register">Create one</Link>.
        </p>
      </form>
    </div>
  );
}
