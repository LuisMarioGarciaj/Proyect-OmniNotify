import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit, Eye, Search, RefreshCw,
  Mail, MessageSquare, MessageCircle,
  Loader2, Copy
} from 'lucide-react';
import { EditorModal, PreviewModal, DeleteModal } from './Modals';
import { api } from '../../services/api'; // Importa tu servicio API

interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  company_id: string;
}

const TemplatesPage: React.FC = () => {
  // Obtener el usuario del localStorage
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const companyId = userData.company_id || '25a63d10-eff4-11f0-86e6-a2aaf909b30d';
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [message, setMessage] = useState<{text: string; type: 'success' | 'error' | 'info'} | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      console.log('Cargando templates para compañía:', companyId);
      
      // Tu backend devuelve { success: boolean, data: [], message: string }
      const response = await api.get(`/templates/company/${companyId}`);
      
      console.log('Respuesta de templates:', response);
      
      let templatesData = [];
      
      // Maneja la estructura de respuesta de tu backend
      if (response && response.success && Array.isArray(response.data)) {
        templatesData = response.data;
      } else if (Array.isArray(response)) {
        templatesData = response;
      } else if (response?.data && Array.isArray(response.data)) {
        templatesData = response.data;
      }
      
      console.log('Templates cargados:', templatesData.length);
      setTemplates(templatesData);
      
    } catch (error: any) {
      console.error('Error cargando templates:', error);
      showMessage('Error cargando templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (templateData: any) => {
    try {
      console.log('Creando template:', templateData);
      console.log('Para compañía:', companyId);
      
      const newTemplate = {
        ...templateData,
        company_id: companyId
      };
      
      // Tu backend espera CreateTemplateDto
      const response = await api.post('/templates', newTemplate);
      
      if (response && response.success) {
        showMessage(response.message || 'Template creado exitosamente', 'success');
        setShowCreateModal(false);
        loadTemplates();
      } else {
        showMessage(response?.message || 'Error creando template', 'error');
      }
    } catch (error: any) {
      console.error('Error creando template:', error);
      showMessage(error.message || 'Error creando template', 'error');
    }
  };

  const handleUpdateTemplate = async (templateData: any) => {
    if (!selectedTemplate) return;

    try {
      console.log('Actualizando template:', selectedTemplate.id);
      
      // Tu backend espera PUT /templates/:id/company/:companyId
      const response = await api.put(
        `/templates/${selectedTemplate.id}/company/${companyId}`,
        templateData
      );
      
      if (response && response.success) {
        showMessage(response.message || 'Template actualizado exitosamente', 'success');
        setShowEditModal(false);
        setSelectedTemplate(null);
        loadTemplates();
      } else {
        showMessage(response?.message || 'Error actualizando template', 'error');
      }
    } catch (error: any) {
      console.error('Error actualizando template:', error);
      showMessage(error.message || 'Error actualizando template', 'error');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      console.log('Eliminando template:', templateToDelete.id);
      
      // Tu backend espera DELETE /templates/:id/company/:companyId
      const response = await api.delete(
        `/templates/${templateToDelete.id}/company/${companyId}`
      );
      
      if (response && response.success) {
        showMessage(response.message || 'Template eliminado exitosamente', 'success');
        setShowDeleteModal(false);
        setTemplateToDelete(null);
        loadTemplates();
      } else {
        showMessage(response?.message || 'Error eliminando template', 'error');
      }
    } catch (error: any) {
      console.error('Error eliminando template:', error);
      showMessage(error.message || 'Error eliminando template', 'error');
    }
  };

  const startEdit = (template: Template) => {
    setSelectedTemplate(template);
    setShowEditModal(true);
  };

  const showPreview = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const confirmDelete = (template: Template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
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
    console.log('TemplatesPage montado - compañía:', companyId);
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
                <p className="text-gray-600">
                  Editor visual de plantillas ({templates.length} templates)
                  <span className="text-xs text-gray-500 ml-2">
                    Compañía: {companyId?.slice(0, 8)}...
                  </span>
                </p>
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
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nuevo Template
              </button>
            </div>
          </div>

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

      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg flex justify-between items-center ${
          message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-lg hover:opacity-70">×</button>
        </div>
      )}

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
              onClick={() => setShowCreateModal(true)}
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

      {showCreateModal && (
        <EditorModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTemplate}
        />
      )}

      {showEditModal && selectedTemplate && (
        <EditorModal
          mode="edit"
          initialTemplate={selectedTemplate}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTemplate(null);
          }}
          onSubmit={handleUpdateTemplate}
        />
      )}

      {showPreviewModal && selectedTemplate && (
        <PreviewModal
          template={selectedTemplate}
          onClose={() => setShowPreviewModal(false)}
          onEdit={() => {
            setShowPreviewModal(false);
            startEdit(selectedTemplate);
          }}
          showMessage={showMessage}
        />
      )}

      {showDeleteModal && templateToDelete && (
        <DeleteModal
          template={templateToDelete}
          onConfirm={handleDeleteTemplate}
          onCancel={() => {
            setShowDeleteModal(false);
            setTemplateToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default TemplatesPage;