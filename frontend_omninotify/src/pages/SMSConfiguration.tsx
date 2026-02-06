import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Send, Loader2, CheckCircle, AlertCircle,
  Smartphone, User, Calendar, Clock, Bell, Zap,
  Users, ChevronRight, X, Plus, Trash2, RefreshCw,
  Eye, EyeOff, DollarSign
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

interface TestSmsRequest {
  to: string;
  text: string;
  provider: 'vonage' | 'twilio';
  apiKey: string;
  apiSecret: string;
  fromNumber?: string;
  metadata?: {
    companyName?: string;
    companyId?: string;
    testType?: string;
  };
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
    apiKey: '84a24d93',
    apiSecret: '46Xump31CGyK88hf',
    fromNumber: 'OmniNotify',
    isActive: true,
  });

  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('+34612345678');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  
  // Estados para mostrar/ocultar contraseñas
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  
  // Estados para programación
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('');
  
  // Estados para mensajes
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Inicializar fechas
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime('09:00');
    
    loadSettings();
  }, [companyId]);

  // Cargar configuración
  const loadSettings = async () => {
    setLoading(true);
    try {
      const savedSettings = localStorage.getItem(`sms_settings_${companyId}`);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error cargando configuración SMS:', error);
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración
  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(`sms_settings_${companyId}`, JSON.stringify(settings));
      showMessage('Configuración SMS guardada exitosamente', 'success');
    } catch (error) {
      showMessage('Error guardando configuración SMS', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Probar SMS
  const handleTest = async () => {
    if (!testPhone || !testPhone.trim()) {
      showMessage('Por favor ingresa un número de teléfono', 'error');
      return;
    }

    if (!settings.apiKey || !settings.apiSecret) {
      showMessage('Por favor configura tu API Key y Secret de Vonage', 'error');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testMessage = testText || generateTestMessage(companyName);
      
      const testRequest: TestSmsRequest = {
        to: testPhone,
        text: testMessage,
        provider: settings.provider,
        apiKey: settings.apiKey,
        apiSecret: settings.apiSecret,
        fromNumber: settings.fromNumber,
        metadata: {
          companyName,
          companyId,
          testType: 'connection_test'
        }
      };

      console.log('📱 Enviando SMS de prueba...', testRequest);

      const response = await axios.post(`${API_BASE_URL}/sms/test`, testRequest);
      
      if (response.data.success) {
        setTestResult(response.data);
        showMessage('SMS de prueba enviado exitosamente', 'success');
      } else {
        setTestResult(response.data);
        showMessage(`Error: ${response.data.error || response.data.message}`, 'error');
      }
    } catch (error: any) {
      console.error('❌ Error enviando SMS de prueba:', error);
      
      setTestResult({
        success: false,
        message: 'Error enviando SMS de prueba',
        error: error.response?.data?.error || error.message
      });
      
      showMessage('Error enviando SMS de prueba', 'error');
    } finally {
      setTesting(false);
    }
  };

  // Obtener balance
  const handleGetBalance = async () => {
    if (!settings.apiKey || !settings.apiSecret) {
      showMessage('Por favor configura tu API Key y Secret de Vonage', 'error');
      return;
    }

    setLoadingBalance(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/sms/balance/${companyId}`, {
        params: {
          provider: settings.provider
        }
      });

      console.log('💰 Respuesta de balance:', response.data);

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
        showMessage(`Balance obtenido: ${formattedBalance.formatted}`, 'success');
      } else {
        showMessage(response.data.message || 'Error obteniendo balance', 'error');
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
        showMessage('Balance de ejemplo cargado (modo desarrollo)', 'info');
      } else {
        showMessage('Error obteniendo balance: ' + error.message, 'error');
      }
    } finally {
      setLoadingBalance(false);
    }
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

  // Enviar SMS programado
  const handleSendScheduled = async () => {
    if (!testPhone || !testText) {
      showMessage('Por favor ingresa número y mensaje', 'error');
      return;
    }

    if (!settings.apiKey || !settings.apiSecret) {
      showMessage('Por favor configura tu API Key y Secret de Vonage', 'error');
      return;
    }

    if (scheduleType === 'later') {
      const scheduleDateTime = localToUTCString(scheduleDate, scheduleTime);
      const scheduledTime = new Date(scheduleDateTime);
      const now = new Date();
      
      if (scheduledTime <= now) {
        showMessage('La fecha programada debe ser futura', 'error');
        return;
      }
    }

    setTesting(true);

    try {
      const payload = {
        to: testPhone,
        text: testText,
        companyId,
        provider: settings.provider,
        config: {
          apiKey: settings.apiKey,
          apiSecret: settings.apiSecret,
          fromNumber: settings.fromNumber
        },
        schedule: scheduleType === 'later' ? localToUTCString(scheduleDate, scheduleTime) : undefined
      };

      const response = await axios.post(`${API_BASE_URL}/sms/send-direct`, payload);
      
      if (response.data.success) {
        showMessage(
          scheduleType === 'now' 
            ? 'SMS enviado exitosamente' 
            : `SMS programado para ${formatLocalDate(scheduleDate, scheduleTime)}`,
          'success'
        );
        setTestResult(response.data);
      } else {
        showMessage(`Error: ${response.data.message}`, 'error');
      }
    } catch (error: any) {
      console.error('Error enviando SMS:', error);
      showMessage('Error enviando SMS', 'error');
    } finally {
      setTesting(false);
    }
  };

  // Helper functions
  const generateTestMessage = (company: string): string => {
    const timestamp = new Date().toLocaleString('es-ES');
    return `✅ Prueba de SMS - ${company}\n\nHora: ${timestamp}\nEstado: CONEXIÓN EXITOSA\n\nEste SMS confirma que la configuración de notificaciones por SMS de ${company} está funcionando correctamente.`;
  };

  const localToUTCString = (dateStr: string, timeStr: string): string => {
    const localDate = new Date(`${dateStr}T${timeStr}`);
    return localDate.toISOString();
  };

  const formatLocalDate = (dateString: string, timeString?: string): string => {
    const dateTimeString = timeString ? `${dateString}T${timeString}` : dateString;
    const date = new Date(dateTimeString);
    
    const formattedDate = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (timeString) {
      const formattedTime = date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${formattedDate} a las ${formattedTime}`;
    }
    
    return formattedDate;
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  };

  const formatPhoneNumber = (phone: string): string => {
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('00')) return `+${phone.substring(2)}`;
    return `+34${phone.replace(/^0/, '')}`;
  };

  // Función para copiar al portapapeles
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
                    <span className="text-xs text-green-500">Valor exacto: {balance.rawValue} {balance.currency}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleGetBalance}
            disabled={loadingBalance}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
          >
            {loadingBalance ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Consultando...
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

          {/* Prueba de SMS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Prueba de SMS</h2>
              <p className="text-gray-600 text-sm mt-1">Envía un SMS de prueba para verificar la configuración</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-6">
                {/* Número de destino */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Smartphone className="w-4 h-4 inline mr-2" />
                    Número de teléfono (E.164)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+34612345678"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      onClick={() => setTestPhone(formatPhoneNumber(testPhone))}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      Formatear
                    </button>
                  </div>
                  {testPhone && !validatePhoneNumber(testPhone) && (
                    <p className="mt-2 text-sm text-red-600">
                      Formato inválido. Debe ser: +[código de país][número]
                    </p>
                  )}
                </div>

                {/* Mensaje */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Mensaje de prueba
                  </label>
                  <textarea
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder={generateTestMessage(companyName)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-gray-500">
                      {testText.length} caracteres
                    </span>
                    <span className={`text-sm ${
                      testText.length > 160 ? 'text-red-600 font-bold' : 'text-gray-500'
                    }`}>
                      {testText.length > 160 ? 'Múltiples SMS' : '1 SMS'}
                    </span>
                  </div>
                </div>

                {/* Programación */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-700 mb-3">⏰ Programación (Opcional)</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setScheduleType('now')}
                        className={`px-4 py-3 rounded-lg border transition flex items-center justify-center gap-2 ${
                          scheduleType === 'now'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        <span>Enviar Ahora</span>
                      </button>
                      
                      <button
                        onClick={() => setScheduleType('later')}
                        className={`px-4 py-3 rounded-lg border transition flex items-center justify-center gap-2 ${
                          scheduleType === 'later'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-300 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Programar</span>
                      </button>
                    </div>

                    {scheduleType === 'later' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <Calendar className="w-4 h-4 inline mr-2" />
                              Fecha
                            </label>
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              <Clock className="w-4 h-4 inline mr-2" />
                              Hora
                            </label>
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                          </div>
                        </div>
                        
                        {scheduleDate && scheduleTime && (
                          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2">
                              <Bell className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-blue-700">Programado para:</span>
                              <span className="text-blue-600">
                                {formatLocalDate(scheduleDate, scheduleTime)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleTest}
                    disabled={testing || !validatePhoneNumber(testPhone) || !settings.apiKey || !settings.apiSecret}
                    className={`px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors flex-1 ${
                      !testing && validatePhoneNumber(testPhone) && settings.apiKey && settings.apiSecret
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando prueba...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Enviar SMS de Prueba
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleSendScheduled}
                    disabled={testing || !validatePhoneNumber(testPhone) || !testText.trim() || !settings.apiKey || !settings.apiSecret}
                    className={`px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors flex-1 ${
                      !testing && validatePhoneNumber(testPhone) && testText.trim() && settings.apiKey && settings.apiSecret
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {scheduleType === 'now' ? (
                      <>
                        <Zap className="w-5 h-5" />
                        Enviar SMS Ahora
                      </>
                    ) : (
                      <>
                        <Calendar className="w-5 h-5" />
                        Programar SMS
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultado de la prueba */}
          {testResult && (
            <div className={`bg-white rounded-xl shadow-sm border ${
              testResult.success 
                ? 'border-green-200' 
                : 'border-red-200'
            } overflow-hidden`}>
              <div className={`p-6 ${
                testResult.success 
                  ? 'bg-green-50 border-b border-green-200' 
                  : 'bg-red-50 border-b border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    testResult.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      {testResult.success ? '✅ Prueba Exitosa' : '❌ Error en la Prueba'}
                    </h3>
                    <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {testResult.result && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">Proveedor</p>
                        <p className="font-medium">{testResult.result.provider}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">Destinatario</p>
                        <p className="font-medium">{testResult.result.recipient}</p>
                      </div>
                    </div>
                    
                    {testResult.result.messageId && (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">ID del Mensaje</p>
                        <p className="font-medium font-mono">{testResult.result.messageId}</p>
                      </div>
                    )}
                    
                    {testResult.result.remainingBalance && (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-sm text-green-600">💰 Balance restante:</p>
                        <p className="font-bold text-green-700">
                          {formatBalanceWithFullDecimals(
                            testResult.result.remainingBalance,
                            testResult.result.currency || 'USD'
                          )}
                        </p>
                        <p className="text-xs text-green-500 mt-1">
                          Valor exacto: {testResult.result.remainingBalance} {testResult.result.currency || 'USD'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {testResult.error && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="font-medium text-red-800">Detalles del error:</p>
                    <p className="text-sm text-red-600 mt-1">{testResult.error}</p>
                  </div>
                )}
              </div>
            </div>
          )}
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
                    <span className="text-xs text-gray-500">Ahora</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleGetBalance}
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
                      Actualizar Balance
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
                onClick={() => setTestPhone('+34612345678')}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-left flex items-center gap-3"
              >
                <User className="w-4 h-4" />
                <span>Usar número de ejemplo</span>
              </button>
              
              <button
                onClick={() => setTestText(generateTestMessage(companyName))}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-left flex items-center gap-3"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Generar mensaje de prueba</span>
              </button>
              
              <button
                onClick={() => {
                  if (settings.apiKey && settings.apiSecret) {
                    copyToClipboard(`${settings.apiKey}:${settings.apiSecret}`, 'Credenciales completas');
                  }
                }}
                disabled={!settings.apiKey || !settings.apiSecret}
                className="w-full px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-left flex items-center gap-3 disabled:opacity-50"
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