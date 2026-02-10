import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Loader2, AlertCircle,
  DollarSign, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface SMSConfigurationProps {
  companyId: string;
  companyName?: string;
}

interface SmsSettings {
  provider: 'vonage' | 'twilio';
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
  // Estados para configuración
  const [settings, setSettings] = useState<SmsSettings>({
    provider: 'vonage',
    apiKey: 'D9zUv9!Yf',
    apiSecret: '745dd9da',
    fromNumber: 'OmniNotify',
    isActive: true,
  });

  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  // Estados para mostrar/ocultar contraseñas
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  
  // Estados para mensajes
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Ref para el intervalo de actualización automática - CORREGIDO: usar number en lugar de NodeJS.Timeout
  const refreshIntervalRef = useRef<number | null>(null);

  // Inicializar
  useEffect(() => {
    loadSettings();
    
    // Limpiar intervalo al desmontar
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [companyId]);

  // Cargar configuración y balance inicial
  const loadSettings = async () => {
    setLoading(true);
    try {
      const savedSettings = localStorage.getItem(`sms_settings_${companyId}`);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
        
        // Cargar balance automáticamente si hay credenciales
        if (parsedSettings.apiKey && parsedSettings.apiSecret) {
          await getBalance(parsedSettings);
        }
      }
    } catch (error) {
      console.error('Error cargando configuración SMS:', error);
      showMessage('Error cargando configuración SMS', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Configurar actualización automática del balance
  useEffect(() => {
    if (settings.apiKey && settings.apiSecret) {
      // Limpiar intervalo anterior si existe
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
      }
      
      // Configurar intervalo para actualizar cada 5 minutos
      refreshIntervalRef.current = window.setInterval(() => {
        getBalance(settings);
      }, 5 * 60 * 1000); // 5 minutos
      
      // Actualizar inmediatamente al montar
      getBalance(settings);
    }
    
    return () => {
      if (refreshIntervalRef.current !== null) {
        window.clearInterval(refreshIntervalRef.current);
      }
    };
  }, [settings.apiKey, settings.apiSecret, settings.provider]);

  // Guardar configuración
  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(`sms_settings_${companyId}`, JSON.stringify(settings));
      showMessage('Configuración SMS guardada exitosamente', 'success');
      
      // Actualizar balance después de guardar
      if (settings.apiKey && settings.apiSecret) {
        await getBalance(settings);
      }
    } catch (error) {
      showMessage('Error guardando configuración SMS', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Obtener balance
  const getBalance = async (currentSettings?: SmsSettings) => {
    const settingsToUse = currentSettings || settings;
    
    if (!settingsToUse.apiKey || !settingsToUse.apiSecret) {
      return;
    }

    setLoadingBalance(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/sms/balance/${companyId}`, {
        params: {
          provider: settingsToUse.provider
        }
      });

      if (response.data.success) {
        const balanceData = response.data.balance;
        
        let formattedBalance: SmsBalance;
        
        if (typeof balanceData === 'object' && balanceData.value !== undefined) {
          formattedBalance = {
            value: balanceData.value,
            currency: balanceData.currency || 'USD',
            formatted: formatBalanceWithFullDecimals(balanceData.value, balanceData.currency || 'USD'),
            rawValue: balanceData.value
          };
        } else if (typeof balanceData === 'number') {
          formattedBalance = {
            value: balanceData,
            currency: 'USD',
            formatted: formatBalanceWithFullDecimals(balanceData, 'USD'),
            rawValue: balanceData
          };
        } else {
          throw new Error('Formato de balance no reconocido');
        }
        
        setBalance(formattedBalance);
        setLastUpdate(new Date().toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit' 
        }));
      } else {
        // Si hay error pero estamos en desarrollo, usar datos de ejemplo
        if (import.meta.env.DEV) {
          const mockBalance: SmsBalance = {
            value: 12.3456789,
            currency: 'USD',
            formatted: '$12.3456789',
            rawValue: 12.3456789
          };
          setBalance(mockBalance);
          setLastUpdate(new Date().toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit' 
          }));
          showMessage('Balance de ejemplo cargado (modo desarrollo)', 'info');
        }
      }
    } catch (error: any) {
      console.error('Error obteniendo balance:', error);
      
      // Datos de ejemplo para desarrollo
      if (import.meta.env.DEV) {
        const mockBalance: SmsBalance = {
          value: 12.3456789,
          currency: 'USD',
          formatted: '$12.3456789',
          rawValue: 12.3456789
        };
        setBalance(mockBalance);
        setLastUpdate(new Date().toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit' 
        }));
        showMessage('Balance de ejemplo cargado (modo desarrollo)', 'info');
      } else {
        console.warn('Error obteniendo balance:', error.message);
        showMessage('Error obteniendo balance. Verifica tus credenciales.', 'error');
      }
    } finally {
      setLoadingBalance(false);
    }
  };

  // Función para forzar actualización manual
  const handleManualRefresh = async () => {
    await getBalance();
    showMessage('Balance actualizado manualmente', 'success');
  };

  // Función para formatear balance con todos los decimales
  const formatBalanceWithFullDecimals = (value: number, currency: string): string => {
    const stringValue = value.toString();
    
    if (currency === 'USD' || currency === 'EUR') {
      const symbol = currency === 'USD' ? '$' : '€';
      const [integerPart, decimalPart] = stringValue.split('.');
      
      if (decimalPart) {
        return `${symbol}${integerPart}.${decimalPart}`;
      } else {
        return `${symbol}${integerPart}.00`;
      }
    } else {
      return `${value} ${currency}`;
    }
  };

  // Helper functions
  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showMessage(`${label} copiado al portapapeles`, 'success');
    }).catch(err => {
      console.error('Error al copiar:', err);
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
          <button 
            onClick={() => setMessage(null)}
            className="text-lg hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl">
            <MessageSquare className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Configuración de SMS</h1>
            <p className="text-gray-600">Configure las notificaciones por SMS de {companyName}</p>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  settings.provider === 'vonage' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {settings.provider === 'vonage' ? 'Vonage (Nexmo)' : 'Twilio'}
                </span>
              </div>
              {balance && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div className="flex flex-col">
                    <span className="text-xs text-green-600 font-medium">Balance disponible</span>
                    <span className="font-bold text-green-700 text-lg">{balance.formatted}</span>
                    <span className="text-xs text-green-500">
                      Actualizado: {lastUpdate || 'Cargando...'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={loadingBalance}
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
                <span>💾</span>
                Guardar Todo
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel izquierdo: Configuración */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configuración del Proveedor */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <h2 className="text-xl font-semibold text-gray-800">Configuración de Vonage</h2>
              <p className="text-gray-600 text-sm mt-1">Configure las credenciales de Vonage (Nexmo)</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* API Key con botón de ojo */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-green-600">🔑</span> API Key de Vonage
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(settings.apiKey, 'API Key')}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={settings.apiKey}
                      onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                      placeholder="Ej: 84a24d93"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                      aria-label={showApiKey ? "Ocultar API Key" : "Mostrar API Key"}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <span>Longitud: {settings.apiKey.length} caracteres</span>
                    {settings.apiKey && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        settings.apiKey.length >= 8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {settings.apiKey.length >= 8 ? 'Válido' : 'Muy corto'}
                      </span>
                    )}
                  </div>
                </div>

                {/* API Secret con botón de ojo */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <span className="text-green-600">🔐</span> API Secret de Vonage
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(settings.apiSecret, 'API Secret')}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiSecret ? "text" : "password"}
                      value={settings.apiSecret}
                      onChange={(e) => setSettings({...settings, apiSecret: e.target.value})}
                      placeholder="Ej: 46Xump31CGyK88hf"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                      aria-label={showApiSecret ? "Ocultar API Secret" : "Mostrar API Secret"}
                    >
                      {showApiSecret ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <span>Longitud: {settings.apiSecret.length} caracteres</span>
                    {settings.apiSecret && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        settings.apiSecret.length >= 8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {settings.apiSecret.length >= 8 ? 'Válido' : 'Muy corto'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Número de Origen */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="text-green-600">📞</span> Número de Origen (From)
                  </label>
                  <input
                    type="text"
                    value={settings.fromNumber}
                    onChange={(e) => setSettings({...settings, fromNumber: e.target.value})}
                    placeholder="Ej: OmniNotify o +15551234567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      Puede ser un número E.164 o un nombre (ej: "OmniNotify")
                    </span>
                    <button
                      onClick={() => copyToClipboard(settings.fromNumber, 'Número de origen')}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* Información de seguridad */}
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Seguridad de las credenciales
                  </h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Nunca compartas tu API Key y Secret</li>
                    <li>• Las credenciales se almacenan solo en tu navegador</li>
                    <li>• Usa el botón de "ojo" para verificar la escritura</li>
                    <li>• Guarda una copia segura de tus credenciales</li>
                  </ul>
                </div>

                {/* Enlace al dashboard */}
                <div className="pt-4 border-t border-gray-200">
                  <a
                    href="https://dashboard.nexmo.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    <span>🌐</span>
                    Ir al Dashboard de Vonage para obtener credenciales
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Estado del Sistema */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <h2 className="text-xl font-semibold text-gray-800">Estado del Sistema</h2>
              <p className="text-gray-600 text-sm mt-1">Información sobre el servicio de SMS</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* Estado de conexión */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-700">Estado de conexión</h3>
                      <p className="text-sm text-gray-500">Conexión con Vonage API</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {loadingBalance ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-gray-500">Verificando...</span>
                        </div>
                      ) : balance ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-600 font-medium">Conectado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-sm text-red-600 font-medium">Sin conexión</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Última actualización */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-700">Última actualización</h3>
                      <p className="text-sm text-gray-500">Balance y estado del sistema</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">{lastUpdate || 'Nunca'}</span>
                    </div>
                  </div>
                </div>

                {/* Configuración de actualización automática */}
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-green-800">Actualización automática</h3>
                      <p className="text-sm text-green-700 mt-1">
                        El balance se actualiza automáticamente cada 5 minutos.
                        También puedes actualizar manualmente usando el botón "Actualizar Balance".
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho: Información y ayuda */}
        <div className="lg:col-span-1 space-y-6">
          {/* Balance Detallado */}
          {balance && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900">Balance Detallado</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-700 mb-1">
                      {balance.formatted}
                    </div>
                    <div className="text-sm text-green-600">
                      Disponible para enviar SMS
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
                    <span className="font-medium text-gray-800">{balance.currency}</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Última actualización:</span>
                    <span className="text-sm text-gray-500">{lastUpdate || 'Nunca'}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleManualRefresh}
                  disabled={loadingBalance}
                  className="w-full text-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loadingBalance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Actualizar Ahora
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Información de Vonage */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900">Información de Vonage</h3>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>📞 Formato de números:</strong> Usar formato E.164 (+[código país][número])
                </p>
              </div>
              
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  <strong>💰 Costos por SMS:</strong> 
                  <br/>• Nacional: ~$0.01 - $0.05
                  <br/>• Internacional: ~$0.05 - $0.15
                </p>
              </div>
              
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-700">
                  <strong>⏱️ Límites:</strong> 
                  <br/>• 1 SMS: 160 caracteres
                  <br/>• Múltiples SMS: 1600 caracteres máx.
                  <br/>• Rate limit: ~1 SMS/segundo
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">⚡ Acciones Rápidas</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowApiKey(!showApiKey);
                  setShowApiSecret(!showApiSecret);
                }}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-left flex items-center gap-3"
              >
                {showApiKey && showApiSecret ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Ocultar Credenciales</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Mostrar Credenciales</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleManualRefresh}
                disabled={loadingBalance}
                className="w-full px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-left flex items-center gap-3 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Actualizar Balance Manualmente</span>
              </button>
              
              <button
                onClick={() => {
                  if (settings.apiKey && settings.apiSecret) {
                    copyToClipboard(`${settings.apiKey}:${settings.apiSecret}`, 'Credenciales completas');
                  }
                }}
                disabled={!settings.apiKey || !settings.apiSecret}
                className="w-full px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-left flex items-center gap-3 disabled:opacity-50"
              >
                <span>📋</span>
                <span>Copiar todas las credenciales</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSConfiguration;