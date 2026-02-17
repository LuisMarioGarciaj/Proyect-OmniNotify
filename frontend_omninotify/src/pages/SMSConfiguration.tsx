// Componente React modificado para usar SystemConfig (credenciales globales)
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Loader2, AlertCircle,
  DollarSign, RefreshCw, Eye, EyeOff, Save, Server, Database
} from 'lucide-react';
import axios from 'axios';
import axiosInstance from '../utils/axios.config';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface SMSConfigurationProps {
  companyId: string;
  companyName?: string;
}

interface VonageCredentials {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
  isActive: boolean;
}

interface SmsBalance {
  value: number;
  currency: string;
  formatted: string;
  rawValue?: number;
}

const SMSConfiguration: React.FC<SMSConfigurationProps> = ({ 
  companyId, 
  companyName = 'Mi Empresa' 
}) => {
  // Estados para configuración global de Vonage
  const [credentials, setCredentials] = useState<VonageCredentials>({
    apiKey: '',
    apiSecret: '',
    fromNumber: 'OmniNotify',
    isActive: true,
  });
  
  // Estado para saber si el secret está cargado
  const [hasStoredSecret, setHasStoredSecret] = useState(false);
  const [secretLastChars, setSecretLastChars] = useState('');

  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  // Estados para mostrar/ocultar contraseñas
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  
  // Estados para mensajes
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Ref para el intervalo de actualización automática
  const refreshIntervalRef = useRef<number | null>(null);

  // Cargar configuración al iniciar
  useEffect(() => {
    loadVonageConfig();
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Configurar actualización automática del balance
  useEffect(() => {
    if (credentials.apiKey && (credentials.apiSecret || hasStoredSecret)) {
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
      }
      
      refreshIntervalRef.current = window.setInterval(() => {
        getBalance();
      }, 5 * 60 * 1000);
      
      getBalance();
    }
    
    return () => {
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
      }
    };
  }, [credentials.apiKey, hasStoredSecret]);

  // Cargar configuración Vonage desde System_Config
  const loadVonageConfig = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/system/config/vonage`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        setCredentials({
          apiKey: data.apiKey || '',
          apiSecret: '', // No recibimos el secret completo
          fromNumber: data.fromNumber || 'OmniNotify',
          isActive: data.isActive !== false,
        });
        setHasStoredSecret(data.hasSecret || false);
        setSecretLastChars(data.lastChars || '');
        
        // Cargar balance automáticamente
        if (data.apiKey && data.hasSecret) {
          await getBalance();
        }
      }
    } catch (error: any) {
      console.error('Error cargando configuración Vonage:', error);
      showMessage('Error cargando configuración de SMS', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración
  const handleSave = async () => {
    setSaving(true);
    try {
      // Solo enviamos apiSecret si fue modificado
      const payload: any = {
        apiKey: credentials.apiKey,
        fromNumber: credentials.fromNumber,
        isActive: credentials.isActive,
      };
      
      // Solo incluir apiSecret si se escribió algo
      if (credentials.apiSecret.trim() !== '') {
        payload.apiSecret = credentials.apiSecret;
      }

      const response = await axiosInstance.put(`${API_BASE_URL}/system/config/vonage`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.data.success) {
        showMessage('✅ Configuración de SMS guardada exitosamente', 'success');
        
        // Actualizar estado
        setHasStoredSecret(true);
        setCredentials(prev => ({
          ...prev,
          apiSecret: '', // Limpiar el campo por seguridad
        }));
        
        // Recargar configuración para obtener los últimos caracteres
        await loadVonageConfig();
        
        // Actualizar balance
        await getBalance();
      }
    } catch (error: any) {
      showMessage('Error guardando configuración SMS: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Probar conexión
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const testPayload: any = {
        to: '+521234567890', // Número de prueba - idealmente sería configurable
        provider: 'vonage',
        metadata: {
          companyName,
          testType: 'connection_test'
        }
      };

      // Si se ingresaron credenciales nuevas, usarlas para la prueba
      if (credentials.apiKey && credentials.apiSecret) {
        testPayload.apiKey = credentials.apiKey;
        testPayload.apiSecret = credentials.apiSecret;
        testPayload.fromNumber = credentials.fromNumber;
      }

      const response = await axios.post(`${API_BASE_URL}/sms/test`, testPayload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.data.success) {
        showMessage('✅ Conexión con Vonage exitosa', 'success');
      } else {
        showMessage('❌ Error en conexión: ' + response.data.error, 'error');
      }
    } catch (error: any) {
      showMessage('Error probando conexión: ' + (error.response?.data?.error || error.message), 'error');
    } finally {
      setTesting(false);
    }
  };

  // Obtener balance
  const getBalance = async () => {
    if (!credentials.apiKey || !hasStoredSecret) {
      return;
    }

    setLoadingBalance(true);
    try {
      const response = await axiosInstance.get(`${API_BASE_URL}/sms/balance/${companyId}`, {
        params: { provider: 'vonage' },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.data.success) {
        const balanceData = response.data.balance;
        
        setBalance({
          value: balanceData.value,
          currency: balanceData.currency || 'EUR',
          formatted: balanceData.formatted,
          rawValue: balanceData.value
        });
        
        setLastUpdate(new Date().toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit' 
        }));
      }
    } catch (error: any) {
      console.error('Error obteniendo balance:', error);
      
      // Datos mock para desarrollo
      if (import.meta.env.DEV) {
        setBalance({
          value: 12.3456789,
          currency: 'EUR',
          formatted: '€12.3456789',
          rawValue: 12.3456789
        });
        setLastUpdate(new Date().toLocaleTimeString('es-ES'));
        showMessage('Balance de ejemplo (modo desarrollo)', 'info');
      }
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleManualRefresh = async () => {
    await getBalance();
    showMessage('Balance actualizado manualmente', 'success');
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showMessage(`${label} copiado al portapapeles`, 'success');
    }).catch(() => {
      showMessage('Error al copiar', 'error');
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Cargando configuración SMS...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Mensajes de estado */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex justify-between items-center animate-slideIn ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : message.type === 'error' 
            ? 'bg-red-100 text-red-800 border border-red-200' 
            : 'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-lg hover:opacity-70">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl">
            <Database className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Configuración Global de SMS</h1>
            <p className="text-gray-600">Credenciales centralizadas de Vonage para todas las empresas</p>
            <div className="mt-2 flex items-center gap-4">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Vonage (Nexmo)
              </span>
              {balance && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div className="flex flex-col">
                    <span className="text-xs text-green-600 font-medium">Balance disponible</span>
                    <span className="font-bold text-green-700 text-lg">{balance.formatted}</span>
                    <span className="text-xs text-green-500">Actualizado: {lastUpdate}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={loadingBalance || !credentials.apiKey || !hasStoredSecret}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
          >
            {loadingBalance ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Actualizar Balance
              </>
            )}
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar Configuración
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel izquierdo: Configuración */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configuración de Vonage */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold text-gray-800">Credenciales Globales de Vonage</h2>
              </div>
              <p className="text-gray-600 text-sm mt-1">
                Estas credenciales se usarán para TODAS las empresas del sistema
              </p>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                <Server className="w-3 h-3" />
                <span>Configuración en System_Config</span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* API Key */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-green-600">🔑</span> API Key de Vonage
                    </label>
                    <button
                      onClick={() => copyToClipboard(credentials.apiKey, 'API Key')}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      disabled={!credentials.apiKey}
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={credentials.apiKey}
                      onChange={(e) => setCredentials({...credentials, apiKey: e.target.value})}
                      placeholder="Ej: 84a24d93"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* API Secret */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-green-600">🔐</span> API Secret de Vonage
                    </label>
                    <div className="flex items-center gap-2">
                      {hasStoredSecret && !credentials.apiSecret && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          ✓ Guardado ({secretLastChars ? `...${secretLastChars}` : ''})
                        </span>
                      )}
                      <button
                        onClick={() => copyToClipboard('[SECRETO]', 'API Secret')}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        disabled={!hasStoredSecret}
                      >
                        {hasStoredSecret ? 'Copiar (oculto)' : 'No disponible'}
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiSecret ? "text" : "password"}
                      value={credentials.apiSecret}
                      onChange={(e) => setCredentials({...credentials, apiSecret: e.target.value})}
                      placeholder={hasStoredSecret ? "•••••••• (dejar vacío para mantener el actual)" : "Ej: 46Xump31CGyK88hf"}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                    >
                      {showApiSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {hasStoredSecret ? '✓ Hay un secret guardado. Deja vacío para mantenerlo.' : '⚠️ No hay secret guardado'}
                  </p>
                </div>

                {/* Número de Origen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-green-600">📞</span> Número de Origen (From)
                  </label>
                  <input
                    type="text"
                    value={credentials.fromNumber}
                    onChange={(e) => setCredentials({...credentials, fromNumber: e.target.value})}
                    placeholder="Ej: OmniNotify o +15551234567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  />
                </div>

                {/* Estado Activo/Inactivo */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={credentials.isActive}
                    onChange={(e) => setCredentials({...credentials, isActive: e.target.checked})}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Servicio activo
                  </label>
                  <span className="text-xs text-gray-500">
                    (Si está inactivo, no se podrán enviar SMS)
                  </span>
                </div>

                {/* Botón de prueba */}
                <div className="pt-4">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !credentials.apiKey || (!credentials.apiSecret && !hasStoredSecret)}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Probando conexión...
                      </>
                    ) : (
                      <>
                        <span>📡</span>
                        Probar Conexión
                      </>
                    )}
                  </button>
                </div>

                {/* Información */}
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Configuración Centralizada
                  </h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Estas credenciales se aplican a TODAS las empresas</li>
                    <li>• Los cambios afectan inmediatamente al sistema completo</li>
                    <li>• El API Secret nunca se muestra completo por seguridad</li>
                    <li>• Solo administradores pueden modificar esta configuración</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho: Información y balance */}
        <div className="lg:col-span-1 space-y-6">
          {/* Balance */}
          {balance && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Balance Vonage
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-700 mb-1">
                      {balance.formatted}
                    </div>
                    <div className="text-sm text-green-600">
                      Saldo disponible
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Valor exacto:</span>
                    <span className="font-mono text-gray-800">{balance.rawValue}</span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Moneda:</span>
                    <span className="font-medium text-gray-800">EUR</span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Última actualización:</span>
                    <span className="text-sm text-gray-500">{lastUpdate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Información del sistema */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Configuración Global
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>📊 Tabla:</strong> System_Config
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>🔑 Clave:</strong> VONAGE_CREDENTIALS
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">
                  <strong>✅ Estado:</strong> {credentials.isActive ? 'Activo' : 'Inactivo'}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  <strong>🔐 Secret:</strong> {hasStoredSecret ? 'Configurado' : 'No configurado'}
                </p>
              </div>
              <a
                href="https://dashboard.nexmo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Dashboard Vonage ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSConfiguration;