import React, { useState, useEffect } from 'react';
import { useNavigate ,Link} from 'react-router-dom'; // <-- AÑADE ESTO

interface LoginFormData {
    email: string;
    password: string;
    rememberMe: boolean;
}

interface LoginFormErrors {
    email?: string;
    password?: string;
}

// Interface para la respuesta del backend
interface LoginResponse {
    access_token: string;
    user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        company_id: string;
    };
}

// Textos para ambos idiomas
const translations = {
    en: {
        title: "Welcome to Omni-Notify",
        subtitle: "Sign in to your account",
        description: "Intelligent notification and management platform",
        email: "Email Address",
        emailPlaceholder: "you@example.com",
        password: "Password",
        forgotPassword: "Forgot your password?",
        passwordPlaceholder: "••••••••",
        rememberMe: "Remember me",
        signIn: "Sign In",
        processing: "Processing...",
        noAccount: "Don't have an account?",
        registerHere: "Register here",
        socialLogin: "Sign in with",
        requiredEmail: "Email is required",
        invalidEmail: "Invalid email",
        requiredPassword: "Password is required",
        minPassword: "Minimum 6 characters",
        welcome: "Welcome",
        loginError: "Login error",
        loginSuccess: "Login successful! Redirecting...",
        language: "English",
        switchTo: "Switch to Spanish",
        apiError: "Error connecting to server",
        invalidCredentials: "Invalid email or password",
        debugInfo: "Debug Info:"
    },
    es: {
        title: "Bienvenid@ a Omni-Notify",
        subtitle: "Inicia sesión en tu cuenta",
        description: "Plataforma de notificaciones y gestión inteligente",
        email: "Correo Electrónico",
        emailPlaceholder: "tu@email.com",
        password: "Contraseña",
        forgotPassword: "¿Olvidaste tu contraseña?",
        passwordPlaceholder: "••••••••",
        rememberMe: "Recordarme",
        signIn: "Iniciar Sesión",
        processing: "Procesando...",
        noAccount: "¿No tienes una cuenta?",
        registerHere: "Regístrate aquí",
        socialLogin: "Iniciar sesión con",
        requiredEmail: "El email es requerido",
        invalidEmail: "Email no válido",
        requiredPassword: "La contraseña es requerida",
        minPassword: "Mínimo 6 caracteres",
        welcome: "¡Bienvenido",
        loginError: "Error al iniciar sesión",
        loginSuccess: "¡Inicio de sesión exitoso! Redirigiendo...",
        language: "Español",
        switchTo: "Cambiar a Inglés",
        apiError: "Error al conectar con el servidor",
        invalidCredentials: "Email o contraseña incorrectos",
        debugInfo: "Información de Depuración:"
    }
};

type Language = 'en' | 'es';

// URL de tu backend - usa variables de entorno
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Detectar si estamos en desarrollo
const IS_DEVELOPMENT =
  import.meta.env.MODE === 'development' ||
  window.location.hostname === 'localhost';


const LoginForm: React.FC = () => {
    const navigate = useNavigate(); // <-- AÑADE ESTO
    
    const [language, setLanguage] = useState<Language>('en');
    const t = translations[language];
    
    const [formData, setFormData] = useState<LoginFormData>({
        email: '',
        password: '',
        rememberMe: false,
    });

    const [errors, setErrors] = useState<LoginFormErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginMessage, setLoginMessage] = useState<string>('');
    const [messageType, setMessageType] = useState<'success' | 'error'>('error');

    // Cargar lenguaje preferido del localStorage al iniciar
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
        const newErrors: LoginFormErrors = {};

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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginMessage('');
        if (!validateForm()) return;

        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Manejo de errores controlados del backend (401, 404, etc.)
                if (data.access_token) {
                console.warn("⚠️ Error secundario del servidor:", data.message);
                } else {
                    // Si NO hay token, entonces sí es un error de login real
                    throw new Error(data.message || t.invalidCredentials);
                }
            }

            // --- LÓGICA DE ÉXITO UNIFICADA ---
            console.log('✅ Login exitoso:', data);

            // 1. Guardar Token
            localStorage.setItem('auth_token', data.access_token);

            // 2. Guardar Usuario (con fallback por si la estructura varía)
            const userData = data.user || {
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.role,
                company_id: data.company_id
            };
            localStorage.setItem('user_data', JSON.stringify(userData));

            // 3. Recordar Email
            if (formData.rememberMe) {
                localStorage.setItem('remembered_email', formData.email);
            } else {
                localStorage.removeItem('remembered_email');
            }

            setMessageType('success');
            setLoginMessage(t.loginSuccess);

            setTimeout(() => {
                navigate('/dashboard');
            }, 1000);

        } catch (error: any) {
            console.error('❌ Error en login:', error);
            setMessageType('error');

            if (error.message === 'Failed to fetch') {
                setLoginMessage(`${t.apiError}: ${API_BASE_URL}`);
            } else {
                setLoginMessage(error.message || t.loginError);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));

        // Limpiar error cuando el usuario empieza a escribir
        if (errors[name as keyof LoginFormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
        
        // Limpiar mensajes
        if (loginMessage) {
            setLoginMessage('');
        }
    };

    // Cargar email guardado si existe
    useEffect(() => {
        const rememberedEmail = localStorage.getItem('remembered_email');
        if (rememberedEmail) {
            setFormData(prev => ({
                ...prev,
                email: rememberedEmail,
                rememberMe: true
            }));
        }
    }, []);

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
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center">
                        <h1 className="text-3xl font-bold text-white mb-2">{t.title}</h1>
                        <p className="text-blue-100">{t.subtitle}</p>
                        <p className="text-blue-100 text-sm mt-1">
                            {t.description}
                        </p>
                    </div>

                    {/* Formulario */}
                    <div className="p-8">
                        {/* Mensaje de éxito/error */}
                        {loginMessage && (
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
                                        {messageType === 'success' ? t.loginSuccess.split('!')[0] + '!' : t.loginError}:
                                    </span>
                                </div>
                                <p className="mt-1 text-sm">{loginMessage}</p>
                                {messageType === 'error' && (
                                    <p className="mt-2 text-xs opacity-75">
                                        Backend URL: {API_BASE_URL}
                                    </p>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">

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
                                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
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
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                        {t.password}
                                    </label>
                                    <a href="#" className="text-sm text-blue-600 hover:text-blue-800 transition">
                                        {t.forgotPassword}
                                    </a>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-3 rounded-lg border ${errors.password ? 'border-red-500' : 'border-gray-300'
                                            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-12`}
                                        placeholder={t.passwordPlaceholder}
                                        disabled={isLoading}
                                        autoComplete="current-password"
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

                            {/* Remember Me & Submit */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="rememberMe"
                                        name="rememberMe"
                                        checked={formData.rememberMe}
                                        onChange={handleChange}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                        disabled={isLoading}
                                    />
                                    <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
                                        {t.rememberMe}
                                    </label>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${isLoading
                                        ? 'bg-blue-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                                    }`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {t.processing}
                                    </span>
                                ) : (
                                    t.signIn
                                )}
                            </button>
                        </form>

                        {/* Register Link */}
                        <div className="mt-8 text-center">
                            <p className="text-gray-600">
                                {t.noAccount}{' '}
                                <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-800 transition">
                                    {t.registerHere}
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;