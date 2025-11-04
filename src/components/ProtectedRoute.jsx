import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ redirectTo = "/beta/login" }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "60px", textAlign: "center" }}>
        <div className="spinner" />
        <p style={{ marginTop: 12 }}>Checking your session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}

