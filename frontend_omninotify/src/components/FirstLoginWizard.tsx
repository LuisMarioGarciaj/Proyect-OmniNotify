// src/components/FirstLoginWizard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  Users,
  Mail,
  MessageCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  Sparkles,
  Zap,
  Globe,
  Smartphone,
  FileText,
  Tag,
  Bell,
  Coins,
  ChevronRight,
  UserPlus,
  Send,
  CreditCard,
  Layers,
  Plus,
  Phone,
  AtSign,
  BookOpen,
  ShoppingBag
} from 'lucide-react';

interface FirstLoginWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  userName: string;
  companyName?: string;
  companyId?: string;
}

type Step = 1 | 2 | 3 | 4 | 5;

const translations = {
  es: {
    welcome: {
      title: '¡Bienvenido a Omni-Notify!',
      subtitle: 'Completa estos pasos para comenzar',
      description: 'Te guiaremos para que configures tu cuenta y empieces a enviar notificaciones.',
      startButton: 'Comenzar recorrido',
      skipButton: 'Omitir y empezar a usar'
    },
    step1: {
      title: 'Configura tu empresa',
      description: 'Personaliza la información de tu organización',
      nameLabel: 'Nombre de la empresa',
      namePlaceholder: 'Ej: Mi Empresa S.A.',
      logoLabel: 'Logo de la empresa',
      logoHint: 'Arrastra o haz clic para subir un logo',
      nextButton: 'Siguiente'
    },
    step2: {
      title: 'Conoce tus créditos',
      description: 'Cada notificación consume créditos según el canal',
      emailCost: 'Email',
      smsCost: 'SMS',
      whatsappCost: 'WhatsApp',
      creditsInfo: 'Créditos iniciales',
      freeCredits: 'Créditos gratis de bienvenida',
      howToRecharge: '¿Cómo recargar?',
      rechargeInfo: 'Puedes recargar créditos desde el panel en cualquier momento usando tu tarjeta o código QR',
      nextButton: 'Siguiente'
    },
    step3: {
      title: 'Crea tus primeros elementos',
      description: 'Prepara todo para empezar a enviar notificaciones',
      createContact: 'Crear Contactos',
      createContactDesc: 'Añade tus primeros contactos manualmente o importa desde Excel',
      createTag: 'Crear Tags',
      createTagDesc: 'Organiza tus contactos por categorías',
      createTemplate: 'Crear Templates',
      createTemplateDesc: 'Diseña plantillas para Email, SMS y WhatsApp',
      createNow: 'Crear ahora',
      later: 'Más tarde',
      nextButton: 'Siguiente'
    },
   
    step5: {
      title: '¡Todo listo!',
      description: 'Estás listo para comenzar',
      whatToDo: '¿Qué te gustaría hacer primero?',
      createContact: 'Crear contactos',
      createTag: 'Crear tags',
      createTemplate: 'Crear template',
      rechargeCredits: 'Recargar créditos',
      sendNotification: 'Enviar notificación',
      dashboard: 'Ir al Dashboard',
      quickActions: 'Acciones rápidas',
      explore: 'Explorar'
    }
  },
  en: {
    welcome: {
      title: 'Welcome to Omni-Notify!',
      subtitle: 'Complete these steps to get started',
      description: 'We\'ll guide you through setting up your account and start sending notifications.',
      startButton: 'Start Tour',
      skipButton: 'Skip and start using'
    },
    step1: {
      title: 'Configure your company',
      description: 'Customize your organization information',
      nameLabel: 'Company name',
      namePlaceholder: 'e.g., My Company Inc.',
      logoLabel: 'Company logo',
      logoHint: 'Drag and drop or click to upload a logo',
      nextButton: 'Next'
    },
    step2: {
      title: 'Learn about credits',
      description: 'Each notification consumes credits based on channel',
      emailCost: 'Email',
      smsCost: 'SMS',
      whatsappCost: 'WhatsApp',
      creditsInfo: 'Initial credits',
      freeCredits: 'Welcome free credits',
      howToRecharge: 'How to recharge?',
      rechargeInfo: 'You can recharge credits anytime from the panel using your card or QR code',
      nextButton: 'Next'
    },
    step3: {
      title: 'Create your first items',
      description: 'Prepare everything to start sending notifications',
      createContact: 'Create Contacts',
      createContactDesc: 'Add your first contacts manually or import from Excel',
      createTag: 'Create Tags',
      createTagDesc: 'Organize your contacts by categories',
      createTemplate: 'Create Templates',
      createTemplateDesc: 'Design templates for Email, SMS and WhatsApp',
      createNow: 'Create now',
      later: 'Later',
      nextButton: 'Next'
    },
    step5: {
      title: 'All set!',
      description: 'You\'re ready to get started',
      whatToDo: 'What would you like to do first?',
      createContact: 'Create contacts',
      createTag: 'Create tags',
      createTemplate: 'Create template',
      rechargeCredits: 'Recharge credits',
      sendNotification: 'Send notification',
      dashboard: 'Go to Dashboard',
      quickActions: 'Quick actions',
      explore: 'Explore'
    }
  }
};

