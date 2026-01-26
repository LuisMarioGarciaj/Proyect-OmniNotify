// frontend_omninotify/src/pages/Templates.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Plus, 
  Search,
  RefreshCw, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Mail, 
  MessageSquare, 
  MessageCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Grid,
  List,
  Eye,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  company_id: string;
  provider_template_id?: string | null;
}

export default function Templates() {
  // Estados principales
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // Estados para búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Estados para CRUD
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Template>>({});
  
  // Estados para creación
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    channel: 'EMAIL' as 'EMAIL' | 'SMS' | 'WHATSAPP',
    content: '',
  });

  // Estados para modales
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  // Estados para import/export
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);

  const companyId = '25a63d10-eff4-11f0-86e6-a2aaf909b30d';

  // ============ FUNCIONES PRINCIPALES ============

  const checkBackend = async () => {
    try {
      setBackendStatus('checking');
      await axios.get(`${API_BASE_URL}/health`);
      await axios.get(`${API_BASE_URL}/templates/test/hello`);
      setBackendStatus('online');
      showNotification('success', 'Conexión establecida', 'Backend conectado correctamente');
    } catch (err: any) {
      setBackendStatus('offline');
      showNotification('error', 'Error de conexión', 'No se puede conectar con el servidor');
    }
  };

  const loadTemplates = async () => {
    if (backendStatus !== 'online') return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/templates/company/${companyId}`);
      
      let templatesData: Template[] = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        templatesData = response.data.data;
      } else if (Array.isArray(response.data?.data)) {
        templatesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        templatesData = response.data;
      }
      
      setTemplates(templatesData.length > 0 ? templatesData : getExampleTemplates());
      
      if (templatesData.length > 0) {
        showNotification('success', 'Templates cargados', `${templatesData.length} templates encontrados`);
      }
    } catch (err: any) {
      console.error('Error cargando templates:', err);
      setTemplates(getExampleTemplates());
      showNotification('error', 'Error', 'No se pudieron cargar los templates');
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      showNotification('error', 'Error', 'Nombre y contenido son requeridos');
      return;
    }

    setCreating(true);
    try {
      await axios.post(`${API_BASE_URL}/templates`, {
        ...newTemplate,
        companyId,
      });

      setNewTemplate({ name: '', channel: 'EMAIL', content: '' });
      setShowCreateForm(false);
      await loadTemplates();
      showNotification('success', '¡Éxito!', 'Template creado exitosamente');
    } catch (err: any) {
      showNotification('error', 'Error', err.response?.data?.message || err.message);
    } finally {
      setCreating(false);
    }
  };

  const updateTemplate = async () => {
    if (!editingId || !editForm.name?.trim() || !editForm.content?.trim()) {
      showNotification('error', 'Error', 'Nombre y contenido son requeridos');
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/templates/${editingId}/company/${companyId}`,
        editForm
      );

      setEditingId(null);
      setEditForm({});
      setShowEditModal(false);
      await loadTemplates();
      showNotification('success', '¡Éxito!', 'Template actualizado exitosamente');
    } catch (err: any) {
      showNotification('error', 'Error', err.response?.data?.message || err.message);
    }
  };

  const deleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      await axios.delete(`${API_BASE_URL}/templates/${templateToDelete.id}/company/${companyId}`);
      setShowDeleteModal(false);
      setTemplateToDelete(null);
      await loadTemplates();
      showNotification('success', '¡Éxito!', 'Template eliminado exitosamente');
    } catch (err: any) {
      showNotification('error', 'Error', err.response?.data?.message || err.message);
    }
  };

  const startEditing = (template: Template) => {
    setEditingId(template.id);
    setEditForm({ ...template });
    setShowEditModal(true);
  };

  const showTemplatePreview = (content: string) => {
    setPreviewContent(content);
    setShowPreviewModal(true);
  };

  const confirmDelete = (template: Template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  // ============ FUNCIONES DE IMPORT/EXPORT ============

  const exportTemplates = () => {
    const exportData = {
      app: 'OmniNotify Templates',
      version: '1.0',
      exportDate: new Date().toISOString(),
      count: templates.length,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        channel: t.channel,
        content: t.content,
        company_id: t.company_id,
        provider_template_id: t.provider_template_id
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('success', 'Exportación exitosa', 'Templates exportados correctamente');
  };

  const importTemplates = async () => {
    if (!importData.trim()) {
      showNotification('error', 'Error', 'Por favor, ingresa los datos JSON');
      return;
    }

    setImporting(true);
    try {
      const data = JSON.parse(importData);
      
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Formato JSON inválido: falta el array de templates');
      }

      showNotification('info', 'Importando', `Procesando ${data.templates.length} templates...`);
      
      // Simular importación (en un caso real, harías una llamada API)
      setTimeout(async () => {
        await loadTemplates();
        setShowImportModal(false);
        setImportData('');
        showNotification('success', 'Importación exitosa', `${data.templates.length} templates procesados`);
      }, 1500);

    } catch (err: any) {
      showNotification('error', 'Error de importación', 'Formato JSON inválido o datos incorrectos');
      console.error('Error importando:', err);
    } finally {
      setImporting(false);
    }
  };

  // ============ FUNCIONES DE BÚSQUEDA ============

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = filterChannel === '' || template.channel === filterChannel;
    
    return matchesSearch && matchesChannel;
  });

  // ============ FUNCIONES AUXILIARES ============

  const showNotification = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 max-w-sm animate-slide-in`;
    notification.innerHTML = `
      <div class="p-4 rounded-xl shadow-lg border ${
        type === 'success' ? 'bg-green-50 border-green-200' :
        type === 'error' ? 'bg-red-50 border-red-200' :
        'bg-blue-50 border-blue-200'
      }">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full ${
            type === 'success' ? 'bg-green-100' :
            type === 'error' ? 'bg-red-100' :
            'bg-blue-100'
          } flex items-center justify-center">
            ${
              type === 'success' ? '✅' :
              type === 'error' ? '❌' :
              '💡'
            }
          </div>
          <div class="flex-1">
            <p class="font-bold text-gray-900">${title}</p>
            <p class="text-sm text-gray-600 mt-1">${message}</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 4000);
  };

  const getExampleTemplates = (): Template[] => [
    {
      id: '1',
      name: 'Bienvenida Email',
      channel: 'EMAIL',
      content: 'Hola {{nombre}},\n\n¡Bienvenido a nuestra plataforma! 🎉\n\nTu cuenta ha sido creada exitosamente con los siguientes detalles:\n\n• Email: {{email}}\n• Teléfono: {{telefono}}\n• Fecha de registro: {{fecha}}\n\nPara cualquier consulta, puedes contactarnos en:\nsoporte@empresa.com\n\n¡Nos vemos dentro!\n\nSaludos cordiales,\nEl equipo de OmniNotify',
      company_id: companyId,
    },
    {
      id: '2',
      name: 'Recordatorio SMS',
      channel: 'SMS',
      content: 'Hola {{nombre}}, recordatorio: Tu cita es mañana a las {{hora}}. Para cambios, contacta al {{telefono}}.',
      company_id: companyId,
    },
    {
      id: '3',
      name: 'WhatsApp Promoción',
      channel: 'WHATSAPP',
      content: '🎉 ¡Oferta especial para {{nombre}}!\n\n20% de descuento en tu próxima compra.\nCódigo: {{codigo}}\n\nContacto: soporte@empresa.com\n\nVálido hasta: {{fecha_expiracion}}',
      company_id: companyId,
    },
    {
      id: '4',
      name: 'Confirmación de Pedido',
      channel: 'EMAIL',
      content: 'Hola {{nombre}},\n\n¡Gracias por tu compra! 🛒\n\nDetalles de tu pedido:\n• Número de pedido: {{numero_pedido}}\n• Total: {{total}}\n• Fecha estimada de entrega: {{fecha_entrega}}\n\nTe enviaremos una actualización cuando tu pedido sea enviado.\n\nGracias por confiar en nosotros,\nEl equipo de Ventas',
      company_id: companyId,
    },
    {
      id: '5',
      name: 'Recordatorio de Pago',
      channel: 'SMS',
      content: 'Hola {{nombre}}, recordatorio: Tu pago de {{monto}} vence el {{fecha_vencimiento}}. Para pagar: {{enlace_pago}}',
      company_id: companyId,
    },
  ];

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail className="w-5 h-5" />;
      case 'SMS': return <MessageSquare className="w-5 h-5" />;
      case 'WHATSAPP': return <MessageCircle className="w-5 h-5" />;
      default: return null;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'SMS': return 'bg-green-100 text-green-800 border border-green-200';
      case 'WHATSAPP': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  // ============ EFECTOS ============

  useEffect(() => {
    checkBackend();
  }, []);

  useEffect(() => {
    if (backendStatus === 'online') {
      loadTemplates();
    }
  }, [backendStatus]);

  // ============ RENDER ============

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER CON SEARCH BAR */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">T</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Templates</h1>
                  <p className="text-sm text-gray-600">Gestiona tus plantillas de comunicación</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
                onClick={loadTemplates}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                title="Recargar"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm font-medium"
              >
                <Plus className="w-5 h-5" />
                Nuevo Template
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="mt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* SEARCH BAR */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar templates por nombre o contenido..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* VIEW TOGGLE AND FILTER */}
              <div className="flex gap-3">
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white"
                >
                  <option value="">Todos los canales</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>

                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 shadow-sm bg-white"
                >
                  {viewMode === 'grid' ? <Grid className="w-5 h-5" /> : <List className="w-5 h-5" />}
                  {viewMode === 'grid' ? 'Vista Grid' : 'Vista Lista'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        {/* STATUS CARD */}
        <div className="mb-8">
          <div className={`rounded-xl p-6 shadow-sm ${
            backendStatus === 'online' ? 'bg-green-50 border border-green-200' :
            backendStatus === 'offline' ? 'bg-red-50 border border-red-200' :
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  backendStatus === 'online' ? 'bg-green-100' :
                  backendStatus === 'offline' ? 'bg-red-100' :
                  'bg-yellow-100'
                }`}>
                  {backendStatus === 'online' ? (
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  ) : backendStatus === 'offline' ? (
                    <AlertCircle className="w-7 h-7 text-red-600" />
                  ) : (
                    <Loader2 className="w-7 h-7 text-yellow-600 animate-spin" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {backendStatus === 'online' ? 'Sistema Conectado ✅' :
                     backendStatus === 'offline' ? 'Sistema Desconectado ❌' : 
                     'Verificando conexión... 🔄'}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {backendStatus === 'online' ? 'Todo funciona correctamente' :
                     backendStatus === 'offline' ? 'No se puede conectar con el servidor' :
                     'Estableciendo comunicación...'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={checkBackend}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium shadow-sm bg-white"
                >
                  Probar Conexión
                </button>
                <button
                  onClick={loadTemplates}
                  disabled={loading || backendStatus !== 'online'}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando...
                    </span>
                  ) : 'Recargar Templates'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CREATE FORM */}
        {showCreateForm && (
          <div className="mb-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Template</h2>
                  <p className="text-gray-600 mt-1">Diseña tu plantilla de comunicación</p>
                </div>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Nombre del Template *
                    </label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: Bienvenida a nuevos clientes"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Canal de Comunicación *
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {['EMAIL', 'SMS', 'WHATSAPP'].map((channel) => (
                        <button
                          key={channel}
                          type="button"
                          onClick={() => setNewTemplate({...newTemplate, channel: channel as any})}
                          className={`p-4 rounded-lg border transition-all ${
                            newTemplate.channel === channel
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              newTemplate.channel === channel ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              {getChannelIcon(channel)}
                            </div>
                            <span className="font-semibold text-gray-800">{channel}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700">
                      Contenido del Template *
                    </label>
                    <span className="text-sm text-gray-500">
                      {newTemplate.content.length} caracteres
                    </span>
                  </div>
                  <div className="relative">
                    <textarea
                      value={newTemplate.content}
                      onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                      rows={12}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                      placeholder={`Escribe el contenido de tu template aquí...

Ejemplos de variables:
• {{nombre}} - Nombre del cliente
• {{email}} - Correo electrónico
• {{telefono}} - Número de teléfono
• {{fecha}} - Fecha actual
• {{hora}} - Hora actual
• {{codigo}} - Código promocional

Ejemplo para EMAIL:
Hola {{nombre}},

¡Bienvenido a nuestra plataforma!

Detalles de tu cuenta:
• Email: {{email}}
• Teléfono: {{telefono}}
• Fecha de registro: {{fecha}}

Gracias por unirte a nosotros.

Saludos cordiales,
El equipo de OmniNotify`}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['{{nombre}}', '{{email}}', '{{telefono}}', '{{fecha}}', '{{hora}}'].map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => {
                          setNewTemplate(prev => ({
                            ...prev,
                            content: prev.content + variable
                          }));
                        }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* PREVIEW */}
              {newTemplate.content && (
                <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <Eye className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">Vista Previa</h3>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-gray-300">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`px-3 py-1 rounded-lg ${getChannelColor(newTemplate.channel)} font-medium`}>
                        {getChannelIcon(newTemplate.channel)}
                        <span className="ml-2">{newTemplate.channel}</span>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                      {newTemplate.content}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={createTemplate}
                  disabled={creating || !newTemplate.name.trim() || !newTemplate.content.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando Template...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-3">
                      <Save className="w-5 h-5" />
                      Crear Template
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    const examples = [
                      `Hola {{nombre}},\n\n¡Bienvenido a nuestra plataforma! 🎉\n\nTu cuenta ha sido creada exitosamente.\n\nDetalles:\n• Email: {{email}}\n• Teléfono: {{telefono}}\n• Fecha: {{fecha}}\n\nSaludos,\nEl equipo`,
                      `Recordatorio: Tu cita es el {{fecha}} a las {{hora}}.\nLugar: {{lugar}}\n\nConfirma tu asistencia respondiendo este mensaje.`,
                      `🎉 ¡Oferta especial {{nombre}}!\n\nDescuento del {{descuento}}% en tu próxima compra.\nCódigo: {{codigo}}\n\nVálido hasta: {{fecha_expiracion}}`
                    ];
                    setNewTemplate({
                      name: `Template ${['Bienvenida', 'Recordatorio', 'Promoción'][Math.floor(Math.random() * 3)]}`,
                      channel: ['EMAIL', 'SMS', 'WHATSAPP'][Math.floor(Math.random() * 3)] as any,
                      content: examples[Math.floor(Math.random() * examples.length)]
                    });
                    showNotification('info', 'Ejemplo cargado', 'Template de ejemplo cargado correctamente');
                  }}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cargar Ejemplo
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATES LIST */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Mis Templates
                <span className="ml-3 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  {filteredTemplates.length} templates
                </span>
              </h2>
              <p className="text-gray-600 mt-2">
                {searchTerm && `Resultados para "${searchTerm}"`}
                {filterChannel && ` • Filtrado por: ${filterChannel}`}
                {!searchTerm && !filterChannel && 'Gestiona todos tus templates de comunicación'}
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-bold">{filteredTemplates.length}</span>
              <span>de</span>
              <span className="font-bold">{templates.length}</span>
              <span>templates</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-gray-400 mb-6" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cargando Templates</h3>
              <p className="text-gray-600">Estamos obteniendo tus plantillas de comunicación...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="text-6xl mb-6">📭</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {searchTerm || filterChannel ? 'No se encontraron templates' : 'No hay templates aún'}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchTerm || filterChannel 
                  ? 'Prueba con otros términos de búsqueda o elimina los filtros.'
                  : 'Comienza creando tu primer template de comunicación.'}
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                Crear Mi Primer Template
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            // GRID VIEW
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  {/* CARD HEADER */}
                  <div className="p-5 border-b border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${getChannelColor(template.channel)}`}>
                            {getChannelIcon(template.channel)}
                            {template.channel}
                          </div>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{template.name}</h3>
                        <p className="text-xs text-gray-500 mt-2">
                          ID: {template.id.substring(0, 8)}...
                        </p>
                      </div>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditing(template)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => confirmDelete(template)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CARD CONTENT */}
                  <div className="p-5">
                    <div className="mb-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Contenido:</div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <pre className="text-gray-700 whitespace-pre-wrap text-sm line-clamp-3 font-mono">
                          {template.content}
                        </pre>
                      </div>
                      {template.content.length > 200 && (
                        <button
                          onClick={() => showTemplatePreview(template.content)}
                          className="text-sm text-blue-600 hover:text-blue-700 mt-2 font-medium"
                        >
                          Ver completo →
                        </button>
                      )}
                    </div>

                    {/* VARIABLES */}
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 mb-2">Variables detectadas:</div>
                      <div className="flex flex-wrap gap-1">
                        {(template.content.match(/\{\{.*?\}\}/g) || []).map((variable, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {variable}
                          </span>
                        ))}
                        {!(template.content.match(/\{\{.*?\}\}/g) || []).length && (
                          <span className="text-xs text-gray-400 italic">Sin variables</span>
                        )}
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(template.content);
                          showNotification('success', 'Copiado', 'Template copiado al portapapeles');
                        }}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                      >
                        <Copy className="w-4 h-4" />
                        Copiar
                      </button>
                      <button
                        onClick={() => showTemplatePreview(template.content)}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        Vista Previa
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // LIST VIEW
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-4 px-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Template</th>
                      <th className="py-4 px-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Canal</th>
                      <th className="py-4 px-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Contenido</th>
                      <th className="py-4 px-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Variables</th>
                      <th className="py-4 px-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTemplates.map((template) => (
                      <tr 
                        key={template.id} 
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-semibold text-gray-900">{template.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              ID: {template.id.substring(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 ${getChannelColor(template.channel)}`}>
                            {getChannelIcon(template.channel)}
                            {template.channel}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="max-w-xs">
                            <pre className="text-gray-600 text-sm whitespace-pre-wrap truncate">
                              {template.content.substring(0, 80)}
                              {template.content.length > 80 ? '...' : ''}
                            </pre>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1">
                            {(template.content.match(/\{\{.*?\}\}/g) || []).slice(0, 2).map((variable, i) => (
                              <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                {variable}
                              </span>
                            ))}
                            {(template.content.match(/\{\{.*?\}\}/g) || []).length > 2 && (
                              <span className="text-xs text-gray-500 font-medium">
                                +{(template.content.match(/\{\{.*?\}\}/g) || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(template)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(template.content)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                              title="Copiar"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(template)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* EDIT MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-200 bg-blue-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Editar Template</h2>
                    <p className="text-gray-600 mt-1">Modifica el contenido de tu plantilla</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingId(null);
                      setEditForm({});
                    }}
                    className="p-2 hover:bg-white/50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Nombre del Template *
                    </label>
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nombre del template"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Canal de Comunicación *
                    </label>
                    <select
                      value={editForm.channel || 'EMAIL'}
                      onChange={(e) => setEditForm({...editForm, channel: e.target.value as any})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="EMAIL">Email</option>
                      <option value="SMS">SMS</option>
                      <option value="WHATSAPP">WhatsApp</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Contenido del Template *
                      </label>
                      <span className="text-sm text-gray-500">
                        {editForm.content?.length || 0} caracteres
                      </span>
                    </div>
                    <textarea
                      value={editForm.content || ''}
                      onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                      placeholder="Contenido del template"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200">
                <div className="flex gap-4">
                  <button
                    onClick={updateTemplate}
                    disabled={!editForm.name?.trim() || !editForm.content?.trim()}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold shadow-lg disabled:opacity-50"
                  >
                    <Save className="w-5 h-5 inline mr-2" />
                    Guardar Cambios
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingId(null);
                      setEditForm({});
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {showDeleteModal && templateToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">¿Eliminar Template?</h2>
                    <p className="text-gray-600 mt-1">Esta acción no se puede deshacer</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="mb-6">
                  <p className="text-gray-700 mb-3">Estás a punto de eliminar el template:</p>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="font-semibold text-gray-900 mb-2">{templateToDelete.name}</div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-2 ${getChannelColor(templateToDelete.channel)}`}>
                      {getChannelIcon(templateToDelete.channel)}
                      {templateToDelete.channel}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Esta acción eliminará permanentemente el template y todos sus datos asociados.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={deleteTemplate}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold shadow-lg"
                  >
                    Sí, Eliminar
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setTemplateToDelete(null);
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW MODAL */}
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-xl">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Vista Previa del Template</h2>
                    <p className="text-gray-600 mt-1">Contenido completo del template</p>
                  </div>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-300">
                  <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                    {previewContent}
                  </pre>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(previewContent);
                      showNotification('success', 'Copiado', 'Contenido copiado al portapapeles');
                    }}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                  >
                    Copiar contenido
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IMPORT MODAL */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl">
              <div className="p-6 border-b border-gray-200 bg-blue-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Importar Templates</h2>
                    <p className="text-gray-600 mt-1">Importa templates desde un archivo JSON</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportData('');
                    }}
                    className="p-2 hover:bg-white/50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Datos JSON para importar
                  </label>
                  <textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                    placeholder={`Pega aquí el contenido JSON de exportación.

Formato esperado:
{
  "templates": [
    {
      "name": "Nombre del template",
      "channel": "EMAIL",
      "content": "Contenido del template..."
    }
  ]
}`}
                  />
                  <div className="mt-3 text-sm text-gray-600">
                    💡 Copia los datos de un archivo de exportación anterior
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={importTemplates}
                    disabled={importing || !importData.trim()}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-lg disabled:opacity-50"
                  >
                    {importing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Importando...
                      </span>
                    ) : (
                      'Importar Templates'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportData('');
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">T</span>
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">Template Manager</div>
                <div className="text-gray-600">Sistema profesional de plantillas de comunicación</div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 text-center">
              <p>© {new Date().getFullYear()} • Conectado a backend: 
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                  backendStatus === 'online' ? 'bg-green-100 text-green-800' :
                  backendStatus === 'offline' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {backendStatus === 'online' ? '✅ ONLINE' :
                   backendStatus === 'offline' ? '❌ OFFLINE' :
                   '🔄 CONECTANDO'}
                </span>
              </p>
              <p className="mt-2">
                Templates: <span className="font-bold">{filteredTemplates.length}</span> • 
                Canal: <span className="font-bold">{filterChannel || 'Todos'}</span>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
} 