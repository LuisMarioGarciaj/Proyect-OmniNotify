// frontend_omninitify/src/components/Header.tsx
import React, { useState, useEffect } from 'react';
import { Bell, ChevronLeft, ChevronRight, Coins, CreditCard, Loader2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { creditsService } from '../services/credits.service';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  company_name?: string;
  credits?: number;
  whatsapp_configured?: boolean;
}

interface HeaderProps {
  user: UserData | null;
  title: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onCreditsUpdate?: (credits: number) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  user, 
  title, 
  sidebarOpen, 
  setSidebarOpen,
  onCreditsUpdate 
}) => {
  const navigate = useNavigate();
  const [credits, setCredits] = useState<number>(0);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showCreditsTooltip, setShowCreditsTooltip] = useState(false);

  // Obtener company_id del usuario logueado
  const getCompanyId = (): string | null => {
    // Prioridad 1: Del prop user
    if (user?.company_id) {
      return user.company_id;
    }
    // Prioridad 2: Del localStorage
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (userData.company_id) {
      return userData.company_id;
    }
    return null;
  };

  // 🔥 Cargar créditos desde el backend
  const loadCredits = async () => {
    const companyId = getCompanyId();
    if (!companyId) {
      console.log('⚠️ Header: No hay company_id disponible');
      return;
    }
    
    setLoadingCredits(true);
    try {
      console.log('💰 Header: Cargando créditos para empresa:', companyId);
      
      const balance = await creditsService.getBalance(companyId);
      console.log('✅ Header: Créditos cargados:', balance);
      
      setCredits(balance.credits);
      
      // Actualizar localStorage
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      userData.credits = balance.credits;
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      if (onCreditsUpdate) {
        onCreditsUpdate(balance.credits);
      }
    } catch (error) {
      console.error('❌ Header: Error cargando créditos:', error);
      
      // Fallback: usar créditos del usuario si existen
      if (user?.credits !== undefined) {
        console.log('📦 Header: Usando créditos del usuario:', user.credits);
        setCredits(user.credits);
      }
    } finally {
      setLoadingCredits(false);
    }
  };

  // Cargar créditos al montar y cuando cambie el usuario
  useEffect(() => {
    loadCredits();
  }, [user?.company_id]);

  // Escuchar evento de actualización de créditos
  useEffect(() => {
    const handleCreditsUpdate = (event: CustomEvent) => {
      console.log('💰 Header: Evento credits-updated recibido:', event.detail);
      const companyId = getCompanyId();
      if (companyId && event.detail.companyId === companyId) {
        setCredits(event.detail.credits);
        
        // Actualizar localStorage
        const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        userData.credits = event.detail.credits;
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        if (onCreditsUpdate) {
          onCreditsUpdate(event.detail.credits);
        }
      }
    };

    window.addEventListener('credits-updated' as any, handleCreditsUpdate);
    
    return () => {
      window.removeEventListener('credits-updated' as any, handleCreditsUpdate);
    };
  }, []);

  const handleRecharge = () => {
    navigate('/credits/recharge');
  };

  const handleRefreshCredits = () => {
    loadCredits();
  };

  const getCreditsColor = () => {
    if (credits <= 50) return 'from-red-500 to-rose-500';
    if (credits <= 200) return 'from-yellow-500 to-amber-500';
    return 'from-green-500 to-emerald-500';
  };

  const getCreditsBgColor = () => {
    if (credits <= 50) return 'bg-red-50 text-red-700 border-red-200';
    if (credits <= 200) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    return 'bg-green-50 text-green-700 border-green-200';
  };

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-30 border-b border-gray-200/50">
      <div className="px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          {/* Left section with title and welcome */}
          <div className="flex items-center w-full sm:w-auto">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:block mr-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-xl transition-all duration-200"
              title={sidebarOpen ? "Contraer menú" : "Expandir menú"}
            >
              {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {title}
              </h1>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                <span>👋</span>
                Welcome back, <span className="font-semibold text-gray-700">{user?.name || 'User'}</span>!
              </p>
            </div>
          </div>
          
          {/* Right section with credits, notifications and profile */}
          <div className="flex items-center justify-end w-full sm:w-auto gap-3">
            {/* Credits Display */}
            <div className="relative group">
              <button
                onClick={handleRecharge}
                onMouseEnter={() => setShowCreditsTooltip(true)}
                onMouseLeave={() => setShowCreditsTooltip(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${getCreditsBgColor()} hover:shadow-md transition-all duration-200 transform hover:scale-105`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getCreditsColor()} flex items-center justify-center shadow-sm`}>
                  <Coins size={16} className="text-white" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium opacity-75">Créditos</span>
                  <div className="flex items-center gap-1">
                    {loadingCredits ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <span className="font-bold text-lg leading-none">{credits.toLocaleString()}</span>
                    )}
                    <Zap size={14} className="opacity-60" />
                  </div>
                </div>
                <div className="h-8 w-px bg-gray-200 mx-1"></div>
                <CreditCard size={16} className="opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
              
              {/* Tooltip */}
              {showCreditsTooltip && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 text-white rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="absolute -top-1 right-6 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                  <p className="font-medium text-sm mb-1 flex items-center gap-1">
                    <Coins size={14} />
                    Tus Créditos
                  </p>
                  <p className="text-xs text-gray-300 mb-2">
                    Usa tus créditos para enviar notificaciones
                  </p>
                  <div className="bg-gray-800 rounded-lg p-2 text-xs">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Disponibles:</span>
                      <span className={`font-bold ${
                        credits <= 50 ? 'text-red-400' : credits <= 200 ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        {credits.toLocaleString()}
                      </span>
                    </div>
                    <button 
                      onClick={handleRefreshCredits}
                      className="w-full mb-2 bg-gray-700 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-gray-600 transition-all flex items-center justify-center gap-1"
                    >
                      {loadingCredits ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        'Actualizar saldo'
                      )}
                    </button>
                  </div>
                  <button 
                    onClick={handleRecharge}
                    className="w-full mt-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium py-2 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all"
                  >
                    Recargar Ahora
                  </button>
                </div>
              )}
            </div>

            {/* Notifications */}
            <button className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-xl transition-all duration-200">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                3
              </span>
            </button>
            
            {/* User Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
              <div className="hidden md:block text-right">
                <p className="font-semibold text-sm text-gray-800">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  {user?.role || 'User'}
                </p>
              </div>
              <div className="relative group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md cursor-pointer transform transition-transform group-hover:scale-105">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;