// SMSConfiguration.tsx - Versión con soporte para Vonage y Twilio (con balance para ambos)
import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Loader2,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Server,
  Database,   
  Phone,
  Smartphone,
  Globe,
  Shield,
  Key,
  Mail,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  Coins,
} from "lucide-react";
import axios from "axios";
import axiosInstance from "../utils/axios.config";
import { smsConfigService } from "../services/sms-config.service";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface SMSConfigurationProps {
  companyId: string;
  companyName?: string;
}

interface VonageCredentials {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
  isActive: boolean;
}

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  isActive: boolean;
}

interface SmsBalance {
  value: number;
  currency: string;
  formatted: string;
  rawValue?: number;
  lastUpdated?: string;
}

interface TwilioBalanceResponse {
  balance: string;
  currency: string;
}

type Provider = "vonage" | "twilio";

const SMSConfiguration: React.FC<SMSConfigurationProps> = ({
  companyId,
  companyName = "Mi Empresa",
}) => {
  // Estados para el proveedor activo
  const [activeProvider, setActiveProvider] = useState<Provider>("vonage");

  // Estados para configuración global de Vonage
  const [vonageCredentials, setVonageCredentials] = useState<VonageCredentials>(
    {
      apiKey: "",
      apiSecret: "",
      fromNumber: "OmniNotify",
      isActive: true,
    },
  );

  // Estados para configuración global de Twilio
  const [twilioCredentials, setTwilioCredentials] = useState<TwilioCredentials>(
    {
      accountSid: "",
      authToken: "",
      fromNumber: "",
      isActive: true,
    },
  );

  // Estados para saber si los secrets están cargados
  const [vonageHasStoredSecret, setVonageHasStoredSecret] = useState(false);
  const [vonageSecretLastChars, setVonageSecretLastChars] = useState("");
  const [twilioHasStoredToken, setTwilioHasStoredToken] = useState(false);
  const [twilioTokenLastChars, setTwilioTokenLastChars] = useState("");

  // Estados para balances
  const [vonageBalance, setVonageBalance] = useState<SmsBalance | null>(null);
  const [twilioBalance, setTwilioBalance] = useState<SmsBalance | null>(null);

  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingVonageBalance, setLoadingVonageBalance] = useState(false);
  const [loadingTwilioBalance, setLoadingTwilioBalance] = useState(false);
  const [lastVonageUpdate, setLastVonageUpdate] = useState<string>("");
  const [lastTwilioUpdate, setLastTwilioUpdate] = useState<string>("");

  // Estados para mostrar/ocultar contraseñas
  const [showVonageApiKey, setShowVonageApiKey] = useState(false);
  const [showVonageApiSecret, setShowVonageApiSecret] = useState(false);
  const [showTwilioAccountSid, setShowTwilioAccountSid] = useState(false);
  const [showTwilioAuthToken, setShowTwilioAuthToken] = useState(false);

  // Estados para mensajes
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Refs para intervalos de actualización automática
  const vonageRefreshIntervalRef = useRef<number | null>(null);
  const twilioRefreshIntervalRef = useRef<number | null>(null);

  // Cargar configuraciones al iniciar
