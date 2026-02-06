import React, { useState, useEffect, useRef } from 'react';
import { emailService } from '../services/emailService';
import type { EmailSettings, TestEmailRequest } from '../types/email.types';

interface EmailConfigurationProps {
  companyId: string;
  companyName?: string;
}

// Obtener URL base desde variables de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// 🔥 NUEVA FUNCIÓN: Comprimir logo para email
const compressLogoForEmail = async (base64: string, maxSizeKB: number = 25): Promise<string | undefined> => {
  return new Promise((resolve) => {
    try {
      console.log(`🔧 Intentando comprimir logo...`);
      
      // Si ya es pequeño, usarlo tal cual
      const currentSizeKB = Math.round(base64.length / 1024);
      if (currentSizeKB <= maxSizeKB) {
        console.log(`✅ Logo ya es pequeño (${currentSizeKB}KB <= ${maxSizeKB}KB)`);
        resolve(base64);
        return;
      }

      console.log(`🔄 Comprimiendo de ${currentSizeKB}KB a máximo ${maxSizeKB}KB`);
      
      const img = new Image();
      
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.warn('❌ Canvas no disponible');
            resolve(undefined);
            return;
          }

          // Redimensionar a tamaño razonable para email
          const maxWidth = 200;
          const maxHeight = 150;
          let width = img.width;
          let height = img.height;

          // Mantener proporción
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          console.log(`📐 Redimensionando a: ${width}x${height}px`);

          canvas.width = width;
          canvas.height = height;
          
          // Configurar para mejor calidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Limpiar fondo blanco para logos con transparencia
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          
          // Dibujar imagen
          ctx.drawImage(img, 0, 0, width, height);

          // Convertir a JPEG (más pequeño que PNG)
          let quality = 0.8;
          let compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          let compressedSizeKB = Math.round(compressedBase64.length / 1024);
          
          console.log(`📦 Intento 1: ${compressedSizeKB}KB (${quality * 100}% calidad)`);

          // Ajustar calidad si sigue grande
          if (compressedSizeKB > maxSizeKB) {
            quality = 0.6;
            compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            compressedSizeKB = Math.round(compressedBase64.length / 1024);
            console.log(`📦 Intento 2: ${compressedSizeKB}KB (${quality * 100}% calidad)`);
          }

          if (compressedSizeKB > maxSizeKB) {
            quality = 0.4;
            compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            compressedSizeKB = Math.round(compressedBase64.length / 1024);
            console.log(`📦 Intento 3: ${compressedSizeKB}KB (${quality * 100}% calidad)`);
          }

          if (compressedSizeKB <= maxSizeKB) {
            console.log(`✅ Logo comprimido: ${compressedSizeKB}KB (reducción del ${Math.round((1 - compressedSizeKB/currentSizeKB)*100)}%)`);
            resolve(compressedBase64);
          } else {
            console.warn(`⚠️ No se pudo comprimir a menos de ${maxSizeKB}KB (queda en ${compressedSizeKB}KB)`);
            resolve(undefined);
          }
          
        } catch (canvasError) {
          console.error('❌ Error en canvas:', canvasError);
          resolve(undefined);
        }
      };

      img.onerror = function() {
        console.warn('❌ Error cargando imagen para comprimir');
        resolve(undefined);
      };

      img.src = base64;
      
    } catch (error) {
      console.error('❌ Error general en compressLogoForEmail:', error);
      resolve(undefined);
    }
  });
};

// Helper para validar si un base64 es válido
const isValidBase64 = (base64: string | null): boolean => {
  if (!base64) return false;
  
  const isDataUrl = base64.startsWith('data:image/') && base64.includes('base64,');
  const hasMinimumSize = base64.length > 1000; // Al menos 1KB para ser una imagen real
  
  return isDataUrl && hasMinimumSize;
};

// Helper para subir logo al backend
const uploadLogoToBackend = async (companyId: string, file: File): Promise<any> => {
  try {
    console.log('📤 Subiendo logo al backend...');
    
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('companyId', companyId);
    
    const response = await fetch(`${API_BASE_URL}/email/upload-logo`, {
      method: 'POST',
      body: formData,
    });
    
    console.log('📥 Respuesta del servidor:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📊 Datos de respuesta:', {
      success: data.success,
      base64Length: data.data?.base64?.length,
      size: data.data?.size
    });
    
    return data;
  } catch (error: any) {
    console.error('❌ Error subiendo logo:', error);
    throw error;
  }
};

