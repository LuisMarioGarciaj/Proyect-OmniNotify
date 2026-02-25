import React, { useState } from 'react';
import type { Contact } from '../../types/contact';
import type { Tag } from '../../types/tag';
import { deleteContact } from '../../services/contacts.service';
import TagsModal from './TagsModal';
import { Trash2, Pencil, AlertTriangle, X } from 'lucide-react';

interface Props {
  contacts: Contact[];
  onAdd: () => void;
  onEdit: (contact: Contact) => void;
  onRefresh: () => void;
}

interface DeleteModalProps {
  contact: Contact;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

// ─── Inline Delete Confirmation Modal ────────────────────────────────────────
const DeleteConfirmModal: React.FC<DeleteModalProps> = ({
  contact,
  onConfirm,
  onCancel,
  loading,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    {/* Backdrop */}
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    />

    {/* Card */}
    <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-red-400 to-rose-500" />

      <div className="p-6">
        {/* Icon + title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">
              Delete contact
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contact info card */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-800">
            {contact.name || '—'}
          </p>
          {contact.email && (
            <p className="text-xs text-gray-500 mt-0.5">{contact.email}</p>
          )}
          {contact.phone && (
            <p className="text-xs text-gray-500">{contact.phone}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
            {loading ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Table ───────────────────────────────────────────────────────────────
const MAX_VISIBLE_TAGS = 2;

const ContactsTable: React.FC<Props> = ({ contacts, onAdd, onEdit, onRefresh }) => {
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactName, setContactName] = useState<string | undefined>();

  // Delete confirmation state
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteContact(contactToDelete.id);
      onRefresh();
    } catch (err) {
      console.error('Error deleting contact:', err);
    } finally {
      setDeleteLoading(false);
      setContactToDelete(null);
    }
  };

  const openTagsModal = (tags: Tag[], name?: string) => {
    setSelectedTags(tags);
    setContactName(name);
    setModalOpen(true);
  };

  return (
    <>
      {/* ── Delete modal ── */}
      {contactToDelete && (
        <DeleteConfirmModal
          contact={contactToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setContactToDelete(null)}
          loading={deleteLoading}
        />
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-semibold">Contacts</h2>
          <button
            onClick={onAdd}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-white text-sm font-medium"
          >
            + Add Contact
          </button>
        </div>

        <table className="min-w-[700px] w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Name</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Email</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Phone</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Tags</th>
              <th className="p-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>

          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-gray-400">
                  No contacts found.
                </td>
              </tr>
            )}
            {contacts.map((contact) => {
              const tags = (contact.tags as Tag[]) ?? [];
              const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS);
              const hiddenCount = tags.length - visibleTags.length;

              return (
                <tr key={contact.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-sm font-medium text-gray-800">{contact.name}</td>
                  <td className="p-4 text-sm text-gray-600">{contact.email || '—'}</td>
                  <td className="p-4 text-sm text-gray-600">{contact.phone || '—'}</td>

                  {/* Tags */}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {visibleTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-medium"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => openTagsModal(tags, contact.name)}
                          className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300 font-medium transition-colors"
                        >
                          +{hiddenCount}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(contact)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        onClick={() => setContactToDelete(contact)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tags modal */}
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