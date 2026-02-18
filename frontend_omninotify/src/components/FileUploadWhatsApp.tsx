import React, { useState, useCallback } from 'react';
import { Upload, X, File, Image, Video, FileText, Music } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (fileUrl: string, fileType: 'image' | 'video' | 'document' | 'audio') => void;
  onFileRemove: () => void;
  currentFile: { url: string; type: string } | null;
  maxSizeMB?: number;
}

const FileUploadWhatsApp: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileRemove,
  currentFile,
  maxSizeMB = 5,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tipos de archivo permitidos por Nexo WhatsApp
  const acceptedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/3gpp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
  };

  const getFileType = (mimeType: string): 'image' | 'video' | 'document' | 'audio' | null => {
    if (acceptedTypes.image.includes(mimeType)) return 'image';
    if (acceptedTypes.video.includes(mimeType)) return 'video';
    if (acceptedTypes.document.includes(mimeType)) return 'document';
    if (acceptedTypes.audio.includes(mimeType)) return 'audio';
    return null;
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-8 h-8" />;
      case 'video': return <Video className="w-8 h-8" />;
      case 'document': return <FileText className="w-8 h-8" />;
      case 'audio': return <Music className="w-8 h-8" />;
      default: return <File className="w-8 h-8" />;
    }
  };

  const uploadToCloudinary = async (file: File): Promise<string> => {
    // ⚠️ IMPORTANTE: Reemplaza con tu propio Cloudinary preset
    // O comenta esto y usa la opción B (base64 directo)
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/upload';
    const UPLOAD_PRESET = 'YOUR_UPLOAD_PRESET';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Error subiendo archivo a Cloudinary');
    }

    const data = await response.json();
    return data.secure_url;
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remover el prefijo "data:image/png;base64," para obtener solo el base64
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      // 1. Validar tamaño
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`El archivo debe ser menor a ${maxSizeMB}MB`);
      }

      // 2. Validar tipo
      const fileType = getFileType(file.type);
      if (!fileType) {
        throw new Error('Tipo de archivo no soportado');
      }

      // ─── OPCIÓN A: Subir a Cloudinary (recomendado para archivos grandes) ───
      // Descomentar si tienes Cloudinary configurado:
      // const publicUrl = await uploadToCloudinary(file);
      // onFileSelect(publicUrl, fileType);

      // ─── OPCIÓN B: Convertir a base64 y crear data URL ───
      // (Funciona sin backend, pero el payload será grande)
      const base64Data = await convertToBase64(file);
      const dataUrl = `data:${file.type};base64,${base64Data}`;
      onFileSelect(dataUrl, fileType);

      console.log('✅ Archivo procesado:', {
        name: file.name,
        type: fileType,
        size: `${fileSizeMB.toFixed(2)}MB`,
      });
    } catch (err: any) {
      console.error('Error procesando archivo:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Adjunto WhatsApp (opcional)
      </label>

      {currentFile ? (
        // ─── Vista previa del archivo ───
        <div className="relative rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <button
            onClick={onFileRemove}
            className="absolute top-2 right-2 p-1 rounded-full bg-white shadow hover:bg-gray-100 transition-colors"
          >
            <X size={14} className="text-gray-600" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 text-emerald-600">
              {getFileIcon(currentFile.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-800">
                Archivo adjunto
              </p>
              <p className="text-xs text-emerald-600 truncate">
                Tipo: {currentFile.type}
              </p>
            </div>
          </div>

          {currentFile.type === 'image' && (
            <div className="mt-3 rounded-lg overflow-hidden border border-emerald-200">
              <img
                src={currentFile.url}
                alt="Preview"
                className="w-full h-auto max-h-48 object-contain bg-white"
              />
            </div>
          )}
        </div>
      ) : (
        // ─── Zona de upload ───
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative rounded-xl border-2 border-dashed transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <input
            type="file"
            onChange={handleInputChange}
            accept="image/*,video/mp4,video/3gpp,application/pdf,.doc,.docx,audio/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />

          <div className="p-8 text-center">
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600">Procesando archivo...</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Arrastra un archivo aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-500">
                  Imágenes, videos, documentos o audio (máx. {maxSizeMB}MB)
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        <strong>Tipos permitidos:</strong> JPG, PNG, GIF, MP4, PDF, DOC, MP3, WAV
      </p>
    </div>
  );
};

export default FileUploadWhatsApp;