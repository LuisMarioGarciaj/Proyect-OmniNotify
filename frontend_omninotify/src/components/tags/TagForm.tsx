import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface TagFormProps {
  tag?: {
    id: string;
    name: string;
    company_id: string;
  } | null;
  onSubmit: (data: { name: string }) => void;
  onClose: () => void;
}

const TagForm: React.FC<TagFormProps> = ({ tag, onSubmit, onClose }) => {
  const [name, setName] = useState(tag?.name || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (tag) {
      setName(tag.name);
    }
  }, [tag]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Tag name is required');
      return;
    }

    if (name.length > 100) {
      setError('Tag name must be less than 100 characters');
      return;
    }

    onSubmit({ name: name.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">
            {tag ? 'Edit Tag' : 'Create New Tag'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tag Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., VIP, Newsletter, Customer..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <p className="mt-2 text-sm text-gray-500">
              Maximum 100 characters
            </p>
          </div>

          {/* Color Preview (opcional) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="flex items-center space-x-4">
              <div
                className="px-4 py-2 rounded-full text-white font-medium"
                style={{
                  backgroundColor: '#3B82F6', // Color fijo para el preview
                }}
              >
                {name || 'Your Tag'}
              </div>
              <span className="text-sm text-gray-600">
                This is how your tag will appear
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              {tag ? 'Update Tag' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TagForm;