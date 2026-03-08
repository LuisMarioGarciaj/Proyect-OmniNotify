// frontend_omninitify/src/pages/Credits/RechargeCredits.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Coins, 
  CreditCard, 
  Zap, 
  CheckCircle, 
  ArrowLeft,
  Gift,
  Star,
  Package,
  Shield,
  Clock,
  Loader2,
  QrCode,
  X,
  AlertCircle,
  FlaskConical,
  Sparkles,
  Building,
  User,
  Mail,
  FileText
} from 'lucide-react';
import { creditsService } from '../../services/credits.service';
import type { RechargeResponse, VerifyResponse } from '../../services/credits.service';

type PaymentMethod = 'QR' | 'CARD' | 'STRIKE';

interface PackageOption {
  id: string;
  name: string;
  credits: number;
  amount: number;
  popular?: boolean;
  description?: string;
  isTest?: boolean;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  credits?: number;
}

// 🔥 TIPOS PARA LA RESPUESTA DEL QR
interface QrResponse {
  success: boolean;
  qrData: {
    status: number;
    transactionId: string;
    qrId: string;
    qr: string;
  };
  companyId: string;
  amount: number;
  transactionCode: string;
  [key: string]: any;
}

interface PaymentVerificationResponse {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  paymentId?: string;
  amount?: string;
  credits?: {
    success: boolean;
    message: string;
    newBalance: number;
    transaction: any;
  };
}

const PACKAGE_OPTIONS: PackageOption[] = [
  { 
    id: 'test-1', 
    name: 'Prueba', 
    credits: 1, 
    amount: 1, 
    description: 'Para probar el sistema',
    isTest: true 
  },
  { 
    id: 'basic', 
    name: 'Básico', 
    credits: 50, 
    amount: 50, 
    description: 'Ideal para empezar' 
  },
  { 
    id: 'standard', 
    name: 'Estándar', 
    credits: 200, 
    amount: 200, 
    popular: true, 
    description: 'El más elegido' 
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    credits: 500, 
    amount: 500, 
    description: 'Para uso profesional' 
  },
  { 
    id: 'business', 
    name: 'Empresarial', 
    credits: 1000, 
    amount: 1000, 
    description: 'Máximo rendimiento' 
  },
];

