import React, { useState } from 'react';
import { Search, X, User, Mail, Phone, MessageCircle, Check } from 'lucide-react';

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
}

interface Props {
  contacts: Contact[];
  selectedContacts: string[];
  selectedTemplate: Template | null;
  onToggleContact: (contact: Contact) => void;
  onClose: () => void;
}

const ContactsSelectionModal: React.FC<Props> = ({
  contacts,
  selectedContacts,
  selectedTemplate,
  onToggleContact,
  onClose
}) => {
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(search.toLowerCase()) ||
    contact.email?.toLowerCase().includes(search.toLowerCase()) ||
    contact.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const getContactValue = (contact: Contact) => {
    if (!selectedTemplate) return contact.email;
    return selectedTemplate.channel === 'SMS' || selectedTemplate.channel === 'WHATSAPP' 
      ? contact.phone 
      : contact.email;
  };

  const isSelected = (contact: Contact) => {
    const value = getContactValue(contact);
    return selectedContacts.includes(value || '');
  };

  const getChannelIcon = () => {
    if (!selectedTemplate) return <Mail className="w-3 h-3" />;
    switch (selectedTemplate.channel) {
      case 'EMAIL': return <Mail className="w-3 h-3" />;
      case 'SMS': return <Phone className="w-3 h-3" />;
      case 'WHATSAPP': return <MessageCircle className="w-3 h-3" />;
      default: return <Mail className="w-3 h-3" />;
    }
  };

  const getChannelColor = () => {
    if (!selectedTemplate) return 'bg-blue-100';
    switch (selectedTemplate.channel) {
      case 'EMAIL': return 'bg-blue-100';
      case 'SMS': return 'bg-green-100';
      case 'WHATSAPP': return 'bg-emerald-100';
      default: return 'bg-blue-100';
    }
  };

  const getIconColor = () => {
    if (!selectedTemplate) return 'text-blue-600';
    switch (selectedTemplate.channel) {
      case 'EMAIL': return 'text-blue-600';
      case 'SMS': return 'text-green-600';
      case 'WHATSAPP': return 'text-emerald-600';
      default: return 'text-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Seleccionar Contactos</h2>
              <p className="text-gray-600">{selectedContacts.length} seleccionados</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar contactos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg"
            />
          </div>

          {selectedTemplate && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border">
              <div className="text-sm">
                <span className="font-medium">Template:</span> {selectedTemplate.channel}
                <span className="ml-4">
                  {selectedTemplate.channel === 'SMS' || selectedTemplate.channel === 'WHATSAPP'
                    ? 'Mostrando contactos con teléfono' 
                    : 'Mostrando contactos con email'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">👤</div>
              <p className="text-gray-600">No se encontraron contactos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(contact => {
                const selected = isSelected(contact);
                const value = getContactValue(contact);
                const isValid = selectedTemplate 
                  ? (selectedTemplate.channel === 'SMS' || selectedTemplate.channel === 'WHATSAPP' ? contact.phone : contact.email)
                  : true;

                return (
                  <button
                    key={contact.id}
                    onClick={() => onToggleContact(contact)}
                    disabled={!isValid}
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition ${
                      selected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    } ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selected ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <User className={selected ? 'text-green-600' : 'text-gray-400'} />
                      </div>
                      
                      <div>
                        <div className="font-bold">{contact.name || 'Sin nombre'}</div>
                        <div className="text-sm text-gray-600 flex items-center gap-4 mt-1">
                          {contact.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {contact.email}
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!isValid && (
                        <span className="text-xs text-gray-500">
                          {selectedTemplate?.channel === 'SMS' || selectedTemplate?.channel === 'WHATSAPP' 
                            ? 'Sin teléfono' 
                            : 'Sin email'}
                        </span>
                      )}
                      {selected && (
                        <div className="p-1 bg-green-500 rounded-full">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold">{selectedContacts.length} seleccionados</div>
              <div className="text-sm text-gray-600">
                {selectedTemplate?.channel === 'SMS' ? 'Envío por SMS' : 
                 selectedTemplate?.channel === 'WHATSAPP' ? 'Envío por WhatsApp' : 
                 'Envío por Email'}
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactsSelectionModal;