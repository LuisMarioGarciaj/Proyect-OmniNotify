import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Send, Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle,
  Users, FileText, MessageSquare, MessageCircle,
  User, Mail as MailIcon, Filter, Plus,
  Calendar, Clock, Search, X, ChevronRight, Check,
  Users as UsersIcon, Eye as EyeIcon, Zap,
  Bell
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:3000/api';

interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  company_id: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_id: string;
  tags?: string[];
}

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contactCount: number;
  tags: string[];
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

const NotificationsSend: React.FC = () => {
  const navigate = useNavigate();
  
  // Estados para datos
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>(['hmauri2000@gmail.com']);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedRecipientType, setSelectedRecipientType] = useState<'individual' | 'group' | 'manual'>('individual');
  const [manualRecipients, setManualRecipients] = useState<string[]>(['hmauri2000@gmail.com']);
  
  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<{text: string; type: 'success' | 'error' | 'info'} | null>(null);
  
  // Estados para modales
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  
  // Estados para búsqueda
  const [searchTemplateTerm, setSearchTemplateTerm] = useState('');
  const [searchContactTerm, setSearchContactTerm] = useState('');
  const [searchGroupTerm, setSearchGroupTerm] = useState('');
  
  // Estados para programación
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('');
  
  // Variables para template
  const [variables, setVariables] = useState<Variables>({
    nombre: 'Juan Pérez',
    email: 'juan@ejemplo.com',
    telefono: '+1234567890',
    empresa: 'Mi Empresa S.A.',
    fecha: new Date().toLocaleDateString('es-ES'),
    hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    monto: '$1,250.00',
    fechaLimite: '25/01/2024',
    numeroFactura: 'INV-2024-001'
  });

  // Inicializar fechas para programación
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Formatear fecha como YYYY-MM-DD para input date
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime('09:00');
  }, []);

  // Cargar templates
  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const companyId = '25a63d10-eff4-11f0-86e6-a2aaf909b30d';
      const response = await axios.get(`${API_BASE_URL}/templates/company/${companyId}`);
      
      let templatesData: Template[] = [];
      if (response.data && Array.isArray(response.data)) {
        templatesData = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        templatesData = response.data.data;
      }
      
      setTemplates(templatesData);
      
      // Seleccionar primer template de EMAIL
      const emailTemplate = templatesData.find(t => t.channel === 'EMAIL');
      if (emailTemplate) {
        setSelectedTemplate(emailTemplate);
      } else if (templatesData.length > 0) {
        setSelectedTemplate(templatesData[0]);
      }
    } catch (error: any) {
      console.error('Error cargando templates:', error);
      showMessage('Error cargando templates', 'error');
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Cargar contactos
  const loadContacts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/contacts`);
      const contactsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setContacts(contactsData);
      
      // Si hay contactos, agregar los emails a seleccionados
      if (contactsData.length > 0 && selectedRecipientType === 'individual') {
        const emails = contactsData
          .slice(0, 3)
          .filter((c: Contact) => c.email)
          .map((c: Contact) => c.email);
        setSelectedContacts(['hmauri2000@gmail.com', ...emails]);
      }
    } catch (error: any) {
      console.error('Error cargando contactos:', error);
      // Datos de ejemplo
      const exampleContacts: Contact[] = [
        { id: '1', name: 'Juan Pérez', email: 'juan@ejemplo.com', phone: '+1234567890', company_id: '1', tags: ['VIP', 'Cliente'] },
        { id: '2', name: 'María García', email: 'maria@ejemplo.com', phone: '+0987654321', company_id: '1', tags: ['Nuevo'] },
        { id: '3', name: 'Carlos Rodríguez', email: 'carlos@ejemplo.com', phone: '+5678901234', company_id: '1', tags: ['Recurrente'] },
        { id: '4', name: 'Ana López', email: 'ana@ejemplo.com', phone: '+4321098765', company_id: '1', tags: ['VIP'] },
        { id: '5', name: 'Pedro Martínez', email: 'pedro@ejemplo.com', phone: '+6789012345', company_id: '1', tags: ['Inactivo'] },
      ];
      setContacts(exampleContacts);
    }
  };

  // Cargar grupos (simulado)
  const loadGroups = () => {
    const groups: ContactGroup[] = [
      { id: '1', name: 'Clientes VIP', description: 'Clientes con compras recurrentes', contactCount: 42, tags: ['VIP', 'Premium'] },
      { id: '2', name: 'Nuevos Usuarios', description: 'Usuarios registrados en los últimos 30 días', contactCount: 156, tags: ['Nuevo', 'Onboarding'] },
      { id: '3', name: 'Suscriptores Newsletter', description: 'Suscriptores del newsletter mensual', contactCount: 892, tags: ['Marketing', 'Email'] },
      { id: '4', name: 'Clientes Inactivos', description: 'Sin actividad en los últimos 90 días', contactCount: 234, tags: ['Inactivo', 'Recuperación'] },
      { id: '5', name: 'Empleados', description: 'Personal interno de la empresa', contactCount: 85, tags: ['Interno', 'Staff'] },
    ];
    setContactGroups(groups);
  };

  // Reemplazar variables
  const replaceVariables = (content: string, vars: Variables): string => {
    let result = content;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, vars[key]);
    });
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, vars[key]);
    });
    return result;
  };

  // Extraer variables
  const extractVariables = (content: string): string[] => {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = content.match(variablePattern) || [];
    const uniqueVariables = [...new Set(matches.map(match => match.replace(/[{}]/g, '')))];
    return uniqueVariables;
  };

  // Función para convertir fecha local a UTC string
  const localToUTCString = (dateStr: string, timeStr: string): string => {
    const localDate = new Date(`${dateStr}T${timeStr}`);
    return localDate.toISOString(); // Esto convierte a UTC
  };

  // Enviar notificaciones
  const sendNotifications = async () => {
    if (!selectedTemplate) {
      showMessage('Por favor selecciona un template', 'error');
      return;
    }

    if (selectedRecipientType === 'individual' && selectedContacts.length === 0) {
      showMessage('Por favor selecciona al menos un destinatario', 'error');
      return;
    }

    if (selectedRecipientType === 'group' && selectedGroups.length === 0) {
      showMessage('Por favor selecciona al menos un grupo', 'error');
      return;
    }

    if (selectedRecipientType === 'manual' && selectedContacts.length === 0) {
      showMessage('Por favor agrega al menos un destinatario manual', 'error');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      // Reemplazar variables
      const finalContent = replaceVariables(selectedTemplate.content, variables);
      const subject = `${selectedTemplate.name}`;

      // Preparar HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${subject}</h1>
            </div>
            <div class="content">
              ${finalContent.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} OmniNotify. Email enviado automáticamente.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Obtener todos los destinatarios según el tipo seleccionado
      let recipients: string[] = [];
      if (selectedRecipientType === 'individual' || selectedRecipientType === 'manual') {
        recipients = selectedContacts;
      } else if (selectedRecipientType === 'group') {
        recipients = getContactsFromSelectedGroups();
      }

      // Si es programado, crear fecha de programación en UTC
      let scheduleDateTime: string | undefined;
      if (scheduleType === 'later') {
        // Convertir fecha/hora local a UTC
        scheduleDateTime = localToUTCString(scheduleDate, scheduleTime);
        const scheduledTime = new Date(scheduleDateTime);
        const now = new Date();
        
        if (scheduledTime <= now) {
          showMessage('La fecha programada debe ser futura', 'error');
          setSending(false);
          return;
        }
      }

      // Para cada destinatario, enviar email con programación si corresponde
      const promises = recipients.map(async (recipient) => {
        try {
          const payload = {
            to: recipient,
            subject: subject,
            html: htmlContent,
            text: finalContent,
            templateId: selectedTemplate.id,
            companyId: selectedTemplate.company_id,
            companyName: variables.empresa,
            variables: variables,
            ...(scheduleDateTime && { schedule: scheduleDateTime })
          };

          // Usar el endpoint que maneja tanto inmediatos como programados
          const response = await axios.post(`${API_BASE_URL}/email/send-notification`, payload);
          
          return {
            recipient,
            success: response.data.success,
            data: response.data.data,
            scheduled: scheduleDateTime ? true : false
          };
        } catch (error: any) {
          console.error(`Error enviando a ${recipient}:`, error);
          return {
            recipient,
            success: false,
            error: error.response?.data?.message || error.message,
            scheduled: scheduleDateTime ? true : false
          };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      setResult({
        success: successCount > 0,
        message: scheduleType === 'now' 
          ? `Enviados ${successCount} de ${totalCount} notificaciones`
          : `Programadas ${totalCount} notificaciones para el ${formatLocalDate(scheduleDate, scheduleTime)}`,
        results: results,
        total: totalCount,
        successful: successCount,
        scheduled: scheduleType === 'later'
      });

      if (scheduleType === 'now') {
        if (successCount > 0) {
          showMessage(`${successCount} notificación(es) enviada(s) exitosamente`, 'success');
        } else {
          showMessage('No se pudo enviar ninguna notificación', 'error');
        }
      } else {
        showMessage(`${totalCount} notificaciones programadas exitosamente`, 'success');
      }

    } catch (error: any) {
      console.error('Error enviando notificaciones:', error);
      setResult({
        success: false,
        message: 'Error enviando notificaciones',
        error: error.response?.data?.message || error.message
      });
      showMessage('Error enviando notificaciones', 'error');
    } finally {
      setSending(false);
    }
  };

  // Formatear fecha local (para mostrar al usuario)
  const formatLocalDate = (dateString: string, timeString?: string) => {
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

  // Formatear solo hora
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Agregar destinatario manual
  const addManualRecipient = () => {
    const email = prompt('Ingresa el email del destinatario:');
    if (email && email.includes('@')) {
      if (!selectedContacts.includes(email)) {
        setSelectedContacts([...selectedContacts, email]);
        setManualRecipients([...manualRecipients, email]);
      }
    } else if (email) {
      alert('Por favor ingresa un email válido');
    }
  };

  // Quitar destinatario
  const removeRecipient = (recipient: string) => {
    setSelectedContacts(selectedContacts.filter(r => r !== recipient));
    if (manualRecipients.includes(recipient)) {
      setManualRecipients(manualRecipients.filter(r => r !== recipient));
    }
  };

  // Seleccionar contacto individual
  const toggleIndividualContact = (contact: Contact) => {
    if (contact.email) {
      if (selectedContacts.includes(contact.email)) {
        setSelectedContacts(selectedContacts.filter(email => email !== contact.email));
      } else {
        setSelectedContacts([...selectedContacts, contact.email]);
      }
    }
  };

  // Seleccionar grupo
  const toggleGroup = (groupId: string) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
    } else {
      setSelectedGroups([...selectedGroups, groupId]);
    }
  };

  // Obtener contactos de grupos seleccionados
  const getContactsFromSelectedGroups = () => {
    const groupContacts: string[] = [];
    
    selectedGroups.forEach(groupId => {
      const group = contactGroups.find(g => g.id === groupId);
      if (group) {
        // Simular emails del grupo
        const groupEmails = Array.from({ length: Math.min(group.contactCount, 5) }, (_, i) => 
          `grupo${groupId}-contacto${i+1}@ejemplo.com`
        );
        groupContacts.push(...groupEmails);
      }
    });
    
    return groupContacts;
  };

  // Cambiar tipo de selección
  const handleRecipientTypeChange = (type: 'individual' | 'group' | 'manual') => {
    setSelectedRecipientType(type);
    
    if (type === 'manual') {
      // Mantener solo los manuales
      const manualEmails = selectedContacts.filter(email => manualRecipients.includes(email));
      setSelectedContacts(manualEmails.length > 0 ? manualEmails : ['hmauri2000@gmail.com']);
      setSelectedGroups([]);
    } else if (type === 'individual') {
      // Solo contactos individuales
      setSelectedContacts(manualRecipients.filter(r => selectedContacts.includes(r)));
      setSelectedGroups([]);
    } else if (type === 'group') {
      // Solo grupos
      setSelectedContacts([]);
    }
  };

  // Template visualizado (con variables reemplazadas)
  const getVisualTemplate = () => {
    if (!selectedTemplate) return '';
    
    const contentWithVars = replaceVariables(selectedTemplate.content, variables);
    
    // Limpiar HTML para vista previa segura
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentWithVars;
    
    // Mantener solo etiquetas básicas seguras
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    // Filtrar atributos peligrosos
    const elements = tempDiv.getElementsByTagName('*');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (!allowedTags.includes(element.tagName.toLowerCase())) {
        const parent = element.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(element.textContent || ''), element);
        }
      } else {
        // Remover atributos peligrosos
        Array.from(element.attributes).forEach(attr => {
          if (!['class', 'style'].includes(attr.name)) {
            element.removeAttribute(attr.name);
          }
        });
      }
    }
    
    return tempDiv.innerHTML;
  };

  // Manejar cambio de variable
  const handleVariableChange = (variable: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  // Filtrar templates
  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchTemplateTerm.toLowerCase()) ||
    template.channel.toLowerCase().includes(searchTemplateTerm.toLowerCase())
  );

  // Filtrar contactos
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchContactTerm.toLowerCase()) ||
    contact.tags?.some(tag => tag.toLowerCase().includes(searchContactTerm.toLowerCase()))
  );

  // Filtrar grupos
  const filteredGroups = contactGroups.filter(group =>
    group.name.toLowerCase().includes(searchGroupTerm.toLowerCase()) ||
    group.description.toLowerCase().includes(searchGroupTerm.toLowerCase()) ||
    group.tags.some(tag => tag.toLowerCase().includes(searchGroupTerm.toLowerCase()))
  );

  // Total destinatarios
  const totalRecipients = selectedRecipientType === 'group' 
    ? getContactsFromSelectedGroups().length 
    : selectedContacts.length;

  // Variables del template
  const templateVariables = selectedTemplate ? extractVariables(selectedTemplate.content) : [];

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadTemplates(),
        loadContacts(),
        loadGroups()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  // VERIFICAR SI EL BOTÓN DEBE ESTAR DESHABILITADO
  const isSendButtonDisabled = () => {
    if (!selectedTemplate) return true;
    
    switch (selectedRecipientType) {
      case 'individual':
        return selectedContacts.length === 0;
      case 'group':
        return selectedGroups.length === 0;
      case 'manual':
        return selectedContacts.length === 0;
      default:
        return true;
    }
  };

  // Obtener fecha/hora local formateada para mostrar
  const getFormattedSchedule = () => {
    if (!scheduleDate || !scheduleTime) return '';
    return formatLocalDate(scheduleDate, scheduleTime);
  };

  // Verificar si la fecha programada es pasada (en hora local)
  const isSchedulePast = () => {
    if (!scheduleDate || !scheduleTime) return false;
    const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
    const now = new Date();
    return scheduleDateTime <= now;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enviar Notificación</h1>
                <p className="text-gray-600">Selecciona template y destinatarios</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {message && (
        <div className={`m-6 p-4 rounded-lg flex justify-between items-center ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="hover:bg-white/50 rounded-full w-6 h-6 flex items-center justify-center">
            ×
          </button>
        </div>
      )}

      {/* Contenido principal */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel izquierdo: Configuración */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selección de Template */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Template</h2>
                    <p className="text-gray-600 text-sm">Selecciona el template para enviar</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2"
                >
                  <EyeIcon className="w-4 h-4" />
                  Ver todos los templates
                </button>
              </div>

              {selectedTemplate ? (
                <div className="border border-gray-300 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100' :
                        selectedTemplate.channel === 'SMS' ? 'bg-green-100' :
                        'bg-emerald-100'
                      }`}>
                        {selectedTemplate.channel === 'EMAIL' && <Mail className="w-5 h-5 text-blue-600" />}
                        {selectedTemplate.channel === 'SMS' && <MessageSquare className="w-5 h-5 text-green-600" />}
                        {selectedTemplate.channel === 'WHATSAPP' && <MessageCircle className="w-5 h-5 text-green-500" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedTemplate.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100 text-blue-800' :
                            selectedTemplate.channel === 'SMS' ? 'bg-green-100 text-green-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {selectedTemplate.channel}
                          </span>
                          <span className="text-xs text-gray-500">
                            {selectedTemplate.content.length} caracteres
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                    <div className="text-sm text-gray-700 line-clamp-2">
                      {selectedTemplate.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-2"
                >
                  <FileText className="w-8 h-8 text-gray-400" />
                  <span className="text-gray-700 font-medium">Seleccionar Template</span>
                  <span className="text-sm text-gray-500">Click para ver todos los templates disponibles</span>
                </button>
              )}
            </div>

            {/* Selección de Destinatarios */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-green-100 rounded-lg">
                    <UsersIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Destinatarios</h2>
                    <p className="text-gray-600 text-sm">Selecciona quienes recibirán la notificación</p>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-bold text-blue-600">{totalRecipients}</span> destinatarios
                </div>
              </div>

              {/* Tipo de selección */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  onClick={() => handleRecipientTypeChange('individual')}
                  className={`px-4 py-3 rounded-lg border transition flex flex-col items-center gap-2 ${
                    selectedRecipientType === 'individual'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm font-medium">Individual</span>
                </button>
                
                <button
                  onClick={() => handleRecipientTypeChange('group')}
                  className={`px-4 py-3 rounded-lg border transition flex flex-col items-center gap-2 ${
                    selectedRecipientType === 'group'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">Grupo</span>
                </button>
                
                <button
                  onClick={() => handleRecipientTypeChange('manual')}
                  className={`px-4 py-3 rounded-lg border transition flex flex-col items-center gap-2 ${
                    selectedRecipientType === 'manual'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <MailIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">Manual</span>
                </button>
              </div>

              {/* Contenido según tipo */}
              {selectedRecipientType === 'individual' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Contactos individuales</span>
                    <button
                      onClick={() => setShowContactsModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Ver todos los contactos
                    </button>
                  </div>
                  
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.slice(0, 5).map((email, index) => {
                        const contact = contacts.find(c => c.email === email);
                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium">
                                  {contact ? contact.name : email}
                                </div>
                                <div className="text-sm text-gray-500">{email}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeRecipient(email)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      
                      {selectedContacts.length > 5 && (
                        <div className="text-center text-sm text-gray-500">
                          +{selectedContacts.length - 5} contactos más
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowContactsModal(true)}
                      className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700 font-medium">Seleccionar contactos</span>
                    </button>
                  )}
                </div>
              )}

              {selectedRecipientType === 'group' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Grupos de contactos</span>
                    <button
                      onClick={() => setShowGroupsModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Ver todos los grupos
                    </button>
                  </div>
                  
                  {selectedGroups.length > 0 ? (
                    <div className="space-y-2">
                      {selectedGroups.map((groupId) => {
                        const group = contactGroups.find(g => g.id === groupId);
                        if (!group) return null;
                        
                        return (
                          <div key={groupId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <Users className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <div className="font-medium">{group.name}</div>
                                <div className="text-sm text-gray-500">
                                  {group.contactCount} contactos • {group.description}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleGroup(groupId)}
                              className="text-red-600 hover:text-red-800 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowGroupsModal(true)}
                      className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700 font-medium">Seleccionar grupos</span>
                    </button>
                  )}
                  
                  {selectedGroups.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 text-blue-700">
                        <Users className="w-4 h-4" />
                        <span className="font-medium">Total estimado:</span>
                        <span>{getContactsFromSelectedGroups().length} destinatarios</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedRecipientType === 'manual' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Destinatarios manuales</span>
                    <button
                      onClick={addManualRecipient}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar email
                    </button>
                  </div>
                  
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.map((email, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <MailIcon className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">{email}</span>
                          </div>
                          <button
                            onClick={() => removeRecipient(email)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No hay destinatarios agregados manualmente
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Programación */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-purple-100 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Programación (Opcional)</h2>
                  <p className="text-gray-600 text-sm">Programa el envío para más tarde</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setScheduleType('now')}
                    className={`px-4 py-3 rounded-lg border transition flex items-center justify-center gap-2 ${
                      scheduleType === 'now'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    
                    {/* Indicador visual de fecha válida - CORREGIDO */}
                    <div className={`p-3 rounded-lg border ${
                      isSchedulePast() 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isSchedulePast() ? (
                          <>
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="font-medium text-yellow-700">Advertencia:</span>
                            <span className="text-yellow-600">
                              {getFormattedSchedule()}
                            </span>
                            <span className="text-yellow-500 text-sm ml-auto">
                              (Fecha pasada)
                            </span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-blue-700">Programado para:</span>
                            <span className="text-blue-600">
                              {getFormattedSchedule()}
                            </span>
                          </>
                        )}
                      </div>
                      {isSchedulePast() && (
                        <p className="text-yellow-600 text-sm mt-2">
                          Esta fecha/hora ya pasó. Si programas para una fecha pasada, el sistema intentará enviar inmediatamente.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Variables del Template */}
            {templateVariables.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-yellow-100 rounded-lg">
                    <Filter className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Variables del Template</h2>
                    <p className="text-gray-600 text-sm">Personaliza las variables del template</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={`Ingresa ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón de envío */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <button
                onClick={sendNotifications}
                disabled={sending || isSendButtonDisabled()}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {scheduleType === 'now' ? 'Enviando...' : 'Programando...'}
                  </>
                ) : (
                  <>
                    {scheduleType === 'now' ? <Send className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                    {scheduleType === 'now' 
                      ? `Enviar a ${totalRecipients} destinatario(s)`
                      : `Programar ${totalRecipients} notificaciones`
                    }
                  </>
                )}
              </button>
              <p className="text-center text-sm text-gray-500 mt-3">
                {scheduleType === 'now' 
                  ? 'Los emails se enviarán inmediatamente'
                  : `Programado para el ${getFormattedSchedule()}`
                }
              </p>
            </div>
          </div>

          {/* Panel derecho: Vista previa */}
          <div className="lg:col-span-1 space-y-6">
            {/* Vista previa del Template */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Vista Previa</h2>
                {selectedTemplate && (
                  <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
                    selectedTemplate.channel === 'EMAIL' ? 'bg-blue-100 text-blue-800' :
                    selectedTemplate.channel === 'SMS' ? 'bg-green-100 text-green-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedTemplate.channel === 'EMAIL' && <Mail className="w-4 h-4" />}
                    {selectedTemplate.channel === 'SMS' && <MessageSquare className="w-4 h-4" />}
                    {selectedTemplate.channel === 'WHATSAPP' && <MessageCircle className="w-4 h-4" />}
                    {selectedTemplate.channel}
                  </div>
                )}
              </div>

              {selectedTemplate ? (
                <div className="space-y-6">
                  {/* Cabecera */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm text-gray-600">Template seleccionado:</div>
                      <div className="font-bold text-gray-900">{selectedTemplate.name}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedTemplate.content.length} caracteres
                    </div>
                  </div>

                  {/* Contenido visual */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Contenido:</div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-300 min-h-[400px] overflow-y-auto">
                      {selectedTemplate.content ? (
                        <div 
                          className="text-gray-800 text-sm leading-relaxed"
                          style={{ 
                            fontFamily: selectedTemplate.channel === 'EMAIL' ? 'Arial, sans-serif' : 
                                       selectedTemplate.channel === 'SMS' ? "'Segoe UI', sans-serif" : 
                                       "'Helvetica Neue', sans-serif"
                          }}
                          dangerouslySetInnerHTML={{ 
                            __html: getVisualTemplate()
                          }}
                        />
                      ) : (
                        <div className="text-center py-20 text-gray-500">
                          No hay contenido disponible
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumen */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-3">📋 Resumen del envío</h4>
                    <div className="space-y-2 text-sm text-blue-800">
                      <div className="flex justify-between">
                        <span>Template:</span>
                        <span className="font-medium">{selectedTemplate.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Destinatarios:</span>
                        <span className="font-medium">{totalRecipients}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Canal:</span>
                        <span className="font-medium">{selectedTemplate.channel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span className="font-medium">
                          {selectedRecipientType === 'individual' ? 'Individual' :
                           selectedRecipientType === 'group' ? 'Grupos' : 'Manual'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Programación:</span>
                        <span className="font-medium">
                          {scheduleType === 'now' ? 'Inmediato' : 
                           getFormattedSchedule()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Selecciona un Template</h3>
                  <p className="text-gray-600">
                    Elige un template de la lista para ver su vista previa
                  </p>
                </div>
              )}
            </div>

            {/* Resultado del envío */}
            {result && (
              <div className={`rounded-xl border p-6 ${
                result.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    result.success ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {result.success ? (
                      result.scheduled ? <Calendar className="w-6 h-6 text-green-600" /> : <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">
                      {result.success 
                        ? (result.scheduled ? '✅ Notificaciones Programadas' : '✅ Notificaciones Enviadas')
                        : '❌ Error al Enviar'
                      }
                    </h3>
                    <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                      {result.message}
                    </p>
                    
                    {result.success && !result.scheduled && (
                      <div className="mt-3 text-sm">
                        <div className="font-medium text-gray-700 mb-1">Destinatarios exitosos:</div>
                        <div className="space-y-1">
                          {result.results
                            .filter((r: any) => r.success)
                            .slice(0, 3)
                            .map((r: any, i: number) => (
                              <div key={i} className="flex items-center">
                                <span className="text-green-600 mr-2">✓</span>
                                <span className="truncate">{r.recipient}</span>
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
                    
                    {result.error && (
                      <div className="mt-3 p-2 bg-white/50 rounded">
                        <div className="font-medium text-red-800">Error:</div>
                        <p className="text-sm text-red-600">{result.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Templates */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Seleccionar Template</h2>
                  <p className="text-gray-600 mt-1">
                    {templates.length} templates disponibles • Haz click para seleccionar
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="p-2 hover:bg-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar templates por nombre, canal o contenido..."
                    value={searchTemplateTerm}
                    onChange={(e) => setSearchTemplateTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingTemplates ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">Cargando templates...</span>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No se encontraron templates</h3>
                  <p className="text-gray-600">
                    {searchTemplateTerm 
                      ? 'Intenta con otros términos de búsqueda'
                      : 'No hay templates disponibles'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplateModal(false);
                      }}
                      className={`bg-white rounded-xl border p-5 hover:shadow-lg transition-all text-left group ${
                        selectedTemplate?.id === template.id 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-2.5 rounded-lg ${
                          template.channel === 'EMAIL' ? 'bg-blue-100' :
                          template.channel === 'SMS' ? 'bg-green-100' :
                          'bg-emerald-100'
                        }`}>
                          {template.channel === 'EMAIL' && <Mail className="w-6 h-6 text-blue-600" />}
                          {template.channel === 'SMS' && <MessageSquare className="w-6 h-6 text-green-600" />}
                          {template.channel === 'WHATSAPP' && <MessageCircle className="w-6 h-6 text-green-500" />}
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <div className="p-1 bg-blue-100 rounded-full">
                            <Check className="w-4 h-4 text-blue-600" />
                          </div>
                        )}
                      </div>
                      
                      <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-700 transition">
                        {template.name}
                      </h3>
                      
                      <div className="mb-4">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          template.channel === 'EMAIL' ? 'bg-blue-100 text-blue-800' :
                          template.channel === 'SMS' ? 'bg-green-100 text-green-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {template.channel}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-100 line-clamp-3">
                        {template.content.replace(/<[^>]*>/g, ' ').substring(0, 120)}...
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {template.content.length} caracteres
                        </span>
                        <span className="text-blue-600 text-sm font-medium group-hover:text-blue-800 transition flex items-center gap-1">
                          Seleccionar
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Contactos */}
      {showContactsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Seleccionar Contactos</h2>
                  <p className="text-gray-600 mt-1">
                    {contacts.length} contactos disponibles • Selecciona múltiples
                  </p>
                </div>
                <button
                  onClick={() => setShowContactsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar contactos por nombre, email o etiqueta..."
                    value={searchContactTerm}
                    onChange={(e) => setSearchContactTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-4">👤</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No se encontraron contactos</h3>
                  <p className="text-gray-600">
                    {searchContactTerm 
                      ? 'Intenta con otros términos de búsqueda'
                      : 'No hay contactos disponibles'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredContacts.map(contact => (
                    <div
                      key={contact.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition cursor-pointer ${
                        selectedContacts.includes(contact.email)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleIndividualContact(contact)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{contact.name}</div>
                          <div className="text-sm text-gray-600">{contact.email}</div>
                          <div className="flex gap-2 mt-2">
                            {contact.tags?.map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.email)}
                        onChange={() => toggleIndividualContact(contact)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-between items-center">
              <div>
                <span className="font-medium text-gray-900">
                  {selectedContacts.length} contactos seleccionados
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedContacts([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => setShowContactsModal(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Aplicar Selección
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Grupos */}
      {showGroupsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Seleccionar Grupos</h2>
                  <p className="text-gray-600 mt-1">
                    {contactGroups.length} grupos disponibles • Selecciona múltiples grupos
                  </p>
                </div>
                <button
                  onClick={() => setShowGroupsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar grupos por nombre, descripción o etiqueta..."
                    value={searchGroupTerm}
                    onChange={(e) => setSearchGroupTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-4">👥</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No se encontraron grupos</h3>
                  <p className="text-gray-600">
                    {searchGroupTerm 
                      ? 'Intenta con otros términos de búsqueda'
                      : 'No hay grupos disponibles'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredGroups.map(group => (
                    <div
                      key={group.id}
                      className={`border rounded-xl p-5 transition cursor-pointer ${
                        selectedGroups.includes(group.id)
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(group.id)}
                          onChange={() => toggleGroup(group.id)}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </div>
                      
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{group.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{group.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {group.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="text-sm text-gray-500">
                          {group.contactCount} contactos
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-between items-center">
              <div>
                <span className="font-medium text-gray-900">
                  {selectedGroups.length} grupos seleccionados
                </span>
                {selectedGroups.length > 0 && (
                  <div className="text-sm text-gray-600">
                    Total estimado: {getContactsFromSelectedGroups().length} destinatarios
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedGroups([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => setShowGroupsModal(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  Aplicar Selección
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsSend;