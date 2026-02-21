import React, { useState, useMemo } from 'react';
import { X, Phone, Mail, Globe, Check, UserPlus, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Country {
  name: string;
  code: string;   // ISO e.g. "BO"
  dial: string;   // e.g. "+591"
  flag: string;
}

interface Props {
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  onConfirm: (value: string, saveAsContact?: { name?: string; phone?: string; email?: string }) => void;
  onClose: () => void;
}

// ─── Country list (most common first, then alphabetical) ─────────────────────
const COUNTRIES: Country[] = [
  { name: 'Bolivia',           code: 'BO', dial: '+591', flag: '🇧🇴' },
  { name: 'Argentina',         code: 'AR', dial: '+54',  flag: '🇦🇷' },
  { name: 'Brasil',            code: 'BR', dial: '+55',  flag: '🇧🇷' },
  { name: 'Chile',             code: 'CL', dial: '+56',  flag: '🇨🇱' },
  { name: 'Colombia',          code: 'CO', dial: '+57',  flag: '🇨🇴' },
  { name: 'Ecuador',           code: 'EC', dial: '+593', flag: '🇪🇨' },
  { name: 'México',            code: 'MX', dial: '+52',  flag: '🇲🇽' },
  { name: 'Paraguay',          code: 'PY', dial: '+595', flag: '🇵🇾' },
  { name: 'Perú',              code: 'PE', dial: '+51',  flag: '🇵🇪' },
  { name: 'Uruguay',           code: 'UY', dial: '+598', flag: '🇺🇾' },
  { name: 'Venezuela',         code: 'VE', dial: '+58',  flag: '🇻🇪' },
  // ── Rest of world ──────────────────────────────────────────────────────────
  { name: 'Alemania',          code: 'DE', dial: '+49',  flag: '🇩🇪' },
  { name: 'Australia',         code: 'AU', dial: '+61',  flag: '🇦🇺' },
  { name: 'Canadá',            code: 'CA', dial: '+1',   flag: '🇨🇦' },
  { name: 'China',             code: 'CN', dial: '+86',  flag: '🇨🇳' },
  { name: 'Costa Rica',        code: 'CR', dial: '+506', flag: '🇨🇷' },
  { name: 'Cuba',              code: 'CU', dial: '+53',  flag: '🇨🇺' },
  { name: 'España',            code: 'ES', dial: '+34',  flag: '🇪🇸' },
  { name: 'Estados Unidos',    code: 'US', dial: '+1',   flag: '🇺🇸' },
  { name: 'Francia',           code: 'FR', dial: '+33',  flag: '🇫🇷' },
  { name: 'Guatemala',         code: 'GT', dial: '+502', flag: '🇬🇹' },
  { name: 'Honduras',          code: 'HN', dial: '+504', flag: '🇭🇳' },
  { name: 'India',             code: 'IN', dial: '+91',  flag: '🇮🇳' },
  { name: 'Italia',            code: 'IT', dial: '+39',  flag: '🇮🇹' },
  { name: 'Japón',             code: 'JP', dial: '+81',  flag: '🇯🇵' },
  { name: 'Nicaragua',         code: 'NI', dial: '+505', flag: '🇳🇮' },
  { name: 'Panamá',            code: 'PA', dial: '+507', flag: '🇵🇦' },
  { name: 'Portugal',          code: 'PT', dial: '+351', flag: '🇵🇹' },
  { name: 'Reino Unido',       code: 'GB', dial: '+44',  flag: '🇬🇧' },
  { name: 'Rep. Dominicana',   code: 'DO', dial: '+1',   flag: '🇩🇴' },
  { name: 'Rusia',             code: 'RU', dial: '+7',   flag: '🇷🇺' },
  { name: 'Salvador',          code: 'SV', dial: '+503', flag: '🇸🇻' },
  { name: 'Turquía',           code: 'TR', dial: '+90',  flag: '🇹🇷' },
];

// ─── Country Selector sub-component ──────────────────────────────────────────
const CountrySelector: React.FC<{
  selected: Country;
  onChange: (c: Country) => void;
}> = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search),
      ),
    [search],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2.5 border border-r-0 rounded-l-lg bg-gray-50 hover:bg-gray-100 transition-colors min-w-[90px] border-gray-300"
      >
        <span className="text-xl">{selected.flag}</span>
        <span className="text-sm font-medium text-gray-700">{selected.dial}</span>
        <span className="text-gray-400 text-xs ml-auto">▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => { setOpen(false); setSearch(''); }}
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar país..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.map((country) => (
                <button
                  key={`${country.code}-${country.dial}`}
                  type="button"
                  onClick={() => { onChange(country); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    selected.code === country.code ? 'bg-emerald-50' : ''
                  }`}
                >
                  <span className="text-lg">{country.flag}</span>
                  <span className="flex-1 text-left text-gray-800">{country.name}</span>
                  <span className="text-gray-500 font-mono">{country.dial}</span>
                  {selected.code === country.code && (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  No se encontraron países
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const ManualRecipientModal: React.FC<Props> = ({ channel, onConfirm, onClose }) => {
  const isPhone = channel === 'SMS' || channel === 'WHATSAPP';

  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Bolivia default
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [saveContact, setSaveContact] = useState(true); // ✅ activado por defecto
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Clean phone: digits only
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const fullPhone = `${selectedCountry.dial}${cleanPhone}`;

  // Validation
  const validate = (): string | null => {
    if (isPhone) {
      if (!cleanPhone) return 'Ingresa el número de teléfono';
      if (cleanPhone.length < 6) return 'El número es demasiado corto';
      if (cleanPhone.length > 12) return 'El número es demasiado largo';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) return 'Ingresa un correo electrónico';
      if (!emailRegex.test(email)) return 'El correo no es válido';
    }
    // nombre es opcional
    return null;
  };

  const handleConfirm = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);

    const value = isPhone ? fullPhone : email.trim();
    const contactData = saveContact
      ? {
          name: contactName.trim() || undefined,        // opcional
          phone: isPhone ? fullPhone : (contactPhone.trim() || undefined),  // opcional para email
          email: !isPhone ? email.trim() : undefined,
        }
      : undefined;

    onConfirm(value, contactData);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onClose();
  };

  const channelColor = {
    WHATSAPP: { ring: 'focus:ring-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-800' },
    SMS:      { ring: 'focus:ring-green-500',   border: 'border-green-500',   bg: 'bg-green-600',   badge: 'bg-green-100 text-green-800'   },
    EMAIL:    { ring: 'focus:ring-blue-500',     border: 'border-blue-500',    bg: 'bg-blue-600',    badge: 'bg-blue-100 text-blue-800'     },
  }[channel];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${channel === 'EMAIL' ? 'bg-blue-100' : channel === 'SMS' ? 'bg-green-100' : 'bg-emerald-100'}`}>
              {isPhone
                ? <Phone className={`w-5 h-5 ${channel === 'SMS' ? 'text-green-600' : 'text-emerald-600'}`} />
                : <Mail className="w-5 h-5 text-blue-600" />
              }
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Agregar destinatario</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${channelColor.badge}`}>
                {channel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Phone input */}
          {isPhone ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número de teléfono
              </label>
              <div className="flex">
                <CountrySelector
                  selected={selectedCountry}
                  onChange={setSelectedCountry}
                />
                <input
                  autoFocus
                  type="tel"
                  placeholder="76131645"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setError(null);
                  }}
                  className={`flex-1 px-3 py-2.5 border rounded-r-lg text-sm focus:outline-none focus:ring-2 border-gray-300 ${channelColor.ring}`}
                />
              </div>

              {/* Preview */}
              {cleanPhone.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Número completo:</span>
                  <span className="font-mono font-semibold text-gray-900">{fullPhone}</span>
                </div>
              )}
            </div>
          ) : (
            /* Email input */
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Correo electrónico
              </label>
              <input
                autoFocus
                type="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 border-gray-300 ${channelColor.ring}`}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <span className="text-red-500">⚠</span>
              {error}
            </div>
          )}

          {/* Save as contact toggle */}
          <div className={`rounded-xl border transition-colors ${saveContact ? 'border-gray-300 bg-gray-50' : 'border-dashed border-gray-300'}`}>
            <button
              type="button"
              onClick={() => setSaveContact((s) => !s)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className={`p-1.5 rounded-lg transition-colors ${saveContact ? 'bg-blue-100' : 'bg-gray-100'}`}>
                <UserPlus className={`w-4 h-4 ${saveContact ? 'text-blue-600' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800">Guardar como contacto</div>
                <div className="text-xs text-gray-500">Añadir a tu lista de contactos al enviar</div>
              </div>
              {/* Toggle visual */}
              <div className={`w-10 h-5 rounded-full transition-colors relative ${saveContact ? 'bg-blue-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${saveContact ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {saveContact && (
              <div className="px-4 pb-4 space-y-3">
                {/* Nombre - opcional */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Nombre <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Fernando Arce"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Teléfono adicional - solo visible en canal EMAIL */}
                {!isPhone && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Teléfono <span className="font-normal text-gray-400">(opcional)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej: +59176131645"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
              channel === 'EMAIL' ? 'bg-blue-600 hover:bg-blue-700' :
              channel === 'SMS'   ? 'bg-green-600 hover:bg-green-700' :
                                    'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Agregar destinatario
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualRecipientModal;