// src/components/SessionExpiredModal.tsx - VERSIÓN ACTUALIZADA
import React, { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, LogIn } from 'lucide-react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  countdown: number;
  onExtend: () => void;
  onLogout: () => void;
}

const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ 
  isOpen, 
  onClose, 
  countdown, 
  onExtend, 
  onLogout 
}) => {
  const [localCountdown, setLocalCountdown] = useState(countdown);

  useEffect(() => {
    setLocalCountdown(countdown);
  }, [countdown]);

  useEffect(() => {
    if (isOpen && localCountdown > 0) {
      const timer = setTimeout(() => {
        setLocalCountdown(prev => {
          if (prev <= 1) {
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, localCountdown, onLogout]);

  const getGradient = () => {
    if (localCountdown > 7) return 'from-emerald-500 to-teal-500';
    if (localCountdown > 4) return 'from-amber-500 to-orange-500';
    return 'from-rose-500 to-pink-500';
  };

  const handleReLogin = () => {
    // Guardar el email actual antes de cerrar sesión
    const userData = localStorage.getItem('user_data');
    let email = '';
    if (userData) {
      try {
        const user = JSON.parse(userData);
        email = user.email;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // Guardar el email para autocompletar en login
    if (email) {
      localStorage.setItem('remembered_email', email);
    }
    
    // Redirigir al login
    onLogout();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className={`bg-gradient-to-br ${getGradient()} rounded-2xl shadow-2xl overflow-hidden max-w-md w-full`}>
        {/* Header con gradiente */}
        <div className="p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">¡Sesión por expirar!</h2>
          <p className="text-white/90">Tu sesión de Omni-Notify está a punto de terminar</p>
        </div>

        {/* Contenido */}
        <div className="bg-white p-8">
          {/* Contador grande */}
          <div className="text-center mb-6">
            <div className="inline-block relative">
              <div className="text-6xl font-black text-gray-900">{localCountdown}</div>
              <div className="text-sm text-gray-500 mt-2">SEGUNDOS RESTANTES</div>
              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full animate-ping bg-rose-500"></div>
            </div>
          </div>

          {/* Mensaje */}
          <div className="text-center mb-8">
            <p className="text-gray-700">
              Por motivos de seguridad, tu sesión expirará en{' '}
              <span className="font-bold text-gray-900">{localCountdown}s</span>.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Tu sesión se cerrará automáticamente por inactividad.
            </p>
          </div>

          {/* Botones */}
          <div className="space-y-3">
            <button
              onClick={handleReLogin}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
              <LogIn size={20} />
              <span className="font-semibold">Volver a iniciar sesión</span>
            </button>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
            >
              <LogOut size={20} />
              <span className="font-semibold">Cerrar sesión ahora</span>
            </button>
          </div>

          {/* Advertencia pequeña */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              Por seguridad, las sesiones tienen tiempo limitado de inactividad
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;