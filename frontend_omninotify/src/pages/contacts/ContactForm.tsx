import React, { useState, useEffect } from 'react';
import type { Contact } from '../../types/contact';
import type { Tag } from '../../types/tag';
import { createContact, updateContact, HttpError } from '../../services/contacts.service';
import { tagsService } from '../../services/tags.service';
import { X, Tag as TagIcon, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  contact?: Contact | null;
  companyId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const ContactForm: React.FC<Props> = ({ contact, companyId, onCancel, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    tagIds: contact?.tags?.map((t) => t.id) || ([] as string[]),
  });

  const filteredTags = availableTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  useEffect(() => {
    tagsService
      .getAll()
      .then(setAvailableTags)
      .catch((err) => console.error('Error loading tags:', err));
  }, [companyId]);

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      if (contact) {
        await updateContact(contact.id, form);
      } else {
        await createContact(companyId, form);
      }
      onSuccess();
    } catch (error: unknown) {
      // HttpError (from contacts.service.ts) already has the parsed message
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again.';
      setErrorMessage(message);
      console.error('Error saving contact:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTagObjects = availableTags.filter((t) =>
    form.tagIds.includes(t.id),
  );

  return (
    <div className="max-w-xl bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">
        {contact ? 'Edit Contact' : 'Add New Contact'}
      </h2>

      {/* Error banner */}
      {errorMessage && (
        <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Email
          </label>
          <input
            className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition ${
              errorMessage && errorMessage.toLowerCase().includes('email')
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200'
            }`}
            placeholder="email@example.com"
            type="email"
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value });
              if (errorMessage) setErrorMessage(null);
            }}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Phone
          </label>
          <input
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="+1 555 000 0000"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        {/* Tags picker */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide flex items-center gap-1">
            <TagIcon size={13} />
            Labels
          </label>

          {/* Selected tags preview */}
          {selectedTagObjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedTagObjects.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-600 text-white text-xs font-medium px-2.5 py-1"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="hover:text-blue-200 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            placeholder="Search tags…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl mb-2 focus:ring-2 focus:ring-blue-500 outline-none transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Tag list */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 border border-dashed border-gray-200 rounded-xl bg-gray-50">
            {availableTags.length === 0 && (
              <p className="text-xs text-gray-400 w-full text-center py-2">
                No tags available. Create some in Tags Management.
              </p>
            )}
            {filteredTags.length === 0 && availableTags.length > 0 && (
              <p className="text-xs text-gray-400 w-full text-center py-2">
                No tags match "{searchTerm}".
              </p>
            )}
            {filteredTags.map((tag) => {
              const isSelected = form.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {isSelected ? <CheckCircle2 size={12} className="text-blue-500" /> : null}
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {submitting && (
              <span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {contact ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;