import { useLocation, Navigate } from "react-router-dom";
import { useMe } from "../hooks/useMe";

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const { loading } = useMe();
  const location = useLocation();
  const hasToken = Boolean(localStorage.getItem("access_token"));

  if (loading) {
    // While we're verifying the user, show nothing to prevent flashes of content.
    return null;
  }

  if (!hasToken) {
    // If loading is finished and we still have no token,
    // redirect to the login page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If we have a user, render the protected application content.
  return <>{children}</>;
}