type Language = 'en' | 'es';

const FirstLoginWizard: React.FC<FirstLoginWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  userName,
  companyName = '',
  companyId
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [language] = useState<Language>('es');
  const t = translations[language];
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Step 1 state
  const [companyNameLocal, setCompanyNameLocal] = useState(companyName);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setCompanyNameLocal(companyName);
      setLogoPreview(null);
      setHasChanges(false);
      setIsClosing(false);
    }
  }, [isOpen, companyName]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep === 5) {
      handleComplete();
    } else {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    
    // Save company changes if any
    if (hasChanges && companyId) {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/companies/${companyId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: companyNameLocal,
            logo: logoPreview || undefined,
          }),
        });
        
        if (response.ok) {
          const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
          userData.company_name = companyNameLocal;
          localStorage.setItem('user_data', JSON.stringify(userData));
        }
      } catch (error) {
        console.error('Error saving company:', error);
      }
    }
    
    setIsSaving(false);
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 2000000) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNavigate = (path: string) => {
    // onComplete();
    navigate(path);
    if (path === '/dashboard') onComplete();
  };

  const handleCreateAction = (type: 'contact' | 'tag' | 'template') => {
    // onComplete();
    if (type === 'contact') {
      navigate('/contacts');
    } else if (type === 'tag') {
      navigate('/tags');
    } else if (type === 'template') {
      navigate('/templates');
    }
  };

  const renderStepIndicator = () => (
    <div className="flex justify-center gap-2 mb-6">
      {[1, 2, 3, 4, 5].map((step) => (
        <div
          key={step}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            currentStep >= step
              ? 'w-8 bg-gradient-to-r from-blue-500 to-indigo-600'
              : 'w-4 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Building className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">{t.step1.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{t.step1.description}</p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t.step1.nameLabel}
        </label>
        <input
          type="text"
          value={companyNameLocal}
          onChange={(e) => {
            setCompanyNameLocal(e.target.value);
            setHasChanges(true);
          }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          placeholder={t.step1.namePlaceholder}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t.step1.logoLabel}
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-blue-400 transition cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
            id="logo-upload"
          />
          <label htmlFor="logo-upload" className="cursor-pointer block">
            {logoPreview ? (
              <div className="flex flex-col items-center">
                <img src={logoPreview} alt="Logo preview" className="w-24 h-24 object-contain mb-2" />
                <span className="text-sm text-blue-600">Cambiar logo</span>
              </div>
            ) : (
              <div className="py-6">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{t.step1.logoHint}</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG (máx 2MB)</p>
              </div>
            )}
          </label>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Coins className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">{t.step2.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{t.step2.description}</p>
      </div>
      
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5">
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-blue-600">150</div>
          <div className="text-sm text-gray-600">{t.step2.freeCredits}</div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-500" />
              <span className="text-gray-700">{t.step2.emailCost}</span>
            </div>
            <span className="font-bold text-blue-600">1 crédito</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-gray-700">{t.step2.whatsappCost}</span>
            </div>
            <span className="font-bold text-emerald-600">1 crédito</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-purple-500" />
              <span className="text-gray-700">{t.step2.smsCost}</span>
            </div>
            <span className="font-bold text-purple-600">2 créditos</span>
          </div>
        </div>
      </div>
      
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
        <div className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">{t.step2.howToRecharge}</p>
            <p className="text-xs text-amber-700 mt-1">{t.step2.rechargeInfo}</p>
            <button
              onClick={() => handleNavigate('/credits/recharge')}
              className="mt-2 text-xs font-medium text-amber-800 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition inline-flex items-center gap-1"
            >
              <ShoppingBag className="w-3 h-3" />
              Recargar ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Layers className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">{t.step3.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{t.step3.description}</p>
      </div>
      
      {/* Create Contact */}
      <div className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition group">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800">{t.step3.createContact}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{t.step3.createContactDesc}</p>
            </div>
          </div>
          <button
            onClick={() => handleCreateAction('contact')}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t.step3.createNow}
          </button>
        </div>
      </div>
      
      {/* Create Tag */}
      <div className="border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition group">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800">{t.step3.createTag}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{t.step3.createTagDesc}</p>
            </div>
          </div>
          <button
            onClick={() => handleCreateAction('tag')}
            className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t.step3.createNow}
          </button>
        </div>
      </div>
      
      {/* Create Template */}
      <div className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition group">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-800">{t.step3.createTemplate}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{t.step3.createTemplateDesc}</p>
              <div className="flex gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  <Mail className="w-3 h-3" /> Email
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  <Phone className="w-3 h-3" /> SMS
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleCreateAction('template')}
            className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t.step3.createNow}
          </button>
        </div>
      </div>
    </div>
  );

  

  const renderStep5 = () => (
    <div className="space-y-5">
      <div className="text-center mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">{t.step5.title}</h3>
        <p className="text-sm text-gray-500">{t.step5.description}</p>
        <p className="text-sm text-green-600 font-medium mt-2">✨ ¡Bienvenido, {userName}! ✨</p>
      </div>
      
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          {t.step5.quickActions}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleNavigate('/credits/recharge')}
            className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:bg-yellow-50 transition group border border-gray-100"
          >
            <div className="p-2 bg-yellow-100 rounded-xl group-hover:bg-yellow-200 transition">
              <Coins className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">{t.step5.rechargeCredits}</span>
          </button>
          
          <button
            onClick={() => handleNavigate('/contacts')}
            className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:bg-blue-50 transition group border border-gray-100"
          >
            <div className="p-2 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">{t.step5.createContact}</span>
          </button>
          
          <button
            onClick={() => handleNavigate('/tags')}
            className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:bg-purple-50 transition group border border-gray-100"
          >
            <div className="p-2 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition">
              <Tag className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">{t.step5.createTag}</span>
          </button>
          
          <button
            onClick={() => handleNavigate('/templates')}
            className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl hover:bg-emerald-50 transition group border border-gray-100"
          >
            <div className="p-2 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">{t.step5.createTemplate}</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleNavigate('/notifications')}
          className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-emerald-50 transition group"
        >
          <div className="p-3 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition">
            <Bell className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-sm font-medium text-gray-700">{t.step5.sendNotification}</span>
        </button>
        
      </div>
      
      <div className="pt-2">
        <button
          onClick={() => handleNavigate('/dashboard')}
          className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-medium hover:from-gray-700 hover:to-gray-800 transition flex items-center justify-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          {t.step5.dashboard}
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
    //   case 4: return renderStep4();
      case 5: return renderStep5();
      default: return null;
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return companyNameLocal.trim().length > 0;
    }
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
        {/* Header with close button */}
        <div className="flex justify-end p-3 border-b">
          <button
            onClick={handleSkip}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
            title={t.welcome.skipButton}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Step indicator */}
        {renderStepIndicator()}
        
        {/* Content */}
        <div className="px-6 pb-6">
          {renderContent()}
        </div>
        
        {/* Navigation buttons */}
        <div className="px-6 pb-6 flex justify-between gap-3">
          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={handleBack}
              disabled={isSaving}
              className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-xl hover:bg-gray-100 transition flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>
          )}
          
          {currentStep < 5 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || isSaving}
              className={`ml-auto px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition ${
                canProceed()
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {t.step1.nextButton}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={isSaving}
              className="ml-auto px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirstLoginWizard;