// frontend_omninotify/src/pages/Templates.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Plus, 
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
  Loader2
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
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  // Estados para CRUD
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Template>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // Estados para creación
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    channel: 'EMAIL' as 'EMAIL' | 'SMS' | 'WHATSAPP',
    content: '',
  });

  const companyId = '25a63d10-eff4-11f0-86e6-a2aaf909b30d';

  // ============ FUNCIONES PRINCIPALES ============

  const checkBackend = async () => {
    try {
      setBackendStatus('checking');
      await axios.get(`${API_BASE_URL}/health`);
      await axios.get(`${API_BASE_URL}/templates/test/hello`);
      setBackendStatus('online');
      setError('');
    } catch (err: any) {
      setBackendStatus('offline');
      setError(`Backend no disponible: ${err.message}`);
    }
  };

  const loadTemplates = async () => {
    if (backendStatus !== 'online') return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/templates/company/${companyId}`);
      
      // Extraer templates de cualquier estructura de respuesta
      let templatesData: Template[] = [];
      if (response.data?.success && Array.isArray(response.data.data)) {
        templatesData = response.data.data;
      } else if (Array.isArray(response.data?.data)) {
        templatesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        templatesData = response.data;
      } else if (Array.isArray(response.data?.templates)) {
        templatesData = response.data.templates;
      }
      
      setTemplates(templatesData.length > 0 ? templatesData : getExampleTemplates());
    } catch (err: any) {
      setError(`Error: ${err.response?.data?.message || err.message}`);
      setTemplates(getExampleTemplates());
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      alert('Nombre y contenido son requeridos');
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
      alert('Template creado exitosamente!');
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const updateTemplate = async () => {
    if (!editingId || !editForm.name?.trim() || !editForm.content?.trim()) {
      alert('Nombre y contenido son requeridos');
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/templates/${editingId}/company/${companyId}`,
        editForm
      );

      setEditingId(null);
      setEditForm({});
      await loadTemplates();
      alert('Template actualizado exitosamente!');
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este template?')) return;

    try {
      await axios.delete(`${API_BASE_URL}/templates/${id}/company/${companyId}`);
      await loadTemplates();
      alert('Template eliminado exitosamente!');
    } catch (err: any) {
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const startEditing = (template: Template) => {
    setEditingId(template.id);
    setEditForm({ ...template });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const getExampleTemplates = (): Template[] => [
    {
      id: '1',
      name: 'Bienvenida Email',
      channel: 'EMAIL',
      content: 'Hola {{nombre}}, bienvenido a nuestra plataforma.',
      company_id: companyId,
    },
    {
      id: '2',
      name: 'Recordatorio SMS',
      channel: 'SMS',
      content: 'Recordatorio: Tu cita es el {{fecha}} a las {{hora}}.',
      company_id: companyId,
    },
  ];

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

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail className="w-4 h-4" />;
      case 'SMS': return <MessageSquare className="w-4 h-4" />;
      case 'WHATSAPP': return <MessageCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return 'bg-blue-100 text-blue-800';
      case 'SMS': return 'bg-green-100 text-green-800';
      case 'WHATSAPP': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📨 Templates</h1>
          <p className="text-gray-600 mt-2">Administra tus plantillas de comunicación</p>
        </header>

        {/* STATUS PANEL */}
        <div className={`rounded-lg p-4 mb-6 ${
          backendStatus === 'online' ? 'bg-green-50 border border-green-200' :
          backendStatus === 'offline' ? 'bg-red-50 border border-red-200' :
          'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {backendStatus === 'online' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : backendStatus === 'offline' ? (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                ) : (
                  <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                )}
                <span className="font-medium">
                  {backendStatus === 'online' ? '✅ Backend Conectado' :
                   backendStatus === 'offline' ? '❌ Backend Desconectado' : 
                   '🔄 Verificando conexión...'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">URL:</span> {API_BASE_URL}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={checkBackend}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Probar Conexión
              </button>
              <button
                onClick={loadTemplates}
                disabled={loading || backendStatus !== 'online'}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                {loading ? 'Cargando...' : 'Recargar'}
              </button>
            </div>
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-red-800 hover:text-red-900">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* CREATE BUTTON */}
        {!showCreateForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Crear Nuevo Template
            </button>
          </div>
        )}

        {/* CREATE FORM */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Template</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Bienvenida Email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Canal *
                </label>
                <select
                  value={newTemplate.channel}
                  onChange={(e) => setNewTemplate({...newTemplate, channel: e.target.value as 'EMAIL' | 'SMS' | 'WHATSAPP'})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="EMAIL">📧 Email</option>
                  <option value="SMS">💬 SMS</option>
                  <option value="WHATSAPP">💚 WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contenido *
                </label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  placeholder="Ej: Hola {{nombre}}, bienvenido..."
                />
                <p className="text-sm text-gray-500 mt-2">
                  Usa variables como {'{{'}nombre{'}}'}, {'{{'}fecha{'}}'}, {'{{'}hora{'}}'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={createTemplate}
                  disabled={creating || !newTemplate.name.trim() || !newTemplate.content.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Crear Template
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEMPLATES LIST */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Templates Existentes
                <span className="ml-3 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {templates.length}
                </span>
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Seleccionado: {selectedTemplateId ? '1' : '0'}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-4 text-gray-500">Cargando templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay templates</h3>
              <p className="text-gray-500">
                {backendStatus === 'online' 
                  ? 'Crea tu primer template usando el botón arriba.'
                  : 'Conecta el backend primero para cargar templates.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {templates.map((template) => (
                <div 
                  key={template.id}
                  className={`p-6 hover:bg-gray-50 transition ${
                    selectedTemplateId === template.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedTemplateId(
                    selectedTemplateId === template.id ? null : template.id
                  )}
                >
                  {editingId === template.id ? (
                    // EDIT FORM
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="text-xl font-semibold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-blue-500 px-1"
                        />
                        <div className="flex gap-2">
                          <select
                            value={editForm.channel || 'EMAIL'}
                            onChange={(e) => setEditForm({...editForm, channel: e.target.value as any})}
                            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="WHATSAPP">WhatsApp</option>
                          </select>
                        </div>
                      </div>

                      <textarea
                        value={editForm.content || ''}
                        onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                      />

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={updateTemplate}
                          disabled={!editForm.name?.trim() || !editForm.content?.trim()}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
                        >
                          <Save className="w-4 h-4" />
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    // TEMPLATE DISPLAY
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {template.name}
                            {selectedTemplateId === template.id && (
                              <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                Seleccionado
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getChannelColor(template.channel)}`}>
                              {getChannelIcon(template.channel)}
                              {template.channel}
                            </span>
                            <span className="text-xs text-gray-500">
                              ID: {template.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(template);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(template.id);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <pre className="text-gray-700 whitespace-pre-wrap font-mono text-sm">
                            {template.content}
                          </pre>
                        </div>
                      </div>

                      <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
                        <div>
                          Variables detectadas: 
                          {template.content.match(/\{\{.*?\}\}/g)?.map((variable, i) => (
                            <span key={i} className="ml-2 px-2 py-1 bg-gray-200 rounded">
                              {variable}
                            </span>
                          )) || ' Ninguna'}
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(template.content);
                              alert('Contenido copiado al portapapeles');
                            }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Copiar contenido
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TEMPLATE SELECTION ACTIONS */}
          {selectedTemplateId && templates.length > 0 && (
            <div className="p-4 border-t border-gray-200 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-700">
                  Template seleccionado · Acciones disponibles:
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      if (template) {
                        navigator.clipboard.writeText(template.content);
                        alert('Template copiado al portapapeles');
                      }
                    }}
                    className="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm"
                  >
                    Copiar
                  </button>
                  <button
                    onClick={() => {
                      const template = templates.find(t => t.id === selectedTemplateId);
                      if (template) {
                        startEditing(template);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('¿Enviar este template como prueba?')) {
                        alert('Función de envío de prueba en desarrollo');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                  >
                    Enviar Prueba
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DEBUG INFO */}
        <details className="mt-8 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <summary className="cursor-pointer font-medium text-gray-700">
            🔧 Información de Desarrollo
          </summary>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-sm">
                <div className="font-medium">Estado Backend:</div>
                <div className="text-gray-600">{backendStatus}</div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Templates Cargados:</div>
                <div className="text-gray-600">{templates.length}</div>
              </div>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-2">Acciones Rápidas:</div>
              <div className="flex gap-2">
                <button
                  onClick={() => console.log('Templates:', templates)}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                >
                  Log Templates
                </button>
                <button
                  onClick={() => setTemplates(getExampleTemplates())}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                >
                  Cargar Ejemplos
                </button>
                <button
                  onClick={() => {
                    setNewTemplate({
                      name: 'Template de Prueba',
                      channel: 'EMAIL',
                      content: 'Hola {{nombre}}, esto es una prueba.',
                    });
                    setShowCreateForm(true);
                  }}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                >
                  Autocompletar Form
                </button>
              </div>
            </div>
          </div>
        </details>

        {/* FOOTER */}
        <footer className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>Sistema de Templates • {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}