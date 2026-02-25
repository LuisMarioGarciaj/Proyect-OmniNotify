// src/components/Sidebar.tsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Mail, 
  Users, 
  Bell, 
  User, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Tag,
  Building,
  MessageSquare,
  Coins,
  Settings
} from 'lucide-react';
import { useAuthorization } from '../hooks/useAuthorization';

interface SidebarProps {
  user?: {
    id?: string;
    name: string;
    email: string;
    role: string;
    company_id?: string;
    credits?: number;
  } | null;
}

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  
  // Usar el hook de autorización
  const { canAccess, isAdmin } = useAuthorization(user);

  // Definir todos los menús disponibles
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { id: 'company', label: 'Company', icon: <Building size={20} />, path: '/company' },
    { id: 'templates', label: 'Templates', icon: <Mail size={20} />, path: '/templates' },
    { id: 'contacts', label: 'Contacts', icon: <Users size={20} />, path: '/contacts' },
    { id: 'tags', label: 'Tags', icon: <Tag size={20} />, path: '/tags' },
    { id: 'notifications', label: 'Send Notifications', icon: <Bell size={20} />, path: '/notifications' },
    { id: 'credits', label: 'Mis Créditos', icon: <Coins size={20} />, path: '/credits/recharge' },
    { id: 'profile', label: 'Profile', icon: <User size={20} />, path: '/profile' },
    { id: 'sms-config', label: 'Configuración SMS', icon: <MessageSquare size={20} />, path: '/sms-configuration' },
    { id: 'email-configuration', label: 'Configuración Email', icon: <Settings size={20} />, path: '/email-configuration' },
  ];

  // Filtrar menús según permisos del rol
  const menuItems = allMenuItems.filter(item => canAccess(item.id));

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('remembered_email');
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Obtener el badge del rol
  const getRoleBadge = () => {
    if (!user) return null;
    
    const roleStyles = {
      ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
      OPERATOR: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    
    const roleLabels = {
      ADMIN: 'Administrador',
      OPERATOR: 'Operador'
    };
    
    const role = user.role?.toUpperCase() as keyof typeof roleStyles;
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${roleStyles[role] || roleStyles.OPERATOR}`}>
        {roleLabels[role] || roleLabels.OPERATOR}
      </span>
    );
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar for Desktop */}
      <div className={`hidden lg:block fixed left-0 top-0 h-screen bg-white shadow-lg transition-all duration-300 z-40 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        {/* Header con botón de toggle */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <LayoutDashboard className="text-blue-600" size={28} />
            {sidebarOpen && (
              <h1 className="ml-3 text-xl font-bold text-gray-800">Omni-Notify</h1>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1 hover:bg-gray-100 rounded-lg transition"
              title="Collapse sidebar"
            >
              <ChevronLeft size={20} />
            </button>
          )}
        </div>
        
        {/* Menu Items */}
        <div className="p-4 h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
          <nav className="space-y-2">
            {menuItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.id === 'dashboard'}
                className={({ isActive }) => 
                  `flex items-center p-3 rounded-lg transition-all ${isActive
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
                title={!sidebarOpen ? item.label : ''}
              >
                {({ isActive }) => (
                  <>
                    <span className={`${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                      {item.icon}
                    </span>
                    {sidebarOpen && (
                      <span className="ml-3 font-medium">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        
        {/* Footer del Sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          {/* User info */}
          <div className="flex items-center p-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {sidebarOpen && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate text-sm">{user?.name || 'User'}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {getRoleBadge()}
                </div>
              </div>
            )}
            {!sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="ml-auto p-1 hover:bg-gray-100 rounded-lg"
                title="Expand sidebar"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
          
          {/* Logout button */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center p-3 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-700 transition ${!sidebarOpen ? 'justify-center' : ''}`}
            title={!sidebarOpen ? 'Logout' : ''}
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="ml-3">Cerrar Sesión</span>}
          </button>
        </div>
      </div>

      {/* Indicador de sidebar contraído para mostrar botón de expandir */}
      {!sidebarOpen && (
        <div className="hidden lg:block fixed left-0 top-1/2 transform -translate-y-1/2 z-30">
          <button
            onClick={toggleSidebar}
            className="ml-2 p-2 bg-white shadow-lg rounded-r-lg hover:bg-gray-50 transition border border-l-0"
            title="Expand sidebar"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center">
                <LayoutDashboard className="text-blue-600" size={28} />
                <h1 className="ml-3 text-xl font-bold text-gray-800">Omni-Notify</h1>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto h-[calc(100vh-80px)]">
              <nav className="space-y-2">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.id === 'dashboard'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center p-3 rounded-lg transition-all ${isActive
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                          {item.icon}
                        </span>
                        <span className="ml-3 font-medium">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
              
              {/* Información del rol en móvil */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-gray-500">Tu rol:</span>
                  {getRoleBadge()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;