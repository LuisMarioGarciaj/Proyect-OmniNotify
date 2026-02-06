import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Save, Building, Loader2 } from 'lucide-react';
import { getCompany, updateCompany } from '../../services/company.service';

interface CompanyPageProps {
  user: {
    company_id?: string;
    name?: string;
    email?: string;
  } | null;
}

const CompanyPage: React.FC<CompanyPageProps> = ({ user }) => {
  const [name, setName] = useState('');
  const [logoB64, setLogoB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // 1. Cargar datos usando el Service (estilo fetch)
  // 1. Cargar datos con manejo de "Empresa no encontrada"
useEffect(() => {
  const fetchCompanyData = async () => {
    if (!user?.company_id) {
      setFetching(false);
      return;
    }
    
    try {
      const data = await getCompany(user.company_id);
      setName(data.name || '');
      setLogoB64(data.logo || null);
    } catch (error: any) {
      // SI EL ERROR ES 404, NO LANZAMOS ALERT, SOLO LOGUEAMOS
      if (error.message.includes('404')) {
        console.warn('ℹ️ La empresa no existe aún. Puedes crearla ahora.');
      } else {
        console.error('Error al cargar datos:', error.message);
      }
    } finally {
      setFetching(false);
    }
  };

  fetchCompanyData();
}, [user?.company_id]);

  // 2. Manejar el Dropzone (Imagen a Base64)
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    // Validar tamaño (2MB)
    if (file.size > 2000000) {
      alert("La imagen es muy pesada (máx 2MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoB64(reader.result as string);
    };
    reader.onerror = () => {
      alert("Error al leer el archivo");
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {'image/*': ['.jpeg', '.png', '.jpg']},
    multiple: false 
  });

  // 3. Guardar cambios usando el Service
  const handleSave = async () => {
    if (!user?.company_id) {
      alert('No se encontró el ID de la empresa');
      return;
    }

    setLoading(true);
    try {
      await updateCompany(user.company_id, { 
        name, 
        logo: logoB64 || undefined 
      });
      alert('✅ Configuración guardada correctamente');
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Panel Izquierdo: Formulario */}
        <div className="md:col-span-2 space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre Comercial</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mi Negocio S.A."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition outline-none"
            />
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
              disabled={loading || !name}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              Guardar Cambios
            </button>
          </div>
        </div>

        {/* Panel Derecho: Vista Previa Realtime */}
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
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;