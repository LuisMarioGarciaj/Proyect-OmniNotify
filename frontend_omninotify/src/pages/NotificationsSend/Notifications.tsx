// src/pages/NotificationsSend.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  ArrowLeft,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  FileText,
  User,
  X,
  Clock,
  Phone,
  Tag,
  MessageCircle,
  Building,
  Coins,
  AlertTriangle,
  Send,
  Calendar,
} from "lucide-react";
import TemplateSelectionModal from "./TemplateSelectionModal";
import ContactsSelectionModal from "./ContactsSelectionModal";
import GroupsSelectionModal from "./GroupsSelectionModal";
import ManualRecipientModal from "./ManualRecipientModal";
import { api } from "../../services/api";
import { getCompany } from "../../services/company.service";
import FileUploadWhatsApp from "../../components/FileUploadWhatsApp";
import { smsConfigService } from "../../services/sms-config.service";
import type { SmsGlobalConfig } from "../../services/sms-config.service";
import { creditsService } from "../../services/credits.service";

// ========== TYPES ==========
interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_id: string;
  tags?: any[];
}

interface Template {
  id: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  name: string;
  content: string;
  company_id: string;
  provider_template_id?: string;
  alias?: string;
}

interface ContactGroup {
  id: string;
  name: string;
  description: string;
  contactCount: number;
  company_id: string;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  company_id: string;
  company_name?: string;
  credits?: number;
}

interface Company {
  id: string;
  name: string;
  logo?: string;
  current_credits?: number;
}

interface Variables {
  [key: string]: string;
}

interface NotificationResult {
  recipient: string;
  success: boolean;
  data?: any;
  error?: string;
  scheduled: boolean;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
}

// ========== CONSTANTS ==========
const BOLIVIA_TIMEZONE = "America/La_Paz";

// 🔥 MAPA DE PALABRAS A VARIABLES Y VICEVERSA
const WORD_TO_VARIABLE: Record<string, string> = {
  // Nombres
  "nombre": "nombre",
  "Nombre": "nombre",
  "NOMBRE": "nombre",
  "name": "nombre",
  "Name": "nombre",
  "👤": "nombre",
  
  // Email
  "email": "email",
  "Email": "email",
  "EMAIL": "email",
  "correo": "email",
  "Correo": "email",
  "mail": "email",
  "📧": "email",
  
  // Teléfono
  "teléfono": "telefono",
  "telefono": "telefono",
  "Teléfono": "telefono",
  "Telefono": "telefono",
  "tel": "telefono",
  "phone": "telefono",
  "celular": "telefono",
  "📱": "telefono",
  
  // Empresa
  "empresa": "empresa",
  "Empresa": "empresa",
  "company": "empresa",
  "compañía": "empresa",
  "🏢": "empresa",
  
  // Fecha
  "fecha": "fecha",
  "Fecha": "fecha",
  "date": "fecha",
  "📅": "fecha",
  
  // Hora
  "hora": "hora",
  "Hora": "hora",
  "time": "hora",
  "⏰": "hora",
  
  // Sitio Web
  "sitio": "sitioWeb",
  "web": "sitioWeb",
  "website": "sitioWeb",
  "Sitio": "sitioWeb",
  "Web": "sitioWeb",
  "🌐": "sitioWeb",
  
  // Mensaje
  "mensaje": "mensajeNotificacion",
  "Mensaje": "mensajeNotificacion",
  "message": "mensajeNotificacion",
  "notificación": "mensajeNotificacion",
  
  // Monto
  "monto": "monto",
  "Monto": "monto",
  "amount": "monto",
  "precio": "monto",
  "💰": "monto",
  
  // Factura
  "factura": "numeroFactura",
  "Factura": "numeroFactura",
  "invoice": "numeroFactura",
  "🧾": "numeroFactura",
  
  // Límite
  "límite": "fechaLimite",
  "limite": "fechaLimite",
  "deadline": "fechaLimite",
  "⏳": "fechaLimite",
};

// 🔥 MAPA INVERSO PARA REEMPLAZAR TEXTO
const VARIABLE_TO_WORDS: Record<string, string[]> = {
  "nombre": ["nombre", "Nombre", "NOMBRE", "name", "Name", "👤"],
  "email": ["email", "Email", "EMAIL", "correo", "Correo", "mail", "📧"],
  "telefono": ["teléfono", "telefono", "Teléfono", "Telefono", "tel", "phone", "celular", "📱"],
  "empresa": ["empresa", "Empresa", "company", "compañía", "🏢"],
  "fecha": ["fecha", "Fecha", "date", "📅"],
  "hora": ["hora", "Hora", "time", "⏰"],
  "sitioWeb": ["sitio web", "Sitio Web", "website", "web", "🌐"],
  "mensajeNotificacion": ["mensaje", "Mensaje", "message", "notificación"],
  "monto": ["monto", "Monto", "amount", "precio", "💰"],
  "numeroFactura": ["factura", "Factura", "invoice", "🧾"],
  "fechaLimite": ["límite", "limite", "deadline", "⏳"],
};

// ========== UTILITY FUNCTIONS ==========
const getBoliviaDateTime = () => {
  const now = new Date();
  const boliviaDate = new Date(now.toLocaleString("en-US", { timeZone: BOLIVIA_TIMEZONE }));
  
  const dia = boliviaDate.getDate().toString().padStart(2, "0");
  const mes = (boliviaDate.getMonth() + 1).toString().padStart(2, "0");
  const año = boliviaDate.getFullYear();
  const hora = boliviaDate.getHours().toString().padStart(2, "0");
  const minutos = boliviaDate.getMinutes().toString().padStart(2, "0");

  return {
    fecha: `${dia}/${mes}/${año}`,
    hora: `${hora}:${minutos}`,
    fechaISO: boliviaDate.toISOString().split("T")[0],
    fechaCompleta: boliviaDate,
    fechaInput: `${año}-${mes}-${dia}`,
    horaInput: `${hora}:${minutos}`
  };
};

const isFutureDateTime = (dateStr: string, timeStr: string): boolean => {
  if (!dateStr || !timeStr) return false;
  
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  
  const scheduledDate = new Date(Date.UTC(year, month - 1, day, hour + 4, minute, 0));
  const now = new Date();
  const boliviaNow = new Date(now.toLocaleString("en-US", { timeZone: BOLIVIA_TIMEZONE }));
  
  return scheduledDate > boliviaNow;
};

