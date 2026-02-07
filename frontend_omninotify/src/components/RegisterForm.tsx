import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Building, Loader2 } from 'lucide-react';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

interface RegisterFormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const translations = {
  en: {
    title: "Create your Omni-Notify account",
    subtitle: "Start managing your notifications",
    name: "Full Name",
    namePlaceholder: "John Doe",
    email: "Email Address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "••••••••",
    role: "Account Type",
    roleAdmin: "Administrator",
    roleOperator: "Operator",
    roleDescriptionAdmin: "Full access to all features",
    roleDescriptionOperator: "Limited access for daily operations",
    companyNote: "A company will be automatically created for you",
    signUp: "Create Account",
    processing: "Creating account...",
    haveAccount: "Already have an account?",
    loginHere: "Login here",
    requiredName: "Name is required",
    requiredEmail: "Email is required",
    invalidEmail: "Invalid email",
    requiredPassword: "Password is required",
    minPassword: "Minimum 6 characters",
    passwordsNotMatch: "Passwords do not match",
    registrationSuccess: "Registration successful! Redirecting...",
    registrationError: "Registration error",
    language: "English",
    switchTo: "Switch to Spanish",
    companyAutoCreate: "Your company will be created automatically"
  },
  es: {
    title: "Crea tu cuenta en Omni-Notify",
    subtitle: "Comienza a gestionar tus notificaciones",
    name: "Nombre Completo",
    namePlaceholder: "Juan Pérez",
    email: "Correo Electrónico",
    emailPlaceholder: "tu@email.com",
    password: "Contraseña",
    passwordPlaceholder: "••••••••",
    confirmPassword: "Confirmar Contraseña",
    confirmPasswordPlaceholder: "••••••••",
    role: "Tipo de Cuenta",
    roleAdmin: "Administrador",
    roleOperator: "Operador",
    roleDescriptionAdmin: "Acceso completo a todas las funciones",
    roleDescriptionOperator: "Acceso limitado para operaciones diarias",
    companyNote: "Una empresa será creada automáticamente para ti",
    signUp: "Crear Cuenta",
    processing: "Creando cuenta...",
    haveAccount: "¿Ya tienes una cuenta?",
    loginHere: "Inicia sesión aquí",
    requiredName: "El nombre es requerido",
    requiredEmail: "El email es requerido",
    invalidEmail: "Email no válido",
    requiredPassword: "La contraseña es requerida",
    minPassword: "Mínimo 6 caracteres",
    passwordsNotMatch: "Las contraseñas no coinciden",
    registrationSuccess: "¡Registro exitoso! Redirigiendo...",
    registrationError: "Error en el registro",
    language: "Español",
    switchTo: "Cambiar a Inglés",
    companyAutoCreate: "Tu empresa será creada automáticamente"
  }
};

type Language = 'en' | 'es';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  
  const [language, setLanguage] = useState<Language>('es');
  const t = translations[language];
  
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'OPERATOR',
  });

  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('error');

  // Cargar lenguaje preferido
  useEffect(() => {
    const savedLanguage = localStorage.getItem('preferredLanguage') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'es')) {
      setLanguage(savedLanguage);
    }
  }, []);

  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'es' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('preferredLanguage', newLanguage);
  };

  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    // Validación de nombre
    if (!formData.name.trim()) {
      newErrors.name = t.requiredName;
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = t.requiredEmail;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = t.invalidEmail;
    }

    // Validación de password
    if (!formData.password) {
      newErrors.password = t.requiredPassword;
    } else if (formData.password.length < 6) {
      newErrors.password = t.minPassword;
    }

    // Validación de confirmación
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t.requiredPassword;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t.passwordsNotMatch;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || t.registrationError);
      }

      // Registro exitoso
      console.log('✅ Registro exitoso:', data);

      // Guardar datos del usuario (sin password)
      const { password, ...userWithoutPassword } = data;
      
      // Mostrar mensaje de éxito
      setMessageType('success');
      setMessage(t.registrationSuccess);

      // Esperar un momento y redirigir al login
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            registeredEmail: formData.email,
            message: 'Registration successful! Please login.' 
          }
        });
      }, 2000);

    } catch (error: any) {
      console.error('❌ Error en registro:', error);
      setMessageType('error');
      
      if (error.message.includes('already registered') || error.message.includes('ya está registrado')) {
        setMessage(language === 'es' ? 'Este correo electrónico ya está registrado' : 'This email is already registered');
      } else if (error.message === 'Failed to fetch') {
        setMessage(language === 'es' 
          ? `Error conectando con el servidor: ${API_BASE_URL}`
          : `Error connecting to server: ${API_BASE_URL}`
        );
      } else {
        setMessage(error.message || t.registrationError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Limpiar error cuando el usuario empieza a escribir
    if (errors[name as keyof RegisterFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
    
    // Limpiar mensajes
    if (message) {
      setMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full flex justify-center">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">

          {/* Language Switcher Button */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
              title={t.switchTo}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              <span className="font-medium">{t.language}</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                {language === 'en' ? 'ES' : 'EN'}
              </span>
            </button>
          </div>

          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
            <p className="text-green-100">{t.subtitle}</p>
            <div className="mt-4 flex items-center justify-center gap-2 text-green-200 text-sm">
              <Building size={18} />
              <span>{t.companyAutoCreate}</span>
            </div>
          </div>

          {/* Formulario */}
          <div className="p-8">
            {/* Mensaje de éxito/error */}
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${messageType === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <div className="flex items-center">
                  {messageType === 'success' ? (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className="font-medium">
                    {messageType === 'success' ? t.registrationSuccess.split('!')[0] + '!' : t.registrationError}:
                  </span>
                </div>
                <p className="mt-1 text-sm">{message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.name}
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border ${errors.name ? 'border-red-500' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition`}
                  placeholder={t.namePlaceholder}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.email}
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg border ${errors.email ? 'border-red-500' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition`}
                  placeholder={t.emailPlaceholder}
                  disabled={isLoading}
                  autoComplete="username"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.password}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-lg border ${errors.password ? 'border-red-500' : 'border-gray-300'
                      } focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition pr-12`}
                    placeholder={t.passwordPlaceholder}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t.confirmPassword}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 rounded-lg border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                      } focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition pr-12`}
                    placeholder={t.confirmPasswordPlaceholder}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  {t.role}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`relative border rounded-xl p-4 cursor-pointer transition-all ${formData.role === 'ADMIN' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => !isLoading && setFormData(prev => ({ ...prev, role: 'ADMIN' }))}
                  >
                    <input
                      type="radio"
                      id="roleAdmin"
                      name="role"
                      value="ADMIN"
                      checked={formData.role === 'ADMIN'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mb-2 ${formData.role === 'ADMIN' 
                        ? 'border-green-500 bg-green-500' 
                        : 'border-gray-300'}`}
                      >
                        {formData.role === 'ADMIN' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <span className="font-semibold text-gray-800">{t.roleAdmin}</span>
                      <span className="text-xs text-gray-500 mt-1">{t.roleDescriptionAdmin}</span>
                    </div>
                  </div>

                  <div className={`relative border rounded-xl p-4 cursor-pointer transition-all ${formData.role === 'OPERATOR' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'}`}
                    onClick={() => !isLoading && setFormData(prev => ({ ...prev, role: 'OPERATOR' }))}
                  >
                    <input
                      type="radio"
                      id="roleOperator"
                      name="role"
                      value="OPERATOR"
                      checked={formData.role === 'OPERATOR'}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mb-2 ${formData.role === 'OPERATOR' 
                        ? 'border-green-500 bg-green-500' 
                        : 'border-gray-300'}`}
                      >
                        {formData.role === 'OPERATOR' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                        )}
                      </div>
                      <span className="font-semibold text-gray-800">{t.roleOperator}</span>
                      <span className="text-xs text-gray-500 mt-1">{t.roleDescriptionOperator}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Info */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-start gap-3">
                  <Building className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-sm text-blue-800 font-medium">{t.companyNote}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {language === 'es' 
                        ? 'Podrás personalizar el nombre y logo después desde la sección "Mi Organización"'
                        : 'You can customize the name and logo later from the "My Organization" section'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${isLoading
                    ? 'bg-green-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 active:scale-[0.98]'
                  }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin h-5 w-5 mr-3 text-white" />
                    {t.processing}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <UserPlus size={20} />
                    {t.signUp}
                  </span>
                )}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-8 text-center">
              <p className="text-gray-600">
                {t.haveAccount}{' '}
                <Link to="/login" className="text-green-600 font-semibold hover:text-green-800 transition">
                  {t.loginHere}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;