// Helper para obtener logo del backend - VERSIÓN CORREGIDA
const getLogoFromBackend = async (companyId: string): Promise<any> => {
  try {
    console.log('🖼️ Solicitando logo para:', companyId);
    
    const response = await fetch(`${API_BASE_URL}/email/logo/${companyId}`);
    
    console.log('📥 Respuesta del logo:', response.status, response.statusText);
    
    if (!response.ok) {
      console.warn('⚠️ No se pudo obtener el logo:', response.status);
      return { 
        success: false, 
        data: { hasLogo: false },
        message: `Error ${response.status}: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    console.log('📊 Logo obtenido:', {
      success: data.success,
      hasLogo: data.data?.hasLogo,
      base64Length: data.data?.base64?.length,
      size: data.data?.size,
      message: data.message
    });
    
    // VALIDACIÓN CRÍTICA: Verificar que el base64 sea real
    if (data.success && data.data?.hasLogo && data.data.base64) {
      if (!isValidBase64(data.data.base64)) {
        console.warn('⚠️ Base64 inválido o muy pequeño:', data.data.base64.length);
        return {
          success: false,
          data: { hasLogo: false },
          message: 'Logo inválido en backend'
        };
      }
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ Error obteniendo logo:', error);
    return { 
      success: false, 
      data: { hasLogo: false },
      error: error.message 
    };
  }
};

// Helper para eliminar logo del backend - VERSIÓN CORREGIDA DEFINITIVA
const deleteLogoFromBackend = async (companyId: string): Promise<any> => {
  try {
    console.log('🗑️ Intentando eliminar logo para:', companyId);
    
    const deleteResponse = await fetch(`${API_BASE_URL}/email/logo/${companyId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('📥 Respuesta DELETE:', deleteResponse.status, deleteResponse.statusText);
    
    if (deleteResponse.ok) {
      const deleteData = await deleteResponse.json();
      console.log('✅ Logo eliminado del backend:', deleteData);
      return deleteData;
    } else {
      const errorText = await deleteResponse.text();
      console.error('❌ Error en DELETE:', errorText);
      
      // Intentar parsear como JSON
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Error ${deleteResponse.status}: ${deleteResponse.statusText}`);
      } catch {
        throw new Error(`Error ${deleteResponse.status}: ${deleteResponse.statusText}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error en deleteLogoFromBackend:', error);
    throw error;
  }
};

// 🔥 NUEVO: Helper para borrar logo anterior antes de subir nuevo
const deleteOldLogoBeforeUpload = async (companyId: string): Promise<boolean> => {
  try {
    console.log('🗑️ Borrando logo anterior para:', companyId);
    
    const deleteResponse = await fetch(`${API_BASE_URL}/email/logo/${companyId}`, {
      method: 'DELETE',
    });
    
    if (deleteResponse.ok) {
      console.log('✅ Logo anterior borrado del backend');
      return true;
    } else if (deleteResponse.status === 404) {
      console.log('ℹ️ No había logo anterior para borrar');
      return true;
    } else {
      console.warn('⚠️ No se pudo borrar logo anterior, pero continuamos');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Error borrando logo anterior:', error);
    return true;
  }
};

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
  const [logoInfo, setLogoInfo] = useState<{filename?: string; optimized?: boolean; valid?: boolean}>({});
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
      console.log('🔄 Cargando logo para companyId:', companyId);
      
      // Limpiar cache temporal
      localStorage.removeItem(`company_logo_temp_${companyId}`);
      
      // Intentar cargar desde el backend usando el helper
      const logoResponse = await getLogoFromBackend(companyId);
      console.log('📥 Respuesta completa del backend:', {
        success: logoResponse.success,
        message: logoResponse.message,
        data: logoResponse.data ? {
          hasLogo: logoResponse.data.hasLogo,
          base64Length: logoResponse.data.base64?.length,
          base64Preview: logoResponse.data.base64?.substring(0, 100),
          size: logoResponse.data.size,
          filename: logoResponse.data.filename
        } : 'No data'
      });
      
      if (logoResponse.success && logoResponse.data?.hasLogo && logoResponse.data.base64) {
        // Verificar si el base64 es real
        if (isValidBase64(logoResponse.data.base64)) {
          console.log('✅ Logo REAL encontrado:', logoResponse.data.base64.length, 'caracteres');
          
          setCompanyLogo(logoResponse.data.base64);
          setLogoSize(logoResponse.data.size || logoResponse.data.base64.length);
          
          // Guardar en localStorage como cache
          localStorage.setItem(`company_logo_${companyId}`, logoResponse.data.base64);
          
          // Guardar información adicional del logo
          setLogoInfo({
            filename: logoResponse.data.filename,
            optimized: logoResponse.data.isOptimized || false,
            valid: true
          });
          
          // Actualizar datos del logo subido
          setUploadedLogoData({
            filename: logoResponse.data.filename,
            fileUrl: logoResponse.data.fileUrl,
            base64: logoResponse.data.base64,
            companyId: logoResponse.data.companyId,
            isOptimized: logoResponse.data.isOptimized,
            size: logoResponse.data.size || logoResponse.data.base64.length
          });
          
        } else {
          console.warn('⚠️ Base64 inválido o muy pequeño:', logoResponse.data.base64.length);
          setCompanyLogo(null);
          setLogoSize(0);
          setLogoInfo({ valid: false });
        }
        
      } else {
        console.log('ℹ️ No hay logo en el backend:', logoResponse.message);
        
        // Intentar cargar desde localStorage (fallback)
        const savedLogo = localStorage.getItem(`company_logo_${companyId}`);
        if (savedLogo && isValidBase64(savedLogo)) {
          console.log('📁 Logo encontrado en localStorage (fallback):', savedLogo.length, 'caracteres');
          setCompanyLogo(savedLogo);
          setLogoSize(savedLogo.length);
          setLogoInfo({ valid: true, optimized: false });
        } else {
          setCompanyLogo(null);
          setLogoSize(0);
          setLogoInfo({ valid: false });
        }
      }
    } catch (error: any) {
      console.error('❌ Error cargando logo del backend:', error);
      
      // Fallback a localStorage
      const savedLogo = localStorage.getItem(`company_logo_${companyId}`);
      if (savedLogo && isValidBase64(savedLogo)) {
        console.log('📁 Usando logo de localStorage (error fallback):', savedLogo.length, 'caracteres');
        setCompanyLogo(savedLogo);
        setLogoSize(savedLogo.length);
        setLogoInfo({ valid: true, optimized: false });
      } else {
        setCompanyLogo(null);
        setLogoSize(0);
        setLogoInfo({ valid: false });
      }
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
    if (!file) return;
    
    console.log('📁 Archivo seleccionado:', {
      name: file.name,
      type: file.type,
      size: `${Math.round(file.size/1024)}KB`
    });
    
    // Validaciones
    if (!file.type.startsWith('image/')) {
      showMessage('Por favor selecciona un archivo de imagen (JPG, PNG, GIF, SVG)', 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      showMessage('La imagen debe ser menor a 5MB', 'error');
      return;
    }
    
    setUploadingLogo(true);
    
    try {
      // 🔥 PASO 1: Borrar logo anterior ANTES de subir nuevo
      await deleteOldLogoBeforeUpload(companyId);
      
      // PASO 2: Leer archivo para preview
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          const previewBase64 = reader.result as string;
          console.log('👁️ Preview generado:', previewBase64.length, 'caracteres');
          
          // Solo mostrar preview si es válido
          if (isValidBase64(previewBase64)) {
            setCompanyLogo(previewBase64);
            setLogoSize(previewBase64.length);
            
            // Guardar temporalmente para mostrar mientras se sube
            localStorage.setItem(`company_logo_temp_${companyId}`, previewBase64);
            // Guardar como original por si el backend falla
            localStorage.setItem(`company_logo_original_${companyId}`, previewBase64);
          }
        }
      };
      reader.readAsDataURL(file);
      
      // PASO 3: Subir al backend usando el helper
      const result = await uploadLogoToBackend(companyId, file);
      
      console.log('📊 Respuesta del servidor:', result);
      
      if (result.success) {
        // Limpiar logo temporal
        localStorage.removeItem(`company_logo_temp_${companyId}`);
        
        if (result.data?.base64 && isValidBase64(result.data.base64)) {
          console.log('✅ Logo REAL recibido del backend:', result.data.base64.length, 'caracteres');
          
          // Guardar información del logo
          setUploadedLogoData(result.data);
          setLogoInfo({
            filename: result.data.filename,
            optimized: result.data.isOptimized || false,
            valid: true
          });
          
          // PASO 4: Optimizar el logo para mostrar/enviar
          const optimizedLogo = await compressLogoForEmail(result.data.base64, 30);
          
          if (optimizedLogo) {
            console.log('🎯 Logo optimizado para frontend:', optimizedLogo.length, 'caracteres');
            setCompanyLogo(optimizedLogo);
            setLogoSize(optimizedLogo.length);
            
            // Guardar versión optimizada en localStorage
            localStorage.setItem(`company_logo_${companyId}`, optimizedLogo);
            
            showMessage('Logo subido y optimizado exitosamente', 'success');
          } else {
            // Usar versión original si no se pudo optimizar
            setCompanyLogo(result.data.base64);
            setLogoSize(result.data.base64.length);
            localStorage.setItem(`company_logo_${companyId}`, result.data.base64);
            
            showMessage('Logo subido exitosamente', 'success');
          }
          
        } else {
          console.error('❌ Backend no devolvió logo válido');
          showMessage('Error: El backend no devolvió un logo válido', 'error');
          
          // Intentar usar el original de localStorage
          const originalLogo = localStorage.getItem(`company_logo_original_${companyId}`);
          if (originalLogo && isValidBase64(originalLogo)) {
            console.log('🔄 Usando logo original de localStorage');
            setCompanyLogo(originalLogo);
            setLogoSize(originalLogo.length);
            localStorage.setItem(`company_logo_${companyId}`, originalLogo);
          }
        }
        
      } else {
        showMessage(`Error: ${result.message || 'Error subiendo logo'}`, 'error');
      }
      
    } catch (error: any) {
      console.error('❌ Error subiendo logo:', error);
      showMessage(`Error subiendo logo: ${error.message}`, 'error');
      
      // Restaurar logo anterior si hay error
      const savedLogo = localStorage.getItem(`company_logo_${companyId}`);
      if (savedLogo && isValidBase64(savedLogo)) {
        setCompanyLogo(savedLogo);
        setLogoSize(savedLogo.length);
      } else {
        // Si no hay logo válido, limpiar todo
        setCompanyLogo(null);
        setLogoSize(0);
        localStorage.removeItem(`company_logo_${companyId}`);
        localStorage.removeItem(`company_logo_original_${companyId}`);
      }
      
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
      // 🔥 CORRECCIÓN CRÍTICA: OPTIMIZAR LOGO ANTES DE ENVIAR
      let logoToSend: string | undefined = undefined;
      let finalLogoSize = 0;
      
      if (companyLogo && logoInfo.valid) {
        console.log('🖼️ Procesando logo para email...');
        console.log(`📏 Logo original: ${Math.round(logoSize/1024)}KB, ${companyLogo.length} caracteres`);
        
        // 1. Intentar comprimir el logo
        const compressedLogo = await compressLogoForEmail(companyLogo, 25); // Máximo 25KB
        
        if (compressedLogo && compressedLogo.length < 30000) { // < 30KB
          logoToSend = compressedLogo;
          finalLogoSize = compressedLogo.length;
          console.log(`✅ Logo optimizado para email: ${Math.round(finalLogoSize/1024)}KB`);
        } else {
          console.log('⚠️ No se pudo optimizar el logo suficientemente, no se incluirá en el email');
          // Pero el backend aún puede buscar su propio logo...
        }
      }

      // 🔥 PREPARAR METADATA CORRECTAMENTE
      const metadata = {
        companyName: propCompanyName,
        companyId: companyId,
        testType: 'connection_test',
        includeLogo: !!logoToSend, // Solo true si tenemos logo optimizado
        logoSize: finalLogoSize,
        // Solo enviar logo si está optimizado y es pequeño
        companyLogo: logoToSend,
        logoUrl: uploadedLogoData?.fileUrl,
        logoFilename: logoInfo.filename
      };

      console.log('📤 Metadata para email:', {
        includeLogo: metadata.includeLogo,
        logoSizeKB: Math.round(metadata.logoSize/1024),
        companyLogoLength: metadata.companyLogo?.length || 0
      });

      const testRequest: TestEmailRequest = {
        to: testEmail,
        provider: settings.provider,
        metadata: metadata
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
      console.log('🏢 CompanyId:', companyId);
      console.log('🖼️ Logo incluido:', metadata.includeLogo);
      console.log('📏 Tamaño logo a enviar:', Math.round(finalLogoSize/1024), 'KB');
      
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
      
      showMessage('Error enviando email de prueba', 'error');
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

  const handleRemoveLogo = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar el logo?')) return;
    
    try {
      const result = await deleteLogoFromBackend(companyId);
      
      if (result.success) {
        // Limpiar estados locales
        setCompanyLogo(null);
        setLogoSize(0);
        setUploadedLogoData(null);
        setLogoInfo({ valid: false });
        
        // Limpiar localStorage completamente
        localStorage.removeItem(`company_logo_${companyId}`);
        localStorage.removeItem(`company_logo_temp_${companyId}`);
        localStorage.removeItem(`company_logo_original_${companyId}`);
        
        showMessage('Logo eliminado exitosamente', 'success');
      } else {
        showMessage('Error eliminando logo: ' + result.message, 'error');
      }
    } catch (error: any) {
      console.error('Error eliminando logo:', error);
      // Aún así limpiamos localmente
      setCompanyLogo(null);
      setLogoSize(0);
      localStorage.removeItem(`company_logo_${companyId}`);
      showMessage('Logo eliminado localmente: ' + error.message, 'info');
    }
  };

  const handleRefreshLogo = async () => {
    console.log('🔄 Forzando recarga de logo...');
    await loadCompanyLogo();
    showMessage('Logo recargado', 'info');
  };

  const handleDebugLogo = () => {
    console.log('🔍 DEBUG COMPLETO DEL LOGO:');
    console.log('1. companyId:', companyId);
    console.log('2. companyLogo exists:', !!companyLogo);
    console.log('3. companyLogo length:', companyLogo?.length);
    console.log('4. companyLogo preview:', companyLogo?.substring(0, 150));
    console.log('5. logoInfo:', logoInfo);
    console.log('6. logoSize:', logoSize, 'bytes ≈', Math.round(logoSize/1024), 'KB');
    console.log('7. localStorage:', {
      company_logo: localStorage.getItem(`company_logo_${companyId}`)?.length,
      company_logo_original: localStorage.getItem(`company_logo_original_${companyId}`)?.length,
      company_logo_temp: localStorage.getItem(`company_logo_temp_${companyId}`)?.length
    });
    console.log('8. uploadedLogoData:', uploadedLogoData);
    console.log('9. API_BASE_URL:', API_BASE_URL);
    
    // Probar endpoint GET
    fetch(`${API_BASE_URL}/email/logo/${companyId}`)
      .then(res => {
        console.log('10. GET /email/logo status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('11. GET /email/logo response:', {
          success: data.success,
          hasLogo: data.data?.hasLogo,
          base64Length: data.data?.base64?.length,
          message: data.message
        });
        if (data.data?.base64) {
          console.log('12. Base64 preview:', data.data.base64.substring(0, 150));
        }
      })
      .catch(err => console.error('13. Error GET:', err));
    
    // Probar compresión
    if (companyLogo) {
      console.log('14. Probando compresión...');
      const originalSizeKB = Math.round(companyLogo.length / 1024);
      console.log(`    Original: ${originalSizeKB}KB`);
      
      compressLogoForEmail(companyLogo, 25)
        .then(compressed => {
          if (compressed) {
            const compressedSizeKB = Math.round(compressed.length / 1024);
            console.log(`    Comprimido: ${compressedSizeKB}KB (${Math.round((1 - compressedSizeKB/originalSizeKB)*100)}% reducción)`);
          } else {
            console.log('    No se pudo comprimir');
          }
        });
    }
    
    showMessage('Debug completo en consola', 'info');
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
              {companyLogo && logoInfo.valid ? (
                <img 
                  src={companyLogo} 
                  alt="Company Logo" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('❌ Error cargando logo en img tag');
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
                  onLoad={() => console.log('✅ Logo cargado correctamente en img tag')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                  <span className="text-2xl text-blue-600">🏢</span>
                </div>
              )}
            </div>
            
            {/* Botones para logo */}
            <div className="absolute -bottom-2 -right-2 flex gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-blue-700"
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
              
              {companyLogo && logoInfo.valid && (
                <button
                  onClick={handleRemoveLogo}
                  className="bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-700"
                  title="Eliminar logo"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
            
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
              {companyLogo && logoInfo.valid ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-medium ${
                    logoSize > 30000 ? 'text-yellow-600' : 
                    logoSize > 15000 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {logoSize > 30000 ? '⚠️ ' : logoSize > 15000 ? '📏 ' : '✅ '}
                    Logo: {Math.round(logoSize/1024)}KB 
                    {logoInfo.optimized && ' (optimizado)'}
                  </span>
                  {logoInfo.filename && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">
                      {logoInfo.filename.substring(0, 15)}...
                    </span>
                  )}
                  <button
                    onClick={handleDebugLogo}
                    className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
                    title="Debug del logo"
                  >
                    🔍
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-500">
                    📭 No hay logo configurado
                  </p>
                  <button
                    onClick={handleDebugLogo}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                    title="Debug del logo"
                  >
                    🔍
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {uploadingLogo && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-blue-700">Optimizando y subiendo logo...</span>
            </div>
          )}
          
          {uploadedLogoData && (
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg">
              <span className="text-sm text-green-700">✅ Logo procesado y optimizado</span>
            </div>
          )}
          
          <button
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            onClick={handleRefreshLogo}
            title="Recargar logo desde backend"
          >
            <span>🔄</span>
            Recargar Logo
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
                <p className="mt-1 text-xs text-blue-600">
                  🔧 <strong>Sugerencia:</strong> Logos 30KB se comprimen automáticamente para email
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

              {/* Configuración para SendGrid */}
              {settings.provider === 'sendgrid' && (
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-700 mb-4">Configuración SendGrid</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key de SendGrid
                    </label>
                    <input
                      type="password"
                      value={settings.apiKey || ''}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      placeholder="SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
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
                    {companyLogo && logoInfo.valid && (
                      <span className="ml-2 text-blue-600">
                        📷 Logo incluido ({Math.round(logoSize/1024)}KB)
                      </span>
                    )}
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
                      <p><strong>Proveedor:</strong> {testResult.result.provider}</p>
                      <p><strong>Empresa:</strong> {testResult.result.companyName || 'No especificada'}</p>
                      {testResult.result.emailId && (
                        <p><strong>ID del email:</strong> {testResult.result.emailId}</p>
                      )}
                      {testResult.result.logoOptimized && (
                        <p><strong>Logo:</strong> {testResult.result.logoOptimized}</p>
                      )}
                    </div>
                  )}
                  
                  {testResult.error && (
                    <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                      <p className="font-medium">Detalles del error:</p>
                      <p className="text-sm font-mono">{testResult.error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Información técnica */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-700 mb-3">Información Técnica</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-700">Company ID</p>
                    <p className="text-gray-600 font-mono text-xs truncate">{companyId}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-700">Estado del Logo</p>
                    <p className={`font-medium ${
                      companyLogo && logoInfo.valid
                        ? logoSize > 30000 ? 'text-yellow-600' : 
                          logoSize > 15000 ? 'text-orange-600' : 'text-green-600'
                        : 'text-gray-500'
                    }`}>
                      {companyLogo && logoInfo.valid
                        ? `${Math.round(logoSize/1024)}KB` 
                        : 'No configurado'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-700">Base de Datos</p>
                    <p className="text-gray-600">MySQL OmniNotify</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    🔧 <strong>Optimización automática:</strong> Logos 30KB se comprimen automáticamente para email
                  </p>
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