const getMinDateBolivia = (): string => {
  const boliviaDate = new Date(new Date().toLocaleString("en-US", { timeZone: BOLIVIA_TIMEZONE }));
  const year = boliviaDate.getFullYear();
  const month = (boliviaDate.getMonth() + 1).toString().padStart(2, "0");
  const day = boliviaDate.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("591")) {
    return `+${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  return phone;
};

// 🔥 FUNCIÓN PARA DETECTAR VARIABLES AUTOMÁTICAMENTE
const detectVariablesFromContent = (content: string): string[] => {
  if (!content) return [];
  
  console.log("🔍 Detectando variables en contenido:", content);
  
  const detectedVars = new Set<string>();
  
  // 1. Buscar variables con formato {{variable}}
  const regex = /\{\{(\w+)\}\}/g;
  const matches = content.matchAll(regex);
  for (const match of matches) {
    detectedVars.add(match[1]);
    console.log(`✓ Detectada variable con formato: ${match[1]}`);
  }
  
  // 2. Buscar palabras clave en el mapa
  Object.entries(WORD_TO_VARIABLE).forEach(([word, varName]) => {
    if (content.includes(word)) {
      detectedVars.add(varName);
      console.log(`✓ Detectada palabra: "${word}" -> variable "${varName}"`);
    }
  });
  
  const result = Array.from(detectedVars);
  console.log("✅ Variables detectadas:", result);
  return result;
};

// ========== MAIN COMPONENT ==========
const NotificationsSend: React.FC = () => {
  const navigate = useNavigate();

  // ========== STATE ==========
  const [userData, setUserData] = useState<UserData>(() => {
    return JSON.parse(localStorage.getItem("user_data") || "{}");
  });

  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "success" | "failed">("all");
  
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    failedRecipients?: Array<{ recipient: string; error: string }>;
    successfulRecipients?: string[];
    allResults?: NotificationResult[];
    successCount?: number;
    failedCount?: number;
    totalCount?: number;
    creditsUsed?: number;
  } | null>(null);

  const [smsGlobalConfig, setSmsGlobalConfig] = useState<SmsGlobalConfig | null>(null);
  const [loadingSmsConfig, setLoadingSmsConfig] = useState(true);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedContactObjects, setSelectedContactObjects] = useState<Contact[]>([]);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedRecipientType, setSelectedRecipientType] = useState<"individual" | "group" | "manual">("individual");

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    results?: NotificationResult[];
    total?: number;
    successful?: number;
    scheduled?: boolean;
    channel?: "EMAIL" | "SMS" | "WHATSAPP";
    error?: string;
  } | null>(null);

  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] = useState(false);

  const [pendingContacts, setPendingContacts] = useState<Array<{ name: string; phone?: string; email?: string }>>([]);

  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");

  const [whatsappFile, setWhatsappFile] = useState<{
    url: string;
    type: "image" | "video" | "document" | "audio";
    fileName?: string;
  } | null>(null);

  // 🔥 COSTOS POR CANAL (desde backend)
  const [channelCosts, setChannelCosts] = useState<Record<string, number>>({
    EMAIL: 1,
    SMS: 2,
    WHATSAPP: 1,
  });

  // ========== DERIVED VALUES ==========
  const companyId = userData.company_id || "25a63d10-eff4-11f0-86e6-a2aaf909b30d";
  const companyName = companyData?.name || userData.company_name || "Mi Empresa S.A.";

  // 🔥 ESTADO DE VARIABLES
  const [variables, setVariables] = useState<Variables>(() => {
    const boliviaDateTime = getBoliviaDateTime();
    const fechaLimiteDate = new Date(boliviaDateTime.fechaCompleta);
    fechaLimiteDate.setDate(fechaLimiteDate.getDate() + 7);
    
    const fechaLimiteDia = fechaLimiteDate.getDate().toString().padStart(2, "0");
    const fechaLimiteMes = (fechaLimiteDate.getMonth() + 1).toString().padStart(2, "0");
    const fechaLimiteAño = fechaLimiteDate.getFullYear();

    return {
      nombre: "",
      email: "",
      telefono: "",
      empresa: companyName,
      fecha: boliviaDateTime.fecha,
      hora: boliviaDateTime.hora,
      monto: "$1,250.00",
      fechaLimite: `${fechaLimiteDia}/${fechaLimiteMes}/${fechaLimiteAño}`,
      numeroFactura: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
      sitioWeb: "",
      mensajeNotificacion: "",
    };
  });

  // 🔥 VARIABLES DETECTADAS DEL TEMPLATE ACTUAL
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

  // 🔥 CARGAR COSTOS POR CANAL
  useEffect(() => {
    const loadChannelCosts = async () => {
      try {
        const emailCost = await creditsService.getChannelCost('EMAIL');
        const smsCost = await creditsService.getChannelCost('SMS');
        const whatsappCost = await creditsService.getChannelCost('WHATSAPP');
        
        setChannelCosts({
          EMAIL: emailCost.cost,
          SMS: smsCost.cost,
          WHATSAPP: whatsappCost.cost,
        });
      } catch (error) {
        console.error('Error cargando costos por canal:', error);
        // Mantener valores por defecto si hay error
      }
    };

    loadChannelCosts();
  }, []);

  // 🔥 EFECTO PARA DETECTAR VARIABLES CUANDO CAMBIA EL TEMPLATE
  useEffect(() => {
    if (selectedTemplate) {
      console.log("🔄 Detectando variables en template seleccionado:", selectedTemplate.name);
      const detected = detectVariablesFromContent(selectedTemplate.content);
      setDetectedVariables(detected);
      
      // Actualizar el estado de variables para incluir SOLO las detectadas
      setVariables(prev => {
        const newVars: Variables = {};
        detected.forEach(varName => {
          if (varName === "empresa" && companyName) {
            newVars[varName] = companyName;
          } else if (varName === "fecha") {
            newVars[varName] = getBoliviaDateTime().fecha;
          } else if (varName === "hora") {
            newVars[varName] = getBoliviaDateTime().hora;
          } else {
            newVars[varName] = prev[varName] || "";
          }
        });
        return newVars;
      });
    } else {
      setDetectedVariables([]);
    }
  }, [selectedTemplate, companyName]);

  // ========== API FUNCTIONS ==========
  const loadCredits = async () => {
    if (!companyId) return;

    setLoadingCredits(true);
    try {
      console.log("💰 Cargando créditos para compañía:", companyId);
      const response = await api.get(`/credits/balance?companyId=${companyId}`);
      console.log("✅ Créditos cargados:", response);

      setCurrentCredits(response.credits);

      const storedUserData = JSON.parse(localStorage.getItem("user_data") || "{}");
      storedUserData.credits = response.credits;
      localStorage.setItem("user_data", JSON.stringify(storedUserData));
      setUserData(storedUserData);

      window.dispatchEvent(
        new CustomEvent("credits-updated", {
          detail: {
            companyId,
            credits: response.credits,
          },
        })
      );
    } catch (error: any) {
      console.error("❌ Error cargando créditos:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

  const loadSmsConfig = async () => {
    try {
      const config = await smsConfigService.getGlobalConfig();
      setSmsGlobalConfig(config);
      console.log("📱 Configuración SMS global cargada:", config);
    } catch (error) {
      console.error("Error cargando configuración SMS:", error);
    } finally {
      setLoadingSmsConfig(false);
    }
  };

  const loadContacts = async (): Promise<void> => {
    try {
      console.log("Cargando contactos para compañía:", companyId);
      const contactsData = await api.get(`/contacts/company/${companyId}`);
      console.log("Contactos cargados:", contactsData.length);
      setContacts(contactsData || []);
    } catch (error: any) {
      console.error("Error cargando contactos:", error);
      if (error.message !== "Authentication failed") {
        showMessage("Error cargando contactos", "error");
      }
    }
  };

  const loadGroups = async (): Promise<void> => {
    try {
      console.log("Cargando tags/grupos para compañía:", companyId);
      const tagsData = await api.get("/tags");
      console.log("Tags recibidos:", tagsData);

      const formattedGroups: ContactGroup[] = Array.isArray(tagsData)
        ? tagsData.map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            description: tag.description || `Contactos con la etiqueta "${tag.name}"`,
            contactCount: tag._count?.contacts || tag.contactCount || 0,
            company_id: tag.company_id || companyId,
          }))
        : [];

      console.log("Grupos formateados:", formattedGroups);
      setContactGroups(formattedGroups);
    } catch (error: any) {
      console.error("Error cargando tags/grupos:", error);
      if (error.message !== "Authentication failed") {
        showMessage("Error cargando grupos (tags)", "error");
      }
    }
  };

  const loadTemplates = async (): Promise<void> => {
    try {
      console.log("Cargando templates para compañía:", companyId);
      const templatesData = await api.get(`/templates/company/${companyId}`);
      console.log("Templates cargados:", Array.isArray(templatesData) ? templatesData.length : 0);

      const templatesArray = Array.isArray(templatesData) ? templatesData : templatesData?.data || [];
      setTemplates(templatesArray);

      const availableTemplates = templatesArray.filter(
        (t: Template) => t.channel === "EMAIL" || t.channel === "SMS" || t.channel === "WHATSAPP"
      );

      console.log("Templates disponibles:", availableTemplates.length);
      if (availableTemplates.length > 0 && !selectedTemplate) {
        const emailTemplate = availableTemplates.find((t: { channel: string }) => t.channel === "EMAIL");
        setSelectedTemplate(emailTemplate || availableTemplates[0]);
      }
    } catch (error: any) {
      console.error("Error cargando templates:", error);
      if (error.message !== "Authentication failed") {
        showMessage("Error cargando templates", "error");
      }
    }
  };

  // ========== EFFECTS ==========
  useEffect(() => {
    const handleCreditsUpdate = (event: CustomEvent) => {
      console.log("💰 Evento credits-updated recibido:", event.detail);
      if (event.detail.companyId === companyId) {
        setCurrentCredits(event.detail.credits);

        const storedUserData = JSON.parse(localStorage.getItem("user_data") || "{}");
        storedUserData.credits = event.detail.credits;
        localStorage.setItem("user_data", JSON.stringify(storedUserData));
        setUserData(storedUserData);
      }
    };

    window.addEventListener("credits-updated" as any, handleCreditsUpdate);
    return () => window.removeEventListener("credits-updated" as any, handleCreditsUpdate);
  }, [companyId]);

  useEffect(() => {
    const fetchCompanyData = async () => {
      setLoadingCompany(true);
      try {
        if (!companyId) return;

        console.log("🔍 Cargando datos de empresa:", companyId);
        const company = await getCompany(companyId);
        console.log("✅ Empresa cargada:", company);

        setCompanyData(company);

        setVariables((prev) => ({
          ...prev,
          empresa: company.name || prev.empresa,
        }));

        if (company.name && userData.company_name !== company.name) {
          const updatedUserData = { ...userData, company_name: company.name };
          localStorage.setItem("user_data", JSON.stringify(updatedUserData));
          setUserData(updatedUserData);
        }
      } catch (error) {
        console.error("❌ Error cargando datos de empresa:", error);
      } finally {
        setLoadingCompany(false);
      }
    };

    fetchCompanyData();
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadCredits();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyData?.name) {
      setVariables((prev) => ({
        ...prev,
        empresa: companyData.name || prev.empresa,
      }));
    }
  }, [companyData]);

  useEffect(() => {
    const boliviaDateTime = getBoliviaDateTime();
    setScheduleDate(boliviaDateTime.fechaInput);

    const nextHourDate = new Date(boliviaDateTime.fechaCompleta);
    nextHourDate.setHours(nextHourDate.getHours() + 1);

    const nextHour = nextHourDate.getHours().toString().padStart(2, "0");
    const nextMinute = nextHourDate.getMinutes().toString().padStart(2, "0");

    setScheduleTime(`${nextHour}:${nextMinute}`);

    console.log("📅 Configuración inicial:", {
      fecha: boliviaDateTime.fechaInput,
      hora: `${nextHour}:${nextMinute}`,
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const boliviaDateTime = getBoliviaDateTime();
      setVariables((prev) => ({
        ...prev,
        fecha: boliviaDateTime.fecha,
        hora: boliviaDateTime.hora,
      }));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      try {
        console.log("Iniciando carga de datos...");

        const token = localStorage.getItem("auth_token");
        if (!token) {
          showMessage("No estás autenticado. Redirigiendo al login...", "error");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        await Promise.all([
          loadTemplates(),
          loadContacts(),
          loadGroups(),
          loadCredits(),
          loadSmsConfig(),
        ]);
      } catch (error) {
        console.error("Error cargando datos:", error);
        showMessage("Error cargando datos iniciales", "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ========== HANDLERS ==========
  const showMessage = (text: string, type: "success" | "error" | "warning"): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadVariablesFromContact = (contact: Contact | null) => {
    if (!contact) return;

    setVariables((prev) => ({
      ...prev,
      nombre: contact.name || prev.nombre,
      email: contact.email || prev.email,
      telefono: contact.phone || prev.telefono,
    }));

    console.log("📞 Variables cargadas desde contacto:", {
      nombre: contact.name,
      email: contact.email,
      telefono: contact.phone,
    });
  };

  const addManualRecipient = (): void => {
    if (!selectedTemplate) {
      showMessage("Selecciona un template primero", "error");
      return;
    }
    setShowManualModal(true);
  };

  const handleManualConfirm = (
    value: string,
    saveAsContact?: { name?: string; phone?: string; email?: string },
  ): void => {
    setShowManualModal(false);

    if (!selectedContacts.includes(value)) {
      setSelectedContacts((prev) => [...prev, value]);
    }

    if (saveAsContact) {
      setPendingContacts((prev) => [...prev, { ...saveAsContact, company_id: companyId } as any]);
    }

    showMessage("Destinatario agregado", "success");
  };

  const removeRecipient = (recipient: string): void => {
    setSelectedContacts(selectedContacts.filter((r) => r !== recipient));

    setSelectedContactObjects((prev) =>
      prev.filter((c) => {
        if (selectedTemplate?.channel === "SMS" || selectedTemplate?.channel === "WHATSAPP") {
          return c.phone !== recipient;
        } else {
          return c.email !== recipient;
        }
      })
    );
  };

  const toggleIndividualContact = (contact: Contact): void => {
    if (!selectedTemplate) return;

    const value = selectedTemplate.channel === "SMS" || selectedTemplate.channel === "WHATSAPP"
      ? contact.phone
      : contact.email;

    if (!value) {
      showMessage(
        `${contact.name} no tiene ${selectedTemplate.channel === "SMS" || selectedTemplate.channel === "WHATSAPP" ? "teléfono" : "email"}`,
        "error"
      );
      return;
    }

    if (selectedContacts.includes(value)) {
      setSelectedContacts(selectedContacts.filter((v) => v !== value));
      setSelectedContactObjects((prev) => prev.filter((c) => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, value]);
      setSelectedContactObjects([...selectedContactObjects, contact]);
      loadVariablesFromContact(contact);
    }
  };

  const toggleGroup = (groupId: string): void => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter((id) => id !== groupId));
    } else {
      setSelectedGroups([...selectedGroups, groupId]);
    }
  };

  const getContactsFromSelectedGroups = (): number => {
    let total = 0;
    selectedGroups.forEach((groupId) => {
      const group = contactGroups.find((g) => g.id === groupId);
      if (group) total += group.contactCount;
    });
    return total;
  };

  const calculateTotalCost = (): number => {
    if (!selectedTemplate) return 0;

    const costPerMessage = channelCosts[selectedTemplate.channel] || 1;
    const totalRecipients = selectedRecipientType === "group"
      ? getContactsFromSelectedGroups()
      : selectedContacts.length;

    return costPerMessage * totalRecipients;
  };

  const hasEnoughCredits = (): boolean => {
    const totalCost = calculateTotalCost();
    return currentCredits >= totalCost;
  };

  // 🔥 FUNCIÓN PARA REEMPLAZAR VARIABLES - AHORA TAMBIÉN REEMPLAZA TEXTO PLANO
  const replaceVariables = (content: string, vars: Variables): string => {
    if (!content) return "";
    
    let result = content;
    
    // 1. Reemplazar variables con formato {{variable}}
    Object.entries(vars).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, value || "");
    });
    
    // 2. Reemplazar texto plano usando el mapa inverso
    Object.entries(vars).forEach(([key, value]) => {
      if (value && VARIABLE_TO_WORDS[key]) {
        VARIABLE_TO_WORDS[key].forEach(word => {
          // Crear una expresión regular que busque la palabra completa
          // Esto asegura que no reemplace partes de otras palabras
          const wordRegex = new RegExp(`\\b${word}\\b`, "g");
          result = result.replace(wordRegex, value);
        });
      }
    });
    
    console.log("🔄 Contenido después de reemplazar:", result);
    return result;
  };

  const handleVariableChange = (variable: string, value: string): void => {
    console.log(`✏️ Variable ${variable} = "${value}"`);
    setVariables((prev) => ({
      ...prev,
      [variable]: value || "",
    }));
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "EMAIL": return <Mail className="w-5 h-5 text-blue-600" />;
      case "SMS": return <Phone className="w-5 h-5 text-green-600" />;
      case "WHATSAPP": return <MessageCircle className="w-5 h-5 text-emerald-600" />;
      default: return <Mail className="w-5 h-5 text-gray-600" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "EMAIL": return "bg-blue-100 text-blue-800";
      case "SMS": return "bg-green-100 text-green-800";
      case "WHATSAPP": return "bg-emerald-100 text-emerald-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const isSendButtonDisabled = (): boolean => {
    if (!selectedTemplate) return true;
    if (selectedRecipientType === "individual" && selectedContacts.length === 0) return true;
    if (selectedRecipientType === "group" && selectedGroups.length === 0) return true;
    if (selectedRecipientType === "manual" && selectedContacts.length === 0) return true;

    if (scheduleType === "later") {
      if (!scheduleDate || !scheduleTime) return true;
      if (!isFutureDateTime(scheduleDate, scheduleTime)) return true;
    }

    return false;
  };

  const getFilteredTemplates = (): Template[] => {
    return templates.filter((t) => t.channel === "EMAIL" || t.channel === "SMS" || t.channel === "WHATSAPP");
  };

  const renderTemplateContent = (content: string): { __html: string } => {
    const replaced = replaceVariables(content, variables);
    return { __html: replaced };
  };

  const totalCost = calculateTotalCost();

  // ============================================
  // 🔥 FUNCIÓN PARA ENVIAR NOTIFICACIONES
  // ============================================
  const sendNotifications = async (): Promise<void> => {
    if (!selectedTemplate) {
      showMessage("Selecciona un template", "error");
      return;
    }

    if (selectedRecipientType === "individual" && selectedContacts.length === 0) {
      showMessage("Selecciona destinatarios", "error");
      return;
    }

    if (selectedRecipientType === "group" && selectedGroups.length === 0) {
      showMessage("Selecciona grupos (tags)", "error");
      return;
    }

    if (selectedRecipientType === "manual" && selectedContacts.length === 0) {
      showMessage("Agrega destinatarios manuales", "error");
      return;
    }

    if (scheduleType === "later") {
      if (!scheduleDate || !scheduleTime) {
        showMessage("Selecciona fecha y hora para programar", "error");
        return;
      }

      if (!isFutureDateTime(scheduleDate, scheduleTime)) {
        showMessage("La fecha/hora programada debe ser futura", "error");
        return;
      }
    }

    const totalCost = calculateTotalCost();
    if (!hasEnoughCredits()) {
      setShowInsufficientCreditsModal(true);
      return;
    }

    setSending(true);
    setResult(null);
    setErrorDetails(null);

    try {
      const uniqueRecipients = [...new Set(selectedContacts)];

      console.log(`🚀 Enviando ${selectedTemplate.channel} a ${uniqueRecipients.length} destinatarios`);
      console.log(`💰 Costo estimado: ${totalCost} créditos (Saldo actual: ${currentCredits})`);

      // ============================================
      // 🔥 PASO 1: REEMPLAZAR VARIABLES EN EL CONTENIDO
      // ============================================
      let finalContent = selectedTemplate.content;

      console.log("📝 Contenido original:", finalContent.substring(0, 200));

      // Reemplazar variables con formato {{variable}}
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        finalContent = finalContent.replace(regex, value || "");
      });

      // También reemplazar texto plano para el envío real
      Object.entries(variables).forEach(([key, value]) => {
        if (value && VARIABLE_TO_WORDS[key]) {
          VARIABLE_TO_WORDS[key].forEach(word => {
            const wordRegex = new RegExp(`\\b${word}\\b`, "g");
            finalContent = finalContent.replace(wordRegex, value);
          });
        }
      });

      console.log("📝 Contenido final:", finalContent.substring(0, 200) + "...");

      // ============================================
      // 🔥 PASO 2: PREPARAR PROGRAMACIÓN
      // ============================================
      let scheduling: { is_scheduled: boolean; send_at?: string } = { is_scheduled: false };

      if (scheduleType === "later") {
        const [year, month, day] = scheduleDate.split("-").map(Number);
        const [hour, minute] = scheduleTime.split(":").map(Number);

        const scheduledDateTime = new Date(Date.UTC(year, month - 1, day, hour + 4, minute, 0));

        scheduling = {
          is_scheduled: true,
          send_at: scheduledDateTime.toISOString(),
        };

        console.log("⏰ Programación:", {
          fechaLocal: `${day}/${month}/${year} ${hour}:${minute}`,
          sendAt: scheduledDateTime.toISOString(),
        });
      }

      // ============================================
      // 🔥 PASO 3: LIMPIAR VARIABLES
      // ============================================
      const cleanVariables: Record<string, string> = {};
      Object.entries(variables).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          cleanVariables[key] = String(val);
        }
      });

      if (selectedTemplate.channel === "SMS" && smsGlobalConfig) {
        cleanVariables.provider = smsGlobalConfig.activeProvider;

        if (smsGlobalConfig.activeProvider === "twilio" && smsGlobalConfig.twilio.configured) {
          cleanVariables.fromNumber = smsGlobalConfig.twilio.fromNumber;
        } else if (smsGlobalConfig.activeProvider === "vonage" && smsGlobalConfig.vonage.configured) {
          cleanVariables.fromNumber = smsGlobalConfig.vonage.fromNumber;
        } else {
          cleanVariables.fromNumber = smsGlobalConfig.activeProvider === "twilio" ? "+13153558924" : "OmniNotify";
        }

        console.log(`📱 Usando proveedor activo: ${smsGlobalConfig.activeProvider}`);
        console.log(`📱 Número de origen: ${cleanVariables.fromNumber}`);
      }

      const subject = selectedTemplate.name;

      const attachments = selectedTemplate.channel === "WHATSAPP" && whatsappFile
        ? [{
            url: whatsappFile.url,
            type: whatsappFile.type,
            fileName: whatsappFile.fileName,
            caption: finalContent,
          }]
        : undefined;

      // ============================================
      // 🔥 PASO 4: ENVIAR A CADA DESTINATARIO
      // ============================================
      const promises = uniqueRecipients.map(async (recipient): Promise<NotificationResult> => {
        const payload: Record<string, any> = {
          channel: selectedTemplate.channel,
          recipient,
          templateId: selectedTemplate.id,
          variables: cleanVariables,
          scheduling,
          metadata: {
            companyId,
            companyName: variables.empresa || "Mi Empresa",
            sentFrom: "web-app",
          },
          content: finalContent,
        };

        if (selectedTemplate.channel === "EMAIL") {
          payload.subject = subject;
        }

        if (attachments) {
          payload.attachments = attachments;
        }

        console.log(`📤 Enviando a ${recipient}`, JSON.stringify({
          channel: payload.channel,
          recipient: payload.recipient,
          scheduled: payload.scheduling.is_scheduled,
          send_at: payload.scheduling.send_at,
        }));

        try {
          const response = await api.post("/notifications/send", payload);

          let success = true;
          let errorMsg = null;

          if (response.data) {
            if (response.data.success === false) {
              success = false;
              errorMsg = response.data.message || response.data.error || "Error en el envío";
            } else if (response.data.error) {
              success = false;
              errorMsg = response.data.error;
            } else if (response.data.status === "error" || response.data.status === "failed") {
              success = false;
              errorMsg = response.data.message || "Error en el envío";
            }
          }

          if (response.status >= 400) {
            success = false;
            errorMsg = errorMsg || `Error HTTP ${response.status}`;
          }

          console.log(`📬 Respuesta para ${recipient}:`, {
            status: response.status,
            data: response.data,
            determinedSuccess: success,
            error: errorMsg,
          });

          return {
            recipient,
            success,
            data: response.data,
            scheduled: scheduling.is_scheduled,
            channel: selectedTemplate.channel,
            error: errorMsg || undefined
          };
        } catch (error: any) {
          console.error(`❌ Error enviando a ${recipient}:`, error);

          let errorMessage = "Error de conexión";

          if (error?.response?.data) {
            const responseData = error.response.data;
            errorMessage = responseData.message || responseData.error || responseData.detail || JSON.stringify(responseData);
            if (error.response.status) {
              errorMessage = `[${error.response.status}] ${errorMessage}`;
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }

          return {
            recipient,
            success: false,
            error: errorMessage,
            scheduled: scheduling.is_scheduled,
            channel: selectedTemplate.channel,
          };
        }
      });

      const results = await Promise.all(promises);
      console.log("🔍 RESULTS RAW:", JSON.stringify(results, null, 2));

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      console.log("📊 Resultados de envío - DETALLADO:", {
        total: results.length,
        successCount,
        failedCount,
        successes: results.filter((r) => r.success).map((r) => r.recipient),
        failures: results.filter((r) => !r.success).map((r) => ({
          recipient: r.recipient,
          error: r.error,
        })),
      });

      const failedRecipients = results.filter((r) => !r.success).map((r) => ({
        recipient: r.recipient,
        error: r.error || "Error desconocido",
      }));

      const successfulRecipients = results.filter((r) => r.success).map((r) => r.recipient);

      setErrorDetails({
        title: failedCount === 0 ? "Envío exitoso" : failedCount === uniqueRecipients.length ? "Error en el envío" : "Error parcial en el envío",
        message: failedCount === 0
          ? `✅ Todos los ${successCount} mensajes se enviaron correctamente.`
          : failedCount === uniqueRecipients.length
            ? `❌ No se pudo enviar ningún mensaje. Ocurrió un problema con el servicio.`
            : `⚠️ Se enviaron ${successCount} mensajes, pero ${failedCount} fallaron.`,
        failedRecipients,
        successfulRecipients,
        allResults: results,
        successCount,
        failedCount,
        totalCount: uniqueRecipients.length,
        creditsUsed: totalCost,
      });
      setShowErrorModal(true);

      if (pendingContacts.length > 0 && successCount > 0) {
        try {
          await Promise.allSettled(
            pendingContacts.map((contact) => api.post("/contacts", { ...contact, company_id: companyId }))
          );
          setPendingContacts([]);
        } catch (error) {
          console.error("Error guardando contactos:", error);
        }
      }

      const channelName = selectedTemplate.channel;

      setResult({
        success: successCount > 0,
        message: scheduleType === "now"
          ? `${successCount} de ${uniqueRecipients.length} ${channelName} enviado(s) exitosamente`
          : `${uniqueRecipients.length} ${channelName} programado(s) exitosamente`,
        results,
        total: uniqueRecipients.length,
        successful: successCount,
        scheduled: scheduleType === "later",
        channel: selectedTemplate.channel,
      });

      if (successCount > 0) {
        await loadCredits();

        showMessage(
          scheduleType === "now"
            ? `✅ ${successCount} ${channelName} enviado(s) exitosamente. Se descontaron ${totalCost} créditos.`
            : `✅ ${uniqueRecipients.length} ${channelName} programado(s) exitosamente. Se reservarán ${totalCost} créditos.`,
          "success"
        );
      }
    } catch (error: any) {
      console.error("❌ Error global:", error);

      setResult({
        success: false,
        message: "Error en el envío",
        error: error?.response?.data?.message || error?.message || "Error desconocido",
      });

      showMessage("❌ Error en el envío", "error");
    } finally {
      setSending(false);
    }
  };

  // ========== RENDER ==========
  if (loading || loadingCompany || loadingCredits) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Cargando datos...</p>
        <p className="text-sm text-gray-500 mt-2">Cargando empresa: {companyId?.slice(0, 8)}...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enviar Notificación</h1>
              <p className="text-gray-600">Selecciona template y destinatarios</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                  <User className="w-3 h-3 text-blue-600" />
                  <span className="text-xs text-blue-700">{userData.name || "Usuario"}</span>
                </div>
                <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg">
                  <Building className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-700">{companyName}</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${currentCredits > 0 ? "bg-yellow-50" : "bg-red-50"}`}>
                  <Coins className={`w-3 h-3 ${currentCredits > 0 ? "text-yellow-600" : "text-red-600"}`} />
                  <span className={`text-xs ${currentCredits > 0 ? "text-yellow-700" : "text-red-700"}`}>
                    {currentCredits} créditos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg ${
          message.type === "success" ? "bg-green-100 text-green-800 border border-green-200" :
          message.type === "warning" ? "bg-yellow-100 text-yellow-800 border border-yellow-200" :
          "bg-red-100 text-red-800 border border-red-200"
        }`}>
          <div className="flex items-center">
            {message.type === "success" ? <CheckCircle className="w-5 h-5 mr-2" /> :
             message.type === "warning" ? <AlertTriangle className="w-5 h-5 mr-2" /> :
             <AlertCircle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Panel izquierdo */}
          <div className="lg:col-span-2 space-y-6">
            {/* Template */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="font-semibold text-gray-900">Template</h2>
                    <p className="text-gray-600 text-sm">Selecciona el template</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                  disabled={getFilteredTemplates().length === 0}
                >
                  Ver todos ({getFilteredTemplates().length})
                </button>
              </div>

              {selectedTemplate ? (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedTemplate.channel === "EMAIL" ? "bg-blue-100" :
                        selectedTemplate.channel === "SMS" ? "bg-green-100" : "bg-emerald-100"
                      }`}>
                        {getChannelIcon(selectedTemplate.channel)}
                      </div>
                      <div>
                        <h3 className="font-bold">{selectedTemplate.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs ${getChannelColor(selectedTemplate.channel)}`}>
                            {selectedTemplate.channel}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                            Costo: {channelCosts[selectedTemplate.channel] || 1} crédito(s) por envío
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            {detectedVariables.length} variable(s)
                          </span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedTemplate(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 flex flex-col items-center gap-2 transition-colors"
                  disabled={getFilteredTemplates().length === 0}
                >
                  <FileText className="w-8 h-8 text-gray-400" />
                  <span className="text-gray-700">Seleccionar Template</span>
                  {getFilteredTemplates().length === 0 && (
                    <span className="text-sm text-red-500">No hay templates disponibles</span>
                  )}
                </button>
              )}
            </div>

            {/* Sección de Media para WhatsApp */}
            {selectedTemplate?.channel === "WHATSAPP" && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Media Adjunta (Opcional)</h2>
                    <p className="text-gray-600 text-sm">Agrega imágenes o documentos a tu mensaje</p>
                  </div>
                </div>

                <FileUploadWhatsApp
                  onFileSelect={(url: any, type: any, fileName?: string) => {
                    setWhatsappFile({ url, type, fileName });
                    console.log("✅ Archivo seleccionado:", { type, fileName });
                  }}
                  onFileRemove={() => {
                    setWhatsappFile(null);
                    console.log("🗑️ Archivo removido");
                  }}
                  currentFile={whatsappFile}
                  maxSizeMB={5}
                />
              </div>
            )}

            {/* 🔥 SECCIÓN DE VARIABLES - SOLO MUESTRA LAS DETECTADAS */}
            {selectedTemplate && detectedVariables.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Tag className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Variables del Template</h2>
                    <p className="text-gray-600 text-sm">
                      {detectedVariables.length} variable(s) detectada(s): {detectedVariables.join(", ")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detectedVariables.map((varName) => (
                    <div key={varName}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {varName === "nombre" ? "👤 Nombre" :
                         varName === "email" ? "📧 Email" :
                         varName === "telefono" ? "📱 Teléfono" :
                         varName === "empresa" ? "🏢 Empresa" :
                         varName === "fecha" ? "📅 Fecha" :
                         varName === "hora" ? "⏰ Hora" :
                         varName === "monto" ? "💰 Monto" :
                         varName === "fechaLimite" ? "⏳ Fecha Límite" :
                         varName === "numeroFactura" ? "🧾 N° Factura" :
                         varName === "sitioWeb" ? "🌐 Sitio Web" :
                         varName === "mensajeNotificacion" ? "📝 Mensaje" :
                         varName.charAt(0).toUpperCase() + varName.slice(1)}
                      </label>
                      <input
                        type="text"
                        value={variables[varName] || ""}
                        onChange={(e) => handleVariableChange(varName, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Ingresa ${varName}`}
                      />
                      {varName === "empresa" && companyData?.name && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Empresa: {companyData.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensaje cuando no hay variables detectadas */}
            {selectedTemplate && detectedVariables.length === 0 && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Tag className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Variables del Template</h2>
                    <p className="text-gray-600 text-sm">
                      Este template no tiene variables detectadas.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Destinatarios */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <h2 className="font-semibold text-gray-900">Destinatarios</h2>
                    <p className="text-gray-600 text-sm">Selecciona quienes recibirán</p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-blue-600">
                    {selectedRecipientType === "group" ? getContactsFromSelectedGroups() : selectedContacts.length}
                  </span> destinatarios
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {(["individual", "group", "manual"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedRecipientType(type)}
                    className={`px-4 py-3 rounded-lg border transition-colors ${
                      selectedRecipientType === type ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {type === "individual" && <User className="w-5 h-5 mx-auto mb-2" />}
                    {type === "group" && <Tag className="w-5 h-5 mx-auto mb-2" />}
                    {type === "manual" && <Mail className="w-5 h-5 mx-auto mb-2" />}
                    <span className="text-sm capitalize">{type === "group" ? "Tags" : type}</span>
                  </button>
                ))}
              </div>

              {selectedRecipientType === "individual" && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">Contactos individuales</span>
                    <button
                      onClick={() => setShowContactsModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                      disabled={contacts.length === 0}
                    >
                      Ver todos ({contacts.length})
                    </button>
                  </div>
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.slice(0, 5).map((value, index) => {
                        const contact = contacts.find((c) =>
                          selectedTemplate?.channel === "SMS" || selectedTemplate?.channel === "WHATSAPP"
                            ? c.phone === value
                            : c.email === value
                        );

                        return (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                selectedTemplate?.channel === "EMAIL" ? "bg-blue-100" :
                                selectedTemplate?.channel === "SMS" ? "bg-green-100" : "bg-emerald-100"
                              }`}>
                                {selectedTemplate?.channel === "EMAIL" && <Mail className="w-4 h-4 text-blue-600" />}
                                {selectedTemplate?.channel === "WHATSAPP" && <MessageCircle className="w-4 h-4 text-emerald-600" />}
                              </div>
                              <div>
                                <div className="font-medium">{contact?.name || value}</div>
                                <div className="text-sm text-gray-500">
                                  {selectedTemplate?.channel === "SMS" || selectedTemplate?.channel === "WHATSAPP"
                                    ? formatPhoneForDisplay(value)
                                    : value}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removeRecipient(value)} className="text-red-600 hover:text-red-800">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {selectedContacts.length > 5 && (
                        <div className="text-center text-sm text-gray-500 p-2">
                          + {selectedContacts.length - 5} más...
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowContactsModal(true)}
                      className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
                      disabled={contacts.length === 0}
                    >
                      {contacts.length === 0 ? "No hay contactos disponibles" : "Seleccionar contactos"}
                    </button>
                  )}
                </div>
              )}

              {selectedRecipientType === "group" && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">Tags (Grupos)</span>
                    <button
                      onClick={() => setShowGroupsModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                      disabled={contactGroups.length === 0}
                    >
                      Ver todos los tags ({contactGroups.length})
                    </button>
                  </div>
                  {selectedGroups.length > 0 ? (
                    <div className="space-y-2">
                      {selectedGroups.map((groupId) => {
                        const group = contactGroups.find((g) => g.id === groupId);
                        if (!group) return null;
                        return (
                          <div key={groupId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Tag className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <div className="font-medium">{group.name}</div>
                                <div className="text-sm text-gray-500">{group.contactCount} contactos</div>
                              </div>
                            </div>
                            <button onClick={() => toggleGroup(groupId)} className="text-red-600 hover:text-red-800">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowGroupsModal(true)}
                      className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
                      disabled={contactGroups.length === 0}
                    >
                      {contactGroups.length === 0 ? "No hay tags disponibles" : "Seleccionar tags"}
                    </button>
                  )}
                </div>
              )}

              {selectedRecipientType === "manual" && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">Destinatarios manuales</span>
                    <button
                      onClick={addManualRecipient}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Agregar {selectedTemplate?.channel === "SMS" || selectedTemplate?.channel === "WHATSAPP" ? "número" : "email"}
                    </button>
                  </div>
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.map((value, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              selectedTemplate?.channel === "EMAIL" ? "bg-blue-100" :
                              selectedTemplate?.channel === "SMS" ? "bg-green-100" : "bg-emerald-100"
                            }`}>
                              {selectedTemplate?.channel === "EMAIL" && <Mail className="w-4 h-4 text-blue-600" />}
                              {selectedTemplate?.channel === "SMS" && <Phone className="w-4 h-4 text-green-600" />}
                              {selectedTemplate?.channel === "WHATSAPP" && <MessageCircle className="w-4 h-4 text-emerald-600" />}
                            </div>
                            <div className="font-medium">
                              {selectedTemplate?.channel === "SMS" || selectedTemplate?.channel === "WHATSAPP"
                                ? formatPhoneForDisplay(value)
                                : value}
                            </div>
                          </div>
                          <button onClick={() => removeRecipient(value)} className="text-red-600 hover:text-red-800">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">No hay destinatarios</div>
                  )}
                </div>
              )}
            </div>

            {/* Programación */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="font-semibold text-gray-900">Programación</h2>
                  <p className="text-gray-600 text-sm">Programa el envío (hora Bolivia)</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setScheduleType("now")}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    scheduleType === "now" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Enviar Ahora
                </button>
                <button
                  onClick={() => setScheduleType("later")}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    scheduleType === "later" ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Programar
                </button>
              </div>

              {scheduleType === "later" && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Fecha</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={getMinDateBolivia()}
                      />
                      <p className="text-xs text-gray-500 mt-1">Hoy: {formatDateForDisplay(getMinDateBolivia())}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Hora</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Hora local Bolivia (24h)</p>
                    </div>
                  </div>

                  {scheduleDate && scheduleTime && (
                    <div className={`p-3 rounded-lg border ${
                      isFutureDateTime(scheduleDate, scheduleTime) ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    }`}>
                      <div className="flex items-center gap-2">
                        {isFutureDateTime(scheduleDate, scheduleTime) ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-700">Programado para:</span>
                            <span className="text-green-600">
                              {formatDateForDisplay(scheduleDate)} a las {scheduleTime}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-700">Fecha/Hora inválida (debe ser futura)</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Resumen de créditos y botón de envío */}
            <div className="bg-white rounded-xl border p-6">
              {selectedTemplate && selectedContacts.length > 0 && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-600" />
                    Resumen de créditos
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Costo por {selectedTemplate.channel}:</span>
                      <span className="font-medium">{channelCosts[selectedTemplate.channel] || 1} crédito(s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Destinatarios:</span>
                      <span className="font-medium">
                        {selectedRecipientType === "group" ? getContactsFromSelectedGroups() : selectedContacts.length}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-semibold text-gray-900">Costo total estimado:</span>
                      <span className={`font-bold ${currentCredits >= totalCost ? "text-green-600" : "text-red-600"}`}>
                        {totalCost} créditos
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saldo actual:</span>
                      <span className={`font-medium ${currentCredits > 0 ? "text-yellow-600" : "text-red-600"}`}>
                        {currentCredits} créditos
                      </span>
                    </div>
                    {currentCredits < totalCost && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">Créditos insuficientes</span>
                        </div>
                        <p className="text-sm text-red-600 mt-1">
                          Necesitas {totalCost - currentCredits} créditos adicionales.
                        </p>
                        <button
                          onClick={() => navigate("/credits/recharge")}
                          className="mt-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                        >
                          Recargar créditos
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={sendNotifications}
                disabled={sending || isSendButtonDisabled() || (selectedTemplate ? !hasEnoughCredits() : false)}
                className={`w-full px-6 py-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                  selectedTemplate && !hasEnoughCredits() ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enviando...
                  </>
                ) : selectedTemplate && !hasEnoughCredits() ? (
                  <>
                    <Coins className="w-5 h-5" />
                    Créditos insuficientes
                  </>
                ) : scheduleType === "now" ? (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar ({totalCost} créditos)
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    Programar ({totalCost} créditos)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Panel derecho: Vista previa */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-6">Vista Previa</h2>

              {selectedTemplate ? (
                <div className="space-y-6">
                  <div className="flex justify-between">
                    <div>
                      <div className="text-sm text-gray-600">Template:</div>
                      <div className="font-bold">{selectedTemplate.name}</div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-sm ${getChannelColor(selectedTemplate.channel)}`}>
                      {selectedTemplate.channel}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Contenido:</div>
                    <div className="bg-gray-50 rounded-lg p-4 border min-h-[200px] overflow-auto">
                      {selectedTemplate.channel === "EMAIL" ? (
                        <div
                          className="preview-content"
                          dangerouslySetInnerHTML={renderTemplateContent(selectedTemplate.content)}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-gray-800">
                          {replaceVariables(selectedTemplate.content, variables)}
                        </div>
                      )}
                    </div>
                    
                    {detectedVariables.length > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                        <span className="font-medium">Variables detectadas:</span> {detectedVariables.join(", ")}
                      </div>
                    )}
                  </div>

                  {selectedTemplate.channel === "WHATSAPP" && whatsappFile && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <MessageCircle className="w-4 h-4" />
                        <span className="font-medium">Media adjunto:</span>
                        <span className="text-sm">{whatsappFile.type}</span>
                      </div>
                      {whatsappFile.type === "image" && (
                        <img src={whatsappFile.url} alt="Preview" className="mt-2 rounded-lg max-h-32 object-contain" />
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 rounded-lg border">
                    <h4 className="font-medium mb-3">Resumen</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Destinatarios:</span>
                        <span className="font-medium">
                          {selectedRecipientType === "group" ? getContactsFromSelectedGroups() : selectedContacts.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span className="font-medium capitalize">
                          {selectedRecipientType === "group" ? "Tags" : selectedRecipientType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Programación:</span>
                        <span className="font-medium">{scheduleType === "now" ? "Inmediato" : "Programado"}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="font-semibold">Costo estimado:</span>
                        <span className={`font-bold ${currentCredits >= totalCost ? "text-green-600" : "text-red-600"}`}>
                          {totalCost} créditos
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-bold mb-2">Selecciona un Template</h3>
                  <p className="text-gray-600">Elige un template para ver vista previa</p>
                </div>
              )}
            </div>

            {result && (
              <div className={`mt-6 rounded-xl border p-6 ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-start gap-4">
                  {result.success ? <CheckCircle className="w-6 h-6 text-green-600" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
                  <div>
                    <h3 className="font-bold">{result.success ? "✅ Éxito" : "❌ Error"}</h3>
                    <p className="mt-1">{result.message}</p>
                    {result.error && <p className="text-sm text-red-600 mt-2">{result.error}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      {showTemplateModal && (
        <TemplateSelectionModal
          templates={getFilteredTemplates()}
          selectedTemplate={selectedTemplate}
          onSelect={(template) => {
            setSelectedTemplate(template);
            setShowTemplateModal(false);
          }}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      {showContactsModal && (
        <ContactsSelectionModal
          contacts={contacts}
          selectedContacts={selectedContacts}
          selectedTemplate={selectedTemplate}
          onToggleContact={toggleIndividualContact}
          onClose={() => setShowContactsModal(false)}
        />
      )}

      {showGroupsModal && (
        <GroupsSelectionModal
          groups={contactGroups}
          selectedGroups={selectedGroups}
          onToggleGroup={toggleGroup}
          onClose={() => setShowGroupsModal(false)}
          getContactsFromSelectedGroups={getContactsFromSelectedGroups}
        />
      )}

      {showManualModal && selectedTemplate && (
        <ManualRecipientModal
          channel={selectedTemplate.channel}
          onConfirm={handleManualConfirm}
          onClose={() => setShowManualModal(false)}
        />
      )}

      {showInsufficientCreditsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Créditos insuficientes</h2>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Créditos disponibles:</span>
                <span className="font-bold text-yellow-600">{currentCredits}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Créditos necesarios:</span>
                <span className="font-bold text-red-600">{totalCost}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Déficit:</span>
                <span className="font-bold text-red-600">{totalCost - currentCredits}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowInsufficientCreditsModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowInsufficientCreditsModal(false);
                  navigate("/credits/recharge");
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Recargar créditos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resultados */}
      {showErrorModal && errorDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className={`p-6 border-b ${
              errorDetails.failedCount === 0 ? "bg-green-50" :
              errorDetails.failedCount === errorDetails.totalCount ? "bg-red-50" : "bg-yellow-50"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  errorDetails.failedCount === 0 ? "bg-green-100" :
                  errorDetails.failedCount === errorDetails.totalCount ? "bg-red-100" : "bg-yellow-100"
                }`}>
                  {errorDetails.failedCount === 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : errorDetails.failedCount === errorDetails.totalCount ? (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{errorDetails.title}</h3>
                  <p className="text-gray-600">{errorDetails.message}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-b">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Exitosos</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{errorDetails.successCount || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Fallidos</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{errorDetails.failedCount || 0}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Send className="w-4 h-4" />
                    <span className="text-sm font-medium">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{errorDetails.totalCount || 0}</div>
                </div>
              </div>

              {errorDetails.creditsUsed && (
                <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Coins className="w-4 h-4" />
                    <span className="font-medium">Créditos utilizados:</span>
                    <span className="font-bold">{errorDetails.creditsUsed}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="flex gap-2 border-b">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === "all" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Todos ({errorDetails.allResults?.length || 0})
                  </button>
                  <button
                    onClick={() => setFilterType("success")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === "success" ? "text-green-600 border-b-2 border-green-600" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Exitosos ({errorDetails.successCount || 0})
                  </button>
                  <button
                    onClick={() => setFilterType("failed")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === "failed" ? "text-red-600 border-b-2 border-red-600" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Fallidos ({errorDetails.failedCount || 0})
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {errorDetails.allResults
                    ?.filter((result) => {
                      if (filterType === "success") return result.success;
                      if (filterType === "failed") return !result.success;
                      return true;
                    })
                    .map((result, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${result.success ? "text-green-600" : "text-red-600"}`}>
                            {result.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-medium">
                              {result.channel === "SMS" || result.channel === "WHATSAPP"
                                ? formatPhoneForDisplay(result.recipient)
                                : result.recipient}
                            </div>
                            {!result.success && result.error && (
                              <div className="mt-2 text-sm text-red-600">
                                Error: {result.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    setErrorDetails(null);
                    setFilterType("all");
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Cerrar
                </button>
                {errorDetails.failedCount && errorDetails.failedCount > 0 && (
                  <button
                    onClick={() => {
                      const failedRecipients = errorDetails.allResults
                        ?.filter((r) => !r.success)
                        .map((r) => r.recipient) || [];

                      setSelectedContacts(failedRecipients);
                      setShowErrorModal(false);
                      setErrorDetails(null);
                      setFilterType("all");

                      showMessage(`${failedRecipients.length} destinatarios listos para reintentar`, "warning");
                    }}
                    className="px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors"
                  >
                    Reintentar fallidos ({errorDetails.failedCount})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsSend;