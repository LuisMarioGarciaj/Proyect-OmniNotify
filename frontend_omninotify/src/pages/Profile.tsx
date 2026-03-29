import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, Eye, EyeOff, Check, X, AlertCircle, Loader2, Camera } from 'lucide-react';
// hfhf
interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  company_name?: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface NameErrors {
  name?: string;
}

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Solo letras (con acentos y ñ), espacios. Sin números ni caracteres especiales.
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);

  // ── Name editing ──────────────────────────────────────────────────────────
  const [nameValue, setNameValue] = useState('');
  const [nameErrors, setNameErrors] = useState<NameErrors>({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Password ──────────────────────────────────────────────────────────────
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordApiError, setPasswordApiError] = useState('');

  // ── Notification settings modal ───────────────────────────────────────────
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSMS, setNotifSMS] = useState(false);
  const [notifWhatsApp, setNotifWhatsApp] = useState(true);

  // ── Load user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem('user_data');
    if (raw) {
      try {
        const parsed: UserData = JSON.parse(raw);
        setUser(parsed);
        setNameValue(parsed.name || '');
      } catch {
        console.error('Error parsing user data');
      }
    }
  }, []);

  // ── Name validation ───────────────────────────────────────────────────────
  const validateName = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return 'El nombre es requerido';
    if (trimmed.length < 2) return 'El nombre debe tener al menos 2 caracteres';
    if (trimmed.length > 80) return 'El nombre no puede superar 80 caracteres';
    if (!NAME_REGEX.test(trimmed)) return 'Solo se permiten letras y espacios (sin números ni símbolos)';
    return undefined;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNameValue(val);
    const err = validateName(val);
    setNameErrors({ name: err });
  };

  const handleSaveName = async () => {
    const err = validateName(nameValue);
    if (err) { setNameErrors({ name: err }); return; }
    if (!user) return;

    setIsSavingName(true);
    setNameSuccess(false);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: nameValue.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setNameErrors({ name: data.message || 'Error al actualizar el nombre' });
        return;
      }

      const updated = { ...user, name: nameValue.trim() };
      setUser(updated);
      localStorage.setItem('user_data', JSON.stringify(updated));
      setIsEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch {
      setNameErrors({ name: 'Error de conexión con el servidor' });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelName = () => {
    setNameValue(user?.name || '');
    setNameErrors({});
    setIsEditingName(false);
  };

  // ── Password validation ───────────────────────────────────────────────────
  const validatePassword = (): boolean => {
    const errors: PasswordErrors = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Ingresa tu contraseña actual';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'Ingresa la nueva contraseña';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Mínimo 6 caracteres';
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      errors.newPassword = 'La nueva contraseña debe ser diferente a la actual';
    }

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Confirma la nueva contraseña';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordChange = (field: keyof PasswordForm, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setPasswordApiError('');
  };

  const handleSavePassword = async () => {
    if (!validatePassword() || !user) return;
    setIsSavingPassword(true);
    setPasswordApiError('');
    setPasswordSuccess(false);

    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE_URL}/users/${user.id}/change-password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordApiError(data.message || 'Error al cambiar la contraseña');
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordSection(false);
      }, 2500);
    } catch {
      setPasswordApiError('Error de conexión con el servidor');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('remembered_email');
    navigate('/login');
  };

  // ── Role helpers ──────────────────────────────────────────────────────────
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      ADMIN: 'Administrador',
      OPERATOR: 'Operador',
    };
    return labels[role?.toUpperCase()] || role;
  };

  const getRoleBadgeClass = (role: string) => {
    const classes: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-800 border border-purple-200',
      OPERATOR: 'bg-blue-100 text-blue-800 border border-blue-200',
    };
    return classes[role?.toUpperCase()] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // ── Password strength ─────────────────────────────────────────────────────
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Débil', color: 'bg-red-400', width: '25%' };
    if (score === 2) return { label: 'Regular', color: 'bg-yellow-400', width: '50%' };
    if (score === 3) return { label: 'Buena', color: 'bg-blue-400', width: '75%' };
    return { label: 'Fuerte', color: 'bg-green-500', width: '100%' };
  };

  const strength = getPasswordStrength(passwordForm.newPassword);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Mi Perfil</h2>
        <p className="text-gray-500 text-sm mt-1">Gestiona tu información personal y credenciales</p>
      </div>

      {/* ── Success banner ────────────────────────────────────────────────── */}
      {nameSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
          <Check className="w-4 h-4 flex-shrink-0" />
          Nombre actualizado correctamente
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal info card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Información Personal
            </h3>

            <div className="space-y-4">

              {/* Avatar + name */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold select-none">
                    {initials}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{user?.name || '—'}</p>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getRoleBadgeClass(user?.role || '')}`}>
                    {getRoleLabel(user?.role || '')}
                  </span>
                </div>
              </div>

              {/* Full Name field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre Completo
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={nameValue}
                      onChange={handleNameChange}
                      onFocus={() => setIsEditingName(true)}
                      disabled={isSavingName}
                      placeholder="Tu nombre completo"
                      className={`w-full px-4 py-2.5 rounded-lg border text-sm transition
                        ${nameErrors.name
                          ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                        }
                        disabled:bg-gray-50 disabled:cursor-not-allowed outline-none`}
                    />
                    {nameErrors.name && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {nameErrors.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">Solo letras y espacios. Sin números ni símbolos.</p>
                  </div>

                  {isEditingName && (
                    <div className="flex gap-1.5 pt-0.5">
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName || !!nameErrors.name}
                        className="flex items-center gap-1 px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {isSavingName ? '' : 'Guardar'}
                      </button>
                      <button
                        onClick={handleCancelName}
                        disabled={isSavingName}
                        className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  Correo Electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-sm cursor-not-allowed outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                    No editable
                  </span>
                </div>
              </div>

              {/* Role (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  Rol
                </label>
                <input
                  type="text"
                  value={getRoleLabel(user?.role || '')}
                  readOnly
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-sm cursor-not-allowed outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── Change password card ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <button
              onClick={() => {
                setShowPasswordSection(!showPasswordSection);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setPasswordErrors({});
                setPasswordApiError('');
                setPasswordSuccess(false);
              }}
              className="w-full flex items-center justify-between text-base font-semibold text-gray-800"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                Cambiar Contraseña
              </span>
              <span className="text-gray-400 text-sm font-normal">
                {showPasswordSection ? '▲ Cerrar' : '▼ Expandir'}
              </span>
            </button>

            {showPasswordSection && (
              <div className="mt-5 space-y-4">

                {passwordSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    Contraseña actualizada correctamente
                  </div>
                )}

                {passwordApiError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {passwordApiError}
                  </div>
                )}

                {/* Current password */}
                {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => {
                  const labels: Record<typeof field, string> = {
                    currentPassword: 'Contraseña Actual',
                    newPassword: 'Nueva Contraseña',
                    confirmPassword: 'Confirmar Nueva Contraseña',
                  };
                  const showKey = field === 'currentPassword' ? 'current' : field === 'newPassword' ? 'new' : 'confirm';
                  return (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {labels[field]}
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords[showKey as keyof typeof showPasswords] ? 'text' : 'password'}
                          value={passwordForm[field]}
                          onChange={e => handlePasswordChange(field, e.target.value)}
                          disabled={isSavingPassword}
                          placeholder="••••••••"
                          className={`w-full px-4 py-2.5 pr-10 rounded-lg border text-sm outline-none transition
                            ${passwordErrors[field]
                              ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                              : 'border-gray-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                            }
                            disabled:bg-gray-50 disabled:cursor-not-allowed`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords(prev => ({
                              ...prev,
                              [showKey]: !prev[showKey as keyof typeof showPasswords],
                            }))
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords[showKey as keyof typeof showPasswords]
                            ? <EyeOff className="w-4 h-4" />
                            : <Eye className="w-4 h-4" />
                          }
                        </button>
                      </div>

                      {/* Strength indicator for new password */}
                      {field === 'newPassword' && passwordForm.newPassword && strength && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Seguridad</span>
                            <span className="text-xs font-medium text-gray-600">{strength.label}</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                              style={{ width: strength.width }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Usa mayúsculas, números y símbolos para mayor seguridad
                          </p>
                        </div>
                      )}

                      {passwordErrors[field] && (
                        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {passwordErrors[field]}
                        </p>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={handleSavePassword}
                  disabled={isSavingPassword}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isSavingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSavingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Account summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Resumen de Cuenta</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Estado</span>
                <span className="px-2.5 py-0.5 bg-green-100 text-green-800 border border-green-200 rounded-full text-xs font-medium">
                  Activo
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Empresa</span>
                <span className="font-medium text-gray-700 truncate max-w-[130px] text-right">
                  {user?.company_name || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Rol</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getRoleBadgeClass(user?.role || '')}`}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Acciones Rápidas</h3>
            <div className="space-y-2">

              <button
                onClick={() => {
                  setShowPasswordSection(true);
                  setTimeout(() => {
                    document.getElementById('password-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition text-sm font-medium text-left"
              >
                <Shield className="w-4 h-4 flex-shrink-0" />
                Cambiar Contraseña
              </button>

             

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition text-sm font-medium text-left"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar Sesión
              </button>
            </div>
          </div>

          
        </div>
      </div>

      {/* ── Notification Settings Modal ───────────────────────────────────── */}
      {showNotifSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5">
              <h3 className="text-lg font-bold text-white">Ajustes de Notificación</h3>
              <p className="text-blue-100 text-sm mt-0.5">Elige cómo quieres recibir alertas</p>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'email', label: 'Notificaciones por Email', value: notifEmail, setter: setNotifEmail },
                { key: 'whatsapp', label: 'Notificaciones por WhatsApp', value: notifWhatsApp, setter: setNotifWhatsApp },
                { key: 'sms', label: 'Notificaciones por SMS', value: notifSMS, setter: setNotifSMS },
              ].map(({ key, label, value, setter }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() => setter(!value)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowNotifSettings(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  // TODO: guardar en backend
                  setShowNotifSettings(false);
                }}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
