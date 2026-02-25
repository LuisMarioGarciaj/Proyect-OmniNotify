import React, { useState } from 'react';
import { Search, X, Tag, Check } from 'lucide-react';

// Define los tipos localmente si no tienes types.ts
interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contactCount: number;
  company_id: string;
}

interface Props {
  groups: ContactGroup[];
  selectedGroups: string[];
  onToggleGroup: (groupId: string) => void;
  onClose: () => void;
  getContactsFromSelectedGroups: () => number;
}

const GroupsSelectionModal: React.FC<Props> = ({
  groups,
  selectedGroups,
  onToggleGroup,
  onClose,
  getContactsFromSelectedGroups
}) => {
  const [search, setSearch] = useState('');

  const filtered = groups.filter(group =>
    group.name.toLowerCase().includes(search.toLowerCase()) ||
    group.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Seleccionar Tags</h2>
              <p className="text-gray-600">Selecciona tags para enviar a todos sus contactos</p>
              <p className="text-sm text-gray-500 mt-1">
                {getContactsFromSelectedGroups()} contactos en total
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar tags por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🏷️</div>
              <p className="text-gray-600">No se encontraron tags</p>
              <p className="text-sm text-gray-500 mt-2">
                {search ? `No hay resultados para "${search}"` : 'Crea tags en la sección de configuración'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(group => {
                const selected = selectedGroups.includes(group.id);
                
                return (
                  <button
                    key={group.id}
                    onClick={() => onToggleGroup(group.id)}
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition ${
                      selected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${selected ? 'bg-purple-100' : 'bg-gray-100'}`}>
                        <Tag className={selected ? 'text-purple-600' : 'text-gray-400'} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="font-bold text-gray-900">{group.name}</div>
                        <div className="text-sm text-gray-600 mt-1">{group.description}</div>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <span className="font-medium">{group.contactCount}</span>
                            <span>contactos</span>
                          </div>
                          <div className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            Tag
                          </div>
                        </div>
                      </div>
                    </div>

                    {selected && (
                      <div className="p-1 bg-purple-500 rounded-full ml-4">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-gray-900">{selectedGroups.length} tags seleccionados</div>
              <div className="text-sm text-gray-600">
                {getContactsFromSelectedGroups()} contactos recibirán la notificación
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Confirmar selección
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupsSelectionModal;