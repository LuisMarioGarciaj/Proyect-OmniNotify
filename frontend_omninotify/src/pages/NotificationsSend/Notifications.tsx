import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle,
  Users, FileText, User, X, Clock, Phone, Tag, MessageCircle, Building
} from 'lucide-react';
import TemplateSelectionModal from './TemplateSelectionModal';
import ContactsSelectionModal from './ContactsSelectionModal';
import GroupsSelectionModal from './GroupsSelectionModal';
import ManualRecipientModal from './ManualRecipientModal';
import { api } from '../../services/api';
import { getCompany } from '../../services/company.service';
import FileUploadWhatsApp from '../../components/FileUploadWhatsApp';
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

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  company_name?: string;
}

interface Company {
  id: string;
  name: string;
  logo?: string;
}

// Variables con propiedades opcionales pero tipo base string
interface Variables {
  [key: string]: string | undefined;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  fecha: string;
  hora: string;
  monto: string;
  fechaLimite: string;
  numeroFactura: string;
  mediaUrl?: string;
  mediaType?: string;
}

interface NotificationResult {
  recipient: string;
  success: boolean;
  data?: any;
  error?: string;
  scheduled: boolean;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
}

// Helper para obtener fecha/hora de Bolivia (UTC-4)
const getBoliviaDateTime = () => {
  const now = new Date();
  // Bolivia está en UTC-4 todo el año (sin horario de verano)
  const boliviaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/La_Paz' }));
  
  return {
    fecha: boliviaTime.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '/'),
    hora: boliviaTime.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }),
    fechaISO: boliviaTime.toISOString().split('T')[0],
    fechaCompleta: boliviaTime
  };
};

// Helper para extraer variables del template
const extractVariablesFromTemplate = (content: string): string[] => {
  const regex = /{{(\w+)}}/g;
  const matches = content.match(regex) || [];
  return [...new Set(matches.map(match => match.replace(/{{|}}/g, '')))];
};

