import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Edit, Eye, Search, RefreshCw,
  Mail, MessageSquare, MessageCircle, CheckCircle, AlertCircle,
  Loader2, Save, X, Copy, Download, Upload,
  Bold, Italic, AlignLeft, AlignCenter, List,
  Palette, Layout, Eye as EyeIcon, Globe,
  ChevronDown, ChevronUp, Hash, Calendar,
  Building, User, CreditCard, AlertTriangle, ArrowLeft, ArrowRight
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  company_id: string;
}

const TemplatesPage: React.FC = () => {
  // Estados básicos
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [message, setMessage] = useState<{text: string; type: 'success' | 'error' | 'info'} | null>(null);
  
  // Estados modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Estados de template actual
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  
  // Estados del editor
  const [editorMode, setEditorMode] = useState<'visual' | 'preview'>('visual');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [currentName, setCurrentName] = useState<string>('');
  const [currentChannel, setCurrentChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  
  // UI estados
  const [showVariablesPanel, setShowVariablesPanel] = useState(true);
  const [showFormatPanel, setShowFormatPanel] = useState(true);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const lastCursorPos = useRef<number>(0);
  const [importContent, setImportContent] = useState('');

  // Variables simplificadas
  const variableCategories = [
    {
      name: 'Cliente',
      icon: <User className="w-4 h-4" />,
      variables: [
        { id: 'nombre', name: 'Nombre', icon: '👤' },
        { id: 'email', name: 'Email', icon: '📧' },
        { id: 'telefono', name: 'Teléfono', icon: '📱' },
      ]
    },
    {
      name: 'Empresa',
      icon: <Building className="w-4 h-4" />,
      variables: [
        { id: 'empresa', name: 'Empresa', icon: '🏢' },
        { id: 'sitioWeb', name: 'Sitio Web', icon: '🌐' },
      ]
    },
    {
      name: 'Fechas',
      icon: <Calendar className="w-4 h-4" />,
      variables: [
        { id: 'fecha', name: 'Fecha', icon: '📅' },
        { id: 'hora', name: 'Hora', icon: '⏰' },
        { id: 'fechaLimite', name: 'Vencimiento', icon: '⏳' },
      ]
    },
    {
      name: 'Pagos',
      icon: <CreditCard className="w-4 h-4" />,
      variables: [
        { id: 'monto', name: 'Monto', icon: '💰' },
        { id: 'numeroFactura', name: 'Factura', icon: '🧾' },
      ]
    }
  ];

  // Plantillas precargadas simplificadas
  const getTemplatesByChannel = (channel: 'EMAIL' | 'SMS' | 'WHATSAPP') => {
    const templates = {
      EMAIL: [
        {
          id: 'welcome-email',
          name: 'Email de Bienvenida',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">🎉 ¡Bienvenido {{nombre}}!</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Te damos la bienvenida a {{empresa}}</p>
  </div>
  <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; line-height: 1.6; color: #333;">
      Estamos muy contentos de que te hayas unido. Tu cuenta ha sido creada exitosamente.
    </p>
    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px;">
      <p style="margin: 0; color: #666;">
        📧 <strong>Email:</strong> {{email}}<br>
        📅 <strong>Fecha:</strong> {{fecha}}
      </p>
    </div>
    <div style="text-align: center; margin-top: 25px;">
      <a href="#" style="display: inline-block; padding: 10px 25px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Comenzar Ahora
      </a>
    </div>
  </div>
</div>`
        },
        {
          id: 'payment-reminder',
          name: 'Recordatorio de Pago',
          content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">💰 Recordatorio de Pago</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">{{empresa}} - Estado de cuenta</p>
  </div>
  <div style="padding: 30px; background: white; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; line-height: 1.6; color: #333;">
      Hola {{nombre}},<br><br>
      Te recordamos que tienes un pago pendiente con {{empresa}}.
    </p>
    <div style="margin: 20px 0; padding: 20px; background: #fee2e2; border-radius: 8px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: #991b1b; font-size: 14px;">MONTO A PAGAR</p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #dc2626;">{{monto}}</p>
      <p style="margin: 10px 0 0 0; color: #991b1b;">Vence: {{fechaLimite}}</p>
    </div>
    <div style="text-align: center;">
      <a href="#" style="display: inline-block; padding: 10px 25px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Pagar Ahora
      </a>
    </div>
  </div>
</div>`
        }
      ],
      SMS: [
        {
          id: 'welcome-sms',
          name: 'SMS de Bienvenida',
          content: `¡Bienvenido {{nombre}} a {{empresa}}!

Tu registro fue exitoso.
Email: {{email}}
Fecha: {{fecha}}

Para activar tu cuenta visita:
{{sitioWeb}}

Gracias por unirte.`
        },
        {
          id: 'payment-sms',
          name: 'SMS de Pago',
          content: `{{empresa}} - Recordatorio

Hola {{nombre}},

Tienes un pago pendiente de {{monto}}.
Vence: {{fechaLimite}}

Para pagar visita:
{{sitioWeb}}

Factura: {{numeroFactura}}`
        }
      ],
      WHATSAPP: [
        {
          id: 'welcome-whatsapp',
          name: 'WhatsApp de Bienvenida',
          content: `¡Hola {{nombre}}! 🎉

*Bienvenido a {{empresa}}*

✅ Tu registro fue exitoso
📧 Email: {{email}}
📅 Fecha: {{fecha}}

Visítanos: {{sitioWeb}}

¡Estamos aquí para ayudarte! 😊`
        },
        {
          id: 'notification-whatsapp',
          name: 'WhatsApp de Notificación',
          content: `🔔 *Notificación importante*
De: {{empresa}}

{{mensajeNotificacion}}

📅 Fecha: {{fecha}}
⏰ Hora: {{hora}}

Para más información:
{{sitioWeb}}`
        }
      ]
    };
    
    return templates[channel];
  };

  // Cargar templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const companyId = '25a63d10-eff4-11f0-86e6-a2aaf909b30d';
      const response = await axios.get(`${API_BASE_URL}/templates/company/${companyId}`);
      
      if (response.data && Array.isArray(response.data)) {
        setTemplates(response.data);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        setTemplates(response.data.data);
      } else {
        setTemplates([]);
      }
    } catch (error: any) {
      console.error('Error cargando templates:', error);
      showMessage('Error cargando templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Guardar posición del cursor
  const saveCursorPosition = () => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(editorRef.current);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    lastCursorPos.current = preSelectionRange.toString().length;
  };

  // Insertar variable
  const insertVariable = (variableId: string) => {
    if (!editorRef.current) return;
    
    saveCursorPosition();
    
    const variableElement = document.createElement('span');
    variableElement.className = 'template-variable';
    variableElement.contentEditable = 'false';
    variableElement.dataset.variable = variableId;
    variableElement.style.cssText = `
      display: inline-block;
      padding: 2px 8px;
      margin: 0 2px;
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #93c5fd;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: default;
      user-select: none;
    `;
    
    const variable = variableCategories
      .flatMap(cat => cat.variables)
      .find(v => v.id === variableId);
    
    variableElement.textContent = variable 
      ? `${variable.icon} ${variable.name}` 
      : `{{${variableId}}}`;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(variableElement);
      
      const space = document.createTextNode(' ');
      range.insertNode(space);
      range.setStartAfter(space);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    
    setTimeout(() => {
      updateEditorContent();
      editorRef.current?.focus();
    }, 10);
  };

  // Aplicar formato
  const applyFormat = (format: string, value: string = '') => {
    if (!editorRef.current) return;
    
    saveCursorPosition();
    document.execCommand(format, false, value);
    
    setTimeout(() => {
      updateEditorContent();
      editorRef.current?.focus();
    }, 10);
  };

  // Actualizar contenido
  const updateEditorContent = () => {
    if (!editorRef.current) return;
    setCurrentContent(editorRef.current.innerHTML);
  };

  // Cargar plantilla precargada
  const loadPrebuiltTemplate = (templateId: string) => {
    const channelTemplates = getTemplatesByChannel(currentChannel);
    const template = channelTemplates.find(t => t.id === templateId);
    
    if (template) {
      setCurrentName(template.name);
      setCurrentContent(template.content);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = template.content;
          updateEditorContent();
          showMessage(`Plantilla "${template.name}" cargada`, 'info');
        }
      }, 100);
    }
  };

  // Cambiar canal
  const handleChannelChange = (channel: 'EMAIL' | 'SMS' | 'WHATSAPP') => {
    setCurrentChannel(channel);
    setCurrentContent('');
    setCurrentName('');
    
    if (editorRef.current) {
      editorRef.current.innerHTML = '<p>Empieza a escribir o elige una plantilla...</p>';
      updateEditorContent();
    }
  };

  // Crear template
  const handleCreateTemplate = async () => {
    if (!currentName.trim() || !currentContent.trim()) {
      showMessage('Nombre y contenido son requeridos', 'error');
      return;
    }

    try {
      const templateData = {
        name: currentName,
        channel: currentChannel,
        content: currentContent,
        companyId: '25a63d10-eff4-11f0-86e6-a2aaf909b30d'
      };

      await axios.post(`${API_BASE_URL}/templates`, templateData);
      
      showMessage('Template creado exitosamente', 'success');
      setShowCreateModal(false);
      resetEditor();
      loadTemplates();
    } catch (error: any) {
      console.error('Error creando template:', error);
      showMessage(error.response?.data?.message || 'Error creando template', 'error');
    }
  };

  // Actualizar template
  const handleUpdateTemplate = async () => {
    if (!selectedTemplate || !currentName.trim() || !currentContent.trim()) {
      showMessage('Nombre y contenido son requeridos', 'error');
      return;
    }

    try {
      const updateData = {
        name: currentName,
        channel: currentChannel,
        content: currentContent,
        companyId: selectedTemplate.company_id
      };

      await axios.put(`${API_BASE_URL}/templates/${selectedTemplate.id}`, updateData);
      
      showMessage('Template actualizado exitosamente', 'success');
      setShowEditModal(false);
      setSelectedTemplate(null);
      resetEditor();
      loadTemplates();
    } catch (error: any) {
      console.error('Error actualizando template:', error);
      showMessage(error.response?.data?.message || 'Error actualizando template', 'error');
    }
  };

  // Eliminar template
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      await axios.delete(`${API_BASE_URL}/templates/${templateToDelete.id}`);
      
      showMessage('Template eliminado exitosamente', 'success');
      setShowDeleteModal(false);
      setTemplateToDelete(null);
      loadTemplates();
    } catch (error: any) {
      console.error('Error eliminando template:', error);
      showMessage(error.response?.data?.message || 'Error eliminando template', 'error');
    }
  };

  // Resetear editor
  const resetEditor = () => {
    setCurrentName('');
    setCurrentContent('');
    setCurrentChannel('EMAIL');
    
    if (editorRef.current) {
      editorRef.current.innerHTML = '<p>Empieza a escribir o elige una plantilla...</p>';
    }
  };

  // Iniciar edición
  const startEdit = (template: Template) => {
    setSelectedTemplate(template);
    setCurrentName(template.name);
    setCurrentChannel(template.channel);
    setCurrentContent(template.content);
    
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = template.content;
        updateEditorContent();
      }
    }, 100);
    
    setShowEditModal(true);
  };

  // Vista previa
  const showPreview = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  // Confirmar eliminación
  const confirmDelete = (template: Template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  // Exportar templates
  const exportTemplates = () => {
    const exportData = {
      templates: templates.map(t => ({
        name: t.name,
        channel: t.channel,
        content: t.content,
        company_id: t.company_id
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates-export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Templates exportados', 'success');
  };

  // Importar templates
  const handleImport = async () => {
    if (!importContent.trim()) {
      showMessage('Por favor ingresa el contenido JSON', 'error');
      return;
    }

    try {
      const data = JSON.parse(importContent);
      
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Formato JSON inválido');
      }

      showMessage(`Importando ${data.templates.length} templates...`, 'info');
      
      setTimeout(() => {
        setShowImportModal(false);
        setImportContent('');
        loadTemplates();
        showMessage(`${data.templates.length} templates procesados`, 'success');
      }, 1500);

    } catch (err: any) {
      showMessage('Error de importación', 'error');
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const getChannelIcon = (channel: string) => {
    switch(channel) {
      case 'EMAIL': return <Mail className="w-5 h-5" />;
      case 'SMS': return <MessageSquare className="w-5 h-5" />;
      case 'WHATSAPP': return <MessageCircle className="w-5 h-5" />;
      default: return null;
    }
  };

  const getChannelColor = (channel: string) => {
    switch(channel) {
      case 'EMAIL': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'SMS': return 'bg-green-100 text-green-800 border border-green-200';
      case 'WHATSAPP': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = filterChannel === '' || template.channel === filterChannel;
    
    return matchesSearch && matchesChannel;
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
                <p className="text-gray-600">Editor visual de plantillas ({templates.length} templates)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadTemplates}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                title="Recargar"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={exportTemplates}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                title="Exportar"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                title="Importar"
              >
                <Upload className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  resetEditor();
                  setShowCreateModal(true);
                }}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nuevo Template
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="mt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos los canales</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg flex justify-between items-center ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-lg hover:opacity-70">
            ×
          </button>
        </div>
      )}

      {/* Contenido principal */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Cargando templates...</span>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-6">📝</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {searchTerm || filterChannel ? 'No se encontraron templates' : 'No hay templates'}
            </h3>
            <p className="text-gray-600 mb-8">
              {searchTerm || filterChannel 
                ? 'Intenta con otros términos de búsqueda'
                : 'Crea tu primer template de comunicación'}
            </p>
            <button
              onClick={() => {
                resetEditor();
                setShowCreateModal(true);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
            >
              <Plus className="w-5 h-5" />
              Crear Primer Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map(template => (
              <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${getChannelColor(template.channel)}`}>
                        {getChannelIcon(template.channel)}
                        {template.channel}
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg truncate">{template.name}</h3>
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => showPreview(template)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                      title="Ver"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(template)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => confirmDelete(template)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Vista previa:</div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-48 overflow-y-auto">
                    <div 
                      className="preview-html"
                      dangerouslySetInnerHTML={{ __html: template.content }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(template.content);
                      showMessage('Template copiado', 'success');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de creación/edición */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {showCreateModal ? 'Crear Nuevo Template' : 'Editar Template'}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {showCreateModal 
                      ? 'Usa el editor visual para crear tu template'
                      : `Editando: ${selectedTemplate?.name}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (showCreateModal) setShowCreateModal(false);
                    if (showEditModal) setShowEditModal(false);
                    resetEditor();
                  }}
                  className="p-2 hover:bg-white/50 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Contenido principal */}
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
                {/* Panel izquierdo */}
                <div className="lg:col-span-1 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {/* Nombre */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre del Template *
                      </label>
                      <input
                        type="text"
                        value={currentName}
                        onChange={(e) => setCurrentName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        placeholder="Ej: Email de bienvenida"
                      />
                    </div>

                    {/* Canal */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Canal *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['EMAIL', 'SMS', 'WHATSAPP'] as const).map((channel) => (
                          <button
                            key={channel}
                            onClick={() => handleChannelChange(channel)}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                              currentChannel === channel
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700'
                            }`}
                          >
                            {getChannelIcon(channel)}
                            <span className="text-xs mt-2 font-medium">{channel}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Plantillas precargadas */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">
                          Plantillas para {currentChannel}
                        </label>
                      </div>
                      <div className="space-y-2">
                        {getTemplatesByChannel(currentChannel).map((template) => (
                          <button
                            key={template.id}
                            onClick={() => loadPrebuiltTemplate(template.id)}
                            className="w-full p-3 text-left bg-white border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                          >
                            <div className="font-medium text-gray-900">
                              {template.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Variables */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">
                          Variables
                        </label>
                        <button
                          onClick={() => setShowVariablesPanel(!showVariablesPanel)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {showVariablesPanel ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      {showVariablesPanel && (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                          {variableCategories.map((category) => (
                            <div key={category.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                                {category.icon}
                                <span className="text-sm font-medium text-gray-700">{category.name}</span>
                              </div>
                              <div className="p-2">
                                {category.variables.map((variable) => (
                                  <button
                                    key={variable.id}
                                    onClick={() => insertVariable(variable.id)}
                                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-blue-50 transition text-left"
                                  >
                                    <span className="text-xl">{variable.icon}</span>
                                    <div className="font-medium text-gray-900">
                                      {variable.name}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formato */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700">
                          Formato
                        </label>
                        <button
                          onClick={() => setShowFormatPanel(!showFormatPanel)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {showFormatPanel ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      
                      {showFormatPanel && (
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            <button
                              onClick={() => applyFormat('bold')}
                              className="p-2 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                              title="Negrita"
                            >
                              <Bold className="w-4 h-4 mx-auto" />
                            </button>
                            <button
                              onClick={() => applyFormat('italic')}
                              className="p-2 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                              title="Cursiva"
                            >
                              <Italic className="w-4 h-4 mx-auto" />
                            </button>
                            <button
                              onClick={() => applyFormat('justifyLeft')}
                              className="p-2 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                              title="Alinear izquierda"
                            >
                              <AlignLeft className="w-4 h-4 mx-auto" />
                            </button>
                            <button
                              onClick={() => applyFormat('justifyCenter')}
                              className="p-2 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                              title="Centrar"
                            >
                              <AlignCenter className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                          
                          {currentChannel === 'EMAIL' && (
                            <button
                              onClick={() => applyFormat('insertUnorderedList')}
                              className="w-full p-2 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm"
                            >
                              <List className="w-4 h-4 inline mr-1" />
                              Lista
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editor principal */}
                <div className="lg:col-span-3 flex flex-col">
                  {/* Barra de herramientas */}
                  <div className="border-b border-gray-200 bg-white">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${getChannelColor(currentChannel)}`}>
                            {getChannelIcon(currentChannel)}
                            {currentChannel}
                          </div>
                          <div className="text-sm text-gray-600">
                            {currentContent.length} caracteres
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditorMode('visual')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                              editorMode === 'visual' 
                                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <EyeIcon className="w-4 h-4" />
                            Visual
                          </button>
                          <button
                            onClick={() => setEditorMode('preview')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                              editorMode === 'preview' 
                                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <EyeIcon className="w-4 h-4" />
                            Vista Previa
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Área del editor */}
                  <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-50 to-gray-100">
                    {editorMode === 'visual' ? (
                      <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-300 overflow-hidden">
                          <div className="px-4 py-3 bg-gray-100 border-b border-gray-300 flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                              Editor Visual • {currentChannel}
                            </div>
                          </div>
                          
                          <div
                            ref={editorRef}
                            contentEditable
                            className="min-h-[500px] p-8 focus:outline-none"
                            onInput={updateEditorContent}
                            onBlur={updateEditorContent}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-300 overflow-hidden">
                          <div className="px-4 py-3 bg-gray-100 border-b border-gray-300">
                            <div className="text-sm text-gray-500">
                              Vista Previa • {currentChannel}
                            </div>
                          </div>
                          
                          <div 
                            className="p-8"
                            dangerouslySetInnerHTML={{ __html: currentContent }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="border-t border-gray-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>Guardado automáticamente</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            if (showCreateModal) setShowCreateModal(false);
                            if (showEditModal) setShowEditModal(false);
                            resetEditor();
                          }}
                          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={showCreateModal ? handleCreateTemplate : handleUpdateTemplate}
                          disabled={!currentName.trim() || !currentContent.trim()}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Save className="w-5 h-5" />
                          {showCreateModal ? 'Crear Template' : 'Guardar Cambios'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de vista previa */}
      {showPreviewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h2>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 mt-2 rounded-full text-sm ${getChannelColor(selectedTemplate.channel)}`}>
                    {getChannelIcon(selectedTemplate.channel)}
                    {selectedTemplate.channel}
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Vista previa:</div>
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div 
                    className="bg-white p-6 rounded border mx-auto"
                    style={{ 
                      maxWidth: selectedTemplate.channel === 'EMAIL' ? '600px' : '400px',
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: selectedTemplate.content
                    }}
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedTemplate.content);
                    showMessage('Contenido copiado', 'success');
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  <Copy className="w-5 h-5 inline mr-2" />
                  Copiar Contenido
                </button>
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    startEdit(selectedTemplate);
                  }}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
                >
                  <Edit className="w-5 h-5 inline mr-2" />
                  Editar
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && templateToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">¿Eliminar Template?</h2>
                  <p className="text-gray-600">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="font-semibold text-gray-900 mb-2">{templateToDelete.name}</div>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${getChannelColor(templateToDelete.channel)}`}>
                    {getChannelIcon(templateToDelete.channel)}
                    {templateToDelete.channel}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleDeleteTemplate}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setTemplateToDelete(null);
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de importación */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Importar Templates</h2>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Contenido JSON
                </label>
                <textarea
                  value={importContent}
                  onChange={(e) => setImportContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder={`Pega aquí el contenido JSON`}
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleImport}
                  disabled={!importContent.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
                >
                  Importar
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;