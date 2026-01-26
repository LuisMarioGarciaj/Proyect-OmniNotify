import React, { useState, useEffect, useRef } from 'react';
import { emailService } from '../services/emailService';
import type { EmailSettings, TestEmailRequest } from '../types/email.types';

interface EmailConfigurationProps {
  companyId: string;
  companyName?: string;
}

const EmailConfiguration: React.FC<EmailConfigurationProps> = ({ 
  companyId, 
  companyName: propCompanyName = 'Mi Empresa' 
}) => {
  const [settings, setSettings] = useState<EmailSettings>({
    companyId,
    provider: 'smtp',
    isActive: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('hgerson3000@gmail.com');
  const [testResult, setTestResult] = useState<any>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Estados para el logo
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadedLogoData, setUploadedLogoData] = useState<any>(null);
  const [logoSize, setLogoSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dominio personalizado para enmascaramiento
  const [customDomain, setCustomDomain] = useState('ominotify.com');
  const [maskedEmail, setMaskedEmail] = useState('no-reply@ominotify.com');

  // Cargar configuración inicial
  useEffect(() => {
    loadSettings();
    loadCompanyLogo();
    loadCompanyDomain();
  }, [companyId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const savedSettings = await emailService.getEmailSettings(companyId);
      if (savedSettings) {
        if (savedSettings.provider === 'smtp' && !savedSettings.smtpPort) {
          savedSettings.smtpPort = 465;
        }
        
        // Precargar configuración de Gmail
        if (savedSettings.provider === 'smtp' && !savedSettings.smtpUser) {
          savedSettings.smtpHost = 'smtp.gmail.com';
          savedSettings.smtpPort = 465;
          savedSettings.smtpUser = 'hgerson3000@gmail.com';
          savedSettings.smtpPassword = 'hwovycjveukvzqwd';
          // Email enmascarado como "Render <no-reply@render.com>"
          savedSettings.fromEmail = 'no-reply@ominotify.com';
          savedSettings.fromName = 'OmniNotify System';
        }
        
        savedSettings.isActive = true;
        setSettings(savedSettings);
        
        // Actualizar email enmascarado
        updateMaskedEmail(savedSettings.fromName, savedSettings.fromEmail);
      }
    } catch (error) {
      showMessage('Error cargando configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyLogo = async () => {
    try {
      // Primero intentar cargar desde localStorage (fallback)
      const savedLogo = localStorage.getItem(`company_logo_${companyId}`);
      if (savedLogo) {
        setCompanyLogo(savedLogo);
        setLogoSize(savedLogo.length);
      }
      
      // Intentar cargar desde el backend
      const response = await fetch(`http://localhost:3000/api/email/logo/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.base64) {
          setCompanyLogo(data.data.base64);
          setLogoSize(data.data.base64.length);
          localStorage.setItem(`company_logo_${companyId}`, data.data.base64);
        }
      }
    } catch (error) {
      console.error('Error cargando logo:', error);
    }
  };

  const loadCompanyDomain = () => {
    // Intentar extraer dominio del nombre de la empresa
    const domainFromName = propCompanyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15) + '.com';
    
    setCustomDomain(domainFromName);
    setMaskedEmail(`no-reply@${domainFromName}`);
  };

  const updateMaskedEmail = (fromName?: string, fromEmail?: string) => {
    if (fromEmail && fromName) {
      setMaskedEmail(`${fromName} <${fromEmail}>`);
    } else if (fromEmail) {
      setMaskedEmail(fromEmail);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('📁 Archivo seleccionado:', file.name, file.type, Math.round(file.size/1024) + 'KB');
      
      if (!file.type.startsWith('image/')) {
        showMessage('Por favor selecciona un archivo de imagen (JPG, PNG, GIF, SVG)', 'error');
        return;
      }
      
      if (file.size > 2 * 1024 * 1024) {
        showMessage('La imagen debe ser menor a 2MB', 'error');
        return;
      }
      
      setUploadingLogo(true);
      
      try {
        // Subir al backend primero
        await uploadLogoToBackend(file);
        
      } catch (error: any) {
        console.error('❌ Error subiendo logo:', error);
        showMessage('Error subiendo logo', 'error');
        setUploadingLogo(false);
      }
    }
  };

  const uploadLogoToBackend = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('companyId', companyId);
      
      console.log('📤 Subiendo al backend...');
      
      const response = await fetch('http://localhost:3000/api/email/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      console.log('📥 Respuesta del servidor:', response.status);
      
      const data = await response.json();
      console.log('📊 Datos de respuesta:', data);
      
      if (data.success) {
        setUploadedLogoData(data.data);
        
        // Si el backend devolvió un base64 completo, usarlo
        if (data.data.fullBase64) {
          setCompanyLogo(data.data.fullBase64);
          setLogoSize(data.data.fullBase64.length);
          localStorage.setItem(`company_logo_${companyId}`, data.data.fullBase64);
          showMessage('Logo subido exitosamente', 'success');
        } else if (data.data.base64Preview) {
          // Solo tenemos preview
          showMessage('Logo subido (versión optimizada)', 'success');
          console.log('⚠️ Logo optimizado por el backend');
        }
      } else {
        showMessage(`Error: ${data.message || 'Error subiendo logo'}`, 'error');
      }
    } catch (error: any) {
      console.error('❌ Error subiendo logo:', error);
      showMessage('Error subiendo logo al servidor', 'error');
      throw error;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await emailService.saveEmailSettings(settings);
      if (success) {
        showMessage('Configuración guardada exitosamente', 'success');
        updateMaskedEmail(settings.fromName, settings.fromEmail);
      } else {
        showMessage('Error guardando configuración', 'error');
      }
    } catch (error) {
      showMessage('Error guardando configuración', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      showMessage('Por favor ingresa un email de prueba', 'info');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // ESTRATEGIA CRÍTICA: Solo enviar logo si es muy pequeño
      let logoToSend: string | undefined;
      let includeLogo = false;
      
      if (companyLogo) {
        if (companyLogo.length < 50000) { // < 50KB
          console.log('✅ Logo pequeño (< 50KB), enviando en body');
          logoToSend = companyLogo;
          includeLogo = true;
        } else {
          console.log('⚠️ Logo grande, NO enviando en body');
          // No enviar el logo grande
          includeLogo = true; // Pero indicar que hay logo
          // El backend usará la versión optimizada almacenada
        }
      }

      const testRequest: TestEmailRequest = {
        to: testEmail,
        provider: settings.provider,
        metadata: {
          companyName: propCompanyName,
          companyLogo: logoToSend, // Solo enviar si es pequeño
          testType: 'connection_test',
          includeLogo: includeLogo,
          logoSize: companyLogo?.length || 0,
          // Enviar referencia del logo si está disponible
          logoUrl: uploadedLogoData?.logoUrl,
          logoFilename: uploadedLogoData?.filename,
        }
      };

      if (settings.provider === 'sendgrid' && settings.apiKey) {
        testRequest.apiKey = settings.apiKey;
      } else if (settings.provider === 'smtp') {
        testRequest.smtpConfig = {
          host: settings.smtpHost || 'smtp.gmail.com',
          port: settings.smtpPort || 465,
          secure: settings.smtpPort === 465,
          auth: {
            user: settings.smtpUser || '',
            pass: settings.smtpPassword || '',
          },
        };
      }

      console.log('📤 Enviando test de email...');
      console.log('📏 Tamaño del payload:', JSON.stringify(testRequest).length, 'bytes');
      
      const result = await emailService.testEmailConnection(testRequest);
      setTestResult(result);
      
      if (result.success) {
        showMessage('Email de prueba enviado exitosamente', 'success');
      } else {
        showMessage(`Error: ${result.error || result.message}`, 'error');
      }
    } catch (error: any) {
      console.error('❌ Error en handleTest:', error);
      setTestResult({
        success: false,
        message: 'Error inesperado',
        error: error.message,
      });
      
      if (error.message.includes('Payload Too Large') || error.message.includes('413')) {
        showMessage('Error: El payload es demasiado grande. Intenta con una imagen más pequeña.', 'error');
      } else {
        showMessage('Error enviando email de prueba', 'error');
      }
    } finally {
      setTesting(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleQuickFillGmail = () => {
    const newSettings: EmailSettings = {
      ...settings,
      provider: 'smtp' as 'smtp',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpUser: 'hgerson3000@gmail.com',
      smtpPassword: 'hwovycjveukvzqwd',
      // Email enmascarado como "Render <no-reply@render.com>"
      fromEmail: 'no-reply@ominotify.com',
      fromName: 'OmniNotify System',
    };
    
    setSettings(newSettings);
    updateMaskedEmail(newSettings.fromName, newSettings.fromEmail);
    showMessage('Configuración de Gmail cargada con remitente enmascarado', 'success');
  };

  const handleDomainChange = (domain: string) => {
    setCustomDomain(domain);
    const newEmail = `no-reply@${domain}`;
    
    setSettings({
      ...settings,
      fromEmail: newEmail,
    });
    
    setMaskedEmail(`OmniNotify System <${newEmail}>`);
    showMessage(`Dominio actualizado a: ${newEmail}`, 'info');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
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

      {/* Header con logo personalizable */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          {/* Logo de la empresa */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              {companyLogo ? (
                <img 
                  src={companyLogo} 
                  alt="Company Logo" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Error cargando logo');
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                          <span class="text-2xl text-blue-600">🏢</span>
                        </div>
                      `;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                  <span className="text-2xl text-blue-600">🏢</span>
                </div>
              )}
            </div>
            
            {/* Botón para cambiar logo */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-blue-700"
              title="Cambiar logo"
              disabled={uploadingLogo}
            >
              {uploadingLogo ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
          </div>

          {/* Información de la empresa */}
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Configuración de Email</h1>
            <p className="text-gray-600">Configure las notificaciones por email de {propCompanyName}</p>
            <div className="mt-2">
              <p className="text-sm font-medium text-blue-700">
                📧 Remitente enmascarado: <span className="font-mono bg-blue-50 px-2 py-1 rounded">{maskedEmail}</span>
              </p>
              {companyLogo && (
                <p className="text-sm mt-1">
                  <span className={`font-medium ${logoSize > 50000 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {logoSize > 50000 ? '⚠️ ' : '✅ '}
                    Logo: {Math.round(logoSize/1024)}KB 
                    {logoSize > 50000 ? ' (no se enviará en el body)' : ' (se enviará en el body)'}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {uploadingLogo && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-blue-700">Subiendo logo...</span>
            </div>
          )}
          
          {uploadedLogoData && (
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
              <span className="text-sm text-green-700">✅ Logo procesado</span>
            </div>
          )}
          
          <button
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            onClick={() => {
              loadSettings();
              loadCompanyLogo();
              loadCompanyDomain();
            }}
          >
            <span>🔄</span>
            Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1">
        {/* Configuración principal */}
        <div className="space-y-6">
          {/* Configuración principal */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Configuración del Proveedor de Email</h2>
              <p className="text-gray-600 text-sm mt-1">Configure los ajustes de notificación por email</p>
            </div>
            
            <div className="p-6">
              {/* Botón de carga rápida para Gmail */}
              <div className="mb-6">
                <button
                  onClick={handleQuickFillGmail}
                  className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                >
                  <span>⚡</span>
                  Cargar configuración de Gmail predeterminada
                </button>
                <p className="mt-2 text-sm text-gray-600">
                  Nota: El remitente se mostrará como "OmniNotify System &lt;no-reply@ominotify.com&gt;"
                </p>
              </div>

              {/* Selector de dominio para enmascaramiento */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">🌐 Dominio para enmascaramiento</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="midominio.com"
                    className="flex-1 px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleDomainChange(customDomain)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Usar este dominio
                  </button>
                </div>
                <p className="mt-2 text-sm text-blue-700">
                  Los emails se enviarán desde: <strong>no-reply@{customDomain}</strong>
                </p>
              </div>

              {/* Selector de proveedor */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">Proveedor de Email</label>
                <div className="flex gap-3">
                  <button
                    className={`flex-1 p-4 border-2 rounded-lg text-center transition-all ${
                      settings.provider === 'smtp' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSettings({
                      ...settings,
                      provider: 'smtp',
                      apiKey: '',
                    })}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">📧</span>
                      <span className="font-medium">SMTP</span>
                      <span className="text-xs text-gray-500">Gmail, Outlook, etc.</span>
                    </div>
                  </button>
                  
                  <button
                    className={`flex-1 p-4 border-2 rounded-lg text-center transition-all ${
                      settings.provider === 'sendgrid' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSettings({
                      ...settings,
                      provider: 'sendgrid',
                      smtpHost: '',
                      smtpPort: undefined,
                      smtpUser: '',
                      smtpPassword: '',
                    })}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">⚡</span>
                      <span className="font-medium">SendGrid</span>
                      <span className="text-xs text-gray-500">API Service</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Configuración para SMTP */}
              {settings.provider === 'smtp' && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">Configuración SMTP</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Host SMTP
                      </label>
                      <input
                        type="text"
                        value={settings.smtpHost || ''}
                        onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Puerto SMTP
                      </label>
                      <input
                        type="number"
                        value={settings.smtpPort || 465}
                        onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Usuario SMTP
                      </label>
                      <input
                        type="text"
                        value={settings.smtpUser || ''}
                        onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                        placeholder="hgerson3000@gmail.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contraseña SMTP
                      </label>
                      <input
                        type="password"
                        value={settings.smtpPassword || ''}
                        onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      {settings.smtpUser === 'hgerson3000@gmail.com' && (
                        <p className="mt-2 text-sm text-yellow-600">
                          Contraseña de aplicación recomendada: hwovycjveukvzqwd
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-700">
                      ⚠️ <strong>Nota importante:</strong> Aunque uses hgerson3000@gmail.com para autenticación,
                      los emails se enviarán desde <strong>{maskedEmail}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Configuración del remitente */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-700 mb-4">Información del Remitente (Enmascarado)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del Remitente
                    </label>
                    <input
                      type="text"
                      value={settings.fromName || ''}
                      onChange={(e) => {
                        setSettings({ ...settings, fromName: e.target.value });
                        updateMaskedEmail(e.target.value, settings.fromEmail);
                      }}
                      placeholder="OmniNotify System"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      Nombre que aparecerá como remitente
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Enmascarado
                    </label>
                    <input
                      type="email"
                      value={settings.fromEmail || ''}
                      onChange={(e) => {
                        setSettings({ ...settings, fromEmail: e.target.value });
                        updateMaskedEmail(settings.fromName, e.target.value);
                      }}
                      placeholder="no-reply@ominotify.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      Email que verán tus clientes (formato: no-reply@dominio.com)
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700">
                    ✅ <strong>Remitente que verán tus clientes:</strong> 
                    <span className="font-mono ml-2 bg-white px-3 py-1 rounded border">{maskedEmail}</span>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Así se mostrará en Gmail, Outlook, etc. (estilo "Render &lt;no-reply@render.com&gt;")
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                    !testing
                      ? 'border border-gray-300 hover:bg-gray-50'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      Enviando prueba...
                    </>
                  ) : (
                    <>
                      <span>📨</span>
                      Enviar Email de Prueba
                    </>
                  )}
                </button>
                
                <button
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      Guardar Configuración
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sección de prueba de email */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Prueba de Email</h2>
              <p className="text-gray-600 text-sm mt-1">Enviar email de prueba para verificar la configuración</p>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email de Prueba
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="destinatario@ejemplo.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <p className="mt-2 text-sm text-gray-600">
                    El email se enviará desde: <strong>{maskedEmail}</strong>
                  </p>
                </div>
                
                <button
                  className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-colors ${
                    testEmail && !testing
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  onClick={handleTest}
                  disabled={testing || !testEmail}
                >
                  <span>📨</span>
                  Enviar Prueba
                </button>
              </div>

              {testResult && (
                <div className={`mt-6 p-4 rounded-lg border ${
                  testResult.success 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{testResult.success ? '✅' : '❌'}</span>
                    <strong>{testResult.message}</strong>
                  </div>
                  
                  {testResult.result && (
                    <div className="mt-2 text-sm">
                      <p><strong>Destinatario:</strong> {testResult.result.recipient}</p>
                      <p><strong>Remitente (enmascarado):</strong> {testResult.result.sender}</p>
                      <p><strong>Formato enmascarado:</strong> {testResult.result.maskedFormat}</p>
                      <p><strong>Incluye logo:</strong> {testResult.result.includesLogo ? '✅ Sí' : '❌ No'}</p>
                      <p><strong>Proveedor:</strong> {testResult.result.provider}</p>
                      
                      {testResult.result.logoOptimized && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                          <p><strong>Optimización de logo:</strong> {testResult.result.logoOptimized}</p>
                          {testResult.result.logoSizeKB && (
                            <p>Tamaño del logo: {testResult.result.logoSizeKB}KB</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {testResult.error && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Error:</p>
                      <p className="font-mono text-xs break-words">{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Información del sistema */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">ℹ️ Información del Sistema</h3>
                <div className="space-y-2 text-sm text-blue-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <p><strong>Límites del sistema:</strong></p>
                      <ul className="list-disc list-inside text-xs">
                        <li>Tamaño máximo del logo: 2MB (archivo)</li>
                        <li>Base64 máximo para email: 50KB</li>
                        <li>Logos grandes se optimizan automáticamente</li>
                        <li>Payload máximo: 20MB</li>
                      </ul>
                    </div>
                    <div>
                      <p><strong>Enmascaramiento:</strong></p>
                      <p className="text-xs">Los emails siempre se envían desde "no-reply@dominio.com"</p>
                      <p className="text-xs mt-1">Autenticación: Gmail SMTP</p>
                      <p className="text-xs">Visible: Dominio personalizado</p>
                    </div>
                  </div>
                  
                  {companyLogo && logoSize > 50000 && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                      <p className="text-sm text-yellow-700 flex items-center gap-2">
                        <span>⚠️</span>
                        Tu logo es grande ({Math.round(logoSize/1024)}KB). Se usará una versión optimizada para el envío.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailConfiguration;