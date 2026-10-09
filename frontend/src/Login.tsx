import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { loginUser } from "./services/api";
import { useAuth } from "./context/AuthContext";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const result = await loginUser(email, password);

      localStorage.setItem("role", result.user.role);
      login(result.access_token);

      navigate(
        result.user.role === "admin"
          ? "/admin-dashboard"
          : result.user.role === "owner"
            ? "/owner-dashboard"
            : "/user-dashboard"
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Login failed"
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Link to="/" className="auth-brand">
          <span className="auth-brand-mark">P</span>

          <span className="auth-brand-text">
            Park<span>Ease</span>
          </span>
        </Link>

        <div className="auth-visual-content">
          <div className="auth-eyebrow">
            WELCOME BACK
          </div>

          <h1>
            Parking
            <br />
            made <span>simple.</span>
          </h1>

          <p>
            Find available parking, reserve your slot and
            navigate to your destination with ParkEase.
          </p>

          <div className="auth-features">
            <span className="auth-feature">
              REAL-TIME PARKING
            </span>

            <span className="auth-feature">
              EASY RESERVATIONS
            </span>

            <span className="auth-feature">
              GPS NAVIGATION
            </span>
          </div>
        </div>
      </section>

      <section className="auth-form-area">
        <div className="auth-form-card">
          <button
            className="auth-back"
            onClick={() => navigate("/")}
          >
            ← BACK TO HOME
          </button>

          <div className="auth-form-header">
            <span className="eyebrow">
              YOUR PARKING ACCOUNT
            </span>

            <h2>
              Welcome
              <br />
              back.
            </h2>

            <p>
              Sign in to continue to your ParkEase
              dashboard.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="auth-show-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {message && (
              <div className="auth-error" role="alert">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={submitting}
            >
              {submitting && <span className="button-spinner" aria-hidden="true" />}
              {submitting ? "LOGGING IN…" : "LOGIN"}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{" "}
            <Link to="/register">Create one</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;
