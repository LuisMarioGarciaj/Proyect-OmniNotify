// src/pages/Credits/RechargeCredits.tsx
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
  Sparkles
} from 'lucide-react';
import { creditsService } from '../../services/credits.service';
import type { CreditsPackage } from '../../services/credits.service';

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  credits?: number;
}

// 🔥 TIPOS CORREGIDOS PARA LA RESPUESTA DEL QR - BASADO EN LA RESPUESTA REAL DEL BACKEND
interface QrResponse {
  success: boolean;
  qrData: {
    status: number;           // 0 = éxito
    transactionId: string;    // "667796"
    qrId: string;            // "58610543"
    qr: string;              // "iVBORw0KGgoAAAANSUhEUgAAAUAAAAF..."
  };
  companyId: string;
  amount: number;
  transactionCode: string;
  [key: string]: any;      // Permitir propiedades adicionales
}

interface PaymentVerificationResponse {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';  // Según el tipo en credits.service.ts
  paymentId?: string;
  amount?: string;
  credits?: {
    success: boolean;
    message: string;
    newBalance: number;
    transaction: any;
  };
}

const RechargeCredits: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [packages, setPackages] = useState<CreditsPackage[]>([]);
  const [testPackages, setTestPackages] = useState<CreditsPackage[]>([]);
  const [realPackages, setRealPackages] = useState<CreditsPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'qr'>('qr');
  const [showTestMode, setShowTestMode] = useState(false);
  
  // Estados para QR
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [verificationInterval, setVerificationInterval] = useState<number | null>(null);

  useEffect(() => {
    // Obtener datos del usuario
    const userData = localStorage.getItem('user_data');
    if (userData) {
      const parsed = JSON.parse(userData);
      setUser(parsed);
    } else {
      navigate('/login');
    }

    // Cargar paquetes
    loadPackages();
  }, []);

  // Limpiar intervalo cuando se desmonte el componente
  useEffect(() => {
    return () => {
      if (verificationInterval !== null) {
        clearInterval(verificationInterval);
      }
    };
  }, [verificationInterval]);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const data = await creditsService.getCreditsPackages();
      setPackages(data);
      
      // Separar paquetes de prueba y reales
      const test = data.filter(p => p.isTest);
      const real = data.filter(p => !p.isTest);
      
      setTestPackages(test);
      setRealPackages(real);
      
      // Seleccionar el primer paquete real por defecto
      if (real.length > 0) {
        setSelectedPackage(real[0].id);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 CORREGIDO: Manejar pago con QR con tipos correctos
  const handleQrPayment = async () => {
    if (!selectedPackage || !user?.company_id) {
      setQrError('No se pudo iniciar el pago: datos incompletos');
      return;
    }

    const selectedPkg = packages.find(p => p.id === selectedPackage);
    if (!selectedPkg) {
      setQrError('Paquete no encontrado');
      return;
    }

    setQrLoading(true);
    setShowQrModal(true);
    setVerificationStatus('pending');
    setQrError(null);

    try {
      console.log('💰 Generando QR para recarga:', {
        companyId: user.company_id,
        amount: selectedPkg.price,
        concept: `Recarga de ${selectedPkg.credits} créditos - ${selectedPkg.name}`
      });

      // 1. Generar QR - LA RESPUESTA TIENE LA ESTRUCTURA { success, qrData, ... }
      const response = await creditsService.generateQr({
        companyId: user.company_id,
        amount: selectedPkg.price,
        concept: `Recarga de ${selectedPkg.credits} créditos - ${selectedPkg.name}`,
        email: user.email,
        billName: user.name
      });

      console.log('✅ Respuesta del backend:', response);

      // 🔥 VERIFICAR QUE LA RESPUESTA EXISTE
      if (!response) {
        throw new Error('No se recibió respuesta del servidor');
      }

      // 🔥 VERIFICAR QUE LA RESPUESTA TIENE LOS DATOS NECESARIOS
      if (!response.success || !response.qrData || !response.qrData.qr) {
        console.error('❌ Respuesta sin QR:', response);
        throw new Error('El servidor no devolvió un código QR válido');
      }

      // 🔥 EXTRAER LOS DATOS DEL QR DESDE qrData
      const qrResponse = response.qrData;

      // 🔥 CORREGIDO: Verificar que qr existe antes de usarlo
      if (!qrResponse.qr) {
        throw new Error('El código QR está vacío');
      }

      // 🔥 CORREGIDO: Crear objeto QR con los datos correctos
      const qrImage = qrResponse.qr.startsWith('data:image') 
        ? qrResponse.qr 
        : `data:image/png;base64,${qrResponse.qr}`;

      // 🔥 CORREGIDO: Usar valores por defecto seguros
      setQrData({
        qrId: qrResponse.qrId,
        transactionId: qrResponse.transactionId,
        qrImage: qrImage,
        amount: selectedPkg.price,
        credits: selectedPkg.credits,
        status: qrResponse.status === 0 ? 'SUCCESS' : 'PENDING'
      });

      console.log('✅ QR procesado correctamente');

      // 2. Empezar a verificar el pago cada 3 segundos
      const transactionId = qrResponse.transactionId;
      const qrId = qrResponse.qrId;

      const intervalId = window.setInterval(async () => {
        try {
          const verification = await creditsService.verifyQrPayment(
            transactionId,
            qrId
          );

          console.log('🔍 Verificación:', verification);

          if (!verification) {
            console.warn('⚠️ No se recibió respuesta de verificación');
            return;
          }

          // 🔥 CORREGIDO: Tipos correctos según PaymentVerificationResponse
          if (verification.status === 'SUCCESS') {
            clearInterval(intervalId);
            setVerificationInterval(null);
            setVerificationStatus('success');
            
            // 🔥 CORREGIDO: Extraer el nuevo balance
            const newBalance = verification.credits?.newBalance;
            
            if (newBalance !== undefined && user) {
              const updatedUser = { 
                ...user, 
                credits: newBalance 
              };
              localStorage.setItem('user_data', JSON.stringify(updatedUser));
              setUser(updatedUser);
              
              window.dispatchEvent(new CustomEvent('credits-updated', { 
                detail: { 
                  companyId: user.company_id, 
                  credits: newBalance 
                }
              }));
            }
            
            // Cerrar modal después de 3 segundos
            setTimeout(() => {
              setShowQrModal(false);
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
            }, 3000);
            
          } else if (verification.status === 'FAILED') {
            clearInterval(intervalId);
            setVerificationInterval(null);
            setVerificationStatus('failed');
            setQrError('El pago no pudo ser procesado');
          } else {
            // Estado 'PENDING' - seguir verificando
            console.log('⏳ Pago pendiente...');
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

  // Manejar recarga según método (ahora TODOS los paquetes usan QR)
  const handleRecharge = () => {
    const selectedPkg = packages.find(p => p.id === selectedPackage);
    
    if (!selectedPkg) return;
    
    // 🔥 TODOS los paquetes usan el mismo método QR (con cobro real)
    handleQrPayment();
  };

  // Método legacy (para card/transfer)
  const handleLegacyRecharge = async () => {
    if (!selectedPackage || !user?.company_id) return;

    setProcessing(true);
    try {
      const result = await creditsService.rechargeCredits({
        company_id: user.company_id,
        package_id: selectedPackage,
        payment_method: paymentMethod
      });

      if (result.success) {
        setSuccess(true);
        
        const updatedUser = { ...user, credits: result.newBalance };
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        window.dispatchEvent(new CustomEvent('credits-updated', { 
          detail: { 
            companyId: user.company_id, 
            credits: result.newBalance 
          }
        }));

        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error processing recharge:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getSelectedPackageDetails = () => {
    return packages.find(p => p.id === selectedPackage);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(price);
  };

  // 🔥 Función para recargar después del éxito
  const reloadUserData = async () => {
    if (!user?.company_id) return;
    
    try {
      const balance = await creditsService.getBalance(user.company_id);
      const updatedUser = { ...user, credits: balance.currentBalance };
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      window.dispatchEvent(new CustomEvent('credits-updated', { 
        detail: { 
          companyId: user.company_id, 
          credits: balance.currentBalance 
        }
      }));
    } catch (error) {
      console.error('Error reloading user data:', error);
    }
  };

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

  const selectedPkg = getSelectedPackageDetails();

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

        {/* Current Credits - CON VALOR REAL */}
        {user?.credits !== undefined && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-l-4 border-blue-500">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tus créditos actuales</p>
                  <p className="text-3xl font-black text-gray-800">{user.credits.toLocaleString()}</p>
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

        {/* 🔥 PAQUETES DE PRUEBA - AHORA CON 1 Bs */}
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
                    onClick={() => setSelectedPackage(pkg.id)}
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
                          {formatPrice(pkg.price)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 text-center mb-4">{pkg.description}</p>
                      
                      <div className="flex justify-between text-xs text-gray-500 px-2">
                        <span>Precio por crédito:</span>
                        <span className="font-semibold">{(pkg.price / pkg.credits).toFixed(2)} Bs</span>
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
            const pricePerCredit = (pkg.price / pkg.credits).toFixed(2);
            
            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
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
                  pkg.id === '1' ? 'from-blue-400 to-cyan-400' :
                  pkg.id === '2' ? 'from-purple-400 to-pink-400' :
                  pkg.id === '3' ? 'from-amber-400 to-orange-400' :
                  'from-emerald-400 to-teal-400'
                }`}></div>
                
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${
                      pkg.id === '1' ? 'from-blue-500 to-cyan-500' :
                      pkg.id === '2' ? 'from-purple-500 to-pink-500' :
                      pkg.id === '3' ? 'from-amber-500 to-orange-500' :
                      'from-emerald-500 to-teal-500'
                    }`}>
                      {pkg.id === '1' ? <Package className="w-6 h-6 text-white" /> :
                       pkg.id === '2' ? <Zap className="w-6 h-6 text-white" /> :
                       pkg.id === '3' ? <Gift className="w-6 h-6 text-white" /> :
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
                      {formatPrice(pkg.price)}
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

        {/* Payment Methods (para TODOS los paquetes) */}
        {selectedPackage && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Método de pago
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setPaymentMethod('qr')}
                className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                  paymentMethod === 'qr' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  paymentMethod === 'qr' ? 'bg-blue-500' : 'bg-gray-100'
                }`}>
                  <QrCode className={`w-5 h-5 ${
                    paymentMethod === 'qr' ? 'text-white' : 'text-gray-600'
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

        {/* Summary and Confirm - AHORA TODOS LOS PAQUETES COBRAN */}
        {selectedPkg && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-6 text-white">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-white/80 mb-2">Resumen de tu compra</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-2xl font-bold">{selectedPkg.credits}</span>
                    <span className="text-white/80 ml-2">créditos</span>
                  </div>
                  <div className="w-px h-8 bg-white/30 hidden sm:block"></div>
                  <div>
                    <span className="text-2xl font-bold">{formatPrice(selectedPkg.price)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Shield size={16} />
                  <span>Pago seguro</span>
                </div>
                
                <button
                  onClick={handleRecharge}
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
                      Pagar {formatPrice(selectedPkg.price)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de QR - CORREGIDO */}
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
                        {formatPrice(qrData.amount || selectedPkg?.price || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Créditos a recibir:</span>
                      <span className="font-bold text-blue-600">{qrData.credits || selectedPkg?.credits}</span>
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
                    Se han agregado {qrData?.credits || selectedPkg?.credits} créditos a tu cuenta
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