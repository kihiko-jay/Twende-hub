import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/lib/supabase.types.ts";

interface RequireAuthProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="pt-24 flex items-center justify-center text-stone-600">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.is_suspended) {
    return (
      <div className="pt-24 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-2xl font-semibold text-red-600">Account suspended</h1>
        <p className="text-stone-600">
          Your account has been suspended by an administrator. If you believe this is a mistake,
          please contact support.
        </p>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

