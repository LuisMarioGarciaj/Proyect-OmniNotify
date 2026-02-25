// src/components/RoleProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthorization } from '../hooks/useAuthorization';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission: string;
  fallbackPath?: string;
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ 
  children, 
  requiredPermission,
  fallbackPath = '/dashboard'
}) => {
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const { canAccess } = useAuthorization(userData);

  if (!canAccess(requiredPermission)) {
    // Si no tiene permiso, redirigir al dashboard
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;