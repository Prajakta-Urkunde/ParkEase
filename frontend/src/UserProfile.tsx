import { useAuth } from "./context/AuthContext";
import "./UserProfile.css";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function UserProfile() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="profile-container">
        <div className="profile-card">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar" aria-hidden="true">
            {getInitials(user.name)}
          </div>

          <div className="profile-identity">
            <p className="profile-eyebrow">Your ParkEase account</p>
            <h2>{user.name}</h2>
            <p className="profile-email">{user.email}</p>
          </div>

          <span className="profile-role-badge">
            {user.role === "owner" ? "Parking Owner" : "Parking User"}
          </span>
        </div>

        <div className="profile-account-status" role="status">
          <span className="profile-status-dot" aria-hidden="true" />
          <span>Account active</span>
        </div>

        <div className="profile-details">
          <div className="profile-detail-item">
            <strong>Full Name</strong>
            <p>{user.name}</p>
          </div>

          <div className="profile-detail-item">
            <strong>Email</strong>
            <p>{user.email}</p>
          </div>

          <div className="profile-detail-item">
            <strong>Account Type</strong>
            <p>{user.role === "owner" ? "Parking Owner" : "Parking User"}</p>
          </div>

          <div className="profile-detail-item">
            <strong>User ID</strong>
            <p>{user.id}</p>
          </div>
        </div>

        <button
          type="button"
          className="profile-logout"
          onClick={logout}
          aria-label="Log out of ParkEase"
        >
          <span aria-hidden="true">↪</span>
          Log out of ParkEase
        </button>
      </div>
    </section>
  );
}

export default UserProfile;
