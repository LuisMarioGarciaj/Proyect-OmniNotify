// src/components/RoleGuard.tsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROLE_PERMISSIONS } from '../hooks/useAuthorization';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredPermission: string;
  fallbackPath?: string;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ 
  children, 
  requiredPermission,
  fallbackPath = '/dashboard' 
}) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Obtener usuario del localStorage
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role?.toUpperCase() as keyof typeof ROLE_PERMISSIONS;
  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.OPERATOR;

  if (!permissions.includes(requiredPermission as any)) {
    console.log(`🔒 Acceso denegado a ${requiredPermission} para rol ${userRole}`);
    return <Navigate to={fallbackPath} replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default RoleGuard;