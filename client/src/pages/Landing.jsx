import { Link } from "react-router-dom";
import "./styles.css";

const steps = [
  {
    title: "1. Create Account",
    description: "Register your company and administrator credentials in a single step.",
  },
  {
    title: "2. Complete Company Profile",
    description: "Fill in legal and operational information so documents align with SII/SAP standards.",
  },
  {
    title: "3. Invite Your Team",
    description: "Add employees with roles so they can start working with inventory, sales and AP/AR.",
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <div>
          <p className="eyebrow">AKKJ ERP</p>
          <h1>All your back-office workflows, one secure platform.</h1>
          <p className="lead">
            Stand up authentication, company configuration, inventory and financial flows in minutes.
            Begin with login & registration, then continue with guided onboarding to finish company
            profile and invite employees.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn primary">
              Log In
            </Link>
            <Link to="/register" className="btn ghost">
              Create Account
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <p>Next milestone</p>
          <h3>Finish Company Profile</h3>
          <p className="muted">
            Complete your company details to unlock document sequences, warehouses and tax automation.
          </p>
          <Link to="/company/setup" className="btn secondary">
            Continue Setup
          </Link>
        </div>
      </section>

      <section className="steps">
        {steps.map((step) => (
          <article key={step.title}>
            <h4>{step.title}</h4>
            <p>{step.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
