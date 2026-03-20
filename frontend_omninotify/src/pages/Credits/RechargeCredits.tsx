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
  FileText,
  History,
  Eye,
  EyeOff,
  Copy,
  Download,
  Share2,
  Calendar,
  Wallet,
  CreditCard as CreditCardIcon,
  Smartphone,
  AlertTriangle,
  Info,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { creditsService } from '../../services/credits.service';
import type { RechargeResponse, VerifyResponse, RechargeHistoryItem, QrImageResponse } from '../../services/credits.service';

type PaymentMethod = 'QR' | 'CARD' | 'STRIKE';

interface PackageOption {
  id: string;
  name: string;
  credits: number;
  amount: number;
  popular?: boolean;
  description?: string;
  isTest?: boolean;
  badge?: string;
  savings?: string;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  credits?: number;
}

interface QrDetailData extends RechargeHistoryItem {
  qrImage?: string;
}

const PACKAGE_OPTIONS: PackageOption[] = [
  { 
    id: 'test-1', 
    name: 'Prueba', 
    credits: 1, 
    amount: 1, 
    description: 'Para probar el sistema',
    isTest: true,
    badge: '🧪 TEST'
  },
  { 
    id: 'basic', 
    name: 'Básico', 
    credits: 50, 
    amount: 50, 
    description: 'Ideal para empezar',
    badge: '🌟 BÁSICO'
  },
  { 
    id: 'standard', 
    name: 'Estándar', 
    credits: 200, 
    amount: 200, 
    popular: true, 
    description: 'El más elegido',
    badge: '🔥 POPULAR',
    savings: 'Ahorras 10%'
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    credits: 500, 
    amount: 500, 
    description: 'Para uso profesional',
    badge: '💎 PREMIUM',
    savings: 'Ahorras 15%'
  },
  { 
    id: 'business', 
    name: 'Empresarial', 
    credits: 1000, 
    amount: 1000, 
    description: 'Máximo rendimiento',
    badge: '🚀 BUSINESS',
    savings: 'Ahorras 20%'
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
  const [successMessage, setSuccessMessage] = useState('');
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('QR');
  const [selectedPackage, setSelectedPackage] = useState<string>('standard');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customCredits, setCustomCredits] = useState<string>('');
  const [useCustom, setUseCustom] = useState(false);
  const [showTestMode, setShowTestMode] = useState(false);
  
  // Estados para historial de recargas
  const [rechargeHistory, setRechargeHistory] = useState<RechargeHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Estados para ver QR detalle
  const [selectedQrDetail, setSelectedQrDetail] = useState<QrDetailData | null>(null);
  const [showQrDetail, setShowQrDetail] = useState(false);
  const [loadingQrDetail, setLoadingQrDetail] = useState(false);
  const [qrDetailError, setQrDetailError] = useState<string | null>(null);
  
  // Datos para factura
  const [billData, setBillData] = useState({
    billName: '',
    billNit: '',
    email: '',
    concept: 'Recarga de créditos',
  });
  
  // Estados para QR actual
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [verificationInterval, setVerificationInterval] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

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

  // Cargar historial de recargas cuando se abre el modal
  useEffect(() => {
    if (showHistory) {
      loadRechargeHistory();
    }
  }, [showHistory]);

  // Countdown para expiración de QR
  useEffect(() => {
    if (qrData?.expiresAt && verificationStatus === 'pending') {
      const expiresAt = new Date(qrData.expiresAt).getTime();
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = expiresAt - now;
        
        if (distance < 0) {
          setCountdown(0);
          clearInterval(interval);
        } else {
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setCountdown(minutes * 60 + seconds);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [qrData, verificationStatus]);

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

  // Cargar historial de recargas
  const loadRechargeHistory = async () => {
    const companyId = getCompanyId();
    if (!companyId) {
      setHistoryError('No se pudo identificar la empresa');
      return;
    }
    
    setLoadingHistory(true);
    setHistoryError(null);
    
    try {
      console.log('📜 Cargando historial de recargas para empresa:', companyId);
      const response = await creditsService.getRechargeHistory(companyId, 50, 0);
      console.log('📜 Historial cargado:', response);
      
      if (response && response.data) {
        setRechargeHistory(response.data);
      } else {
        setRechargeHistory([]);
      }
    } catch (error) {
      console.error('❌ Error cargando historial:', error);
      setHistoryError('No se pudo cargar el historial. Intenta nuevamente.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // 🔥 Ver detalle de un QR específico (ahora recupera la imagen)
  const handleViewQrDetail = async (recharge: RechargeHistoryItem) => {
    setSelectedQrDetail({
      ...recharge,
      qrImage: undefined
    });
    setShowQrDetail(true);
    setQrDetailError(null);
    setLoadingQrDetail(true);

    try {
      // Solo intentar obtener el QR si está pendiente
      if (recharge.paymentStatus === 'PENDING' && recharge.id) {
        console.log('🔄 Obteniendo QR nuevamente para recarga:', recharge.id);
        
        const qrData = await creditsService.getQrImage(recharge.id);
        
        setSelectedQrDetail({
          ...recharge,
          qrImage: qrData.qrImage,
          expiresAt: qrData.expiresAt
        });
        
        console.log('✅ QR recuperado exitosamente');
      } else if (recharge.paymentStatus === 'PAID') {
        setQrDetailError('Esta recarga ya fue pagada. El QR ya no está disponible.');
      } else if (recharge.paymentStatus === 'EXPIRED') {
        setQrDetailError('El QR ha expirado. Puedes generar uno nuevo.');
      }
    } catch (error: any) {
      console.error('❌ Error al obtener detalle del QR:', error);
      
      if (error.message?.includes('expirado')) {
        setQrDetailError('El QR ha expirado. Genera uno nuevo para continuar.');
      } else {
        setQrDetailError('No se pudo recuperar el código QR. Puedes generar uno nuevo.');
      }
    } finally {
      setLoadingQrDetail(false);
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

  // Manejar pago con QR
  const handleQrPayment = async () => {
    if (!validateForm()) return;
    
    const companyId = getCompanyId();
    if (!companyId) {
      setQrError('No se encontró el ID de la empresa');
      return;
    }

    const amount = getAmount();
    const credits = getCreditsAmount();

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

      const response = await creditsService.generateQr({
        amount,
        credits,
        ...billData,
      });

      console.log('✅ Respuesta del backend:', response);

      if (!response) {
        throw new Error('No se recibió respuesta del servidor');
      }

      if (!response.qrCode) {
        console.error('❌ Respuesta sin QR:', response);
        throw new Error('El servidor no devolvió un código QR válido');
      }

      const qrImage = response.qrCode.startsWith('data:image') 
        ? response.qrCode 
        : `data:image/png;base64,${response.qrCode}`;

      setQrData({
        id: response.id,
        qrId: response.qrId,
        transactionId: response.transactionId,
        qrImage: qrImage,
        amount: response.amount,
        credits: response.credits,
        expiresAt: response.expiresAt,
      });

      console.log('✅ QR procesado correctamente');

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
              
              await loadBalance();
              
              setSuccessMessage(`¡${credits} créditos agregados a tu cuenta!`);
              setSuccess(true);
              
              window.dispatchEvent(new CustomEvent('credits-updated', {
                detail: {
                  companyId,
                  credits: currentCredits + credits,
                }
              }));
              
              if (showHistory) {
                loadRechargeHistory();
              }
              
              setTimeout(() => {
                setShowQrModal(false);
                setTimeout(() => setSuccess(false), 3000);
              }, 3000);
              
            } else if (result.paymentStatus === 'EXPIRED' || result.paymentStatus === 'FAILED') {
              clearInterval(intervalId);
              setVerificationInterval(null);
              setVerificationStatus('failed');
              setQrError('El pago no pudo ser procesado');
            } else {
              console.log('⏳ Pago pendiente...');
            }
          }
        } catch (error: any) {
          console.error('Error verifying payment:', error);
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
    setCountdown(null);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = (qrImage: string, transactionId: string) => {
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `qr-${transactionId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / (1000 * 60));
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 0) {
        return 'Expirado';
      } else if (diffMins < 60) {
        return `${diffMins} minutos`;
      } else if (diffHours < 24) {
        return `${diffHours} horas`;
      } else {
        return `${diffDays} días`;
      }
    } catch {
      return 'Fecha desconocida';
    }
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return 'Expirado';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(price);
  };

  const getStatusColor = (status: string): { bg: string; text: string; border: string; icon: string } => {
    switch (status) {
      case 'PAID':
        return { 
          bg: 'bg-green-50', 
          text: 'text-green-700', 
          border: 'border-green-200',
          icon: 'text-green-500'
        };
      case 'PENDING':
        return { 
          bg: 'bg-yellow-50', 
          text: 'text-yellow-700', 
          border: 'border-yellow-200',
          icon: 'text-yellow-500'
        };
      case 'EXPIRED':
        return { 
          bg: 'bg-gray-50', 
          text: 'text-gray-700', 
          border: 'border-gray-200',
          icon: 'text-gray-500'
        };
      case 'FAILED':
      case 'CANCELLED':
        return { 
          bg: 'bg-red-50', 
          text: 'text-red-700', 
          border: 'border-red-200',
          icon: 'text-red-500'
        };
      default:
        return { 
          bg: 'bg-gray-50', 
          text: 'text-gray-700', 
          border: 'border-gray-200',
          icon: 'text-gray-500'
        };
    }
  };

  const getStatusIcon = (status: string, size: number = 20) => {
    const colors = getStatusColor(status);
    switch (status) {
      case 'PAID':
        return <CheckCircle className={`w-${size} h-${size} ${colors.icon}`} />;
      case 'PENDING':
        return <Clock className={`w-${size} h-${size} ${colors.icon}`} />;
      case 'EXPIRED':
        return <AlertCircle className={`w-${size} h-${size} ${colors.icon}`} />;
      case 'FAILED':
      case 'CANCELLED':
        return <X className={`w-${size} h-${size} ${colors.icon}`} />;
      default:
        return <Clock className={`w-${size} h-${size} ${colors.icon}`} />;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'PAID':
        return 'Pagado';
      case 'PENDING':
        return 'Pendiente';
      case 'EXPIRED':
        return 'Expirado';
      case 'FAILED':
        return 'Fallido';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const testPackages = PACKAGE_OPTIONS.filter(p => p.isTest);
  const realPackages = PACKAGE_OPTIONS.filter(p => !p.isTest);

  // Componente de detalle de QR (ahora muestra el QR recuperado)
  const QrDetailModal = () => {
    if (!showQrDetail || !selectedQrDetail) return null;

    const statusColors = getStatusColor(selectedQrDetail.paymentStatus);
    const isPending = selectedQrDetail.paymentStatus === 'PENDING';

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
        <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-fadeIn">
          {/* Header */}
          <div className={`p-4 border-b ${statusColors.bg} ${statusColors.border} flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(selectedQrDetail.paymentStatus, 24)}
              <h3 className="text-lg font-bold text-gray-900">
                Detalle de Recarga
              </h3>
            </div>
            <button
              onClick={() => setShowQrDetail(false)}
              className="p-2 hover:bg-white/50 rounded-lg transition"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="p-6 max-h-[80vh] overflow-auto">
            {loadingQrDetail ? (
              <div className="text-center py-12">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
                  <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-600 font-medium">Cargando detalle...</p>
                <p className="text-sm text-gray-500 mt-2">Obteniendo información del QR</p>
              </div>
            ) : qrDetailError ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">QR no disponible</h3>
                <p className="text-gray-600 mb-4">{qrDetailError}</p>
                <button
                  onClick={() => setShowQrDetail(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Estado actual */}
                <div className={`p-4 rounded-xl ${statusColors.bg} border ${statusColors.border}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Estado del pago</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
                      {getStatusText(selectedQrDetail.paymentStatus)}
                    </span>
                  </div>
                  {isPending && (
                    <p className="text-sm text-gray-600 mt-2 flex items-center gap-1">
                      <Info className="w-4 h-4 text-yellow-500" />
                      Escanea el código QR para pagar
                    </p>
                  )}
                  {selectedQrDetail.paymentStatus === 'PAID' && selectedQrDetail.paidAt && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Pagado el {formatDate(selectedQrDetail.paidAt)}
                    </p>
                  )}
                </div>

                {/* 🔥 QR CODE - Solo si está pendiente y tenemos la imagen */}
                {isPending && selectedQrDetail.qrImage && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-blue-600" />
                      Código QR para pagar
                    </h4>
                    
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
                      <div className="relative bg-white p-4 rounded-xl border-2 border-gray-200 shadow-lg">
                        <img 
                          src={selectedQrDetail.qrImage.startsWith('data:image') 
                            ? selectedQrDetail.qrImage 
                            : `data:image/png;base64,${selectedQrDetail.qrImage}`}
                          alt="QR Code" 
                          className="w-full max-w-[200px] mx-auto"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">Expira en:</span>
                      </div>
                      <span className="font-medium text-blue-600">
                        {selectedQrDetail.expiresAt ? formatRelativeTime(selectedQrDetail.expiresAt) : 'N/A'}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      Escanea con tu aplicación bancaria
                    </p>
                  </div>
                )}

                {/* Información de la recarga */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    Detalles de la compra
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Créditos:</span>
                      <span className="font-bold text-blue-600 text-lg">{selectedQrDetail.credits}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monto:</span>
                      <span className="font-bold text-gray-900">{formatPrice(selectedQrDetail.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Método:</span>
                      <span className="px-2 py-1 bg-white rounded text-sm font-medium">
                        {selectedQrDetail.paymethod === 'QR' ? 'Código QR' : selectedQrDetail.paymethod}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    Fechas importantes
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500 block">Creado el:</span>
                      <span className="text-sm font-medium">{formatDate(selectedQrDetail.createdAt)}</span>
                    </div>
                    {selectedQrDetail.expiresAt && (
                      <div>
                        <span className="text-xs text-gray-500 block">Expira el:</span>
                        <span className="text-sm font-medium">{formatDate(selectedQrDetail.expiresAt)}</span>
                        {isPending && (
                          <span className="text-xs text-yellow-600 block mt-1">
                            Tiempo restante: {formatRelativeTime(selectedQrDetail.expiresAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-3 pt-2">
                  {isPending && (
                    <button
                      onClick={() => {
                        setShowQrDetail(false);
                        // Aquí puedes redirigir a generar nuevo QR con los mismos datos
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Generar nuevo QR
                    </button>
                  )}
                  <button
                    onClick={() => setShowQrDetail(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Componente de historial de recargas
  const HistoryModal = () => {
    if (!showHistory) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fadeIn">
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <History className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Historial de Recargas</h3>
                  <p className="text-sm text-blue-100 mt-1">
                    {rechargeHistory.length} {rechargeHistory.length === 1 ? 'transacción' : 'transacciones'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-auto p-6 bg-gray-50">
            {loadingHistory ? (
              <div className="text-center py-12">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
                  <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-600 font-medium">Cargando historial...</p>
              </div>
            ) : historyError ? (
              <div className="text-center py-12 bg-white rounded-xl border border-red-200">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Error al cargar</h3>
                <p className="text-gray-600 mb-4">{historyError}</p>
                <button
                  onClick={loadRechargeHistory}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reintentar
                </button>
              </div>
            ) : rechargeHistory.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <QrCode className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No hay recargas aún</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Las recargas que realices aparecerán aquí.
                </p>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 inline-flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Recargar ahora
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {rechargeHistory.map((recharge) => {
                  const colors = getStatusColor(recharge.paymentStatus);
                  
                  return (
                    <div
                      key={recharge.id}
                      className="bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden group"
                    >
                      <div className={`h-1.5 ${colors.bg}`}></div>
                      
                      <div className="p-5">
                        {/* Cabecera */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${colors.bg} border ${colors.border}`}>
                              {getStatusIcon(recharge.paymentStatus, 24)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900 text-lg">
                                  {recharge.credits} créditos
                                </p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                                  {getStatusText(recharge.paymentStatus)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                              {formatPrice(recharge.amount)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(recharge.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* Grid de información */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-xs text-gray-500 block mb-1">Estado QR</span>
                            <div className="flex items-center gap-1.5">
                              {getStatusIcon(recharge.qrStatus, 16)}
                              <span className={`text-sm font-semibold capitalize ${
                                recharge.qrStatus === 'PAID' ? 'text-green-600' :
                                recharge.qrStatus === 'PENDING' ? 'text-yellow-600' :
                                recharge.qrStatus === 'EXPIRED' ? 'text-gray-600' :
                                'text-red-600'
                              }`}>
                                {recharge.qrStatus}
                              </span>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-xs text-gray-500 block mb-1">Método</span>
                            <div className="flex items-center gap-1.5">
                              {recharge.paymethod === 'QR' ? (
                                <QrCode className="w-4 h-4 text-blue-600" />
                              ) : (
                                <CreditCardIcon className="w-4 h-4 text-purple-600" />
                              )}
                              <span className="text-sm font-semibold text-gray-700">
                                {recharge.paymethod === 'QR' ? 'QR' : recharge.paymethod}
                              </span>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-xs text-gray-500 block mb-1">Expira</span>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-semibold text-gray-700">
                                {recharge.expiresAt ? formatRelativeTime(recharge.expiresAt) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botón ver detalles */}
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => handleViewQrDetail(recharge)}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 group-hover:translate-x-1 transition-transform bg-blue-50 px-3 py-1.5 rounded-lg"
                          >
                            Ver QR
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={() => setShowHistory(false)}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition font-medium"
            >
              Cerrar historial
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-lg font-semibold text-gray-700">Cargando...</p>
        </div>
      </div>
    );
  }

  const selectedPkg = getSelectedPackage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/80 rounded-xl transition-colors shadow-sm hover:shadow"
              title="Volver"
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

          {/* Botón de historial */}
          <button
            onClick={() => setShowHistory(true)}
            className="group flex items-center gap-3 px-5 py-2.5 bg-white border-2 border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm hover:shadow-md"
          >
            <div className="p-1.5 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
              <History size={18} className="text-blue-600" />
            </div>
            <div className="text-left">
              <span className="font-semibold block">Ver historial</span>
              <span className="text-xs text-gray-500">{rechargeHistory.length} recargas</span>
            </div>
          </button>
        </div>

        {/* Current Credits */}
        {currentCredits > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border-l-4 border-blue-500 hover:shadow-2xl transition-all">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Tus créditos actuales</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-gray-800">{currentCredits.toLocaleString()}</p>
                    <span className="text-sm text-gray-500">créditos disponibles</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm bg-blue-50 px-3 py-2 rounded-lg">
                <Clock size={16} className="text-blue-600" />
                <span className="text-blue-700 font-medium">Válidos por 1 año</span>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-center gap-3 animate-slideDown shadow-lg">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800">¡Recarga exitosa!</p>
              <p className="text-sm text-green-600">{successMessage || 'Tus créditos han sido actualizados'}</p>
            </div>
            <button
              onClick={() => setSuccess(false)}
              className="p-1 hover:bg-green-200 rounded-lg transition"
            >
              <X size={18} className="text-green-600" />
            </button>
          </div>
        )}

        {/* TOGGLE PARA MODO PRUEBA */}
        <div className="mb-6 flex items-center justify-end">
          <button
            onClick={() => setShowTestMode(!showTestMode)}
            className="group flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all"
          >
            {showTestMode ? <EyeOff size={18} /> : <Eye size={18} />}
            <span className="font-medium">
              {showTestMode ? 'Ocultar paquetes de prueba' : 'Mostrar paquetes de prueba'}
            </span>
          </button>
        </div>

        {/* PAQUETES DE PRUEBA */}
        {showTestMode && testPackages.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-purple-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              🧪 Paquetes de Prueba
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {testPackages.map((pkg) => {
                const isSelected = selectedPackage === pkg.id;
                
                return (
                  <div
                    key={pkg.id}
                    onClick={() => handlePackageSelect(pkg.id)}
                    className={`relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 border-2 ${
                      isSelected ? 'border-purple-500 ring-4 ring-purple-200' : 'border-purple-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="absolute top-0 right-0">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 shadow-md">
                        <Sparkles size={12} />
                        PRUEBA
                      </div>
                    </div>
                    
                    <div className="h-2 bg-gradient-to-r from-purple-400 to-pink-400"></div>
                    
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md">
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
                      
                      {isSelected && (
                        <div className="absolute bottom-2 right-2">
                          <div className="p-1 bg-purple-100 rounded-full">
                            <CheckCircle className="w-5 h-5 text-purple-600" />
                          </div>
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
          Paquetes Recomendados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {realPackages.map((pkg) => {
            const isSelected = selectedPackage === pkg.id;
            
            return (
              <div
                key={pkg.id}
                onClick={() => handlePackageSelect(pkg.id)}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                  isSelected ? 'ring-4 ring-blue-500 ring-offset-2' : ''
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1 shadow-md">
                      <Star size={12} />
                      {pkg.badge || 'POPULAR'}
                    </div>
                  </div>
                )}
                
                {pkg.savings && (
                  <div className="absolute top-0 left-0 z-10">
                    <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-br-lg shadow-md">
                      {pkg.savings}
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
                    <div className={`p-3 rounded-xl bg-gradient-to-br shadow-md ${
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
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{pkg.name}</h3>
                      <p className="text-xs text-gray-500">{pkg.badge}</p>
                    </div>
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
                  
                  {isSelected && (
                    <div className="absolute bottom-2 right-2">
                      <div className="p-1 bg-blue-100 rounded-full">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Datos de factura */}
        {selectedPackage && (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-8 hover:shadow-lg transition-all">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Datos de Factura (Opcional)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1 text-gray-400" />
                  Nombre/Razón Social
                </label>
                <input
                  type="text"
                  value={billData.billName}
                  onChange={(e) => setBillData({ ...billData, billName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Tu nombre o empresa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building className="w-4 h-4 inline mr-1 text-gray-400" />
                  NIT
                </label>
                <input
                  type="text"
                  value={billData.billNit}
                  onChange={(e) => setBillData({ ...billData, billNit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1 text-gray-400" />
                  Email
                </label>
                <input
                  type="email"
                  value={billData.email}
                  onChange={(e) => setBillData({ ...billData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1 text-gray-400" />
                  Concepto
                </label>
                <input
                  type="text"
                  value={billData.concept}
                  onChange={(e) => setBillData({ ...billData, concept: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Recarga de créditos"
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods */}
        {selectedPackage && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Método de pago
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedMethod('QR')}
                className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                  selectedMethod === 'QR' 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-2 rounded-lg transition-all ${
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
                {selectedMethod === 'QR' && (
                  <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Summary and Confirm */}
        {selectedPkg && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-6 text-white hover:shadow-2xl transition-all">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-white/80 mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Resumen de tu compra
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="bg-white/20 px-4 py-2 rounded-lg">
                    <span className="text-2xl font-bold">{getCreditsAmount()}</span>
                    <span className="text-white/80 ml-2">créditos</span>
                  </div>
                  <div className="w-px h-8 bg-white/30 hidden sm:block"></div>
                  <div className="bg-white/20 px-4 py-2 rounded-lg">
                    <span className="text-2xl font-bold">{formatPrice(getAmount())}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm bg-white/20 px-3 py-2 rounded-lg">
                  <Shield size={16} />
                  <span>Pago seguro</span>
                </div>
                
                <button
                  onClick={handleQrPayment}
                  disabled={processing || qrLoading}
                  className="px-8 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg group"
                >
                  {processing || qrLoading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5 group-hover:rotate-90 transition-transform" />
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-fadeIn">
              
              {qrLoading ? (
                <div className="text-center py-16 px-6">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-lg font-semibold text-gray-800">Generando código QR</p>
                </div>
              ) : qrError ? (
                <div className="text-center py-12 px-6">
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-12 h-12 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Error en el pago</h3>
                  <p className="text-gray-600 mb-6">{qrError}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseQrModal}
                      className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={handleQrPayment}
                      className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
              ) : qrData && verificationStatus === 'pending' ? (
                <>
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold mb-1">Pago con QR</h3>
                        <p className="text-blue-100 text-sm">Escanea con tu aplicación bancaria</p>
                      </div>
                      <button
                        onClick={handleCloseQrModal}
                        className="p-1 hover:bg-white/20 rounded-lg transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
                      <div className="relative bg-white p-4 rounded-xl border-2 border-gray-200 shadow-xl">
                        <img 
                          src={qrData.qrImage} 
                          alt="QR Code" 
                          className="w-full max-w-[250px] mx-auto"
                        />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-700">Tiempo restante:</span>
                        </div>
                        {countdown !== null && (
                          <span className={`text-xl font-bold font-mono ${countdown < 60 ? 'text-red-600' : 'text-blue-600'}`}>
                            {formatCountdown(countdown)}
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg">
                          <span className="text-xs text-gray-500 block">Monto</span>
                          <span className="text-lg font-bold text-blue-600">{formatPrice(qrData.amount)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <span className="text-xs text-gray-500 block">Créditos</span>
                          <span className="text-lg font-bold text-blue-600">{qrData.credits}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                      <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-gray-600" />
                        Pasos para pagar:
                      </h4>
                      <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                        <li>Abre tu aplicación bancaria</li>
                        <li>Selecciona "Pagar con QR"</li>
                        <li>Escanea el código QR</li>
                        <li>Confirma el pago</li>
                      </ol>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadQR(qrData.qrImage, qrData.transactionId)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span className="text-sm">Guardar</span>
                      </button>
                      <button
                        onClick={handleCloseQrModal}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Verificando pago...</span>
                    </div>
                  </div>
                </>
              ) : verificationStatus === 'success' ? (
                <div className="text-center py-12 px-6">
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Pago exitoso!</h3>
                  <p className="text-gray-600 mb-4">
                    Se han agregado <span className="font-bold text-green-600">{qrData?.credits}</span> créditos
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
                    <p className="text-sm text-green-700">Nuevo saldo: {currentCredits} créditos</p>
                  </div>
                </div>
              ) : verificationStatus === 'failed' ? (
                <div className="text-center py-12 px-6">
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-12 h-12 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Error en el pago</h3>
                  <p className="text-gray-600 mb-6">{qrError || 'No se pudo procesar el pago'}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseQrModal}
                      className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={handleQrPayment}
                      className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Modal de historial */}
        <HistoryModal />
        
        {/* Modal de detalle de QR */}
        <QrDetailModal />
      </div>
    </div>
  );
};

export default RechargeCredits;