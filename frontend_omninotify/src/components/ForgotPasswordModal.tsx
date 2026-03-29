import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: 'en' | 'es';
}

const translations = {
  en: {
    title: 'Forgot Password',
    description: 'Enter your email address and we\'ll send you a link to reset your password.',
    email: 'Email Address',
    emailPlaceholder: 'you@example.com',
    send: 'Send Reset Link',
    sending: 'Sending...',
    success: 'If an account exists with that email, you will receive a password reset link.',
    error: 'An error occurred. Please try again.',
    close: 'Close',
  },
  es: {
    title: '¿Olvidaste tu contraseña?',
    description: 'Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.',
    email: 'Correo Electrónico',
    emailPlaceholder: 'tu@email.com',
    send: 'Enviar enlace',
    sending: 'Enviando...',
    success: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.',
    error: 'Ocurrió un error. Por favor intenta de nuevo.',
    close: 'Cerrar',
  },
};

// 👈 IMPORTANTE: Asegúrate de que el componente esté definido con "const" y exportado al final
const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  language = 'es',
}) => {
  const t = translations[language];
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setMessage({ type: 'success', text: t.success });
      setEmail('');
    } catch (error: any) {
      console.error('Error sending reset link:', error);
      setMessage({ type: 'error', text: t.error });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition"
          >
            <X size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">{t.title}</h2>
          <p className="text-blue-100 text-sm mt-1">{t.description}</p>
        </div>

        {/* Form */}
        <div className="p-6">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                {t.email}
              </label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder={t.emailPlaceholder}
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {isLoading ? t.sending : t.send}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm transition"
            >
              {t.close}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// 👈 EXPORTACIÓN CORRECTA como default
export default ForgotPasswordModal;