// Cargar configuraciones al iniciar
useEffect(() => {
  const loadAll = async () => {
    await loadConfigurations();
    
    // Cargar proveedor activo desde el backend
    try {
      const provider = await smsConfigService.getActiveProvider();
      setActiveProvider(provider);
    } catch (error) {
      console.error('Error cargando proveedor activo:', error);
    }
  };
  
  loadAll();
  
  return () => {
    if (vonageRefreshIntervalRef.current) {
      clearInterval(vonageRefreshIntervalRef.current);
    }
    if (twilioRefreshIntervalRef.current) {
      clearInterval(twilioRefreshIntervalRef.current);
    }
  };
}, []);

  // Configurar actualización automática del balance según proveedor activo
  useEffect(() => {
    // Limpiar intervalos existentes
    if (vonageRefreshIntervalRef.current) {
      clearInterval(vonageRefreshIntervalRef.current);
      vonageRefreshIntervalRef.current = null;
    }
    if (twilioRefreshIntervalRef.current) {
      clearInterval(twilioRefreshIntervalRef.current);
      twilioRefreshIntervalRef.current = null;
    }

    // Configurar intervalo para Vonage si está activo y tiene credenciales
    if (
      activeProvider === "vonage" &&
      vonageCredentials.apiKey &&
      vonageHasStoredSecret
    ) {
      getVonageBalance(); // Obtener inmediatamente
      vonageRefreshIntervalRef.current = window.setInterval(
        () => {
          getVonageBalance();
        },
        5 * 60 * 1000,
      ); // Cada 5 minutos
    }

    // Configurar intervalo para Twilio si está activo y tiene credenciales
    if (
      activeProvider === "twilio" &&
      twilioCredentials.accountSid &&
      twilioHasStoredToken
    ) {
      getTwilioBalance(); // Obtener inmediatamente
      twilioRefreshIntervalRef.current = window.setInterval(
        () => {
          getTwilioBalance();
        },
        5 * 60 * 1000,
      ); // Cada 5 minutos
    }

    return () => {
      if (vonageRefreshIntervalRef.current) {
        clearInterval(vonageRefreshIntervalRef.current);
      }
      if (twilioRefreshIntervalRef.current) {
        clearInterval(twilioRefreshIntervalRef.current);
      }
    };
  }, [
    activeProvider,
    vonageCredentials.apiKey,
    vonageHasStoredSecret,
    twilioCredentials.accountSid,
    twilioHasStoredToken,
  ]);

  // Cargar ambas configuraciones
  const loadConfigurations = async () => {
    setLoading(true);
    try {
      await Promise.all([loadVonageConfig(), loadTwilioConfig()]);
    } catch (error: any) {
      console.error("Error cargando configuraciones:", error);
      showMessage("Error cargando configuraciones de SMS", "error");
    } finally {
      setLoading(false);
    }
  };

  // Cargar configuración Vonage desde System_Config
  const loadVonageConfig = async () => {
    try {
      const response = await axiosInstance.get(
        `${API_BASE_URL}/system/config/vonage`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        },
      );

      if (response.data.success) {
        const data = response.data.data;
        setVonageCredentials({
          apiKey: data.apiKey || "",
          apiSecret: "", // No recibimos el secret completo
          fromNumber: data.fromNumber || "OmniNotify",
          isActive: data.isActive !== false,
        });
        setVonageHasStoredSecret(data.hasSecret || false);
        setVonageSecretLastChars(data.lastChars || "");

        // Cargar balance automáticamente si es el proveedor activo
        if (activeProvider === "vonage" && data.apiKey && data.hasSecret) {
          await getVonageBalance();
        }
      }
    } catch (error: any) {
      console.error("Error cargando configuración Vonage:", error);
    }
  };

  // Cargar configuración Twilio desde System_Config
  const loadTwilioConfig = async () => {
    try {
      const response = await axiosInstance.get(
        `${API_BASE_URL}/system/config/twilio`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        },
      );

      if (response.data.success) {
        const data = response.data.data;
        setTwilioCredentials({
          accountSid: data.accountSid || "",
          authToken: "", // No recibimos el token completo
          fromNumber: data.fromNumber || "",
          isActive: data.isActive !== false,
        });
        setTwilioHasStoredToken(data.hasToken || false);
        setTwilioTokenLastChars(data.lastChars || "");

        // Cargar balance automáticamente si es el proveedor activo
        if (activeProvider === "twilio" && data.accountSid && data.hasToken) {
          await getTwilioBalance();
        }
      }
    } catch (error: any) {
      console.error("Error cargando configuración Twilio:", error);
    }
  };

  // Guardar configuración según proveedor activo
  const handleSave = async () => {
    setSaving(true);
    try {
      let response;

      if (activeProvider === "vonage") {
        const payload: any = {
          apiKey: vonageCredentials.apiKey,
          fromNumber: vonageCredentials.fromNumber,
          isActive: vonageCredentials.isActive,
        };

        // Solo incluir apiSecret si se escribió algo
        if (vonageCredentials.apiSecret.trim() !== "") {
          payload.apiSecret = vonageCredentials.apiSecret;
        }

        response = await axiosInstance.put(
          `${API_BASE_URL}/system/config/vonage`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
          },
        );

        if (response.data.success) {
          showMessage(
            "✅ Configuración de Vonage guardada exitosamente",
            "success",
          );

          setVonageHasStoredSecret(true);
          setVonageCredentials((prev) => ({
            ...prev,
            apiSecret: "", // Limpiar el campo por seguridad
          }));

          await loadVonageConfig();
          await getVonageBalance();
        }
      } else {
        const payload: any = {
          accountSid: twilioCredentials.accountSid,
          fromNumber: twilioCredentials.fromNumber,
          isActive: twilioCredentials.isActive,
        };

        // Solo incluir authToken si se escribió algo
        if (twilioCredentials.authToken.trim() !== "") {
          payload.authToken = twilioCredentials.authToken;
        }

        response = await axiosInstance.put(
          `${API_BASE_URL}/system/config/twilio`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
          },
        );

        if (response.data.success) {
          showMessage(
            "✅ Configuración de Twilio guardada exitosamente",
            "success",
          );

          setTwilioHasStoredToken(true);
          setTwilioCredentials((prev) => ({
            ...prev,
            authToken: "", // Limpiar el campo por seguridad
          }));

          await loadTwilioConfig();
          await getTwilioBalance();
        }
      }
    } catch (error: any) {
      showMessage(
        "Error guardando configuración: " +
          (error.response?.data?.error || error.message),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  // Probar conexión según proveedor activo
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      let testPayload: any = {
        to: "+521234567890", // Número de prueba - idealmente sería configurable
        provider: activeProvider,
        metadata: {
          companyName,
          testType: "connection_test",
        },
      };

      if (activeProvider === "vonage") {
        // Si se ingresaron credenciales nuevas, usarlas para la prueba
        if (vonageCredentials.apiKey && vonageCredentials.apiSecret) {
          testPayload.apiKey = vonageCredentials.apiKey;
          testPayload.apiSecret = vonageCredentials.apiSecret;
          testPayload.fromNumber = vonageCredentials.fromNumber;
        }
      } else {
        if (twilioCredentials.accountSid && twilioCredentials.authToken) {
          testPayload.accountSid = twilioCredentials.accountSid;
          testPayload.authToken = twilioCredentials.authToken;
          testPayload.fromNumber = twilioCredentials.fromNumber;
        }
      }

      const response = await axios.post(
        `${API_BASE_URL}/sms/test`,
        testPayload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        },
      );

      if (response.data.success) {
        showMessage(
          `✅ Conexión con ${activeProvider === "vonage" ? "Vonage" : "Twilio"} exitosa`,
          "success",
        );
      } else {
        showMessage("❌ Error en conexión: " + response.data.error, "error");
      }
    } catch (error: any) {
      showMessage(
        "Error probando conexión: " +
          (error.response?.data?.error || error.message),
        "error",
      );
    } finally {
      setTesting(false);
    }
  };

  // Obtener balance de Vonage
  const getVonageBalance = async () => {
    if (!vonageCredentials.apiKey || !vonageHasStoredSecret) {
      return;
    }

    setLoadingVonageBalance(true);
    try {
      const response = await axiosInstance.get(
        `${API_BASE_URL}/sms/balance/${companyId}`,
        {
          params: { provider: "vonage" },
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        },
      );

      if (response.data.success) {
        const balanceData = response.data.balance;

        setVonageBalance({
          value: balanceData.value,
          currency: balanceData.currency || "EUR",
          formatted: balanceData.formatted,
          rawValue: balanceData.value,
        });

        setLastVonageUpdate(
          new Date().toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      }
    } catch (error: any) {
      console.error("Error obteniendo balance de Vonage:", error);

      // Datos mock para desarrollo
      if (import.meta.env.DEV) {
        setVonageBalance({
          value: 12.3456789,
          currency: "EUR",
          formatted: "€12.3456789",
          rawValue: 12.3456789,
        });
        setLastVonageUpdate(new Date().toLocaleTimeString("es-ES"));
        showMessage("Balance de Vonage (ejemplo - modo desarrollo)", "info");
      }
    } finally {
      setLoadingVonageBalance(false);
    }
  };

  // Obtener balance de Twilio
  const getTwilioBalance = async () => {
    if (!twilioCredentials.accountSid || !twilioHasStoredToken) {
      return;
    }

    setLoadingTwilioBalance(true);
    try {
      // Llamada al backend para obtener balance de Twilio
      const response = await axiosInstance.get(
        `${API_BASE_URL}/sms/twilio/balance`,
        {
          params: {
            accountSid: twilioCredentials.accountSid,
            // El authToken se obtiene del backend desde System_Config
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        },
      );

      if (response.data.success) {
        const balanceData = response.data.balance;

        // Formatear el balance de Twilio (viene como string ej: "12.29")
        const balanceValue = parseFloat(balanceData.balance);
        const currency = balanceData.currency || "USD";

        // Formatear según la moneda
        const formatted = new Intl.NumberFormat("es-ES", {
          style: "currency",
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(balanceValue);

        setTwilioBalance({
          value: balanceValue,
          currency: currency,
          formatted: formatted,
          rawValue: balanceValue,
        });

        setLastTwilioUpdate(
          new Date().toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        );
      }
    } catch (error: any) {
      console.error("Error obteniendo balance de Twilio:", error);

      // Datos mock para desarrollo
      if (import.meta.env.DEV) {
        setTwilioBalance({
          value: 25.5,
          currency: "USD",
          formatted: "$25.50",
          rawValue: 25.5,
        });
        setLastTwilioUpdate(new Date().toLocaleTimeString("es-ES"));
        showMessage("Balance de Twilio (ejemplo - modo desarrollo)", "info");
      }
    } finally {
      setLoadingTwilioBalance(false);
    }
  };

  const handleManualRefresh = async () => {
    if (activeProvider === "vonage") {
      await getVonageBalance();
      showMessage("Balance de Vonage actualizado manualmente", "success");
    } else {
      await getTwilioBalance();
      showMessage("Balance de Twilio actualizado manualmente", "success");
    }
  };

  const showMessage = (text: string, type: "success" | "error" | "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showMessage(`${label} copiado al portapapeles`, "success");
      })
      .catch(() => {
        showMessage("Error al copiar", "error");
      });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Cargando configuraciones SMS...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Mensajes de estado */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex justify-between items-center animate-slideIn ${
            message.type === "success"
              ? "bg-green-100 text-green-800 border border-green-200"
              : message.type === "error"
                ? "bg-red-100 text-red-800 border border-red-200"
                : "bg-blue-100 text-blue-800 border border-blue-200"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-lg hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl">
            <Database className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Configuración Global de SMS
            </h1>
            <p className="text-gray-600">
              Credenciales centralizadas para todos los proveedores
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={
              (activeProvider === "vonage" &&
                (!vonageCredentials.apiKey ||
                  !vonageHasStoredSecret ||
                  loadingVonageBalance)) ||
              (activeProvider === "twilio" &&
                (!twilioCredentials.accountSid ||
                  !twilioHasStoredToken ||
                  loadingTwilioBalance))
            }
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
          >
            {(activeProvider === "vonage" && loadingVonageBalance) ||
            (activeProvider === "twilio" && loadingTwilioBalance) ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Actualizar Balance
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[140px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar {activeProvider === "vonage" ? "Vonage" : "Twilio"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selector de Proveedor */}
      <div className="mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 inline-flex">
          <button
            onClick={async () => {
              setActiveProvider("vonage");
              const success =
                await smsConfigService.setActiveProvider("vonage");
              if (success) {
                showMessage("Proveedor activo cambiado a Vonage", "success");
              } else {
                showMessage("Error al guardar el proveedor activo", "error");
              }
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeProvider === "vonage"
                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Phone className="w-5 h-5" />
            Vonage (Nexmo)
          </button>

          <button
            onClick={async () => {
              setActiveProvider("twilio");
              const success =
                await smsConfigService.setActiveProvider("twilio");
              if (success) {
                showMessage("Proveedor activo cambiado a Twilio", "success");
              } else {
                showMessage("Error al guardar el proveedor activo", "error");
              }
            }}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeProvider === "twilio"
                ? "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Smartphone className="w-5 h-5" />
            Twilio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel izquierdo: Configuración */}
        <div className="lg:col-span-2 space-y-6">
          {/* Configuración según proveedor activo */}
          <div
            className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
              activeProvider === "vonage"
                ? "border-green-200"
                : "border-red-200"
            }`}
          >
            <div
              className={`p-6 border-b ${
                activeProvider === "vonage"
                  ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                  : "bg-gradient-to-r from-red-50 to-orange-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {activeProvider === "vonage" ? (
                  <Database className="w-5 h-5 text-green-600" />
                ) : (
                  <Database className="w-5 h-5 text-red-600" />
                )}
                <h2
                  className={`text-xl font-semibold ${
                    activeProvider === "vonage"
                      ? "text-green-800"
                      : "text-red-800"
                  }`}
                >
                  Credenciales Globales de{" "}
                  {activeProvider === "vonage" ? "Vonage" : "Twilio"}
                </h2>
              </div>
              <p className="text-gray-600 text-sm mt-1">
                Estas credenciales se usarán para TODAS las empresas del sistema
              </p>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                <Server className="w-3 h-3" />
                <span>Configuración en System_Config</span>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Campos específicos de Vonage */}
                {activeProvider === "vonage" && (
                  <>
                    {/* API Key */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          <Key className="w-4 h-4 inline mr-1 text-green-600" />
                          API Key de Vonage
                        </label>
                        <button
                          onClick={() =>
                            copyToClipboard(vonageCredentials.apiKey, "API Key")
                          }
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          disabled={!vonageCredentials.apiKey}
                        >
                          Copiar
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showVonageApiKey ? "text" : "password"}
                          value={vonageCredentials.apiKey}
                          onChange={(e) =>
                            setVonageCredentials({
                              ...vonageCredentials,
                              apiKey: e.target.value,
                            })
                          }
                          placeholder="Ej: 84a24d93"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowVonageApiKey(!showVonageApiKey)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                        >
                          {showVonageApiKey ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* API Secret */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          <Shield className="w-4 h-4 inline mr-1 text-green-600" />
                          API Secret de Vonage
                        </label>
                        <div className="flex items-center gap-2">
                          {vonageHasStoredSecret &&
                            !vonageCredentials.apiSecret && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                ✓ Guardado (
                                {vonageSecretLastChars
                                  ? `...${vonageSecretLastChars}`
                                  : ""}
                                )
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showVonageApiSecret ? "text" : "password"}
                          value={vonageCredentials.apiSecret}
                          onChange={(e) =>
                            setVonageCredentials({
                              ...vonageCredentials,
                              apiSecret: e.target.value,
                            })
                          }
                          placeholder={
                            vonageHasStoredSecret
                              ? "•••••••• (dejar vacío para mantener)"
                              : "Ej: 46Xump31CGyK88hf"
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors pr-12"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowVonageApiSecret(!showVonageApiSecret)
                          }
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                        >
                          {showVonageApiSecret ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Campos específicos de Twilio */}
                {activeProvider === "twilio" && (
                  <>
                    {/* Account SID */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          <Key className="w-4 h-4 inline mr-1 text-red-600" />
                          Account SID de Twilio
                        </label>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              twilioCredentials.accountSid,
                              "Account SID",
                            )
                          }
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          disabled={!twilioCredentials.accountSid}
                        >
                          Copiar
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showTwilioAccountSid ? "text" : "password"}
                          value={twilioCredentials.accountSid}
                          onChange={(e) =>
                            setTwilioCredentials({
                              ...twilioCredentials,
                              accountSid: e.target.value,
                            })
                          }
                          placeholder="Tu Account SID aquí"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors pr-12"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowTwilioAccountSid(!showTwilioAccountSid)
                          }
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                        >
                          {showTwilioAccountSid ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Auth Token */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          <Shield className="w-4 h-4 inline mr-1 text-red-600" />
                          Auth Token de Twilio
                        </label>
                        <div className="flex items-center gap-2">
                          {twilioHasStoredToken &&
                            !twilioCredentials.authToken && (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                ✓ Guardado (
                                {twilioTokenLastChars
                                  ? `...${twilioTokenLastChars}`
                                  : ""}
                                )
                              </span>
                            )}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showTwilioAuthToken ? "text" : "password"}
                          value={twilioCredentials.authToken}
                          onChange={(e) =>
                            setTwilioCredentials({
                              ...twilioCredentials,
                              authToken: e.target.value,
                            })
                          }
                          placeholder={
                            twilioHasStoredToken
                              ? "•••••••• (dejar vacío para mantener)"
                              : "b4b41a075e9b0ec8c8674cd5bc062a30"
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors pr-12"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowTwilioAuthToken(!showTwilioAuthToken)
                          }
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                        >
                          {showTwilioAuthToken ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Número de Origen (común para ambos) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1 text-gray-600" />
                    Número de Origen (From)
                  </label>
                  <input
                    type="text"
                    value={
                      activeProvider === "vonage"
                        ? vonageCredentials.fromNumber
                        : twilioCredentials.fromNumber
                    }
                    onChange={(e) => {
                      if (activeProvider === "vonage") {
                        setVonageCredentials({
                          ...vonageCredentials,
                          fromNumber: e.target.value,
                        });
                      } else {
                        setTwilioCredentials({
                          ...twilioCredentials,
                          fromNumber: e.target.value,
                        });
                      }
                    }}
                    placeholder={
                      activeProvider === "vonage"
                        ? "Ej: OmniNotify"
                        : "Ej: +13153558924"
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  />
                </div>

                {/* Estado Activo/Inactivo */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={
                      activeProvider === "vonage"
                        ? vonageCredentials.isActive
                        : twilioCredentials.isActive
                    }
                    onChange={(e) => {
                      if (activeProvider === "vonage") {
                        setVonageCredentials({
                          ...vonageCredentials,
                          isActive: e.target.checked,
                        });
                      } else {
                        setTwilioCredentials({
                          ...twilioCredentials,
                          isActive: e.target.checked,
                        });
                      }
                    }}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-medium text-gray-700"
                  >
                    Servicio activo
                  </label>
                  <span className="text-xs text-gray-500">
                    (Si está inactivo, no se podrán enviar SMS)
                  </span>
                </div>

                {/* Botón de prueba */}
                <div className="pt-4">
                  <button
                    onClick={handleTestConnection}
                    disabled={
                      testing ||
                      (activeProvider === "vonage"
                        ? !vonageCredentials.apiKey ||
                          (!vonageCredentials.apiSecret &&
                            !vonageHasStoredSecret)
                        : !twilioCredentials.accountSid ||
                          (!twilioCredentials.authToken &&
                            !twilioHasStoredToken))
                    }
                    className={`px-4 py-2 rounded-lg transition flex items-center gap-2 disabled:opacity-50 ${
                      activeProvider === "vonage"
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }`}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Probando conexión...
                      </>
                    ) : (
                      <>
                        <Globe className="w-4 h-4" />
                        Probar Conexión con{" "}
                        {activeProvider === "vonage" ? "Vonage" : "Twilio"}
                      </>
                    )}
                  </button>
                </div>

                {/* Información */}
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="font-medium text-yellow-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Configuración Centralizada
                  </h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>
                      • Estas credenciales se aplican a TODAS las empresas
                    </li>
                    <li>
                      • Los cambios afectan inmediatamente al sistema completo
                    </li>
                    <li>
                      • Los secrets nunca se muestran completos por seguridad
                    </li>
                    <li>
                      • Solo administradores pueden modificar esta configuración
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho: Información y balances */}
        <div className="lg:col-span-1 space-y-6">
          {/* Balance de Vonage (visible cuando está activo) */}
          {activeProvider === "vonage" && vonageBalance && (
            <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-green-600" />
                Balance Vonage
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-700 mb-1">
                      {vonageBalance.formatted}
                    </div>
                    <div className="text-sm text-green-600 flex items-center justify-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Saldo disponible
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Valor exacto:</span>
                    <span className="font-mono text-gray-800">
                      {vonageBalance.rawValue}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Moneda:</span>
                    <span className="font-medium text-gray-800">
                      {vonageBalance.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Última actualización:
                    </span>
                    <span className="text-sm text-gray-500">
                      {lastVonageUpdate}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance de Twilio (visible cuando está activo) */}
          {activeProvider === "twilio" && twilioBalance && (
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-red-600" />
                Balance Twilio
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-700 mb-1">
                      {twilioBalance.formatted}
                    </div>
                    <div className="text-sm text-red-600 flex items-center justify-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Saldo disponible
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Valor exacto:</span>
                    <span className="font-mono text-gray-800">
                      {twilioBalance.rawValue}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Moneda:</span>
                    <span className="font-medium text-gray-800">
                      {twilioBalance.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Última actualización:
                    </span>
                    <span className="text-sm text-gray-500">
                      {lastTwilioUpdate}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Información de Twilio cuando no hay balance */}
          {activeProvider === "twilio" && !twilioBalance && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-red-600" />
                Información de Twilio
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    {twilioHasStoredToken ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {twilioHasStoredToken ? "Configurado" : "No configurado"}
                    </span>
                  </div>
                  <p className="text-sm text-red-600">
                    {twilioHasStoredToken
                      ? `Token guardado (termina en ...${twilioTokenLastChars})`
                      : "No hay token de autenticación guardado"}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">
                      Número activo:
                    </span>
                    <span className="font-medium text-gray-800">
                      {twilioCredentials.fromNumber || "No configurado"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2">
                    <span className="text-sm text-gray-600">Estado:</span>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        twilioCredentials.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {twilioCredentials.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Información del sistema */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Configuración Global
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>📊 Tabla:</strong> System_Config
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>🔑 Claves:</strong> VONAGE_CREDENTIALS,
                  TWILIO_CREDENTIALS
                </p>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  activeProvider === "vonage" ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p
                  className={`text-sm ${
                    activeProvider === "vonage"
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  <strong>
                    ✅ Estado{" "}
                    {activeProvider === "vonage" ? "Vonage" : "Twilio"}:
                  </strong>{" "}
                  {activeProvider === "vonage"
                    ? vonageCredentials.isActive
                      ? "Activo"
                      : "Inactivo"
                    : twilioCredentials.isActive
                      ? "Activo"
                      : "Inactivo"}
                </p>
              </div>
              <a
                href={
                  activeProvider === "vonage"
                    ? "https://dashboard.nexmo.com/"
                    : "https://www.twilio.com/console"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Dashboard {activeProvider === "vonage" ? "Vonage" : "Twilio"} ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SMSConfiguration;
