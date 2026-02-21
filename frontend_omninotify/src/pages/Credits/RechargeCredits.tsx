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
  Loader2
} from 'lucide-react';
import { creditsService } from '../../services/credits.service';
import type { CreditsPackage } from '../../services/credits.service'; // <-- Cambio aquí

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  credits?: number;
}

const RechargeCredits: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [packages, setPackages] = useState<CreditsPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'qr'>('card');

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

  const loadPackages = async () => {
    setLoading(true);
    try {
      const data = await creditsService.getCreditsPackages();
      setPackages(data);
      
      // Seleccionar paquete popular por defecto
      const popular = data.find(p => p.popular);
      if (popular) {
        setSelectedPackage(popular.id);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async () => {
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
        
        // Actualizar créditos en localStorage
        const updatedUser = { ...user, credits: result.credits };
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
        setUser(updatedUser);
        
        // Disparar evento para actualizar header
        window.dispatchEvent(new CustomEvent('credits-updated', { 
          detail: { companyId: user.company_id, credits: result.credits }
        }));

        // Ocultar mensaje de éxito después de 3 segundos
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

        {/* Current Credits */}
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

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {packages.map((pkg) => {
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
                  
                  {pkg.description && (
                    <p className="text-sm text-gray-600 text-center mb-4">{pkg.description}</p>
                  )}
                  
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

        {/* Payment Methods */}
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
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Código QR</p>
                  <p className="text-xs text-gray-600">Escanea y paga</p>
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
                <p className="text-blue-100 mb-2">Resumen de tu compra</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-2xl font-bold">{selectedPkg.credits}</span>
                    <span className="text-blue-100 ml-2">créditos</span>
                  </div>
                  <div className="w-px h-8 bg-blue-400 hidden sm:block"></div>
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
                  disabled={processing}
                  className="px-8 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Confirmar Recarga
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        
      </div>
    </div>
  );
};

export default RechargeCredits;