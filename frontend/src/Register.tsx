import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  registerUser,
  submitOwnerVerification,
  type OwnerVerificationSubmission,
} from "./services/api";
import { useAuth } from "./context/AuthContext";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyRelationship, setPropertyRelationship] =
    useState<OwnerVerificationSubmission["property_relationship"]>("OWNER");
  const [propertyIdentifier, setPropertyIdentifier] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (role === "owner") {
      if (!propertyName.trim() || !propertyAddress.trim() || documents.length === 0) {
        setMessage("Owners must provide property details and at least one evidence document.");
        return;
      }
      if (!latitude.trim() || !longitude.trim()) {
        setMessage("Owners must provide the property's map location.");
        return;
      }
      if (documents.length > 8) {
        setMessage("You can submit up to 8 property evidence documents at a time.");
        return;
      }
      if (documents.some((file) => file.size > 10 * 1024 * 1024) ||
          documents.reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024) {
        setMessage("Each document must be 10 MB or smaller and all documents together must be 25 MB or smaller.");
        return;
      }
    }

    setSubmitting(true);

    try {
      const result = await registerUser({
        name,
        email,
        password,
        role,
      });

      localStorage.setItem("role", result.user.role);
      login(result.access_token);

      if (result.user.role === "owner") {
        try {
          await submitOwnerVerification({
            property_name: propertyName.trim(),
            property_address: propertyAddress.trim(),
            property_relationship: propertyRelationship,
            property_identifier: propertyIdentifier.trim() || undefined,
            latitude: Number(latitude),
            longitude: Number(longitude),
            files: documents,
          });
        } catch (error) {
          navigate("/owner-dashboard", {
            state: {
              verificationNotice:
                error instanceof Error
                  ? error.message
                  : "Your account was created, but the property evidence could not be submitted. Please try again from your dashboard.",
            },
          });
          return;
        }
      }

      navigate(result.user.role === "owner" ? "/owner-dashboard" : "/user-dashboard");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Registration failed"
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
            JOIN PARKEASE
          </div>

          <h1>
            Your
            <br />
            smarter <span>parking</span>
            <br />
            journey.
          </h1>

          <p>
            Create your ParkEase account and discover a simpler way to find and manage parking.
          </p>

          <div className="auth-features">
            <span className="auth-feature">
              FIND PARKING
            </span>

            <span className="auth-feature">
              RESERVE SLOTS
            </span>

            <span className="auth-feature">
              MANAGE PARKING
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
              CREATE ACCOUNT
            </span>

            <h2>
              Get
              <br />
              started.
            </h2>

            <p>
              Create your ParkEase account in a few seconds.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                minLength={2}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
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
                <label htmlFor="reg-password">Password</label>
                <button
                  type="button"
                  className="auth-show-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <fieldset className="auth-field auth-role-field">
              <legend>Account Type</legend>
              <div className="auth-role-picker" role="radiogroup" aria-label="Account Type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === "user"}
                  className={`auth-role-option ${role === "user" ? "auth-role-active" : ""}`}
                  onClick={() => setRole("user")}
                >
                  <span className="auth-role-icon">🚗</span>
                  <span className="auth-role-name">Parking User</span>
                  <span className="auth-role-desc">Find &amp; reserve slots</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={role === "owner"}
                  className={`auth-role-option ${role === "owner" ? "auth-role-active" : ""}`}
                  onClick={() => setRole("owner")}
                >
                  <span className="auth-role-icon">🏢</span>
                  <span className="auth-role-name">Parking Owner</span>
                  <span className="auth-role-desc">Manage lots &amp; slots</span>
                </button>
              </div>
            </fieldset>

            {role === "owner" && (
              <section className="owner-signup-verification" aria-labelledby="owner-verification-heading">
                <h3 id="owner-verification-heading">Property verification</h3>
                <p>
                  Submit evidence for manual review. Uploading documents does not automatically approve or prove ownership.
                </p>

                <div className="auth-field">
                  <label htmlFor="owner-property-name">Property name</label>
                  <input
                    id="owner-property-name"
                    type="text"
                    value={propertyName}
                    onChange={(event) => setPropertyName(event.target.value)}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="owner-property-address">Property address</label>
                  <input
                    id="owner-property-address"
                    type="text"
                    value={propertyAddress}
                    onChange={(event) => setPropertyAddress(event.target.value)}
                    maxLength={255}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="owner-property-relationship">Relationship to property</label>
                  <select
                    id="owner-property-relationship"
                    value={propertyRelationship}
                    onChange={(event) =>
                      setPropertyRelationship(
                        event.target.value as OwnerVerificationSubmission["property_relationship"]
                      )
                    }
                  >
                    <option value="OWNER">Owner</option>
                    <option value="TENANT">Tenant</option>
                    <option value="AUTHORIZED_OPERATOR">Authorized operator</option>
                  </select>
                </div>

                <div className="auth-field">
                  <label htmlFor="owner-property-identifier">Property identifier (if applicable)</label>
                  <input
                    id="owner-property-identifier"
                    type="text"
                    value={propertyIdentifier}
                    onChange={(event) => setPropertyIdentifier(event.target.value)}
                    maxLength={150}
                  />
                </div>

                <div className="auth-field">
                  <label>Property map location</label>
                  <div className="owner-signup-coordinates">
                    <input
                      type="number"
                      aria-label="Property latitude"
                      placeholder="Latitude"
                      step="any"
                      min="-90"
                      max="90"
                      required
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                    />
                    <input
                      type="number"
                      aria-label="Property longitude"
                      placeholder="Longitude"
                      step="any"
                      min="-180"
                      max="180"
                      required
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="owner-property-documents">Property evidence (PDF, JPG, PNG; up to 8)</label>
                  <input
                    id="owner-property-documents"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    multiple
                    required
                    onChange={(event) => setDocuments(Array.from(event.target.files ?? []))}
                  />
                  <small>
                    Owner: ownership/property record. Tenant or operator: lease or written authorization, plus relevant property evidence.
                  </small>
                </div>
              </section>
            )}

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
              {submitting ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login">Login</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;
