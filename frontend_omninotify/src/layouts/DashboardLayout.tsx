// src/layouts/DashboardLayout.tsx
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header'; // <-- Importa el Header
import SessionExpiredModal from '../components/SessionExpiredModal';
import useAuthCheck from '../hooks/useAuthCheck'; 

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  credits?: number;
}

const DashboardLayout: React.FC = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true); // <-- Estado para el sidebar
  const location = useLocation();
  const navigate = useNavigate();
  
  const {
    showExpiredModal,
    timeRemaining,
    setShowExpiredModal,
    handleExtendSession,
    handleLogoutNow,
  } = useAuthCheck();

  useEffect(() => {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Escuchar actualizaciones de créditos
  useEffect(() => {
    const handleCreditsUpdate = (event: CustomEvent) => {
      if (user && event.detail.companyId === user.company_id) {
        setUser(prev => prev ? { ...prev, credits: event.detail.credits } : null);
      }
    };

    window.addEventListener('credits-updated' as any, handleCreditsUpdate);
    return () => {
      window.removeEventListener('credits-updated' as any, handleCreditsUpdate);
    };
  }, [user]);

  // Obtener el título de la página actual
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('templates')) return 'Templates';
    if (path.includes('contacts')) return 'Contacts';
    if (path.includes('tags')) return 'Tags';
    if (path.includes('notifications')) return 'Send Notifications';
    if (path.includes('profile')) return 'Profile';
    if (path.includes('credits')) return 'Recargar Créditos';
    if (path.includes('company')) return 'Company';
    if (path.includes('sms-configuration')) return 'Configuración SMS';
    if (path.includes('email-configuration')) return 'Configuración Email';
    return 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} />
      
      {/* Modal de sesión por expirar */}
      <SessionExpiredModal
        isOpen={showExpiredModal}
        onClose={() => setShowExpiredModal(false)}
        countdown={timeRemaining}
        onExtend={handleExtendSession}
        onLogout={handleLogoutNow}
      />
      
      {/* Main Content - Se adapta dinámicamente */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Header con créditos */}
        <Header 
          user={user}
          title={getPageTitle()}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main Content Area */}
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;