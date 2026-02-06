import React, { useState, useEffect } from 'react';
import type { Contact } from '../../types/contact';
import type { Tag } from '../../types/tag';
import { createContact, updateContact } from '../../services/contacts.service';
import { tagsService } from '../../services/tags.service';
import { X } from 'lucide-react';

interface Props {
  contact?: Contact | null;
  companyId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const ContactForm: React.FC<Props> = ({ contact, companyId, onCancel, onSuccess }) => {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [form, setForm] = useState({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    tag_ids: contact?.tags?.map(t => t.id) || [] as string[],
  });

  // Cargar los tags de la empresa al abrir el formulario
  useEffect(() => {
    const loadTags = async () => {
      try {
        const data = await tagsService.getAll();
        setAvailableTags(data);
      } catch (error) {
        console.error("Error loading tags for form:", error);
      }
    };
    loadTags();
  }, [companyId]);

  const toggleTag = (tagId: string) => {
    setForm(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (contact) {
        await updateContact(contact.id, form); // Enviamos con tag_ids
      } else {
        await createContact(companyId, form); 
      }
      onSuccess();
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  };

  return (
    <div className="max-w-xl bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">
        {contact ? 'Edit Contact' : 'Add New Contact'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full p-3 border rounded-lg"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="w-full p-3 border rounded-lg"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="w-full p-3 border rounded-lg"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        {/* Sección de Selección de Tags */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Assign Tags</label>
          <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
            {availableTags.length === 0 && <p className="text-xs text-gray-400">No tags available. Create some in Tags Management.</p>}
            {availableTags.map(tag => {
              const isSelected = form.tag_ids.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    isSelected 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                >
                  {tag.name}
                  {isSelected && <X size={12} className="inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {contact ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;