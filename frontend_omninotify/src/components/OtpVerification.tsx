import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, RefreshCw, ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface OtpVerificationProps {
  userId: string;
  email: string;
  onBack: () => void;
}

const OtpVerification: React.FC<OtpVerificationProps> = ({ userId, email, onBack }) => {
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(300); // 5 min
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newDigits.every(d => d !== '')) {
      handleVerify(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length !== 6 || countdown === 0) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Código inválido');

      // Guardar sesión — mismo flujo que el login normal
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user_data', JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        company_id: data.user.company_id,
        company_name: data.user.company_name || '',
      }));

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Código inválido o expirado');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">¡Bienvenid@ a Omni-Notify!</h1>
          <p className="text-green-100 text-sm">Verifica tu cuenta para continuar</p>
        </div>

        <div className="p-8">
          {/* Indicador de email */}
          <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4 mb-6 border border-green-100">
            <Mail size={18} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Código enviado a:</p>
              <p className="text-sm text-green-600 font-mono">{maskedEmail}</p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mb-6">
            Revisa tu correo, incluyendo la carpeta de spam
          </p>

          {/* Inputs OTP */}
          <div className="flex gap-3 justify-center mb-2" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={isLoading || countdown === 0}
                className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all
                  ${digit ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-800'}
                  ${error ? 'border-red-400 bg-red-50' : ''}
                  focus:border-green-500 focus:ring-2 focus:ring-green-100
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-center text-sm text-red-600 mt-2 mb-2 font-medium">{error}</p>
          )}

          {/* Countdown */}
          <div className="text-center mt-3 mb-6">
            {countdown > 0 ? (
              <p className="text-sm text-gray-500">
                Código válido por{' '}
                <span className={`font-bold tabular-nums ${countdown < 60 ? 'text-red-500' : 'text-gray-700'}`}>
                  {formatTime(countdown)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-red-500 font-medium">
                El código expiró. Vuelve al login para recibir uno nuevo.
              </p>
            )}
          </div>

          {/* Botón verificar */}
          <button
            onClick={() => handleVerify(digits.join(''))}
            disabled={digits.some(d => !d) || isLoading || countdown === 0}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-300 
                       text-white font-semibold rounded-xl transition-all mb-3"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" />
                Verificando...
              </span>
            ) : (
              'Verificar y entrar'
            )}
          </button>

          {/* Volver */}
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 py-3 
                       text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default OtpVerification;