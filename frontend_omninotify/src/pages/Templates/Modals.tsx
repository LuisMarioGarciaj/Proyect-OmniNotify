import React, { useState, useRef } from 'react';
import {
  X, Save, Bold, Italic, AlignLeft, AlignCenter, List,
  Eye as EyeIcon, ChevronDown, ChevronUp, CheckCircle,
  Mail, MessageSquare, MessageCircle, User, Building,
  Calendar, CreditCard, AlertCircle, Copy, Edit, Trash2
} from 'lucide-react';
import { getTemplatesByChannel, variableCategories } from './plantillas';

// ========== EDITOR MODAL ==========
interface EditorModalProps {
  mode: 'create' | 'edit';
  initialTemplate?: any;
  onClose: () => void;
  onSubmit: (templateData: any) => Promise<void>;
}

export const EditorModal: React.FC<EditorModalProps> = ({
  mode,
  initialTemplate,
  onClose,
  onSubmit
}) => {
  const [editorMode, setEditorMode] = useState<'visual' | 'preview'>('visual');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [currentName, setCurrentName] = useState<string>('');
  const [currentChannel, setCurrentChannel] = useState<'EMAIL' | 'SMS' | 'WHATSAPP'>('EMAIL');
  const [showVariablesPanel, setShowVariablesPanel] = useState(true);
  const [showFormatPanel, setShowFormatPanel] = useState(true);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const lastCursorPos = useRef<number>(0);

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

  const getIconComponent = (iconName: string) => {
    switch(iconName) {
      case 'User': return <User className="w-4 h-4" />;
      case 'Building': return <Building className="w-4 h-4" />;
      case 'Calendar': return <Calendar className="w-4 h-4" />;
      case 'CreditCard': return <CreditCard className="w-4 h-4" />;
      default: return null;
    }
  };

  React.useEffect(() => {
    if (initialTemplate) {
      setCurrentName(initialTemplate.name);
      setCurrentChannel(initialTemplate.channel);
      setCurrentContent(initialTemplate.content);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = initialTemplate.content;
        }
      }, 100);
    } else {
      setCurrentName('');
      setCurrentContent('');
      setCurrentChannel('EMAIL');
      if (editorRef.current) {
        editorRef.current.innerHTML = '<p>Empieza a escribir o elige una plantilla...</p>';
      }
    }
  }, [initialTemplate]);

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

  const applyFormat = (format: string, value: string = '') => {
    if (!editorRef.current) return;
    saveCursorPosition();
    document.execCommand(format, false, value);
    setTimeout(() => {
      updateEditorContent();
      editorRef.current?.focus();
    }, 10);
  };

  const updateEditorContent = () => {
    if (!editorRef.current) return;
    setCurrentContent(editorRef.current.innerHTML);
  };

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
        }
      }, 100);
    }
  };

  const handleChannelChange = (channel: 'EMAIL' | 'SMS' | 'WHATSAPP') => {
    setCurrentChannel(channel);
    setCurrentContent('');
    setCurrentName('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '<p>Empieza a escribir o elige una plantilla...</p>';
      updateEditorContent();
    }
  };

  const handleSubmit = async () => {
    if (!currentName.trim() || !currentContent.trim()) return;
    await onSubmit({
      name: currentName,
      channel: currentChannel,
      content: currentContent
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {mode === 'create' ? 'Crear Nuevo Template' : 'Editar Template'}
              </h2>
              <p className="text-gray-600 mt-1">
                {mode === 'create' 
                  ? 'Usa el editor visual para crear tu template'
                  : `Editando: ${initialTemplate?.name}`}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
            <div className="lg:col-span-1 border-r border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-6 space-y-6">
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

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Variables
                    </label>
                    <button
                      onClick={() => setShowVariablesPanel(!showVariablesPanel)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {showVariablesPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {showVariablesPanel && (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {variableCategories.map((category) => (
                        <div key={category.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-2">
                            {getIconComponent(category.icon)}
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

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Formato
                    </label>
                    <button
                      onClick={() => setShowFormatPanel(!showFormatPanel)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {showFormatPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

            <div className="lg:col-span-3 flex flex-col">
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
                    </div>
                  </div>
                </div>
              </div>

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
                      onClick={onClose}
                      className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!currentName.trim() || !currentContent.trim()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      {mode === 'create' ? 'Crear Template' : 'Guardar Cambios'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== PREVIEW MODAL ==========
interface PreviewModalProps {
  template: {
    name: string;
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
    content: string;
  };
  onClose: () => void;
  onEdit: () => void;
  showMessage: (text: string, type: 'success' | 'error' | 'info') => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  template,
  onClose,
  onEdit,
  showMessage,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{template.name}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
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
                  maxWidth: template.channel === 'EMAIL' ? '600px' : '400px',
                }}
                dangerouslySetInnerHTML={{ 
                  __html: template.content
                }}
              />
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(template.content);
                showMessage('Contenido copiado', 'success');
              }}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <Copy className="w-5 h-5 inline mr-2" />
              Copiar Contenido
            </button>
            <button
              onClick={onEdit}
              className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              <Edit className="w-5 h-5 inline mr-2" />
              Editar
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== DELETE MODAL ==========
interface DeleteModalProps {
  template: {
    name: string;
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ template, onConfirm, onCancel }) => {
  return (
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
              <div className="font-semibold text-gray-900 mb-2">{template.name}</div>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={onConfirm} className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
              Eliminar
            </button>
            <button onClick={onCancel} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};