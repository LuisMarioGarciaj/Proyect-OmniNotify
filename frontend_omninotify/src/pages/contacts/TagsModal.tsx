import React from 'react';
import type { Tag } from '../../types/tag';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  tags: Tag[];
  contactName?: string;
}

const TagsModal: React.FC<Props> = ({
  open,
  onClose,
  tags,
  contactName,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Tags – {contactName || 'Contact'}
          </h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">
            This contact has no tags.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag.id}
                className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagsModal;
