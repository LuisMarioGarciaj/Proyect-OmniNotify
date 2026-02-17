import React, { useState } from 'react';
import type { Contact } from '../../types/contact';
import type { Tag } from '../../types/tag';
import { deleteContact } from '../../services/contacts.service';
import TagsModal from './TagsModal';

interface Props {
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (contact: Contact) => void;
  onRefresh: () => void;
}

const MAX_VISIBLE_TAGS = 2;

const ContactsTable: React.FC<Props> = ({
  contacts,
  onAdd,
  onEdit,
  onRefresh,
}) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactName, setContactName] = useState<string | undefined>();

  const handleDelete = async (id: string) => {
    if (confirm('Delete contact?')) {
      await deleteContact(id);
      onRefresh();
    }
  };

  const openTagsModal = (tags: Tag[], name?: string) => {
    setSelectedTags(tags);
    setContactName(name);
    setModalOpen(true);
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-semibold">Contacts</h2>
          <button
            onClick={onAdd}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-white"
          >
            + Add Contact
          </button>
        </div>

        <table className="min-w-[700px] w-full">
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
            {contacts.map(contact => {
              const tags = (contact.tags as Tag[]) ?? [];
              const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
              const hiddenCount = tags.length - visibleTags.length;

              return (
                <tr
                  key={contact.id}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="p-4">{contact.name}</td>
                  <td className="p-4">{contact.email}</td>
                  <td className="p-4">{contact.phone}</td>

                  {/* TAGS */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {visibleTags.map(tag => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
                        >
                          {tag.name}
                        </span>
                      ))}

                      {hiddenCount > 0 && (
                        <button
                          onClick={() =>
                            openTagsModal(tags, contact.name)
                          }
                          className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                        >
                          +{hiddenCount}
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="space-x-3 p-4">
                    <button
                      onClick={() => onEdit(contact)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      <TagsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tags={selectedTags}
        contactName={contactName}
      />
    </>
  );
};

export default ContactsTable;
