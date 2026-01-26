import React, { useState } from 'react';
import type { Contact } from '../../types/contact';
import { createContact, updateContact } from '../../services/contacts.service';

interface Props {
  contact?: Contact | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ContactForm: React.FC<Props> = ({ contact, onCancel, onSuccess }) => {
  const [form, setForm] = useState({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (contact) {
      await updateContact(contact.id, form);
    } else {
      await createContact(form);
    }

    onSuccess();
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
        />
        <input
          className="w-full p-3 border rounded-lg"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="w-full p-3 border rounded-lg"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            {contact ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;
