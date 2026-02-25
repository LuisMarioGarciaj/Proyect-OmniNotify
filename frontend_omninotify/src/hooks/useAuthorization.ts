// src/hooks/useAuthorization.ts
import { useMemo } from 'react';

interface User {
  id?: string;
  name: string;
  email: string;
  role: string;
  company_id?: string;
  credits?: number;
}

type UserRole = 'ADMIN' | 'OPERATOR';

// Exportamos los permisos para usarlos en otros lugares
export const ROLE_PERMISSIONS = {
  ADMIN: [
    'dashboard',
    'company',
    'templates',
    'contacts',
    'tags',
    'notifications',
    'credits',
    'profile',
    'sms-config',
    'email-configuration'
  ],
  OPERATOR: [
    'dashboard', 
    'company',
    'templates',
    'contacts',
    'tags',
    'notifications',
    'credits',
    'profile'
  ]
} as const;

export type Permission = typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS][number];

export const useAuthorization = (user: User | null | undefined) => {
  const userRole = (user?.role?.toUpperCase() as UserRole) || 'OPERATOR';
  
  const permissions = useMemo(() => {
    return ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.OPERATOR;
  }, [userRole]);

  const canAccess = (menuItemId: string): boolean => {
    return permissions.includes(menuItemId as any);
  };

  const isAdmin = userRole === 'ADMIN';
  const isOperator = userRole === 'OPERATOR';

  return {
    userRole,
    permissions,
    canAccess,
    isAdmin,
    isOperator
  };
};

export type { UserRole };