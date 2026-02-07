// src/components/ProtectedRoute.tsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const token = localStorage.getItem('auth_token');

  useEffect(() => {
    const checkTokenValidity = () => {
      if (!token) {
        setIsValid(false);
        return;
      }

      try {
        // Decodificar el token JWT para verificar la expiración
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        
        const payload = JSON.parse(jsonPayload);
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Verificar si el token ha expirado
        if (payload.exp && payload.exp < currentTime) {
          console.log('Token expirado. Redirigiendo a login...');
          // Limpiar localStorage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          setIsValid(false);
        } else {
          setIsValid(true);
        }
      } catch (error) {
        console.error('Error verificando token:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        setIsValid(false);
      }
    };

    checkTokenValidity();
  }, [token]);

  // Mostrar loading mientras se verifica
  if (isValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    // Redirige al login si el token no es válido o ha expirado
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;