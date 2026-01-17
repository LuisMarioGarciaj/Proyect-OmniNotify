import React from 'react';
import type { Contact } from '../../types/contact';
import { deleteContact } from '../../services/contacts.service';

interface Props {
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (contact: Contact) => void;
  onRefresh: () => void;
}

const ContactsTable: React.FC<Props> = ({
  contacts,
  onAdd,
  onEdit,
  onRefresh,
}) => {
  const handleDelete = async (id: string) => {
    if (confirm('Delete contact?')) {
      await deleteContact(id);
      onRefresh();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-xl font-semibold">Contacts</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg"
        >
          + Add Contact
        </button>
      </div>

      <table className="w-full min-w-[700px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-4 text-left">Name</th>
            <th className="p-4 text-left">Email</th>
            <th className="p-4 text-left">Phone</th>
            <th className="p-4 text-left">Tags</th>
            <th className="p-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="p-4">{c.name}</td>
              <td className="p-4">{c.email}</td>
              <td className="p-4">{c.phone}</td>
              <td className="p-4">
                {c.tags?.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-1 mr-1 text-sm bg-blue-100 text-blue-700 rounded-full"
                  >
                    {t.name}
                  </span>
                ))}
              </td>
              <td className="p-4 space-x-3">
                <button
                  onClick={() => onEdit(c)}
                  className="text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ContactsTable;