const RechargeCredits: React.FC = () => {
  const navigate = useNavigate();
  
  const [user, setUser] = useState<UserData | null>(null);
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('QR');
  const [selectedPackage, setSelectedPackage] = useState<string>('standard');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customCredits, setCustomCredits] = useState<string>('');
  const [useCustom, setUseCustom] = useState(false);
  const [showTestMode, setShowTestMode] = useState(false);
  
  // Datos para factura
  const [billData, setBillData] = useState({
    billName: '',
    billNit: '',
    email: '',
    concept: 'Recarga de créditos',
  });
  
  // Estados para QR
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [verificationInterval, setVerificationInterval] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Obtener company_id del usuario logueado
  const getCompanyId = (): string | null => {
    if (user?.company_id) {
      return user.company_id;
    }
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    return userData.company_id || null;
  };

  // Cargar datos del usuario al montar
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user_data') || '{}');
    setUser(storedUser);
    setCurrentCredits(storedUser.credits || 0);
    
    // Precargar datos para factura
    setBillData(prev => ({
      ...prev,
      billName: storedUser.name || '',
      email: storedUser.email || '',
    }));
    
    loadBalance();
    
    return () => {
      if (verificationInterval !== null) {
        clearInterval(verificationInterval);
      }
    };
  }, []);

  const loadBalance = async () => {
    const companyId = getCompanyId();
    if (!companyId) {
      console.error('❌ No hay company_id disponible');
      setLoading(false);
      return;
    }
    
    try {
      console.log('💰 Cargando balance para empresa:', companyId);
      const balance = await creditsService.getBalance(companyId);
      console.log('✅ Balance cargado:', balance);
      setCurrentCredits(balance.credits);
      
      // Actualizar localStorage
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      userData.credits = balance.credits;
      localStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
      
    } catch (error) {
      console.error('❌ Error cargando balance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar créditos cuando cambia el monto custom
  useEffect(() => {
    if (useCustom && customAmount) {
      const amount = parseFloat(customAmount);
      if (!isNaN(amount) && amount > 0) {
        const credits = creditsService.calculateCredits(amount);
        setCustomCredits(credits.toString());
      } else {
        setCustomCredits('');
      }
    }
  }, [customAmount, useCustom]);

  // Actualizar monto cuando cambian los créditos custom
  useEffect(() => {
    if (useCustom && customCredits) {
      const credits = parseInt(customCredits);
      if (!isNaN(credits) && credits > 0) {
        const amount = creditsService.calculateAmount(credits);
        setCustomAmount(amount.toString());
      } else {
        setCustomAmount('');
      }
    }
  }, [customCredits, useCustom]);

  const handlePackageSelect = (pkgId: string) => {
    setSelectedPackage(pkgId);
    setUseCustom(false);
    setCustomAmount('');
    setCustomCredits('');
  };

  const handleCustomToggle = () => {
    setUseCustom(!useCustom);
    if (!useCustom) {
      setCustomAmount('');
      setCustomCredits('');
    }
  };

  const getSelectedPackage = (): PackageOption | undefined => {
    return PACKAGE_OPTIONS.find(p => p.id === selectedPackage);
  };

  const getAmount = (): number => {
    if (useCustom) {
      return parseFloat(customAmount) || 0;
    }
    const selectedPkg = getSelectedPackage();
    return selectedPkg?.amount || 0;
  };

  const getCreditsAmount = (): number => {
    if (useCustom) {
      return parseInt(customCredits) || 0;
    }
    const selectedPkg = getSelectedPackage();
    return selectedPkg?.credits || 0;
  };

  const validateForm = (): boolean => {
    const amount = getAmount();
    const credits = getCreditsAmount();
    
    if (amount <= 0 || credits <= 0) {
      setQrError('Ingresa un monto válido');
      return false;
    }
    
    if (amount !== credits) {
      setQrError('El monto y los créditos deben coincidir (1 Bs = 1 crédito)');
      return false;
    }
    
    return true;
  };

  // 🔥 CORREGIDO: Manejar pago con QR con tipos correctos
  const handleQrPayment = async () => {
    if (!validateForm()) return;
    
    const companyId = getCompanyId();
    if (!companyId) {
      setQrError('No se encontró el ID de la empresa');
      return;
    }

    const amount = getAmount();
    const credits = getCreditsAmount();
    const selectedPkg = getSelectedPackage();

    setQrLoading(true);
    setShowQrModal(true);
    setVerificationStatus('pending');
    setQrError(null);

    try {
      console.log('💰 Generando QR para recarga:', {
        companyId,
        amount,
        concept: `Recarga de ${credits} créditos`
      });

      // Generar QR
      const response = await creditsService.generateQr({
        amount,
        credits,
        ...billData,
      });

      console.log('✅ Respuesta del backend:', response);

      // 🔥 VERIFICAR QUE LA RESPUESTA EXISTE
      if (!response) {
        throw new Error('No se recibió respuesta del servidor');
      }

      // 🔥 VERIFICAR QUE LA RESPUESTA TIENE LOS DATOS NECESARIOS
      if (!response.qrCode) {
        console.error('❌ Respuesta sin QR:', response);
        throw new Error('El servidor no devolvió un código QR válido');
      }

      // 🔥 CORREGIDO: Crear objeto QR con los datos correctos
      const qrImage = response.qrCode.startsWith('data:image') 
        ? response.qrCode 
        : `data:image/png;base64,${response.qrCode}`;

      setQrData({
        qrId: response.qrId,
        transactionId: response.transactionId,
        qrImage: qrImage,
        amount: response.amount,
        credits: response.credits,
      });

      console.log('✅ QR procesado correctamente');

      // 2. Empezar a verificar el pago cada 3 segundos
      const transactionId = response.transactionId;
      const qrId = response.qrId;

      const intervalId = window.setInterval(async () => {
        try {
          if (selectedMethod === 'QR' && qrId) {
            const result = await creditsService.verifyQr({
              transactionId,
              qrId,
            });

            console.log('🔍 Verificación:', result);

            if (!result) {
              console.warn('⚠️ No se recibió respuesta de verificación');
              return;
            }

            if (result.paymentStatus === 'PAID') {
              clearInterval(intervalId);
              setVerificationInterval(null);
              setVerificationStatus('success');
              
              // Recargar balance
              await loadBalance();
              
              // Disparar evento de actualización de créditos
              window.dispatchEvent(new CustomEvent('credits-updated', {
                detail: {
                  companyId,
                  credits: currentCredits + credits,
                }
              }));
              
              // Cerrar modal después de 3 segundos
              setTimeout(() => {
                setShowQrModal(false);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
              }, 3000);
              
            } else if (result.paymentStatus === 'EXPIRED' || result.paymentStatus === 'FAILED') {
              clearInterval(intervalId);
              setVerificationInterval(null);
              setVerificationStatus('failed');
              setQrError('El pago no pudo ser procesado');
            } else {
              // Estado 'PENDING' - seguir verificando
              console.log('⏳ Pago pendiente...');
            }
          }
        } catch (error: any) {
          console.error('Error verifying payment:', error);
          // No detenemos el intervalo por errores de red
        }
      }, 3000);

      setVerificationInterval(intervalId);

    } catch (error: any) {
      console.error('❌ Error generando QR:', error);
      setQrError(error.message || 'Error al generar el código QR');
      setVerificationStatus('failed');
    } finally {
      setQrLoading(false);
    }
  };

  // Cancelar verificación y cerrar modal
  const handleCloseQrModal = () => {
    if (verificationInterval !== null) {
      clearInterval(verificationInterval);
      setVerificationInterval(null);
    }
    setShowQrModal(false);
    setQrData(null);
    setVerificationStatus('pending');
    setQrError(null);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString('es-BO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateString;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(price);
  };

  const testPackages = PACKAGE_OPTIONS.filter(p => p.isTest);
  const realPackages = PACKAGE_OPTIONS.filter(p => !p.isTest);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-lg font-semibold text-gray-700">Cargando paquetes...</p>
        </div>
      </div>
    );
  }

  const selectedPkg = getSelectedPackage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white rounded-xl transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Recargar Créditos
            </h1>
            <p className="text-gray-600 mt-1">
              Elige el paquete que mejor se adapte a tus necesidades
            </p>
          </div>
        </div>

        {/* Current Credits */}
        {currentCredits > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-blue-500">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tus créditos actuales</p>
                  <p className="text-3xl font-black text-gray-800">{currentCredits.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} />
                <span>Válidos por 1 año</span>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-slideDown">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">¡Recarga exitosa!</p>
              <p className="text-sm text-green-600">Tus créditos han sido actualizados</p>
            </div>
          </div>
        )}

        {/* 🔥 TOGGLE PARA MODO PRUEBA */}
        <div className="mb-6 flex items-center justify-end">
          <button
            onClick={() => setShowTestMode(!showTestMode)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
          >
            <FlaskConical size={18} />
            {showTestMode ? 'Ocultar paquetes de prueba' : 'Mostrar paquetes de prueba (desde 1 Bs)'}
          </button>
        </div>

        {/* 🔥 PAQUETES DE PRUEBA */}
        {showTestMode && testPackages.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              🧪 Paquetes de Prueba (1 Bs)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {testPackages.map((pkg) => {
                const isSelected = selectedPackage === pkg.id;
                
                return (
                  <div
                    key={pkg.id}
                    onClick={() => handlePackageSelect(pkg.id)}
                    className={`relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 border-2 ${
                      isSelected ? 'border-purple-500 ring-4 ring-purple-200' : 'border-purple-200'
                    }`}
                  >
                    <div className="absolute top-0 right-0">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                        <Sparkles size={12} />
                        PRUEBA
                      </div>
                    </div>
                    
                    <div className="h-2 bg-gradient-to-r from-purple-400 to-pink-400"></div>
                    
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                          <FlaskConical className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">{pkg.name}</h3>
                      </div>
                      
                      <div className="text-center mb-4">
                        <span className="text-4xl font-black text-gray-800">{pkg.credits}</span>
                        <span className="text-gray-600 ml-2">créditos</span>
                      </div>
                      
                      <div className="text-center mb-4">
                        <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                          {formatPrice(pkg.amount)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 text-center mb-4">{pkg.description}</p>
                      
                      <div className="flex justify-between text-xs text-gray-500 px-2">
                        <span>Precio por crédito:</span>
                        <span className="font-semibold">{(pkg.amount / pkg.credits).toFixed(2)} Bs</span>
                      </div>
                      
                      {isSelected && (
                        <div className="absolute bottom-2 right-2">
                          <CheckCircle className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Paquetes Reales */}
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Paquetes Reales
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {realPackages.map((pkg) => {
            const isSelected = selectedPackage === pkg.id;
            const pricePerCredit = (pkg.amount / pkg.credits).toFixed(2);
            
            return (
              <div
                key={pkg.id}
                onClick={() => handlePackageSelect(pkg.id)}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  isSelected ? 'ring-4 ring-blue-500 ring-offset-2' : ''
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                      <Star size={12} />
                      POPULAR
                    </div>
                  </div>
                )}
                
                <div className={`h-2 bg-gradient-to-r ${
                  pkg.id === 'basic' ? 'from-blue-400 to-cyan-400' :
                  pkg.id === 'standard' ? 'from-purple-400 to-pink-400' :
                  pkg.id === 'premium' ? 'from-amber-400 to-orange-400' :
                  'from-emerald-400 to-teal-400'
                }`}></div>
                
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${
                      pkg.id === 'basic' ? 'from-blue-500 to-cyan-500' :
                      pkg.id === 'standard' ? 'from-purple-500 to-pink-500' :
                      pkg.id === 'premium' ? 'from-amber-500 to-orange-500' :
                      'from-emerald-500 to-teal-500'
                    }`}>
                      {pkg.id === 'basic' ? <Package className="w-6 h-6 text-white" /> :
                       pkg.id === 'standard' ? <Zap className="w-6 h-6 text-white" /> :
                       pkg.id === 'premium' ? <Gift className="w-6 h-6 text-white" /> :
                       <Star className="w-6 h-6 text-white" />}
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">{pkg.name}</h3>
                  </div>
                  
                  <div className="text-center mb-4">
                    <span className="text-4xl font-black text-gray-800">{pkg.credits}</span>
                    <span className="text-gray-600 ml-2">créditos</span>
                  </div>
                  
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                      {formatPrice(pkg.amount)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 text-center mb-4">{pkg.description}</p>
                  
                  <div className="flex justify-between text-xs text-gray-500 px-2">
                    <span>Precio por crédito:</span>
                    <span className="font-semibold">{pricePerCredit} Bs</span>
                  </div>
                  
                  {isSelected && (
                    <div className="absolute bottom-2 right-2">
                      <CheckCircle className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Datos de factura (solo si hay paquete seleccionado) */}
        {selectedPackage && (
          <div className="bg-white rounded-xl border p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-4">Datos de Factura (Opcional)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Nombre/Razón Social
                </label>
                <input
                  type="text"
                  value={billData.billName}
                  onChange={(e) => setBillData({ ...billData, billName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tu nombre o empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building className="w-4 h-4 inline mr-1" />
                  NIT
                </label>
                <input
                  type="text"
                  value={billData.billNit}
                  onChange={(e) => setBillData({ ...billData, billNit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={billData.email}
                  onChange={(e) => setBillData({ ...billData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Concepto
                </label>
                <input
                  type="text"
                  value={billData.concept}
                  onChange={(e) => setBillData({ ...billData, concept: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Recarga de créditos"
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods */}
        {selectedPackage && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Método de pago
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedMethod('QR')}
                className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                  selectedMethod === 'QR' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  selectedMethod === 'QR' ? 'bg-blue-500' : 'bg-gray-100'
                }`}>
                  <QrCode className={`w-5 h-5 ${
                    selectedMethod === 'QR' ? 'text-white' : 'text-gray-600'
                  }`} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Código QR</p>
                  <p className="text-xs text-gray-600">Escanea y paga con tu banco</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Summary and Confirm */}
        {selectedPkg && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-white/80 mb-2">Resumen de tu compra</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-2xl font-bold">{getCreditsAmount()}</span>
                    <span className="text-white/80 ml-2">créditos</span>
                  </div>
                  <div className="w-px h-8 bg-white/30 hidden sm:block"></div>
                  <div>
                    <span className="text-2xl font-bold">{formatPrice(getAmount())}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Shield size={16} />
                  <span>Pago seguro</span>
                </div>
                
                <button
                  onClick={handleQrPayment}
                  disabled={processing || qrLoading}
                  className="px-8 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                >
                  {processing || qrLoading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      Pagar {formatPrice(getAmount())}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de QR */}
        {showQrModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 relative">
              <button
                onClick={handleCloseQrModal}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>

              {qrLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Generando código QR...</p>
                </div>
              ) : qrError ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Error en el pago</h3>
                  <p className="text-gray-600 mb-6">{qrError}</p>
                  <button
                    onClick={handleCloseQrModal}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Cerrar
                  </button>
                </div>
              ) : qrData && verificationStatus === 'pending' ? (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Escanea el código QR</h3>
                  <p className="text-gray-600 mb-6">
                    Abre tu aplicación bancaria y escanea este código para pagar
                  </p>
                  
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200 mb-4">
                    <img 
                      src={qrData.qrImage} 
                      alt="QR Code" 
                      className="w-full max-w-[250px] mx-auto"
                    />
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Monto a pagar:</span>
                      <span className="font-bold text-blue-600">
                        {formatPrice(qrData.amount || getAmount())}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Créditos a recibir:</span>
                      <span className="font-bold text-blue-600">{qrData.credits || getCreditsAmount()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Clock className="w-4 h-4" />
                    <span>El QR expira en 30 minutos</span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Esperando confirmación de pago...</span>
                  </div>
                </>
              ) : verificationStatus === 'success' ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">¡Pago exitoso!</h3>
                  <p className="text-gray-600 mb-4">
                    Se han agregado {qrData?.credits || getCreditsAmount()} créditos a tu cuenta
                  </p>
                  <p className="text-sm text-gray-500">
                    Redirigiendo...
                  </p>
                </div>
              ) : verificationStatus === 'failed' ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Error en el pago</h3>
                  <p className="text-gray-600 mb-6">
                    {qrError || 'No se pudo procesar el pago. Intenta nuevamente.'}
                  </p>
                  <button
                    onClick={handleCloseQrModal}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Cerrar
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RechargeCredits;