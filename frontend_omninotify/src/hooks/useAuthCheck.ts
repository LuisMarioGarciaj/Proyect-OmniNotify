// src/hooks/useAuthCheck.ts
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const useAuthCheck = () => {
  const navigate = useNavigate();
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10); // Cambiado a 10 segundos
  const [isChecking, setIsChecking] = useState(false);

  const checkToken = useCallback(async (forceCheck = false) => {
    if (isChecking && !forceCheck) return;
    
    setIsChecking(true);
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      setIsChecking(false);
      return false;
    }

    try {
      // Decodificar el token
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
      const timeLeft = payload.exp - currentTime;
      
      console.log(`🕒 Token expira en: ${timeLeft} segundos`);
      
      // Modal solo aparece cuando faltan 10 segundos o menos
      if (timeLeft > 0 && timeLeft <= 10 && !showExpiredModal) {
        console.log('⏰ Mostrando modal (10 segundos restantes)...');
        setTimeRemaining(timeLeft);
        setShowExpiredModal(true);
      }
      
      // Si ya expiró (0 o menos segundos) y el modal NO está abierto
      if (timeLeft <= 0 && !showExpiredModal) {
        console.log('❌ Token expirado, redirigiendo al login...');
        handleLogoutNow();
      }
      
      // Si tenemos más de 10 segundos, cerramos el modal si estaba abierto
      if (timeLeft > 10 && showExpiredModal) {
        setShowExpiredModal(false);
      }
      
      setIsChecking(false);
      return timeLeft > 0;
    } catch (error) {
      console.error('❌ Error verificando token:', error);
      setIsChecking(false);
      handleLogoutNow();
      return false;
    }
  }, [isChecking, showExpiredModal]);

  const handleExtendSession = async () => {
    try {
      // Intenta renovar el token llamando al backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.access_token);
        setShowExpiredModal(false);
        console.log('✅ Token renovado exitosamente');
        return true;
      }
      throw new Error('No se pudo renovar el token');
    } catch (error) {
      console.log('⚠️ No hay endpoint de refresh, recargando página...');
      // Simplemente recargamos la página para forzar nueva verificación
      window.location.reload();
      return false;
    }
  };

  const handleLogoutNow = useCallback(() => {
    console.log('👋 Cerrando sesión...');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('remembered_email');
    setShowExpiredModal(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  // Verificar actividad del usuario
  useEffect(() => {
    const resetInactivityTimer = () => {
      checkToken();
    };

    // Eventos de actividad del usuario
    const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [checkToken]);

  useEffect(() => {
    // Verificar cada 2 segundos para mayor precisión con tiempos cortos
    const interval = setInterval(() => checkToken(), 2000);
    
    // Verificar al cargar
    checkToken(true);
    
    return () => clearInterval(interval);
  }, [checkToken]);

  // Actualizar contador del modal cuando está abierto
  useEffect(() => {
    if (!showExpiredModal) return;
    
    console.log(`⏳ Modal activo. Tiempo restante: ${timeRemaining}s`);
    
    const countdownInterval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          console.log('⏰ Tiempo agotado! Redirigiendo...');
          clearInterval(countdownInterval);
          handleLogoutNow();
          return 0;
        }
        
        console.log(`⏳ Tiempo restante: ${newTime}s`);
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, [showExpiredModal, handleLogoutNow]);

  return {
    showExpiredModal,
    timeRemaining,
    setShowExpiredModal,
    handleExtendSession,
    handleLogoutNow,
    checkToken,
  };
};

export default useAuthCheck;