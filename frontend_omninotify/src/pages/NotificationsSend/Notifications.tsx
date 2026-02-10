import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle,
  Users, FileText, User, X, Clock, Phone, Tag
} from 'lucide-react';
import TemplateSelectionModal from './TemplateSelectionModal';
import ContactsSelectionModal from './ContactsSelectionModal';
import GroupsSelectionModal from './GroupsSelectionModal';
import { api } from '../../services/api';

// Define los tipos localmente
interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_id: string;
  tags?: any[];
}

interface Template {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  name: string;
  content: string;
  company_id: string;
  provider_template_id?: string;
}

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contactCount: number;
  company_id: string;
}

interface Variables {
  [key: string]: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  fecha: string;
  hora: string;
  monto: string;
  fechaLimite: string;
  numeroFactura: string;
}

interface NotificationResult {
  recipient: string;
  success: boolean;
  data?: any;
  error?: string;
  scheduled: boolean;
  channel: 'EMAIL' | 'SMS';
}

const NotificationsSend: React.FC = () => {
  const navigate = useNavigate();
  
  // Obtener el usuario del localStorage
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const companyId = userData.company_id || '25a63d10-eff4-11f0-86e6-a2aaf909b30d';
  
  // Estados principales
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedRecipientType, setSelectedRecipientType] = useState<'individual' | 'group' | 'manual'>('individual');

  // Estados UI
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    results?: NotificationResult[];
    total?: number;
    successful?: number;
    scheduled?: boolean;
    channel?: 'EMAIL' | 'SMS';
    error?: string;
  } | null>(null);
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados modales
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);

  // Programación
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('09:00');

  // Variables para template
  const [variables, setVariables] = useState<Variables>({
    nombre: 'Juan Pérez',
    email: 'juan@ejemplo.com',
    telefono: '+59170797542',
    empresa: userData.company_name || 'Mi Empresa S.A.',
    fecha: new Date().toLocaleDateString('es-ES'),
    hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    monto: '$1,250.00',
    fechaLimite: new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleDateString('es-ES'),
    numeroFactura: 'INV-' + new Date().getFullYear() + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  });

  // Cargar contactos desde API
  const loadContacts = async (): Promise<void> => {
    try {
      console.log('Cargando contactos para compañía:', companyId);
      
      const contactsData = await api.get(`/contacts/company/${companyId}`);
      console.log('Contactos cargados:', contactsData.length);
      setContacts(contactsData || []);
    } catch (error: any) {
      console.error('Error cargando contactos:', error);
      
      if (error.message !== 'Authentication failed') {
        showMessage('Error cargando contactos', 'error');
      }
    }
  };

  // Cargar Tags como Grupos desde API
  const loadGroups = async (): Promise<void> => {
    try {
      console.log('Cargando tags/grupos para compañía:', companyId);
      
      const tagsData = await api.get('/tags');
      console.log('Tags recibidos:', tagsData);
      
      const formattedGroups: ContactGroup[] = Array.isArray(tagsData) ? tagsData.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description || `Contactos con la etiqueta "${tag.name}"`,
        contactCount: tag._count?.contacts || tag.contactCount || 0,
        company_id: tag.company_id || companyId
      })) : [];
      
      console.log('Grupos formateados:', formattedGroups);
      setContactGroups(formattedGroups);
      
    } catch (error: any) {
      console.error('Error cargando tags/grupos:', error);
      
      if (error.message !== 'Authentication failed') {
        showMessage('Error cargando grupos (tags)', 'error');
      }
      
      // Datos de ejemplo como fallback
      const exampleTags = [
        { id: '1', name: 'VIP', description: 'Clientes VIP' },
        { id: '2', name: 'Nuevo', description: 'Clientes nuevos' },
        { id: '3', name: 'Recurrente', description: 'Clientes recurrentes' },
      ];
      
      const exampleGroups: ContactGroup[] = exampleTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        contactCount: Math.floor(Math.random() * 50) + 10,
        company_id: companyId
      }));
      
      setContactGroups(exampleGroups);
    }
  };

  // Cargar templates
  const loadTemplates = async (): Promise<void> => {
    try {
      console.log('Cargando templates para compañía:', companyId);
      
      const templatesData = await api.get(`/templates/company/${companyId}`);
      console.log('Templates cargados:', Array.isArray(templatesData) ? templatesData.length : 0);
      
      const templatesArray = Array.isArray(templatesData) 
        ? templatesData 
        : (templatesData?.data || []);
      
      setTemplates(templatesArray);
      
      // Filtrar solo EMAIL y SMS para este componente
      const availableTemplates = templatesArray.filter((t: Template) => 
        t.channel === 'EMAIL' || t.channel === 'SMS'
      );
      
      console.log('Templates disponibles (EMAIL/SMS):', availableTemplates.length);
      if (availableTemplates.length > 0) {
        // Intentar seleccionar primero un template de EMAIL
        const emailTemplate = availableTemplates.find((t: { channel: string; }) => t.channel === 'EMAIL');
        if (emailTemplate) {
          setSelectedTemplate(emailTemplate);
        } else {
          setSelectedTemplate(availableTemplates[0]);
        }
      }
      
    } catch (error: any) {
      console.error('Error cargando templates:', error);
      
      if (error.message !== 'Authentication failed') {
        showMessage('Error cargando templates', 'error');
      }
      
      // Datos de ejemplo como fallback
      const exampleTemplates: Template[] = [
        {
          id: '1',
          name: 'Template de Email',
          channel: 'EMAIL',
          content: '<div style="background-color: #f0f8ff; padding: 20px; border-radius: 10px;"><h1 style="color: #0066cc;">¡Hola {{nombre}}!</h1><p style="color: #333;">Este es un template de email de ejemplo para {{empresa}}.</p><p>Tu factura {{numeroFactura}} por {{monto}} vence el {{fechaLimite}}.</p><p>Fecha: {{fecha}} Hora: {{hora}}</p><button style="background-color: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 5px;">Haz clic aquí</button></div>',
          company_id: companyId
        },
        {
          id: '2',
          name: 'Template de SMS',
          channel: 'SMS',
          content: 'Hola {{nombre}}, tu cita es el {{fecha}} a las {{hora}}. ¡No faltes! Factura: {{numeroFactura}}, Monto: {{monto}}. {{empresa}}',
          company_id: companyId
        }
      ];
      
      setTemplates(exampleTemplates);
      setSelectedTemplate(exampleTemplates[0]);
    }
  };

  // Cargar todos los datos
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      try {
        console.log('Iniciando carga de datos...');
        console.log('Compañía del usuario:', companyId);
        
        const token = localStorage.getItem('auth_token');
        if (!token) {
          showMessage('No estás autenticado. Redirigiendo al login...', 'error');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
        
        console.log('Token disponible:', !!token);
        
        await loadTemplates();
        await loadContacts();
        await loadGroups();
        
        // Configurar fecha por defecto (hoy, no mañana)
        const today = new Date();
        // Normalizamos la fecha a medianoche para que no bloquee el día actual
        const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        setScheduleDate(normalizedToday.toISOString().split('T')[0]);
        
        // Configurar hora por defecto (1 hora en el futuro para evitar problemas de hora pasada)
        const nextHour = new Date(today.getTime() + 60 * 60 * 1000);
        setScheduleTime(nextHour.toISOString().split('T')[1].substring(0, 5));
        
        console.log('Carga de datos completada');

      } catch (error) {
        console.error('Error cargando datos:', error);
        showMessage('Error cargando datos iniciales', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Función para mostrar mensajes
  const showMessage = (text: string, type: 'success' | 'error'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Agregar destinatario manual
  const addManualRecipient = (): void => {
    if (!selectedTemplate) {
      showMessage('Selecciona un template primero', 'error');
      return;
    }

    const promptMsg = selectedTemplate.channel === 'SMS' 
      ? 'Ingresa número (Ej: +59170797542):' 
      : 'Ingresa email:';
    
    const input = prompt(promptMsg);
    if (!input) return;

    if (selectedTemplate.channel === 'SMS') {
      if (!/^\+?\d{10,15}$/.test(input.replace(/\D/g, ''))) {
        showMessage('Número inválido', 'error');
        return;
      }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
        showMessage('Email inválido', 'error');
        return;
      }
    }

    if (!selectedContacts.includes(input)) {
      setSelectedContacts([...selectedContacts, input]);
      showMessage('Destinatario agregado', 'success');
    }
  };

  // Remover destinatario
  const removeRecipient = (recipient: string): void => {
    setSelectedContacts(selectedContacts.filter(r => r !== recipient));
  };

  // Toggle contacto individual
  const toggleIndividualContact = (contact: Contact): void => {
    if (!selectedTemplate) return;

    const value = selectedTemplate.channel === 'SMS' ? contact.phone : contact.email;
    if (!value) {
      showMessage(`${contact.name} no tiene ${selectedTemplate.channel === 'SMS' ? 'teléfono' : 'email'}`, 'error');
      return;
    }

    if (selectedContacts.includes(value)) {
      setSelectedContacts(selectedContacts.filter(v => v !== value));
    } else {
      setSelectedContacts([...selectedContacts, value]);
    }
  };

  // Toggle grupo (tag)
  const toggleGroup = (groupId: string): void => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
    } else {
      setSelectedGroups([...selectedGroups, groupId]);
    }
  };

  // Obtener contactos de grupos seleccionados (tags)
  const getContactsFromSelectedGroups = (): number => {
    let total = 0;
    selectedGroups.forEach(groupId => {
      const group = contactGroups.find(g => g.id === groupId);
      if (group) total += group.contactCount;
    });
    return total;
  };

  // Reemplazar variables en el contenido
  const replaceVariables = (content: string, vars: Variables): string => {
    let result = content;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, vars[key]);
    });
    return result;
  };

  // Extraer variables del template
  const extractVariables = (content: string): string[] => {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = content.match(variablePattern) || [];
    const uniqueVariables = [...new Set(matches.map(match => match.replace(/[{}]/g, '')))];
    return uniqueVariables;
  };

  // Función para obtener fecha mínima (hoy a medianoche)
  const getMinDate = (): string => {
    const today = new Date();
    // Normalizar a medianoche para que no bloquee el día actual
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split('T')[0];
  };

  // Función para validar si la fecha/hora programada es válida
  const isValidSchedule = (dateStr: string, timeStr: string): boolean => {
    if (!dateStr || !timeStr) return false;
    
    const scheduledDateTime = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    
    return scheduledDateTime > now;
  };

  // Función para determinar si una respuesta es exitosa (FIX CRÍTICO)
  const isSuccessResponse = (responseData: any): boolean => {
    // Verificar si hay un campo 'success' explícito
    if (typeof responseData.success === 'boolean') {
      return responseData.success;
    }
    
    // Verificar si hay un campo 'error'
    if (responseData.error) {
      return false;
    }
    
    // Verificar si la respuesta tiene datos válidos
    if (responseData.data) {
      return true;
    }
    
    // Verificar si el mensaje indica éxito
    if (responseData.message) {
      const lowerMessage = responseData.message.toLowerCase();
      if (lowerMessage.includes('enviado') || 
          lowerMessage.includes('correctamente') || 
          lowerMessage.includes('éxito') ||
          lowerMessage.includes('success')) {
        return true;
      }
    }
    
    // Por defecto, asumir éxito si no hay indicadores de error
    return !responseData.error && responseData.message;
  };

  // Función para enviar notificaciones - CORREGIDA
  const sendNotifications = async (): Promise<void> => {
    if (!selectedTemplate) {
      showMessage('Selecciona un template', 'error');
      return;
    }

    if (selectedRecipientType === 'individual' && selectedContacts.length === 0) {
      showMessage('Selecciona destinatarios', 'error');
      return;
    }

    if (selectedRecipientType === 'group' && selectedGroups.length === 0) {
      showMessage('Selecciona grupos (tags)', 'error');
      return;
    }

    if (selectedRecipientType === 'manual' && selectedContacts.length === 0) {
      showMessage('Agrega destinatarios manuales', 'error');
      return;
    }

    // Validar programación si es "later"
    if (scheduleType === 'later') {
      if (!scheduleDate || !scheduleTime) {
        showMessage('Selecciona fecha y hora para programar', 'error');
        return;
      }
      
      if (!isValidSchedule(scheduleDate, scheduleTime)) {
        showMessage('La fecha/hora programada debe ser futura', 'error');
        return;
      }
    }

    setSending(true);
    setResult(null);

    try {
      // Preparar destinatarios únicos para evitar duplicados
      const uniqueRecipients = [...new Set(selectedContacts)];
      const totalRecipients = selectedRecipientType === 'group' 
        ? getContactsFromSelectedGroups() 
        : uniqueRecipients.length;

      console.log(`Iniciando envío a ${totalRecipients} destinatarios únicos`);

      if (selectedTemplate.channel === 'EMAIL') {
        // Reemplazar variables en el contenido para el payload
        const finalContent = replaceVariables(selectedTemplate.content, variables);
        
        // Para email, enviar a cada destinatario individualmente
        const promises = uniqueRecipients.map(async (recipient): Promise<NotificationResult> => {
          const emailPayload = {
            to: recipient,
            subject: `${selectedTemplate.name} - ${variables.empresa}`,
            html: finalContent,
            text: finalContent.replace(/<[^>]*>/g, ''),
            templateId: selectedTemplate.id,
            companyId: companyId,
            companyName: variables.empresa,
            variables: variables,
            schedule: scheduleType === 'later' ? `${scheduleDate}T${scheduleTime}:00` : null
          };
          
          console.log(`Enviando EMAIL a: ${recipient}`);
          
          try {
            const response = await api.post('/email/send-notification', emailPayload);
            console.log(`Respuesta para ${recipient}:`, response.data);
            
            // USAR LA NUEVA FUNCIÓN PARA DETERMINAR ÉXITO
            const success = isSuccessResponse(response.data);
            
            return {
              recipient,
              success,
              data: response.data.data || response.data,
              scheduled: !!emailPayload.schedule,
              channel: 'EMAIL'
            };
          } catch (error: any) {
            console.error(`Error enviando a ${recipient}:`, error);
            return {
              recipient,
              success: false,
              error: error.response?.data?.message || error.message || 'Error desconocido',
              scheduled: !!emailPayload.schedule,
              channel: 'EMAIL'
            };
          }
        });
        
        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;
        
        console.log(`Resultados: ${successCount} exitosos de ${results.length} totales`);
        
        setResult({
          success: successCount > 0,
          message: scheduleType === 'now'
            ? `Enviados ${successCount} de ${uniqueRecipients.length} EMAIL(s)`
            : `Programados ${uniqueRecipients.length} EMAIL(s)`,
          results: results,
          total: uniqueRecipients.length,
          successful: successCount,
          scheduled: scheduleType === 'later',
          channel: 'EMAIL'
        });
        
        if (scheduleType === 'now') {
          if (successCount > 0) {
            showMessage(`${successCount} EMAIL(s) enviado(s) exitosamente`, 'success');
          } else {
            showMessage(`No se pudo enviar ningún EMAIL`, 'error');
          }
        } else {
          showMessage(`${uniqueRecipients.length} EMAIL(s) programado(s) exitosamente`, 'success');
        }
        
      } else if (selectedTemplate.channel === 'SMS') {
        // Para SMS, usar el endpoint /sms/send-direct
        const smsPromises = uniqueRecipients.map(async (recipient): Promise<NotificationResult> => {
          const smsPayload = {
            to: recipient,
            text: replaceVariables(selectedTemplate.content, variables),
            templateId: selectedTemplate.id,
            companyId: companyId,
            variables: variables,
            provider: 'vonage',
            config: {
              apiKey: '84a24d93',
              apiSecret: '46Xump31CGyK88hf',
              fromNumber: 'OmniNotify'
            },
            schedule: scheduleType === 'later' ? `${scheduleDate}T${scheduleTime}:00` : null
          };
          
          console.log(`Enviando SMS a: ${recipient}`);
          
          try {
            const response = await api.post('/sms/send-direct', smsPayload);
            console.log(`Respuesta para ${recipient}:`, response.data);
            
            // USAR LA NUEVA FUNCIÓN PARA DETERMINAR ÉXITO
            const success = isSuccessResponse(response.data);
            
            return {
              recipient,
              success,
              data: response.data.data || response.data,
              scheduled: !!smsPayload.schedule,
              channel: 'SMS'
            };
          } catch (error: any) {
            console.error(`Error enviando SMS a ${recipient}:`, error);
            return {
              recipient,
              success: false,
              error: error.response?.data?.message || error.message || 'Error desconocido',
              scheduled: !!smsPayload.schedule,
              channel: 'SMS'
            };
          }
        });
        
        const results = await Promise.all(smsPromises);
        const successCount = results.filter(r => r.success).length;
        
        setResult({
          success: successCount > 0,
          message: scheduleType === 'now'
            ? `Enviados ${successCount} de ${uniqueRecipients.length} SMS`
            : `Programados ${uniqueRecipients.length} SMS`,
          results: results,
          total: uniqueRecipients.length,
          successful: successCount,
          scheduled: scheduleType === 'later',
          channel: 'SMS'
        });
        
        if (scheduleType === 'now') {
          if (successCount > 0) {
            showMessage(`${successCount} SMS enviado(s) exitosamente`, 'success');
          } else {
            showMessage(`No se pudo enviar ningún SMS`, 'error');
          }
        } else {
          showMessage(`${uniqueRecipients.length} SMS programado(s) exitosamente`, 'success');
        }
      }

    } catch (error: any) {
      console.error('Error en el envío:', error);
      setResult({
        success: false,
        message: 'Error en el envío',
        error: error.response?.data?.message || error.message || 'Error desconocido'
      });
      showMessage('Error en el envío', 'error');
    } finally {
      setSending(false);
    }
  };

  // Verificar si botón debe estar deshabilitado
  const isSendButtonDisabled = (): boolean => {
    if (!selectedTemplate) return true;
    if (selectedRecipientType === 'individual' && selectedContacts.length === 0) return true;
    if (selectedRecipientType === 'group' && selectedGroups.length === 0) return true;
    if (selectedRecipientType === 'manual' && selectedContacts.length === 0) return true;
    
    // Validar programación si es "later"
    if (scheduleType === 'later') {
      if (!scheduleDate || !scheduleTime) return true;
      if (!isValidSchedule(scheduleDate, scheduleTime)) return true;
    }
    
    return false;
  };

  // Filtrar templates para mostrar solo EMAIL y SMS
  const getFilteredTemplates = (): Template[] => {
    return templates.filter(t => t.channel === 'EMAIL' || t.channel === 'SMS');
  };

  // Función para renderizar HTML seguro
  const renderTemplateContent = (content: string): { __html: string } => {
    // Reemplazar variables primero
    const contentWithVars = replaceVariables(content, variables);
    return { __html: contentWithVars };
  };

  // Función para formatear teléfono
  const formatPhoneForDisplay = (phone: string): string => {
    if (!phone) return '';
    
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('591')) {
      // Formato Bolivia: +591 70797542
      return `+${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
    } else if (cleaned.length === 10) {
      // Formato USA: (123) 456-7890
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    
    return phone;
  };

  // Variables del template actual
  const templateVariables = selectedTemplate ? extractVariables(selectedTemplate.content) : [];

  // Manejar cambio de variable
  const handleVariableChange = (variable: string, value: string): void => {
    setVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  // Formatear fecha para mostrar
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Cargando datos...</p>
        <p className="text-sm text-gray-500 mt-2">Compañía: {companyId?.slice(0, 8)}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enviar Notificación</h1>
              <p className="text-gray-600">Selecciona template y destinatarios</p>
              <p className="text-xs text-gray-500 mt-1">
                Usuario: {userData.name} | Compañía: {companyId?.slice(0, 8)}...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          <div className="flex items-center">
            {message.type === 'success' ? 
              <CheckCircle className="w-5 h-5 mr-2" /> : 
              <AlertCircle className="w-5 h-5 mr-2" />
            }
            {message.text}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Panel izquierdo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Template */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="font-semibold text-gray-900">Template</h2>
                    <p className="text-gray-600 text-sm">Selecciona el template</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTemplateModal(true)} 
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  disabled={getFilteredTemplates().length === 0}
                >
                  Ver todos ({getFilteredTemplates().length})
                </button>
              </div>

              {selectedTemplate ? (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100' : 'bg-green-100'}`}>
                        {selectedTemplate.channel === 'EMAIL' ? <Mail className="w-5 h-5 text-blue-600" /> : <Phone className="w-5 h-5 text-green-600" />}
                      </div>
                      <div>
                        <h3 className="font-bold">{selectedTemplate.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs ${selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                            {selectedTemplate.channel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedTemplate(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowTemplateModal(true)} 
                  className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 flex flex-col items-center gap-2 transition-colors"
                  disabled={getFilteredTemplates().length === 0}
                >
                  <FileText className="w-8 h-8 text-gray-400" />
                  <span className="text-gray-700">Seleccionar Template</span>
                  {getFilteredTemplates().length === 0 && (
                    <span className="text-sm text-red-500">No hay templates disponibles</span>
                  )}
                </button>
              )}
            </div>

            {/* Variables del Template */}
            {templateVariables.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Tag className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Variables del Template</h2>
                    <p className="text-gray-600 text-sm">Personaliza las variables del template</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templateVariables.map(variable => (
                    <div key={variable}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable === 'nombre' ? '👤 Nombre' :
                         variable === 'email' ? '📧 Email' :
                         variable === 'telefono' ? '📱 Teléfono' :
                         variable === 'empresa' ? '🏢 Empresa' :
                         variable === 'fecha' ? '📅 Fecha' :
                         variable === 'hora' ? '⏰ Hora' :
                         variable === 'monto' ? '💰 Monto' :
                         variable === 'fechaLimite' ? '⏳ Fecha Límite' :
                         variable === 'numeroFactura' ? '🧾 N° Factura' :
                         variable.charAt(0).toUpperCase() + variable.slice(1)}
                      </label>
                      <input
                        type="text"
                        value={variables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Ingresa ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Destinatarios */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <h2 className="font-semibold text-gray-900">Destinatarios</h2>
                    <p className="text-gray-600 text-sm">Selecciona quienes recibirán</p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-blue-600">
                    {selectedRecipientType === 'group' ? getContactsFromSelectedGroups() : selectedContacts.length}
                  </span> destinatarios
                </div>
              </div>

              {/* Tipo de selección */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {(['individual', 'group', 'manual'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedRecipientType(type)}
                    className={`px-4 py-3 rounded-lg border transition-colors ${
                      selectedRecipientType === type ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type === 'individual' && <User className="w-5 h-5 mx-auto mb-2" />}
                    {type === 'group' && <Tag className="w-5 h-5 mx-auto mb-2" />}
                    {type === 'manual' && <Mail className="w-5 h-5 mx-auto mb-2" />}
                    <span className="text-sm capitalize">
                      {type === 'group' ? 'Tags' : type}
                    </span>
                  </button>
                ))}
              </div>

              {/* Contenido según tipo */}
              {selectedRecipientType === 'individual' && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">Contactos individuales</span>
                    <button 
                      onClick={() => setShowContactsModal(true)} 
                      className="text-sm text-blue-600 hover:text-blue-800"
                      disabled={contacts.length === 0}
                    >
                      Ver todos ({contacts.length})
                    </button>
                  </div>
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.slice(0, 5).map((value, index) => {
                        const contact = contacts.find(c => 
                          selectedTemplate?.channel === 'SMS' ? c.phone === value : c.email === value
                        );
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedTemplate?.channel === 'SMS' ? 'bg-green-100' : 'bg-blue-100'}`}>
                                {selectedTemplate?.channel === 'SMS' ? <Phone className="w-4 h-4 text-green-600" /> : <Mail className="w-4 h-4 text-blue-600" />}
                              </div>
                              <div>
                                <div className="font-medium">{contact?.name || value}</div>
                                <div className="text-sm text-gray-500">
                                  {selectedTemplate?.channel === 'SMS' ? formatPhoneForDisplay(value) : value}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removeRecipient(value)} className="text-red-600 hover:text-red-800">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {selectedContacts.length > 5 && (
                        <div className="text-center text-sm text-gray-500 p-2">
                          + {selectedContacts.length - 5} más...
                        </div>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowContactsModal(true)} 
                      className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
                      disabled={contacts.length === 0}
                    >
                      {contacts.length === 0 ? 'No hay contactos disponibles' : 'Seleccionar contactos'}
                    </button>
                  )}
                </div>
              )}

              {selectedRecipientType === 'group' && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">Tags (Grupos)</span>
                    <button 
                      onClick={() => setShowGroupsModal(true)} 
                      className="text-sm text-blue-600 hover:text-blue-800"
                      disabled={contactGroups.length === 0}
                    >
                      Ver todos los tags ({contactGroups.length})
                    </button>
                  </div>
                  {selectedGroups.length > 0 ? (
                    <div className="space-y-2">
                      {selectedGroups.map(groupId => {
                        const group = contactGroups.find(g => g.id === groupId);
                        if (!group) return null;
                        return (
                          <div key={groupId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Tag className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <div className="font-medium">{group.name}</div>
                                <div className="text-sm text-gray-500">{group.contactCount} contactos</div>
                              </div>
                            </div>
                            <button onClick={() => toggleGroup(groupId)} className="text-red-600 hover:text-red-800">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowGroupsModal(true)} 
                      className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
                      disabled={contactGroups.length === 0}
                    >
                      {contactGroups.length === 0 ? 'No hay tags disponibles' : 'Seleccionar tags'}
                    </button>
                  )}
                </div>
              )}

              {selectedRecipientType === 'manual' && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">Destinatarios manuales</span>
                    <button onClick={addManualRecipient} className="text-sm text-blue-600 hover:text-blue-800">
                      Agregar {selectedTemplate?.channel === 'SMS' ? 'número' : 'email'}
                    </button>
                  </div>
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.map((value, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedTemplate?.channel === 'SMS' ? 'bg-green-100' : 'bg-blue-100'}`}>
                              {selectedTemplate?.channel === 'SMS' ? <Phone className="w-4 h-4 text-green-600" /> : <Mail className="w-4 h-4 text-blue-600" />}
                            </div>
                            <div className="font-medium">
                              {selectedTemplate?.channel === 'SMS' ? formatPhoneForDisplay(value) : value}
                            </div>
                          </div>
                          <button onClick={() => removeRecipient(value)} className="text-red-600 hover:text-red-800">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No hay destinatarios
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Programación */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="font-semibold text-gray-900">Programación</h2>
                  <p className="text-gray-600 text-sm">Programa el envío</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setScheduleType('now')}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    scheduleType === 'now' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Enviar Ahora
                </button>
                <button
                  onClick={() => setScheduleType('later')}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    scheduleType === 'later' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Programar
                </button>
              </div>

              {scheduleType === 'later' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Fecha</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={getMinDate()} 
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Puedes seleccionar hoy o cualquier fecha futura
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Hora</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Hora local (24 horas)
                      </p>
                    </div>
                  </div>

                  {/* Validación de fecha/hora */}
                  {scheduleDate && scheduleTime && (
                    <div className={`p-3 rounded-lg border ${
                      isValidSchedule(scheduleDate, scheduleTime) 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isValidSchedule(scheduleDate, scheduleTime) ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-700">Programado para:</span>
                            <span className="text-green-600">
                              {formatDateForDisplay(scheduleDate)} a las {scheduleTime}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-700">Fecha/Hora inválida:</span>
                            <span className="text-red-600">
                              {formatDateForDisplay(scheduleDate)} a las {scheduleTime}
                            </span>
                            <span className="text-red-500 text-sm ml-auto">
                              (Debe ser futura)
                            </span>
                          </>
                        )}
                      </div>
                      {!isValidSchedule(scheduleDate, scheduleTime) && (
                        <p className="text-red-600 text-sm mt-2">
                          La fecha/hora programada ya pasó. Selecciona una fecha/hora futura.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Botón de envío */}
            <button
              onClick={sendNotifications}
              disabled={sending || isSendButtonDisabled()}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              {sending ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Enviando...
                </span>
              ) : scheduleType === 'now' ? 'Enviar' : 'Programar'}
            </button>
          </div>

          {/* Panel derecho: Vista previa */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-6">Vista Previa</h2>

              {selectedTemplate ? (
                <div className="space-y-6">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Template:</div>
                      <div className="font-bold">{selectedTemplate.name}</div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-sm ${selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      {selectedTemplate.channel}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Contenido:</div>
                    <div className="bg-gray-50 rounded-lg p-4 border min-h-[200px] overflow-auto">
                      {selectedTemplate.channel === 'EMAIL' ? (
                        // Para EMAIL, renderizar HTML con variables reemplazadas
                        <div 
                          className="preview-content"
                          dangerouslySetInnerHTML={renderTemplateContent(selectedTemplate.content)}
                        />
                      ) : (
                        // Para SMS, mostrar texto plano con variables reemplazadas
                        <div className="whitespace-pre-wrap text-gray-800">
                          {replaceVariables(selectedTemplate.content, variables)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border">
                    <h4 className="font-medium mb-3">Resumen</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Destinatarios:</span>
                        <span className="font-medium">
                          {selectedRecipientType === 'group' ? getContactsFromSelectedGroups() : selectedContacts.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span className="font-medium capitalize">
                          {selectedRecipientType === 'group' ? 'Tags' : selectedRecipientType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Programación:</span>
                        <span className="font-medium">{scheduleType === 'now' ? 'Inmediato' : 'Programado'}</span>
                      </div>
                      {scheduleType === 'later' && (
                        <div className="flex justify-between">
                          <span>Fecha/Hora:</span>
                          <span className="font-medium">{scheduleDate} {scheduleTime}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Variables:</span>
                        <span className="font-medium">{templateVariables.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-bold mb-2">Selecciona un Template</h3>
                  <p className="text-gray-600">Elige un template para ver vista previa</p>
                </div>
              )}
            </div>

            {/* Resultado */}
            {result && (
              <div className={`mt-6 rounded-xl border p-6 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-4">
                  {result.success ? <CheckCircle className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
                  <div>
                    <h3 className="font-bold">{result.success ? '✅ Éxito' : '❌ Error'}</h3>
                    <p className="mt-1">{result.message}</p>
                    {result.error && (
                      <p className="text-sm text-red-600 mt-2">{result.error}</p>
                    )}
                    {result.results && result.successful && result.successful > 0 && (
                      <div className="mt-3 text-sm">
                        <div className="font-medium text-gray-700 mb-1">Destinatarios exitosos:</div>
                        <div className="space-y-1">
                          {result.results
                            .filter((r: any) => r.success)
                            .slice(0, 3)
                            .map((r: any, i: number) => (
                              <div key={i} className="flex items-center">
                                <span className="text-green-600 mr-2">✓</span>
                                <span className="truncate">
                                  {r.channel === 'SMS' ? formatPhoneForDisplay(r.recipient) : r.recipient}
                                </span>
                              </div>
                            ))}
                          {result.successful > 3 && (
                            <div className="text-green-600 font-medium">
                              +{result.successful - 3} más
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {showTemplateModal && (
        <TemplateSelectionModal
          templates={getFilteredTemplates()}
          selectedTemplate={selectedTemplate}
          onSelect={(template) => {
            setSelectedTemplate(template);
            setShowTemplateModal(false);
          }}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {showContactsModal && (
        <ContactsSelectionModal
          contacts={contacts}
          selectedContacts={selectedContacts}
          selectedTemplate={selectedTemplate}
          onToggleContact={toggleIndividualContact}
          onClose={() => setShowContactsModal(false)}
        />
      )}

      {showGroupsModal && (
        <GroupsSelectionModal
          groups={contactGroups}
          selectedGroups={selectedGroups}
          onToggleGroup={toggleGroup}
          onClose={() => setShowGroupsModal(false)}
          getContactsFromSelectedGroups={getContactsFromSelectedGroups}
        />
      )}
    </div>
  );
};

export default NotificationsSend;