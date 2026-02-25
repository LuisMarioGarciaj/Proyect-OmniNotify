// src/pages/CompanyPage.tsx (FRONTEND)
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Save, Building, Loader2, Info } from 'lucide-react';
import { getCompany, updateCompany } from '../../services/company.service';

interface CompanyPageProps {
  user: {
    company_id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

const CompanyPage: React.FC<CompanyPageProps> = ({ user }) => {
  const [name, setName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [logoB64, setLogoB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error'|'info' } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);

  // Cargar datos de la empresa
  useEffect(() => {
    const fetchCompanyData = async () => {
      // Obtener company_id del localStorage (prioridad) o del prop
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      const companyIdToUse = userData.company_id || user?.company_id;
      
      if (!companyIdToUse) {
        console.error('❌ No se encontró company_id');
        setMessage({
          text: 'Error: No se encontró el ID de la empresa',
          type: 'error'
        });
        setFetching(false);
        return;
      }
      
      console.log('🔍 Cargando empresa con ID:', companyIdToUse);
      console.log('👤 Datos del usuario:', userData);
      
      try {
        const data = await getCompany(companyIdToUse);
        console.log('✅ Datos de empresa recibidos:', data);
        
        setName(data.name || '');
        setInitialName(data.name || '');
        setLogoB64(data.logo || null);
        
        // Mostrar mensaje si la empresa tiene nombre por defecto
        if (data.name && data.name.includes('Empresa de')) {
          setMessage({
            text: 'Tu empresa fue creada automáticamente. ¡Personaliza el nombre y logo!',
            type: 'info'
          });
        }
      } catch (error: any) {
        console.error('❌ Error al cargar empresa:', error);
        
        // Si es 404, la empresa aún no existe
        if (error.message?.includes('404') || error.response?.status === 404) {
          setName('Mi Empresa');
          setMessage({
            text: 'Configura el nombre y logo de tu empresa para comenzar.',
            type: 'info'
          });
        } else {
          setMessage({
            text: 'Error al cargar los datos de la empresa',
            type: 'error'
          });
        }
      } finally {
        setFetching(false);
      }
    };

    fetchCompanyData();
  }, [user]);

  // Manejar el Dropzone para imágenes
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    // Validar tamaño (2MB)
    if (file.size > 2000000) {
      setMessage({
        text: "La imagen es muy pesada (máximo 2MB)",
        type: 'error'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoB64(reader.result as string);
      setMessage({
        text: "Logo cargado correctamente. ¡No olvides guardar los cambios!",
        type: 'success'
      });
    };
    reader.onerror = () => {
      setMessage({
        text: "Error al leer el archivo",
        type: 'error'
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {'image/*': ['.jpeg', '.png', '.jpg', '.gif']},
    maxSize: 2000000, // 2MB
    multiple: false 
  });

  // Guardar cambios
  const handleSave = async () => {
    // Obtener company_id del localStorage
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const companyIdToUse = userData.company_id || user?.company_id;
    
    if (!companyIdToUse) {
      setMessage({
        text: 'No se encontró el ID de la empresa',
        type: 'error'
      });
      return;
    }

    if (!name.trim()) {
      setMessage({
        text: 'El nombre de la empresa es requerido',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateCompany(companyIdToUse, { 
        name: name.trim(), 
        logo: logoB64 || undefined 
      });
      
      console.log('✅ Empresa actualizada:', updated);
      
      setInitialName(name.trim());
      setMessage({
        text: '✅ Configuración guardada correctamente',
        type: 'success'
      });
      
      // Actualizar el nombre en localStorage
      const currentUserData = JSON.parse(localStorage.getItem('user_data') || '{}');
      currentUserData.company_name = name.trim();
      localStorage.setItem('user_data', JSON.stringify(currentUserData));
      
    } catch (error: any) {
      console.error('❌ Error al guardar:', error);
      setMessage({
        text: '❌ Error: ' + (error.message || 'Error al guardar'),
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setName(initialName);
    setIsEditingName(false);
  };

  if (fetching) {
    return (
      <div className="p-20 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-2" size={40} />
        <p className="text-gray-500 animate-pulse">Cargando datos de la organización...</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Building className="text-blue-600" /> Mi Organización
        </h1>
        <p className="text-gray-500">Gestiona el nombre y la identidad visual que verán tus clientes.</p>
      </div>

      {/* Mensaje de estado */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' 
          ? 'bg-green-50 text-green-800 border border-green-200' 
          : message.type === 'error'
          ? 'bg-red-50 text-red-800 border border-red-200'
          : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : message.type === 'error' ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <Info className="w-5 h-5 mr-2" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Panel Izquierdo: Formulario */}
        <div className="md:col-span-2 space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">Nombre Comercial</label>
              {name !== initialName && (
                <button
                  onClick={handleCancelEdit}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              )}
            </div>
            <input 
              type="text" 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value !== initialName) {
                  setIsEditingName(true);
                }
              }}
              placeholder="Ej. Mi Negocio S.A."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              Este nombre aparecerá en las notificaciones que envíes a tus clientes.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Logo de la Empresa</label>
            <div 
              {...getRootProps()} 
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center">
                <Upload className={`mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} size={40} />
                <p className="text-gray-600 font-medium text-sm lg:text-base">
                  {isDragActive ? 'Suelta la imagen aquí' : 'Arrastra tu logo aquí o haz clic'}
                </p>
                <p className="text-xs text-gray-400 mt-2 italic">Recomendado: PNG o JPG cuadrado (Máx. 2MB)</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleSave}
              disabled={loading || (!name.trim()) || (name === initialName && !logoB64)}
              className={`w-full ${(name.trim() && (name !== initialName || logoB64)) 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-400 cursor-not-allowed'} text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:shadow-none`}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {name === initialName && !logoB64 ? 'Sin cambios para guardar' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Panel Derecho: Vista Previa */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 ml-1">Vista Previa</h3>
          <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
            <div className="w-32 h-32 bg-gray-50 rounded-xl shadow-inner mb-4 flex items-center justify-center overflow-hidden border border-gray-100">
              {logoB64 ? (
                <img src={logoB64} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center">
                  <Building size={48} className="text-gray-200" />
                  <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Sin Logo</span>
                </div>
              )}
            </div>
            <h4 className="text-lg font-bold text-gray-800 break-words w-full">
              {name || 'Nombre Empresa'}
            </h4>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                Organización Activa
              </span>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Nota:</strong> Este logo aparecerá en el encabezado de tus notificaciones y en tu panel principal.
            </p>
          </div>

          {/* Información de la empresa */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Información del Sistema</h4>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>ID de Empresa:</span>
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {(() => {
                    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
                    const companyId = userData.company_id || user?.company_id;
                    return companyId ? companyId.substring(0, 8) + '...' : 'No disponible';
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Creado por:</span>
                <span className="font-medium">{user?.name || 'Usuario'}</span>
              </div>
              <div className="flex justify-between">
                <span>Rol:</span>
                <span className={`px-2 py-0.5 rounded-full ${user?.role === 'ADMIN' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'}`}>
                  {user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Nombre empresa:</span>
                <span className="font-medium text-green-600">{name || 'No disponible'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;