const NotificationsSend: React.FC = () => {
  const navigate = useNavigate();
  
  // Obtener el usuario del localStorage (datos del login)
  const [userData, setUserData] = useState<UserData>(() => {
    return JSON.parse(localStorage.getItem('user_data') || '{}');
  });
  
  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  
  const companyId = userData.company_id || '25a63d10-eff4-11f0-86e6-a2aaf909b30d';
  const companyName = companyData?.name || userData.company_name || 'Mi Empresa S.A.';
  
  console.log('🔐 Usuario logueado:', userData);
  console.log('🏢 Datos de empresa:', companyData);
  console.log('📛 Nombre de empresa final:', companyName);
  
  // Estados principales
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedContactObjects, setSelectedContactObjects] = useState<Contact[]>([]);
  
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
    channel?: 'EMAIL' | 'SMS' | 'WHATSAPP';
    error?: string;
  } | null>(null);
  
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados modales
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Contactos pendientes de guardar (ingresados manualmente con "guardar como contacto")
  const [pendingContacts, setPendingContacts] = useState<Array<{name: string; phone?: string; email?: string}>>([]);

  // Programación
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('09:00');

  // Estado para media URL (WhatsApp)
  const [whatsappFile, setWhatsappFile] = useState<{
    url: string;
    type: 'image' | 'video' | 'document' | 'audio';
    fileName?: string;
  } | null>(null);

  // Variables - Inicializar con valores por defecto
  const [variables, setVariables] = useState<Variables>(() => {
    const boliviaDateTime = getBoliviaDateTime();
    // Calcular fecha límite (7 días después)
    const fechaLimiteDate = new Date(boliviaDateTime.fechaCompleta);
    fechaLimiteDate.setDate(fechaLimiteDate.getDate() + 7);
    
    return {
      nombre: '',
      email: '',
      telefono: '',
      empresa: companyName, // Inicialmente con el valor del localStorage
      fecha: boliviaDateTime.fecha,
      hora: boliviaDateTime.hora,
      monto: '$1,250.00',
      fechaLimite: fechaLimiteDate.toLocaleDateString('es-ES'),
      numeroFactura: 'INV-' + new Date().getFullYear() + '-' + 
        Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    };
  });

  // Cargar datos de la empresa desde la API
  useEffect(() => {
    const fetchCompanyData = async () => {
      setLoadingCompany(true);
      try {
        if (!companyId) {
          console.log('❌ No hay companyId disponible');
          return;
        }
        
        console.log('🔍 Cargando datos de empresa desde API, companyId:', companyId);
        const company = await getCompany(companyId);
        console.log('✅ Empresa cargada:', company);
        
        setCompanyData(company);
        
        // Actualizar variables con el nombre de la empresa
        setVariables(prev => ({
          ...prev,
          empresa: company.name || prev.empresa
        }));
        
        // Actualizar userData en localStorage si es necesario
        if (company.name && userData.company_name !== company.name) {
          const updatedUserData = { ...userData, company_name: company.name };
          localStorage.setItem('user_data', JSON.stringify(updatedUserData));
          setUserData(updatedUserData);
          console.log('📦 Actualizado company_name en localStorage:', company.name);
        }
        
      } catch (error) {
        console.error('❌ Error cargando datos de empresa:', error);
      } finally {
        setLoadingCompany(false);
      }
    };
    
    fetchCompanyData();
  }, [companyId]);

  // Actualizar variables cuando cambie companyData
  useEffect(() => {
    if (companyData?.name) {
      setVariables(prev => ({
        ...prev,
        empresa: companyData.name || prev.empresa
      }));
    }
  }, [companyData]);

  // Función para cargar variables desde un contacto (siempre editable)
  const loadVariablesFromContact = (contact: Contact | null) => {
    if (!contact) return;

    setVariables(prev => ({
      ...prev,
      nombre: contact.name || prev.nombre,
      email: contact.email || prev.email,
      telefono: contact.phone || prev.telefono
    }));

    console.log('📞 Variables cargadas desde contacto (editables):', {
      nombre: contact.name,
      email: contact.email,
      telefono: contact.phone
    });
  };

  // Actualizar fecha/hora cada minuto (para mantener hora actual)
  useEffect(() => {
    const interval = setInterval(() => {
      const boliviaDateTime = getBoliviaDateTime();
      setVariables(prev => ({
        ...prev,
        fecha: boliviaDateTime.fecha,
        hora: boliviaDateTime.hora
      }));
    }, 60000); // Actualizar cada minuto

    return () => clearInterval(interval);
  }, []);

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
      
      // Filtrar solo EMAIL, SMS y WHATSAPP
      const availableTemplates = templatesArray.filter((t: Template) => 
        t.channel === 'EMAIL' || t.channel === 'SMS' || t.channel === 'WHATSAPP'
      );
      
      console.log('Templates disponibles:', availableTemplates.length);
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
        },
        {
          id: '3',
          name: 'Template de WhatsApp',
          channel: 'WHATSAPP',
          content: 'Hola {{nombre}} 👋\n\nTu factura {{numeroFactura}} por {{monto}} está próxima a vencer el {{fechaLimite}}.\n\nPuedes realizar el pago a través de nuestro portal.\n\nGracias,\n{{empresa}}',
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
        console.log('Nombre de empresa desde userData:', userData.company_name);
        
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
        
        // Configurar fecha por defecto (hoy en Bolivia)
        const boliviaDateTime = getBoliviaDateTime();
        setScheduleDate(boliviaDateTime.fechaISO);
        
        // Configurar hora por defecto (1 hora en el futuro)
        const nextHour = new Date(boliviaDateTime.fechaCompleta.getTime() + 60 * 60 * 1000);
        setScheduleTime(nextHour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }));
        
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

  // Cuando se selecciona un template, extraer variables
  useEffect(() => {
    if (selectedTemplate) {
      console.log('Template seleccionado:', selectedTemplate.name);
    }
  }, [selectedTemplate]);

  // Función para mostrar mensajes
  const showMessage = (text: string, type: 'success' | 'error'): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Agregar destinatario manual — ahora abre el modal
  const addManualRecipient = (): void => {
    if (!selectedTemplate) {
      showMessage('Selecciona un template primero', 'error');
      return;
    }
    setShowManualModal(true);
  };

  // Callback del ManualRecipientModal
  const handleManualConfirm = (
    value: string,
    saveAsContact?: { name?: string; phone?: string; email?: string }
  ): void => {
    setShowManualModal(false);

    if (!selectedContacts.includes(value)) {
      setSelectedContacts(prev => [...prev, value]);
    }

    // Guardar contacto pendiente para crearlo al enviar
    if (saveAsContact) {
      setPendingContacts(prev => [...prev, { ...saveAsContact, company_id: companyId } as any]);
    }

    showMessage('Destinatario agregado', 'success');
  };

  // Remover destinatario
  const removeRecipient = (recipient: string): void => {
    setSelectedContacts(selectedContacts.filter(r => r !== recipient));
    
    // Actualizar selectedContactObjects
    setSelectedContactObjects(prev => prev.filter(c => {
      if (selectedTemplate?.channel === 'SMS' || selectedTemplate?.channel === 'WHATSAPP') {
        return c.phone !== recipient;
      } else {
        return c.email !== recipient;
      }
    }));
  };

  // Toggle contacto individual
  const toggleIndividualContact = (contact: Contact): void => {
    if (!selectedTemplate) return;

    const value = selectedTemplate.channel === 'SMS' || selectedTemplate.channel === 'WHATSAPP' 
      ? contact.phone 
      : contact.email;
      
    if (!value) {
      showMessage(`${contact.name} no tiene ${selectedTemplate.channel === 'SMS' || selectedTemplate.channel === 'WHATSAPP' ? 'teléfono' : 'email'}`, 'error');
      return;
    }

    if (selectedContacts.includes(value)) {
      // Remover contacto
      setSelectedContacts(selectedContacts.filter(v => v !== value));
      setSelectedContactObjects(prev => prev.filter(c => c.id !== contact.id));
    } else {
      // Agregar contacto
      setSelectedContacts([...selectedContacts, value]);
      setSelectedContactObjects([...selectedContactObjects, contact]);
      
      // Cargar variables del contacto (siempre editable)
      loadVariablesFromContact(contact);
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

  // Reemplazar variables en el contenido - maneja valores undefined
  const replaceVariables = (content: string, vars: Variables): string => {
    let result = content;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = vars[key] || '';
      result = result.replace(regex, value);
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

  // Función para obtener fecha mínima (hoy a medianoche en Bolivia)
  const getMinDate = (): string => {
    return getBoliviaDateTime().fechaISO;
  };

  // Función para validar si la fecha/hora programada es válida (en Bolivia)
  const isValidSchedule = (dateStr: string, timeStr: string): boolean => {
    if (!dateStr || !timeStr) return false;
    
    const scheduledDateTime = new Date(`${dateStr}T${timeStr}:00`);
    const now = getBoliviaDateTime().fechaCompleta;
    
    return scheduledDateTime > now;
  };

  // Función para determinar si una respuesta es exitosa
  const isSuccessResponse = (responseData: any): boolean => {
    if (typeof responseData.success === 'boolean') {
      return responseData.success;
    }
    
    if (responseData.error) {
      return false;
    }
    
    if (responseData.data) {
      return true;
    }
    
    if (responseData.message) {
      const lowerMessage = responseData.message.toLowerCase();
      if (lowerMessage.includes('enviado') || 
          lowerMessage.includes('correctamente') || 
          lowerMessage.includes('éxito') ||
          lowerMessage.includes('success') ||
          lowerMessage.includes('encolado')) {
        return true;
      }
    }
    
    return !responseData.error && responseData.message;
  };

  // Función para enviar notificaciones
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
      const uniqueRecipients = [...new Set(selectedContacts)];

      console.log(
        `🚀 Enviando ${selectedTemplate.channel} a ${uniqueRecipients.length} destinatarios`
      );

      // ───── Scheduling UTC correcto (Bolivia -04:00) ─────
      const scheduling =
        scheduleType === 'later'
          ? {
              is_scheduled: true,
              send_at: new Date(
                `${scheduleDate}T${scheduleTime}:00-04:00`
              ).toISOString(),
            }
          : { is_scheduled: false };

      // ───── Limpiar variables ─────
      const cleanVariables: Record<string, string> = {};
      Object.entries(variables).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          cleanVariables[key] = String(val);
        }
      });

      // ───── Contenido final ─────
      const finalContent = replaceVariables(
        selectedTemplate.content,
        variables
      );

      // ───── Adjuntos WhatsApp ─────
      // ───── Adjuntos WhatsApp ─────
      const attachments =
        selectedTemplate.channel === 'WHATSAPP' && whatsappFile
          ? [
              {
                url: whatsappFile.url,
                type: whatsappFile.type,
                fileName: whatsappFile.fileName, // ✅ FIX: nombre real del archivo
                caption: replaceVariables(selectedTemplate.content, variables),
              },
            ]
          : undefined;

      // ───── Promesas ─────
      const promises = uniqueRecipients.map(
        async (recipient): Promise<NotificationResult> => {
          const payload: Record<string, any> = {
            channel: selectedTemplate.channel,
            recipient,
            templateId: selectedTemplate.id,
            variables: cleanVariables,
            scheduling,
            metadata: {
              companyId,
              companyName: variables.empresa || 'Mi Empresa',
              sentFrom: 'web-app',
            },
            content: finalContent,
          };

          if (attachments) {
            payload.attachments = attachments;
          }

          console.log(
            `📤 Payload → ${recipient}`,
            JSON.stringify(payload, null, 2)
          );

          try {
            const response = await api.post(
              '/notifications/send',
              payload
            );

            const success = isSuccessResponse
              ? isSuccessResponse(response.data)
              : true;

            return {
              recipient,
              success,
              data: response.data?.data || response.data,
              scheduled: scheduling.is_scheduled,
              channel: selectedTemplate.channel,
            };
          } catch (error: any) {
            return {
              recipient,
              success: false,
              error:
                error?.response?.data?.message ||
                error?.message ||
                'Error desconocido',
              scheduled: scheduling.is_scheduled,
              channel: selectedTemplate.channel,
            };
          }
        }
      );

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.success).length;

      // ── Guardar contactos pendientes (ingresados como "guardar como contacto") ──
      if (pendingContacts.length > 0 && successCount > 0) {
        await Promise.allSettled(
          pendingContacts.map(contact =>
            api.post('/contacts', { ...contact, company_id: companyId })
          )
        );
        setPendingContacts([]);
      }

      const channelName = selectedTemplate.channel;

      setResult({
        success: successCount > 0,
        message:
          scheduleType === 'now'
            ? `Enviados ${successCount} de ${uniqueRecipients.length} ${channelName}`
            : `Programados ${uniqueRecipients.length} ${channelName}`,
        results,
        total: uniqueRecipients.length,
        successful: successCount,
        scheduled: scheduleType === 'later',
        channel: selectedTemplate.channel,
      });

      if (successCount > 0) {
        showMessage(
          scheduleType === 'now'
            ? `${successCount} ${channelName} enviado(s) exitosamente`
            : `${uniqueRecipients.length} ${channelName} programado(s) exitosamente`,
          'success'
        );
      } else {
        showMessage(
          `No se pudo enviar ningún ${channelName}`,
          'error'
        );
      }
    } catch (error: any) {
      console.error('❌ Error global:', error);

      setResult({
        success: false,
        message: 'Error en el envío',
        error:
          error?.response?.data?.message ||
          error?.message ||
          'Error desconocido',
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

  // Filtrar templates para mostrar solo los del canal seleccionado
  const getFilteredTemplates = (): Template[] => {
    return templates.filter(t => 
      t.channel === 'EMAIL' || t.channel === 'SMS' || t.channel === 'WHATSAPP'
    );
  };

  // Función para renderizar HTML seguro - maneja valores undefined
  const renderTemplateContent = (content: string): { __html: string } => {
    const contentWithVars = replaceVariables(content, variables);
    return { __html: contentWithVars };
  };

  // Función para formatear teléfono
  const formatPhoneForDisplay = (phone: string): string => {
    if (!phone) return '';
    
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('591')) {
      return `+${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    
    return phone;
  };

  // Variables del template actual
  const templateVariables = selectedTemplate ? extractVariables(selectedTemplate.content) : [];

  // Manejar cambio de variable - SIEMPRE EDITABLE
  const handleVariableChange = (variable: string, value: string): void => {
    setVariables(prev => ({
      ...prev,
      [variable]: value || ''
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

  // Obtener icono del canal
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail className="w-5 h-5 text-blue-600" />;
      case 'SMS': return <Phone className="w-5 h-5 text-green-600" />;
      case 'WHATSAPP': return <MessageCircle className="w-5 h-5 text-emerald-600" />;
      default: return <Mail className="w-5 h-5 text-gray-600" />;
    }
  };

  // Obtener color del canal
  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return 'bg-blue-100 text-blue-800';
      case 'SMS': return 'bg-green-100 text-green-800';
      case 'WHATSAPP': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || loadingCompany) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Cargando datos...</p>
        <p className="text-sm text-gray-500 mt-2">Cargando empresa: {companyId?.slice(0, 8)}...</p>
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
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                  <User className="w-3 h-3 text-blue-600" />
                  <span className="text-xs text-blue-700">{userData.name || 'Usuario'}</span>
                </div>
                <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg">
                  <Building className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-700">{companyName}</span>
                </div>
              </div>
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
                      <div className={`p-2 rounded-lg ${
                        selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100' :
                        selectedTemplate.channel === 'SMS' ? 'bg-green-100' :
                        'bg-emerald-100'
                      }`}>
                        {getChannelIcon(selectedTemplate.channel)}
                      </div>
                      <div>
                        <h3 className="font-bold">{selectedTemplate.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs ${getChannelColor(selectedTemplate.channel)}`}>
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

            {/* Sección de Media para WhatsApp */}
            {selectedTemplate?.channel === 'WHATSAPP' && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Media Adjunta (Opcional)</h2>
                    <p className="text-gray-600 text-sm">Agrega imágenes o documentos a tu mensaje</p>
                  </div>
                </div>

                <FileUploadWhatsApp
                onFileSelect={(url: any, type: any, fileName?: string) => {
                  setWhatsappFile({ url, type, fileName });
                  console.log('✅ Archivo seleccionado:', { type, fileName });
                }}
                onFileRemove={() => {
                  setWhatsappFile(null);
                  console.log('🗑️ Archivo removido');
                }}
                currentFile={whatsappFile}
                maxSizeMB={5}
              />
              </div>
            )}

            {/* Variables del Template - SIEMPRE EDITABLES */}
            {templateVariables.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Tag className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Variables del Template</h2>
                    <p className="text-gray-600 text-sm">Personaliza las variables del template (siempre editables)</p>
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
                         variable === 'mediaUrl' ? '🖼️ URL Media' :
                         variable === 'mediaType' ? '📁 Tipo Media' :
                         variable.charAt(0).toUpperCase() + variable.slice(1)}
                      </label>
                      <input
                        type="text"
                        value={variables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Ingresa ${variable}`}
                      />
                      {/* Indicadores informativos (no bloqueantes) */}
                      {variable === 'empresa' && companyData?.name && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Empresa desde API: {companyData.name} (puedes editarlo)
                        </p>
                      )}
                      {(variable === 'nombre' || variable === 'email' || variable === 'telefono') && 
                       selectedContactObjects.length > 0 && variables[variable] && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Cargado desde contacto (puedes editarlo)
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Información del usuario logueado */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Usuario activo:</span>
                    <span>{userData.name} ({userData.email})</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-700">
                    <Building className="w-4 h-4" />
                    <span className="font-medium">Empresa activa:</span>
                    <span>{companyName}</span>
                  </div>
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
                          selectedTemplate?.channel === 'SMS' || selectedTemplate?.channel === 'WHATSAPP' 
                            ? c.phone === value 
                            : c.email === value
                        );
                        
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                selectedTemplate?.channel === 'EMAIL' ? 'bg-blue-100' :
                                selectedTemplate?.channel === 'SMS' ? 'bg-green-100' :
                                'bg-emerald-100'
                              }`}>
                                {selectedTemplate?.channel === 'EMAIL' && <Mail className="w-4 h-4 text-blue-600" />}
                                {selectedTemplate?.channel === 'SMS' && <Phone className="w-4 h-4 text-green-600" />}
                                {selectedTemplate?.channel === 'WHATSAPP' && <MessageCircle className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <div>
                                <div className="font-medium">{contact?.name || value}</div>
                                <div className="text-sm text-gray-500">
                                  {selectedTemplate?.channel === 'SMS' || selectedTemplate?.channel === 'WHATSAPP' 
                                    ? formatPhoneForDisplay(value) 
                                    : value}
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
                      Agregar {selectedTemplate?.channel === 'SMS' || selectedTemplate?.channel === 'WHATSAPP' ? 'número' : 'email'}
                    </button>
                  </div>
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.map((value, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              selectedTemplate?.channel === 'EMAIL' ? 'bg-blue-100' :
                              selectedTemplate?.channel === 'SMS' ? 'bg-green-100' :
                              'bg-emerald-100'
                            }`}>
                              {selectedTemplate?.channel === 'EMAIL' && <Mail className="w-4 h-4 text-blue-600" />}
                              {selectedTemplate?.channel === 'SMS' && <Phone className="w-4 h-4 text-green-600" />}
                              {selectedTemplate?.channel === 'WHATSAPP' && <MessageCircle className="w-4 h-4 text-emerald-600" />}
                            </div>
                            <div className="font-medium">
                              {selectedTemplate?.channel === 'SMS' || selectedTemplate?.channel === 'WHATSAPP' 
                                ? formatPhoneForDisplay(value) 
                                : value}
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
                  <p className="text-gray-600 text-sm">Programa el envío (hora Bolivia)</p>
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
                        Fecha local Bolivia
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
                        Hora local Bolivia (24h)
                      </p>
                    </div>
                  </div>

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
                              {formatDateForDisplay(scheduleDate)} a las {scheduleTime} (Bolivia)
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
                    <div className={`px-3 py-1.5 rounded-full text-sm ${getChannelColor(selectedTemplate.channel)}`}>
                      {selectedTemplate.channel}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Contenido:</div>
                    <div className="bg-gray-50 rounded-lg p-4 border min-h-[200px] overflow-auto">
                      {selectedTemplate.channel === 'EMAIL' ? (
                        <div 
                          className="preview-content"
                          dangerouslySetInnerHTML={renderTemplateContent(selectedTemplate.content)}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-gray-800">
                          {replaceVariables(selectedTemplate.content, variables)}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedTemplate.channel === 'WHATSAPP' && whatsappFile && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <MessageCircle className="w-4 h-4" />
                        <span className="font-medium">Media adjunto:</span>
                        <span className="text-sm">{whatsappFile.type}</span>
                      </div>
                      {whatsappFile.type === 'image' && (
                        <img
                          src={whatsappFile.url}
                          alt="Preview"
                          className="mt-2 rounded-lg max-h-32 object-contain"
                        />
                      )}
                    </div>
                  )}

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
                          <span className="font-medium">{scheduleDate} {scheduleTime} (Bolivia)</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Variables:</span>
                        <span className="font-medium">{templateVariables.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Variables cargadas:</span>
                        <span className="font-medium">
                          {selectedContactObjects.length > 0 ? '✓ Sí' : '✗ No'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Empresa:</span>
                        <span className="font-medium text-green-600">{companyName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Usuario:</span>
                        <span className="font-medium text-blue-600">{userData.name}</span>
                      </div>
                      {selectedTemplate.channel === 'WHATSAPP' && (
                        <div className="flex justify-between">
                          <span>Con Media:</span>
                          <span className="font-medium">{whatsappFile ? 'Sí' : 'No'}</span>
                        </div>
                      )}
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
                                  {r.channel === 'SMS' || r.channel === 'WHATSAPP' 
                                    ? formatPhoneForDisplay(r.recipient) 
                                    : r.recipient}
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

      {showManualModal && selectedTemplate && (
        <ManualRecipientModal
          channel={selectedTemplate.channel}
          onConfirm={handleManualConfirm}
          onClose={() => setShowManualModal(false)}
        />
      )}
    </div>
  );
};

export default NotificationsSend;