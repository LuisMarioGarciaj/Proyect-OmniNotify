// src/components/EmailVerification.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';

interface EmailVerificationProps {
  userId: string;
  email: string;
  onBack?: () => void;
  onVerificationSuccess?: () => void; // 🔥 NUEVO: Callback opcional
  redirectAfterSuccess?: boolean; // 🔥 NUEVO: Controlar si redirige automáticamente
}

const translations = {
  en: {
    title: 'Verify Your Email',
    subtitle: 'We sent a verification code to',
    codeSent: 'Code sent to',
    codePlaceholder: 'Enter 6-digit code',
    verify: 'Verify Account',
    verifying: 'Verifying...',
    resend: 'Resend Code',
    resending: 'Sending...',
    success: 'Email verified successfully!',
    error: 'Invalid or expired code',
    resendSuccess: 'New code sent!',
    resendError: 'Error sending code. Try again.',
    didntReceive: "Didn't receive the code?",
    checkSpam: "Check your spam folder",
    backToLogin: "Back to Login"
  },
  es: {
    title: 'Verifica tu Correo',
    subtitle: 'Enviamos un código de verificación a',
    codeSent: 'Código enviado a',
    codePlaceholder: 'Ingresa el código de 6 dígitos',
    verify: 'Verificar Cuenta',
    verifying: 'Verificando...',
    resend: 'Reenviar Código',
    resending: 'Enviando...',
    success: '¡Correo verificado exitosamente!',
    error: 'Código inválido o expirado',
    resendSuccess: '¡Nuevo código enviado!',
    resendError: 'Error al enviar el código. Intenta de nuevo.',
    didntReceive: '¿No recibiste el código?',
    checkSpam: 'Revisa tu carpeta de spam',
    backToLogin: "Volver al Login"
  }
};

type Language = 'en' | 'es';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const EmailVerification: React.FC<EmailVerificationProps> = ({ 
  userId, 
  email, 
  onBack, 
  onVerificationSuccess,
  redirectAfterSuccess = true 
}) => {
  const navigate = useNavigate();
  
  const [language, setLanguage] = useState<Language>('es');
  const t = translations[language];
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'es')) {
      setLanguage(savedLanguage);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const firstInput = document.getElementById('code-0');
      if (firstInput) (firstInput as HTMLInputElement).focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;
    if (value.length > 1) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
    
    if (message) setMessage(null);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) (prevInput as HTMLInputElement).focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedNumbers = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (pastedNumbers) {
      const newCode = [...code];
      for (let i = 0; i < pastedNumbers.length; i++) {
        newCode[i] = pastedNumbers[i];
      }
      setCode(newCode);
      
      const nextIndex = Math.min(pastedNumbers.length, 5);
      const nextInput = document.getElementById(`code-${nextIndex}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setMessage({ 
        type: 'error', 
        text: language === 'es' ? 'Ingresa el código de 6 dígitos' : 'Enter the 6-digit code' 
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ userId, code: fullCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t.error);
      }

      setMessage({ type: 'success', text: t.success });
      
      // 🔥 Si hay un callback de éxito, ejecutarlo
      if (onVerificationSuccess) {
        setTimeout(() => {
          onVerificationSuccess();
        }, 2000);
      } 
      // Si no hay callback pero redirectAfterSuccess está activo, redirigir al login
      else if (redirectAfterSuccess) {
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              verifiedEmail: email,
              message: language === 'es' ? 'Cuenta verificada. Ya puedes iniciar sesión.' : 'Account verified. You can now log in.'
            }
          });
        }, 2000);
      }
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t.error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setIsResending(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/users/resend-verification/${userId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || t.resendError);
      }

      setMessage({ type: 'success', text: t.resendSuccess });
      setCountdown(60);
      setCode(['', '', '', '', '', '']);
      
      const firstInput = document.getElementById('code-0');
      if (firstInput) (firstInput as HTMLInputElement).focus();
      
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || t.resendError });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full flex justify-center">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center">
            <div className="flex justify-center mb-4">
              <Mail className="w-16 h-16 text-white opacity-90" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-blue-100">{t.subtitle}</p>
            <p className="text-blue-200 text-sm font-mono mt-1 break-all">{email}</p>
          </div>

          {/* Form */}
          <div className="p-8">
            {message && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}

            <div className="text-center mb-6">
              <p className="text-gray-600 text-sm">{t.codeSent}</p>
              <p className="text-gray-800 font-medium mt-1">{email}</p>
            </div>

            {/* 6-digit code inputs */}
            <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  disabled={isLoading}
                  autoComplete="off"
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all mb-4 ${
                isLoading
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin w-5 h-5" />
                  {t.verifying}
                </span>
              ) : (
                t.verify
              )}
            </button>

            {/* Resend section */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">{t.didntReceive}</p>
              <button
                onClick={handleResend}
                disabled={isResending || countdown > 0}
                className={`text-sm font-medium transition ${
                  isResending || countdown > 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-800'
                }`}
              >
                {isResending ? (
                  <span className="flex items-center justify-center gap-1">
                    <Loader2 className="animate-spin w-4 h-4" />
                    {t.resending}
                  </span>
                ) : countdown > 0 ? (
                  `Reenviar en ${countdown}s`
                ) : (
                  t.resend
                )}
              </button>
              <p className="text-xs text-gray-400 mt-3">{t.checkSpam}</p>
            </div>

            {/* Back to login */}
            <div className="mt-8 text-center">
              <button
                onClick={onBack || (() => navigate('/login'))}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.backToLogin}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;