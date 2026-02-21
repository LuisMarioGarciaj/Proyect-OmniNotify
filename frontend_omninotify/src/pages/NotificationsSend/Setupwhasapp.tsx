import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, EyeOff, CheckCircle, AlertCircle, ArrowRight, SkipForward } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SetupWhatsApp: React.FC = () => {
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const companyId = userData.company_id;

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!token.trim()) {
      setError('El token no puede estar vacío');
      return;
    }
    if (!companyId) {
      setError('No se encontró el ID de empresa. Intenta hacer login de nuevo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/companies/${companyId}/setup-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            token: token.trim(),
            environment: 'production',
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al guardar la configuración');
      }

      // ✅ Actualizar localStorage con whatsapp_configured = true
      const updatedUserData = { ...userData, whatsapp_configured: true };
      localStorage.setItem('user_data', JSON.stringify(updatedUserData));

      setSuccess(true);

      // Redirigir al dashboard después de 1.5s
      setTimeout(() => navigate('/dashboard'), 1500);

    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Permite saltar pero el usuario no podrá enviar WhatsApp hasta configurarlo
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configurar WhatsApp</h1>
          <p className="text-emerald-100 mt-1 text-sm">
            Conecta tu cuenta de Nexo para enviar mensajes
          </p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">

          {/* Info box */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
            <p className="font-semibold mb-1">¿Dónde encuentro mi token?</p>
            <p className="text-emerald-700">
              Ingresa a tu panel de <strong>Nexo</strong> → Configuración → API Token.
              Es un UUID con el formato: <span className="font-mono bg-white px-1 rounded">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>
            </p>
          </div>

          {/* Token input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Token de Nexo API
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="15c461b4-76ac-4c71-ac98-975901a98efb"
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              ¡WhatsApp configurado! Redirigiendo al dashboard...
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSave}
              disabled={loading || success || !token.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Guardar y continuar
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </>
              )}
            </button>

            <button
              onClick={handleSkip}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-medium transition-colors"
            >
              <SkipForward className="w-4 h-4" />
              Configurar más tarde
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            Puedes cambiar esto cuando quieras desde Configuración → Proveedores
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupWhatsApp;