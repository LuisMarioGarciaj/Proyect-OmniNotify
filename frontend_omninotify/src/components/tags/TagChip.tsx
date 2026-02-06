import React from 'react';
import { X } from 'lucide-react';

interface TagChipProps {
  label: string;
  color?: string;
  showRemove?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

const TagChip: React.FC<TagChipProps> = ({
  label,
  color,
  showRemove = true,
  onRemove,
  onClick,
  className = '',
}) => {
  // Función para generar un color basado en el texto
  const generateColor = (text: string) => {
    if (color) return color;
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
      '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
      '#6366F1', '#84CC16', '#F43F5E', '#8B5CF6',
    ];
    
    const hash = text.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return colors[hash % colors.length];
  };

  const tagColor = generateColor(label);

  return (
    <div
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium
        transition hover:opacity-90 cursor-pointer ${className}
      `}
      style={{ backgroundColor: tagColor, color: 'white' }}
    >
      <span>{label}</span>
      {showRemove && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 p-0.5 hover:bg-white/20 rounded-full transition"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default TagChip;