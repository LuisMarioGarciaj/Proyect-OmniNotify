import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Bell } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
}

const DashboardLayout: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // Escuchar cambios en el estado del sidebar (podrías usar Context o Redux)
    // Por ahora, usaremos localStorage o un estado compartido
    const handleStorageChange = () => {
      const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
      setSidebarCollapsed(isCollapsed);
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Obtener el título de la página actual
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('templates')) return 'Templates';
    if (path.includes('contacts')) return 'Contacts';
    if (path.includes('notifications')) return 'Send Notifications';
    if (path.includes('profile')) return 'Profile';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        user={user ? {
          name: user.name,
          email: user.email,
          role: user.role,
          id: user.id,
          company_id: user.company_id
        } : null} 
      />
      
      {/* Main Content - Se adapta dinámicamente */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Header */}
        <header className="bg-white shadow">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{getPageTitle()}</h2>
                <p className="text-gray-600 text-sm sm:text-base">Welcome back, {user?.name || 'User'}!</p>
              </div>
              <div className="flex items-center space-x-4">
                <button className="p-2 text-gray-600 hover:text-gray-800">
                  <Bell size={20} />
                </button>
                <div className="flex items-center">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-3 hidden md:block">
                    <p className="font-medium">{user?.name || 'User'}</p>
                    <p className="text-sm text-gray-600">{user?.role || 'User'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area - con menos padding en móvil */}
        <main className="p-2 sm:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;