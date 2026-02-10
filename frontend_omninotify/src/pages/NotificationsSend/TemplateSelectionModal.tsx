import React, { useState } from 'react';
import { Search, X, Mail, MessageSquare, Check } from 'lucide-react';

// Define el tipo localmente
interface Template {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  content: string;
  company_id: string;
}

interface Props {
  templates: Template[];
  selectedTemplate: Template | null;
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const TemplateSelectionModal: React.FC<Props> = ({ templates, selectedTemplate, onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.channel.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Seleccionar Template</h2>
              <p className="text-gray-600">{templates.length} disponibles</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-gray-600">No se encontraron templates</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map(template => {
                const isSelected = selectedTemplate?.id === template.id;
                const Icon = template.channel === 'EMAIL' ? Mail : MessageSquare;

                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      onSelect(template);
                      onClose();
                    }}
                    className={`bg-white rounded-xl border p-5 text-left hover:shadow-lg transition ${
                      isSelected ? `border-blue-500 ring-2 ring-blue-100` : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${template.channel === 'EMAIL' ? 'bg-blue-100' : 'bg-green-100'}`}>
                        <Icon className={`w-6 h-6 ${template.channel === 'EMAIL' ? 'text-blue-600' : 'text-green-600'}`} />
                      </div>
                      {isSelected && (
                        <div className={`p-1 ${template.channel === 'EMAIL' ? 'bg-blue-500' : 'bg-green-500'} rounded-full`}>
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-lg mb-2">{template.name}</h3>
                    
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${template.channel === 'EMAIL' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                      <Icon className="w-4 h-4" />
                      {template.channel}
                    </div>

                    <div className="mt-4 p-3 bg-gray-50 rounded border">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {template.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateSelectionModal;