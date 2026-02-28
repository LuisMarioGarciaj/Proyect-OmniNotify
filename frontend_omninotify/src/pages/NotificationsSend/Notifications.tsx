// src/pages/NotificationsSend.tsx
import React, { useState, useEffect } from "react";
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

// Define los tipos localmente
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
  [key: string]: string | undefined;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  fecha: string;
  hora: string;
  monto: string;
  fechaLimite: string;
  numeroFactura: string;
  mediaUrl?: string;
  mediaType?: string;
}

interface NotificationResult {
  recipient: string;
  success: boolean;
  data?: any;
  error?: string;
  scheduled: boolean;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
}

const CHANNEL_COSTS = {
  EMAIL: 1,
  SMS: 2,
  WHATSAPP: 1,
};
// Utilidad para depurar respuestas de la API
const debugApiResponse = (response: any, recipient: string) => {
  console.log(`🔍 Debug respuesta API para ${recipient}:`, {
    status: response?.status,
    statusText: response?.statusText,
    data: response?.data,
    success: response?.data?.success,
    hasData: !!response?.data?.data,
    notificationId: response?.data?.id || response?.data?.notificationId,
  });
};

// 🔥 FUNCIÓN CORREGIDA PARA FECHA/HORA DE BOLIVIA (UTC-4)
const getBoliviaDateTime = () => {
  const now = new Date();

  // Bolivia está en UTC-4 todo el año (sin horario de verano)
  // Crear fecha en UTC-4
  const boliviaTime = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  // Ajustar para que la fecha sea correcta
  const boliviaDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/La_Paz" }),
  );

  // Formato para mostrar (dd/mm/yyyy)
  const dia = boliviaDate.getDate().toString().padStart(2, "0");
  const mes = (boliviaDate.getMonth() + 1).toString().padStart(2, "0");
  const año = boliviaDate.getFullYear();

  // Hora en formato 24h
  const hora = boliviaDate.getHours().toString().padStart(2, "0");
  const minutos = boliviaDate.getMinutes().toString().padStart(2, "0");

  // Fecha para input date (YYYY-MM-DD)
  const fechaInput = `${año}-${mes}-${dia}`;

  console.log("📅 Bolivia DateTime:", {
    fecha: `${dia}/${mes}/${año}`,
    hora: `${hora}:${minutos}`,
    fechaInput,
    timestamp: boliviaDate.toISOString(),
  });

  return {
    fecha: `${dia}/${mes}/${año}`,
    hora: `${hora}:${minutos}`,
    fechaISO: boliviaDate.toISOString().split("T")[0],
    fechaCompleta: boliviaDate,
    fechaInput,
    horaInput: `${hora}:${minutos}`,
  };
};

// 🔥 FUNCIÓN PARA VALIDAR SI UNA FECHA ES FUTURA EN BOLIVIA
const isFutureDateTime = (dateStr: string, timeStr: string): boolean => {
  if (!dateStr || !timeStr) return false;

  // Crear fecha en hora local de Bolivia
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Crear fecha en UTC-4 (Bolivia)
  const scheduledDate = new Date(
    Date.UTC(year, month - 1, day, hour + 4, minute, 0),
  );

  const now = new Date();
  const boliviaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/La_Paz" }),
  );

  console.log("⏰ Comparación de fechas:", {
    scheduled: scheduledDate.toISOString(),
    now: boliviaNow.toISOString(),
    isFuture: scheduledDate > boliviaNow,
  });

  return scheduledDate > boliviaNow;
};

// 🔥 FUNCIÓN PARA OBTENER FECHA MÍNIMA (HOY EN BOLIVIA)
const getMinDateBolivia = (): string => {
  const boliviaDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/La_Paz" }),
  );
  const year = boliviaDate.getFullYear();
  const month = (boliviaDate.getMonth() + 1).toString().padStart(2, "0");
  const day = boliviaDate.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// 🔥 FUNCIÓN PARA FORMATEAR FECHA PARA MOSTRAR
const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

const extractVariablesFromTemplate = (content: string): string[] => {
  const regex = /{{(\w+)}}/g;
  const matches = content.match(regex) || [];
  return [...new Set(matches.map((match) => match.replace(/{{|}}/g, "")))];
};

// useState<string>("+13153558924"); // Tu número de Twilio
const NotificationsSend: React.FC = () => {
  const navigate = useNavigate();

  const [userData, setUserData] = useState<UserData>(() => {
    return JSON.parse(localStorage.getItem("user_data") || "{}");
  });

  const [companyData, setCompanyData] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "success" | "failed">(
    "all",
  );
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    failedRecipients?: Array<{
      recipient: string;
      error: string;
    }>;
    successfulRecipients?: string[];
    allResults?: NotificationResult[];
    successCount?: number;
    failedCount?: number;
    totalCount?: number;
    creditsUsed?: number;
  } | null>(null);

  const [smsGlobalConfig, setSmsGlobalConfig] =
    useState<SmsGlobalConfig | null>(null);
  const [loadingSmsConfig, setLoadingSmsConfig] = useState(true);

  // ============================================
  // 🔥 FUNCIÓN PARA CARGAR CONFIGURACIÓN SMS GLOBAL
  // ============================================
  const loadSmsConfig = async () => {
    try {
      const config = await smsConfigService.getGlobalConfig();
      setSmsGlobalConfig(config);
      console.log("📱 Configuración SMS global cargada:", config);
      console.log(
        "📱 Proveedor activo desde SMSConfiguration:",
        config.activeProvider,
      );
    } catch (error) {
      console.error("Error cargando configuración SMS:", error);
    } finally {
      setLoadingSmsConfig(false);
    }
  };
  const companyId =
    userData.company_id || "25a63d10-eff4-11f0-86e6-a2aaf909b30d";
  const companyName =
    companyData?.name || userData.company_name || "Mi Empresa S.A.";

  console.log("🔐 Usuario logueado:", userData);
  console.log("🏢 Datos de empresa:", companyData);
  console.log("📛 Nombre de empresa final:", companyName);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [selectedContactObjects, setSelectedContactObjects] = useState<
    Contact[]
  >([]);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedRecipientType, setSelectedRecipientType] = useState<
    "individual" | "group" | "manual"
  >("individual");

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
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] =
    useState(false);

  const [pendingContacts, setPendingContacts] = useState<
    Array<{ name: string; phone?: string; email?: string }>
  >([]);

  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduleDate, setScheduleDate] = useState<string>("");
  const [scheduleTime, setScheduleTime] = useState<string>("");

  const [whatsappFile, setWhatsappFile] = useState<{
    url: string;
    type: "image" | "video" | "document" | "audio";
    fileName?: string;
  } | null>(null);

  const [variables, setVariables] = useState<Variables>(() => {
    const boliviaDateTime = getBoliviaDateTime();

    // Calcular fecha límite (+7 días)
    const fechaLimiteDate = new Date(boliviaDateTime.fechaCompleta);
    fechaLimiteDate.setDate(fechaLimiteDate.getDate() + 7);

    const fechaLimiteDia = fechaLimiteDate
      .getDate()
      .toString()
      .padStart(2, "0");
    const fechaLimiteMes = (fechaLimiteDate.getMonth() + 1)
      .toString()
      .padStart(2, "0");
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
      numeroFactura:
        "INV-" +
        new Date().getFullYear() +
        "-" +
        Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0"),
    };
  });

  // ============================================
  // 🔥 FUNCIÓN PARA CARGAR CRÉDITOS
  // ============================================
  const loadCredits = async () => {
    if (!companyId) return;

    setLoadingCredits(true);
    try {
      console.log("💰 Cargando créditos para compañía:", companyId);
      const response = await api.get(`/credits/balance?companyId=${companyId}`);
      console.log("✅ Créditos cargados:", response);

      setCurrentCredits(response.currentBalance);

      const storedUserData = JSON.parse(
        localStorage.getItem("user_data") || "{}",
      );
      storedUserData.credits = response.currentBalance;
      localStorage.setItem("user_data", JSON.stringify(storedUserData));
      setUserData(storedUserData);

      window.dispatchEvent(
        new CustomEvent("credits-updated", {
          detail: {
            companyId,
            credits: response.currentBalance,
          },
        }),
      );
    } catch (error: any) {
      console.error("❌ Error cargando créditos:", error);
    } finally {
      setLoadingCredits(false);
    }
  };

  // ============================================
  // 🔥 ESCUCHAR EVENTO DE ACTUALIZACIÓN DE CRÉDITOS
  // ============================================
  useEffect(() => {
    const handleCreditsUpdate = (event: CustomEvent) => {
      console.log("💰 Evento credits-updated recibido:", event.detail);
      if (event.detail.companyId === companyId) {
        setCurrentCredits(event.detail.credits);

        const storedUserData = JSON.parse(
          localStorage.getItem("user_data") || "{}",
        );
        storedUserData.credits = event.detail.credits;
        localStorage.setItem("user_data", JSON.stringify(storedUserData));
        setUserData(storedUserData);
      }
    };

    window.addEventListener("credits-updated" as any, handleCreditsUpdate);

    return () => {
      window.removeEventListener("credits-updated" as any, handleCreditsUpdate);
    };
  }, [companyId]);

  // Cargar datos de la empresa
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

  // Cargar créditos al montar
  useEffect(() => {
    if (companyId) {
      loadCredits();
    }
  }, [companyId]);

  // Actualizar variables cuando cambie companyData
  useEffect(() => {
    if (companyData?.name) {
      setVariables((prev) => ({
        ...prev,
        empresa: companyData.name || prev.empresa,
      }));
    }
  }, [companyData]);

  // 🔥 CONFIGURAR FECHA Y HORA INICIAL CORRECTAMENTE (BOLIVIA)
  useEffect(() => {
    const boliviaDateTime = getBoliviaDateTime();

    // Fecha actual (hoy) para el input date
    setScheduleDate(boliviaDateTime.fechaInput);

    // Hora actual + 1 hora (para que sea futura)
    const nextHourDate = new Date(boliviaDateTime.fechaCompleta);
    nextHourDate.setHours(nextHourDate.getHours() + 1);

    const nextHour = nextHourDate.getHours().toString().padStart(2, "0");
    const nextMinute = nextHourDate.getMinutes().toString().padStart(2, "0");

    setScheduleTime(`${nextHour}:${nextMinute}`);

    console.log("📅 Configuración inicial:", {
      fecha: boliviaDateTime.fechaInput,
      hora: `${nextHour}:${nextMinute}`,
      fechaCompleta: boliviaDateTime.fechaCompleta.toISOString(),
    });
  }, []);

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

  // Actualizar fecha/hora cada minuto
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
            description:
              tag.description || `Contactos con la etiqueta "${tag.name}"`,
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
      console.log(
        "Templates cargados:",
        Array.isArray(templatesData) ? templatesData.length : 0,
      );

      const templatesArray = Array.isArray(templatesData)
        ? templatesData
        : templatesData?.data || [];

      setTemplates(templatesArray);

      const availableTemplates = templatesArray.filter(
        (t: Template) =>
          t.channel === "EMAIL" ||
          t.channel === "SMS" ||
          t.channel === "WHATSAPP",
      );

      console.log("Templates disponibles:", availableTemplates.length);
      if (availableTemplates.length > 0) {
        const emailTemplate = availableTemplates.find(
          (t: { channel: string }) => t.channel === "EMAIL",
        );
        if (emailTemplate) {
          setSelectedTemplate(emailTemplate);
        } else {
          setSelectedTemplate(availableTemplates[0]);
        }
      }
    } catch (error: any) {
      console.error("Error cargando templates:", error);
      if (error.message !== "Authentication failed") {
        showMessage("Error cargando templates", "error");
      }
    }
  };

  // Cargar todos los datos
  useEffect(() => {
    const loadData = async (): Promise<void> => {
      setLoading(true);
      try {
        console.log("Iniciando carga de datos...");

        const token = localStorage.getItem("auth_token");
        if (!token) {
          showMessage(
            "No estás autenticado. Redirigiendo al login...",
            "error",
          );
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        await Promise.all([
          loadTemplates(),
          loadContacts(),
          loadGroups(),
          loadCredits(),
          loadSmsConfig(), // <-- NUEVO
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
  const showMessage = (
    text: string,
    type: "success" | "error" | "warning",
  ): void => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
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
      setPendingContacts((prev) => [
        ...prev,
        { ...saveAsContact, company_id: companyId } as any,
      ]);
    }

    showMessage("Destinatario agregado", "success");
  };

  const removeRecipient = (recipient: string): void => {
    setSelectedContacts(selectedContacts.filter((r) => r !== recipient));

    setSelectedContactObjects((prev) =>
      prev.filter((c) => {
        if (
          selectedTemplate?.channel === "SMS" ||
          selectedTemplate?.channel === "WHATSAPP"
        ) {
          return c.phone !== recipient;
        } else {
          return c.email !== recipient;
        }
      }),
    );
  };

  const toggleIndividualContact = (contact: Contact): void => {
    if (!selectedTemplate) return;

    const value =
      selectedTemplate.channel === "SMS" ||
      selectedTemplate.channel === "WHATSAPP"
        ? contact.phone
        : contact.email;

    if (!value) {
      showMessage(
        `${contact.name} no tiene ${selectedTemplate.channel === "SMS" || selectedTemplate.channel === "WHATSAPP" ? "teléfono" : "email"}`,
        "error",
      );
      return;
    }

    if (selectedContacts.includes(value)) {
      setSelectedContacts(selectedContacts.filter((v) => v !== value));
      setSelectedContactObjects((prev) =>
        prev.filter((c) => c.id !== contact.id),
      );
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

    const costPerMessage = CHANNEL_COSTS[selectedTemplate.channel] || 1;
    const totalRecipients =
      selectedRecipientType === "group"
        ? getContactsFromSelectedGroups()
        : selectedContacts.length;

    return costPerMessage * totalRecipients;
  };

  const hasEnoughCredits = (): boolean => {
    const totalCost = calculateTotalCost();
    return currentCredits >= totalCost;
  };

  const replaceVariables = (content: string, vars: Variables): string => {
    let result = content;
    Object.keys(vars).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      const value = vars[key] || "";
      result = result.replace(regex, value);
    });
    return result;
  };

  const extractVariables = (content: string): string[] => {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const matches = content.match(variablePattern) || [];
    const uniqueVariables = [
      ...new Set(matches.map((match) => match.replace(/[{}]/g, ""))),
    ];
    return uniqueVariables;
  };

  // ============================================
  // 🔥 FUNCIÓN COMPLETA Y CORREGIDA PARA ENVIAR NOTIFICACIONES
  // ============================================
  const sendNotifications = async (): Promise<void> => {
    if (!selectedTemplate) {
      showMessage("Selecciona un template", "error");
      return;
    }

    if (
      selectedRecipientType === "individual" &&
      selectedContacts.length === 0
    ) {
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

      console.log(
        `🚀 Enviando ${selectedTemplate.channel} a ${uniqueRecipients.length} destinatarios`,
      );
      console.log(
        `💰 Costo estimado: ${totalCost} créditos (Saldo actual: ${currentCredits})`,
      );

      // ============================================
      // 🔥 PASO 1: REEMPLAZAR VARIABLES EN EL CONTENIDO
      // ============================================
      let finalContent = selectedTemplate.content;

      // Reemplazar cada variable en el contenido
      Object.keys(variables).forEach((key) => {
        const placeholder = `{{${key}}}`;
        const value = variables[key] || "";

        // Reemplazar todas las ocurrencias de la variable
        finalContent = finalContent.replace(
          new RegExp(placeholder, "g"),
          value,
        );
      });

      console.log(
        "📝 Contenido después de reemplazar variables:",
        finalContent.substring(0, 200) + "...",
      );

      // ============================================
      // 🔥 PASO 2: PREPARAR PROGRAMACIÓN CON HORA BOLIVIA
      // ============================================
      let scheduling: { is_scheduled: boolean; send_at?: string } = {
        is_scheduled: false,
      };

      if (scheduleType === "later") {
        // Crear fecha en hora Bolivia (UTC-4) para enviar al backend
        const [year, month, day] = scheduleDate.split("-").map(Number);
        const [hour, minute] = scheduleTime.split(":").map(Number);

        // Crear fecha en UTC para el backend
        const scheduledDateTime = new Date(
          Date.UTC(year, month - 1, day, hour + 4, minute, 0),
        );

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
      // Opción 1: Usar Vonage (si tienes credenciales de Vonage configuradas)
      // 🔥 USAR EL PROVEEDOR SELECCIONADO PARA SMS
      if (selectedTemplate.channel === "SMS" && smsGlobalConfig) {
        cleanVariables.provider = smsGlobalConfig.activeProvider;

        if (
          smsGlobalConfig.activeProvider === "twilio" &&
          smsGlobalConfig.twilio.configured
        ) {
          cleanVariables.fromNumber = smsGlobalConfig.twilio.fromNumber;
        } else if (
          smsGlobalConfig.activeProvider === "vonage" &&
          smsGlobalConfig.vonage.configured
        ) {
          cleanVariables.fromNumber = smsGlobalConfig.vonage.fromNumber;
        } else {
          // Fallback (nunca debería ocurrir si la configuración es correcta)
          cleanVariables.fromNumber =
            smsGlobalConfig.activeProvider === "twilio"
              ? "+13153558924"
              : "OmniNotify";
        }

        console.log(
          `📱 Usando proveedor activo: ${smsGlobalConfig.activeProvider}`,
        );
        console.log(`📱 Número de origen: ${cleanVariables.fromNumber}`);
      }

      // ============================================
      // 🔥 PASO 4: PREPARAR SUBJECT PARA EMAIL
      // ============================================
      const subject = selectedTemplate.name;

      // ============================================
      // 🔥 PASO 5: PREPARAR ADJUNTOS PARA WHATSAPP
      // ============================================
      const attachments =
        selectedTemplate.channel === "WHATSAPP" && whatsappFile
          ? [
              {
                url: whatsappFile.url,
                type: whatsappFile.type,
                fileName: whatsappFile.fileName,
                caption: finalContent,
              },
            ]
          : undefined;

      // ============================================
      // 🔥 PASO 6: ENVIAR A CADA DESTINATARIO
      // ============================================
      const promises = uniqueRecipients.map(
        async (recipient): Promise<NotificationResult> => {
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

          // AÑADIR SUBJECT PARA EMAIL
          if (selectedTemplate.channel === "EMAIL") {
            payload.subject = subject;
          }

          // AÑADIR ADJUNTOS PARA WHATSAPP
          if (attachments) {
            payload.attachments = attachments;
          }

          console.log(
            `📤 Enviando a ${recipient}`,
            JSON.stringify({
              channel: payload.channel,
              recipient: payload.recipient,
              scheduled: payload.scheduling.is_scheduled,
              send_at: payload.scheduling.send_at,
            }),
          );

          try {
            const response = await api.post("/notifications/send", payload);
            debugApiResponse(response, recipient);

            // ✅ VERSIÓN SIMPLIFICADA Y CORREGIDA
            // Si llegamos aquí sin error, consideramos éxito a menos que la respuesta indique explícitamente lo contrario
            let success = true;
            let errorMsg = null;

            // Verificar si la respuesta indica explícitamente un error
            if (response.data) {
              // Si el backend devuelve explícitamente success: false
              if (response.data.success === false) {
                success = false;
                errorMsg =
                  response.data.message ||
                  response.data.error ||
                  "Error en el envío";
              }
              // Si el backend devuelve un campo error
              else if (response.data.error) {
                success = false;
                errorMsg = response.data.error;
              }
              // Si el backend devuelve un status de error
              else if (
                response.data.status === "error" ||
                response.data.status === "failed"
              ) {
                success = false;
                errorMsg = response.data.message || "Error en el envío";
              }
            }

            // Verificar código de estado HTTP (solo si no hay datos)
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

            if (success) {
              return {
                recipient,
                success: true,
                data: response.data,
                scheduled: scheduling.is_scheduled,
                channel: selectedTemplate.channel,
              };
            } else {
              return {
                recipient,
                success: false,
                error: errorMsg || "Error desconocido en la respuesta",
                scheduled: scheduling.is_scheduled,
                channel: selectedTemplate.channel,
              };
            }
          } catch (error: any) {
            console.error(`❌ Error enviando a ${recipient}:`, error);

            // Extraer mensaje de error detallado - VERSIÓN MEJORADA
            let errorMessage = "Error de conexión";

            // Intentar extraer el mensaje de error de la respuesta del backend
            if (error?.response?.data) {
              const responseData = error.response.data;

              // Diferentes formatos posibles de error
              if (responseData.message) {
                errorMessage = responseData.message;
              } else if (responseData.error) {
                errorMessage = responseData.error;
              } else if (responseData.detail) {
                errorMessage = responseData.detail;
              } else if (typeof responseData === "string") {
                errorMessage = responseData;
              } else {
                // Si no hay un campo específico, mostrar el objeto completo (útil para debugging)
                errorMessage = JSON.stringify(responseData);
              }

              // Agregar código de estado si está disponible
              if (error.response.status) {
                errorMessage = `[${error.response.status}] ${errorMessage}`;
              }
            } else if (error?.message) {
              errorMessage = error.message;
            }

            // Log detallado para debugging
            console.log(`📝 Error detallado para ${recipient}:`, {
              status: error?.response?.status,
              statusText: error?.response?.statusText,
              data: error?.response?.data,
              message: errorMessage,
            });

            return {
              recipient,
              success: false,
              error: errorMessage,
              scheduled: scheduling.is_scheduled,
              channel: selectedTemplate.channel,
            };
          }
        },
      );

      // ============================================
      // 🔥 PASO 7: ESPERAR TODAS LAS PROMESAS
      // ============================================
      const results = await Promise.all(promises);
      console.log("🔍 RESULTS RAW:", JSON.stringify(results, null, 2));

      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      // Después de obtener results, successCount y failedCount
      console.log("📊 Resultados de envío - DETALLADO:", {
        total: results.length,
        successCount,
        failedCount,
        successes: results.filter((r) => r.success).map((r) => r.recipient),
        failures: results
          .filter((r) => !r.success)
          .map((r) => ({
            recipient: r.recipient,
            error: r.error,
          })),
      });
      // Preparar detalles completos para el modal
      const failedRecipients = results
        .filter((r) => !r.success)
        .map((r) => ({
          recipient: r.recipient,
          error: r.error || "Error desconocido",
        }));

      const successfulRecipients = results
        .filter((r) => r.success)
        .map((r) => r.recipient);
      3; // ✅ AGREGAR ESTA ASIGNACIÓN (la que falta)
      setErrorDetails({
        title:
          failedCount === 0
            ? "Envío exitoso"
            : failedCount === uniqueRecipients.length
              ? "Error en el envío"
              : "Error parcial en el envío",
        message:
          failedCount === 0
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

      // ============================================
      // 🔥 PASO 8: GUARDAR CONTACTOS PENDIENTES
      // ============================================
      if (pendingContacts.length > 0 && successCount > 0) {
        try {
          await Promise.allSettled(
            pendingContacts.map((contact) =>
              api.post("/contacts", { ...contact, company_id: companyId }),
            ),
          );
          setPendingContacts([]);
        } catch (error) {
          console.error("Error guardando contactos:", error);
        }
      }

      const channelName = selectedTemplate.channel;
      // ============================================
      // 🔥 PASO 8.5: MANEJAR ERRORES PARCIALES
      // ============================================
      console.log("📊 Resultados de envío:", {
        total: uniqueRecipients.length,
        exitosos: successCount,
        fallidos: failedCount,
        resultados: results.map((r) => ({
          recipient: r.recipient,
          success: r.success,
          error: r.error,
        })),
      });

      {
        console.log(
          "✅ Todos los envíos fueron exitosos, no se muestra modal de error",
        );
      }

      // ============================================
      // 🔥 PASO 9: ACTUALIZAR RESULTADO EN UI
      // ============================================
      setResult({
        success: successCount > 0,
        message:
          scheduleType === "now"
            ? `${successCount} de ${uniqueRecipients.length} ${channelName} enviado(s) exitosamente`
            : `${uniqueRecipients.length} ${channelName} programado(s) exitosamente`,
        results,
        total: uniqueRecipients.length,
        successful: successCount,
        scheduled: scheduleType === "later",
        channel: selectedTemplate.channel,
      });

      // ============================================
      // 🔥 PASO 10: ACTUALIZAR CRÉDITOS Y MOSTRAR MENSAJE
      // ============================================
      if (successCount > 0) {
        // RECARGAR CRÉDITOS INMEDIATAMENTE
        await loadCredits();

        showMessage(
          scheduleType === "now"
            ? `✅ ${successCount} ${channelName} enviado(s) exitosamente. Se descontaron ${totalCost} créditos.`
            : `✅ ${uniqueRecipients.length} ${channelName} programado(s) exitosamente. Se reservarán ${totalCost} créditos.`,
          "success",
        );
      }
    } catch (error: any) {
      console.error("❌ Error global:", error);

      setResult({
        success: false,
        message: "Error en el envío",
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Error desconocido",
      });

      showMessage("❌ Error en el envío", "error");
    } finally {
      setSending(false);
    }
  };

  const isSendButtonDisabled = (): boolean => {
    if (!selectedTemplate) return true;
    if (selectedRecipientType === "individual" && selectedContacts.length === 0)
      return true;
    if (selectedRecipientType === "group" && selectedGroups.length === 0)
      return true;
    if (selectedRecipientType === "manual" && selectedContacts.length === 0)
      return true;

    if (scheduleType === "later") {
      if (!scheduleDate || !scheduleTime) return true;
      if (!isFutureDateTime(scheduleDate, scheduleTime)) return true;
    }

    return false;
  };

  const getFilteredTemplates = (): Template[] => {
    return templates.filter(
      (t) =>
        t.channel === "EMAIL" ||
        t.channel === "SMS" ||
        t.channel === "WHATSAPP",
    );
  };

  const renderTemplateContent = (content: string): { __html: string } => {
    const contentWithVars = replaceVariables(content, variables);
    return { __html: contentWithVars };
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

  const templateVariables = selectedTemplate
    ? extractVariables(selectedTemplate.content)
    : [];

  const handleVariableChange = (variable: string, value: string): void => {
    setVariables((prev) => ({
      ...prev,
      [variable]: value || "",
    }));
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "EMAIL":
        return <Mail className="w-5 h-5 text-blue-600" />;
      case "SMS":
        return <Phone className="w-5 h-5 text-green-600" />;
      case "WHATSAPP":
        return <MessageCircle className="w-5 h-5 text-emerald-600" />;
      default:
        return <Mail className="w-5 h-5 text-gray-600" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "EMAIL":
        return "bg-blue-100 text-blue-800";
      case "SMS":
        return "bg-green-100 text-green-800";
      case "WHATSAPP":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalCost = calculateTotalCost();

  if (loading || loadingCompany || loadingCredits) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-600">Cargando datos...</p>
        <p className="text-sm text-gray-500 mt-2">
          Cargando empresa: {companyId?.slice(0, 8)}...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Enviar Notificación
              </h1>
              <p className="text-gray-600">
                Selecciona template y destinatarios
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                  <User className="w-3 h-3 text-blue-600" />
                  <span className="text-xs text-blue-700">
                    {userData.name || "Usuario"}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg">
                  <Building className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-green-700">{companyName}</span>
                </div>
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                    currentCredits > 0 ? "bg-yellow-50" : "bg-red-50"
                  }`}
                >
                  <Coins
                    className={`w-3 h-3 ${currentCredits > 0 ? "text-yellow-600" : "text-red-600"}`}
                  />
                  <span
                    className={`text-xs ${currentCredits > 0 ? "text-yellow-700" : "text-red-700"}`}
                  >
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
        <div
          className={`mx-6 mt-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-800 border border-green-200"
              : message.type === "warning"
                ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center">
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : message.type === "warning" ? (
              <AlertTriangle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
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
                    <p className="text-gray-600 text-sm">
                      Selecciona el template
                    </p>
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
                      <div
                        className={`p-2 rounded-lg ${
                          selectedTemplate.channel === "EMAIL"
                            ? "bg-blue-100"
                            : selectedTemplate.channel === "SMS"
                              ? "bg-green-100"
                              : "bg-emerald-100"
                        }`}
                      >
                        {getChannelIcon(selectedTemplate.channel)}
                      </div>
                      <div>
                        <h3 className="font-bold">{selectedTemplate.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${getChannelColor(selectedTemplate.channel)}`}
                          >
                            {selectedTemplate.channel}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                            Costo: {CHANNEL_COSTS[selectedTemplate.channel]}{" "}
                            crédito(s) por envío
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
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
                    <span className="text-sm text-red-500">
                      No hay templates disponibles
                    </span>
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
                    <h2 className="font-semibold text-gray-900">
                      Media Adjunta (Opcional)
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Agrega imágenes o documentos a tu mensaje
                    </p>
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

            {/* Variables del Template */}
            {templateVariables.length > 0 && (
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Tag className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Variables del Template
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Personaliza las variables del template (siempre editables)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templateVariables.map((variable) => (
                    <div key={variable}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {variable === "nombre"
                          ? "👤 Nombre"
                          : variable === "email"
                            ? "📧 Email"
                            : variable === "telefono"
                              ? "📱 Teléfono"
                              : variable === "empresa"
                                ? "🏢 Empresa"
                                : variable === "fecha"
                                  ? "📅 Fecha"
                                  : variable === "hora"
                                    ? "⏰ Hora"
                                    : variable === "monto"
                                      ? "💰 Monto"
                                      : variable === "fechaLimite"
                                        ? "⏳ Fecha Límite"
                                        : variable === "numeroFactura"
                                          ? "🧾 N° Factura"
                                          : variable === "mediaUrl"
                                            ? "🖼️ URL Media"
                                            : variable === "mediaType"
                                              ? "📁 Tipo Media"
                                              : variable
                                                  .charAt(0)
                                                  .toUpperCase() +
                                                variable.slice(1)}
                      </label>
                      <input
                        type="text"
                        value={variables[variable] || ""}
                        onChange={(e) =>
                          handleVariableChange(variable, e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Ingresa ${variable}`}
                      />
                      {variable === "empresa" && companyData?.name && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Empresa desde API: {companyData.name} (puedes
                          editarlo)
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Usuario activo:</span>
                    <span>
                      {userData.name} ({userData.email})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-green-700">
                    <Building className="w-4 h-4" />
                    <span className="font-medium">Empresa activa:</span>
                    <span>{companyName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Coins className="w-4 h-4" />
                    <span className="font-medium">Créditos disponibles:</span>
                    <span
                      className={
                        currentCredits > 0
                          ? "text-yellow-700 font-bold"
                          : "text-red-600 font-bold"
                      }
                    >
                      {currentCredits}
                    </span>
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
                    <h2 className="font-semibold text-gray-900">
                      Destinatarios
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Selecciona quienes recibirán
                    </p>
                  </div>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-blue-600">
                    {selectedRecipientType === "group"
                      ? getContactsFromSelectedGroups()
                      : selectedContacts.length}
                  </span>{" "}
                  destinatarios
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {(["individual", "group", "manual"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedRecipientType(type)}
                    className={`px-4 py-3 rounded-lg border transition-colors ${
                      selectedRecipientType === type
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {type === "individual" && (
                      <User className="w-5 h-5 mx-auto mb-2" />
                    )}
                    {type === "group" && (
                      <Tag className="w-5 h-5 mx-auto mb-2" />
                    )}
                    {type === "manual" && (
                      <Mail className="w-5 h-5 mx-auto mb-2" />
                    )}
                    <span className="text-sm capitalize">
                      {type === "group" ? "Tags" : type}
                    </span>
                  </button>
                ))}
              </div>

              {selectedRecipientType === "individual" && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">
                      Contactos individuales
                    </span>
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
                          selectedTemplate?.channel === "SMS" ||
                          selectedTemplate?.channel === "WHATSAPP"
                            ? c.phone === value
                            : c.email === value,
                        );

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  selectedTemplate?.channel === "EMAIL"
                                    ? "bg-blue-100"
                                    : selectedTemplate?.channel === "SMS"
                                      ? "bg-green-100"
                                      : "bg-emerald-100"
                                }`}
                              >
                                {selectedTemplate?.channel === "EMAIL" && (
                                  <Mail className="w-4 h-4 text-blue-600" />
                                )}

                                {selectedTemplate?.channel === "WHATSAPP" && (
                                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">
                                  {contact?.name || value}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {selectedTemplate?.channel === "SMS" ||
                                  selectedTemplate?.channel === "WHATSAPP"
                                    ? formatPhoneForDisplay(value)
                                    : value}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeRecipient(value)}
                              className="text-red-600 hover:text-red-800"
                            >
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
                      {contacts.length === 0
                        ? "No hay contactos disponibles"
                        : "Seleccionar contactos"}
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
                        const group = contactGroups.find(
                          (g) => g.id === groupId,
                        );
                        if (!group) return null;
                        return (
                          <div
                            key={groupId}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Tag className="w-5 h-5 text-purple-600" />
                              </div>
                              <div>
                                <div className="font-medium">{group.name}</div>
                                <div className="text-sm text-gray-500">
                                  {group.contactCount} contactos
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleGroup(groupId)}
                              className="text-red-600 hover:text-red-800"
                            >
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
                      {contactGroups.length === 0
                        ? "No hay tags disponibles"
                        : "Seleccionar tags"}
                    </button>
                  )}
                </div>
              )}

              {selectedRecipientType === "manual" && (
                <div>
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-medium">
                      Destinatarios manuales
                    </span>
                    <button
                      onClick={addManualRecipient}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Agregar{" "}
                      {selectedTemplate?.channel === "SMS" ||
                      selectedTemplate?.channel === "WHATSAPP"
                        ? "número"
                        : "email"}
                    </button>
                  </div>
                  {selectedContacts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedContacts.map((value, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                selectedTemplate?.channel === "EMAIL"
                                  ? "bg-blue-100"
                                  : selectedTemplate?.channel === "SMS"
                                    ? "bg-green-100"
                                    : "bg-emerald-100"
                              }`}
                            >
                              {selectedTemplate?.channel === "EMAIL" && (
                                <Mail className="w-4 h-4 text-blue-600" />
                              )}
                              {selectedTemplate?.channel === "SMS" && (
                                <Phone className="w-4 h-4 text-green-600" />
                              )}
                              {selectedTemplate?.channel === "WHATSAPP" && (
                                <MessageCircle className="w-4 h-4 text-emerald-600" />
                              )}
                            </div>
                            <div className="font-medium">
                              {selectedTemplate?.channel === "SMS" ||
                              selectedTemplate?.channel === "WHATSAPP"
                                ? formatPhoneForDisplay(value)
                                : value}
                            </div>
                          </div>
                          <button
                            onClick={() => removeRecipient(value)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No hay destinatarios
                    </div>
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
                  <p className="text-gray-600 text-sm">
                    Programa el envío (hora Bolivia)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setScheduleType("now")}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    scheduleType === "now"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Enviar Ahora
                </button>
                <button
                  onClick={() => setScheduleType("later")}
                  className={`px-4 py-3 rounded-lg border transition-colors ${
                    scheduleType === "later"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Programar
                </button>
              </div>

              {scheduleType === "later" && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={getMinDateBolivia()}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Hoy: {formatDateForDisplay(getMinDateBolivia())}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Hora
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Hora local Bolivia (24h)
                      </p>
                    </div>
                  </div>

                  {scheduleDate && scheduleTime && (
                    <div
                      className={`p-3 rounded-lg border ${
                        isFutureDateTime(scheduleDate, scheduleTime)
                          ? "bg-green-50 border-green-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isFutureDateTime(scheduleDate, scheduleTime) ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-700">
                              Programado para:
                            </span>
                            <span className="text-green-600">
                              {formatDateForDisplay(scheduleDate)} a las{" "}
                              {scheduleTime}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="font-medium text-red-700">
                              Fecha/Hora inválida:
                            </span>
                            <span className="text-red-600">
                              {formatDateForDisplay(scheduleDate)} a las{" "}
                              {scheduleTime}
                            </span>
                            <span className="text-red-500 text-sm ml-auto">
                              (Debe ser futura)
                            </span>
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
                      <span className="text-gray-600">
                        Costo por {selectedTemplate.channel}:
                      </span>
                      <span className="font-medium">
                        {CHANNEL_COSTS[selectedTemplate.channel]} crédito(s)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Destinatarios:</span>
                      <span className="font-medium">
                        {selectedRecipientType === "group"
                          ? getContactsFromSelectedGroups()
                          : selectedContacts.length}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-semibold text-gray-900">
                        Costo total estimado:
                      </span>
                      <span
                        className={`font-bold ${
                          currentCredits >= totalCost
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {totalCost} créditos
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Saldo actual:</span>
                      <span
                        className={`font-medium ${
                          currentCredits > 0
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {currentCredits} créditos
                      </span>
                    </div>
                    {currentCredits < totalCost && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">
                            Créditos insuficientes
                          </span>
                        </div>
                        <p className="text-sm text-red-600 mt-1">
                          Necesitas {totalCost - currentCredits} créditos
                          adicionales para realizar este envío.
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
                disabled={
                  sending ||
                  isSendButtonDisabled() ||
                  (selectedTemplate ? !hasEnoughCredits() : false)
                }
                className={`w-full px-6 py-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                  selectedTemplate && !hasEnoughCredits()
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
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
                    <div
                      className={`px-3 py-1.5 rounded-full text-sm ${getChannelColor(selectedTemplate.channel)}`}
                    >
                      {selectedTemplate.channel}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Contenido:</div>
                    <div className="bg-gray-50 rounded-lg p-4 border min-h-[200px] overflow-auto">
                      {selectedTemplate.channel === "EMAIL" ? (
                        <div
                          className="preview-content"
                          dangerouslySetInnerHTML={renderTemplateContent(
                            selectedTemplate.content,
                          )}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-gray-800">
                          {replaceVariables(
                            selectedTemplate.content,
                            variables,
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedTemplate.channel === "WHATSAPP" && whatsappFile && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <MessageCircle className="w-4 h-4" />
                        <span className="font-medium">Media adjunto:</span>
                        <span className="text-sm">{whatsappFile.type}</span>
                      </div>
                      {whatsappFile.type === "image" && (
                        <img
                          src={whatsappFile.url}
                          alt="Preview"
                          className="mt-2 rounded-lg max-h-32 object-contain"
                        />
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-blue-50 rounded-lg border">
                    <h4 className="font-medium mb-3">Resumen</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Destinatarios:</span>
                        <span className="font-medium">
                          {selectedRecipientType === "group"
                            ? getContactsFromSelectedGroups()
                            : selectedContacts.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tipo:</span>
                        <span className="font-medium capitalize">
                          {selectedRecipientType === "group"
                            ? "Tags"
                            : selectedRecipientType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Programación:</span>
                        <span className="font-medium">
                          {scheduleType === "now" ? "Inmediato" : "Programado"}
                        </span>
                      </div>
                      {scheduleType === "later" && (
                        <div className="flex justify-between">
                          <span>Fecha/Hora:</span>
                          <span className="font-medium">
                            {formatDateForDisplay(scheduleDate)} {scheduleTime}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Variables:</span>
                        <span className="font-medium">
                          {templateVariables.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Variables cargadas:</span>
                        <span className="font-medium">
                          {selectedContactObjects.length > 0 ? "✓ Sí" : "✗ No"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Empresa:</span>
                        <span className="font-medium text-green-600">
                          {companyName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Usuario:</span>
                        <span className="font-medium text-blue-600">
                          {userData.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Créditos disponibles:</span>
                        <span
                          className={`font-medium ${currentCredits > 0 ? "text-yellow-600" : "text-red-600"}`}
                        >
                          {currentCredits}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="font-semibold">Costo estimado:</span>
                        <span
                          className={`font-bold ${currentCredits >= totalCost ? "text-green-600" : "text-red-600"}`}
                        >
                          {totalCost} créditos
                        </span>
                      </div>
                      {selectedTemplate.channel === "WHATSAPP" && (
                        <div className="flex justify-between">
                          <span>Con Media:</span>
                          <span className="font-medium">
                            {whatsappFile ? "Sí" : "No"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📝</div>
                  <h3 className="text-lg font-bold mb-2">
                    Selecciona un Template
                  </h3>
                  <p className="text-gray-600">
                    Elige un template para ver vista previa
                  </p>
                </div>
              )}
            </div>

            {result && (
              <div
                className={`mt-6 rounded-xl border p-6 ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <div className="flex items-start gap-4">
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  )}
                  <div>
                    <h3 className="font-bold">
                      {result.success ? "✅ Éxito" : "❌ Error"}
                    </h3>
                    <p className="mt-1">{result.message}</p>
                    {result.error && (
                      <p className="text-sm text-red-600 mt-2">
                        {result.error}
                      </p>
                    )}
                    {result.results &&
                      result.successful &&
                      result.successful > 0 && (
                        <div className="mt-3 text-sm">
                          <div className="font-medium text-gray-700 mb-1">
                            Destinatarios exitosos:
                          </div>
                          <div className="space-y-1">
                            {result.results
                              .filter((r: any) => r.success)
                              .slice(0, 3)
                              .map((r: any, i: number) => (
                                <div key={i} className="flex items-center">
                                  <span className="text-green-600 mr-2">✓</span>
                                  <span className="truncate">
                                    {r.channel === "SMS" ||
                                    r.channel === "WHATSAPP"
                                      ? formatPhoneForDisplay(r.recipient)
                                      : r.recipient}
                                  </span>
                                </div>
                              ))}
                            {result.successful > 3 && (
                              <div className="text-green-600 font-medium">
                                +{result.successful - 3} más
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
              <h2 className="text-xl font-bold text-gray-900">
                Créditos insuficientes
              </h2>
            </div>

            <p className="text-gray-600 mb-4">
              No tienes suficientes créditos para realizar este envío.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Créditos disponibles:</span>
                <span className="font-bold text-yellow-600">
                  {currentCredits}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Créditos necesarios:</span>
                <span className="font-bold text-red-600">{totalCost}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Déficit:</span>
                <span className="font-bold text-red-600">
                  {totalCost - currentCredits}
                </span>
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
      {/* Modal de Error */}
      {/* Modal de Resultados */}
      {showErrorModal && errorDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header - Cambia según si hay errores o no */}
            <div className="p-6 border-b">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-full ${
                    errorDetails.failedCount === 0
                      ? "bg-green-100"
                      : errorDetails.failedCount === errorDetails.totalCount
                        ? "bg-red-100"
                        : "bg-yellow-100"
                  }`}
                >
                  {errorDetails.failedCount === 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : errorDetails.failedCount === errorDetails.totalCount ? (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {errorDetails.failedCount === 0
                      ? "✅ Envío exitoso"
                      : errorDetails.failedCount === errorDetails.totalCount
                        ? "❌ Error en el envío"
                        : "⚠️ Envío parcialmente exitoso"}
                  </h3>
                  <p className="text-gray-600">{errorDetails.message}</p>
                </div>
              </div>
            </div>

            {/* Resumen de estadísticas */}
            <div className="p-6 bg-gray-50 border-b">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Exitosos</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {errorDetails.successCount || 0}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-600 mb-1">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Fallidos</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {errorDetails.failedCount || 0}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Send className="w-4 h-4" />
                    <span className="text-sm font-medium">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {errorDetails.totalCount || 0}
                  </div>
                </div>
              </div>

              {/* Créditos usados */}
              {errorDetails.creditsUsed && (
                <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Coins className="w-4 h-4" />
                    <span className="font-medium">Créditos utilizados:</span>
                    <span className="font-bold">
                      {errorDetails.creditsUsed}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Lista detallada de resultados */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Tabs para filtrar */}
                <div className="flex gap-2 border-b">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === "all"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Todos ({errorDetails.allResults?.length || 0})
                  </button>
                  <button
                    onClick={() => setFilterType("success")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === "success"
                        ? "text-green-600 border-b-2 border-green-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Exitosos ({errorDetails.successCount || 0})
                  </button>
                  <button
                    onClick={() => setFilterType("failed")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      filterType === "failed"
                        ? "text-red-600 border-b-2 border-red-600"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Fallidos ({errorDetails.failedCount || 0})
                  </button>
                </div>

                {/* Lista de resultados filtrados */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {errorDetails.allResults
                    ?.filter((result) => {
                      if (filterType === "success") return result.success;
                      if (filterType === "failed") return !result.success;
                      return true;
                    })
                    .map((result, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          result.success
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 ${
                                result.success
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {result.success ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <AlertCircle className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">
                                {result.channel === "SMS" ||
                                result.channel === "WHATSAPP"
                                  ? formatPhoneForDisplay(result.recipient)
                                  : result.recipient}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    result.channel === "EMAIL"
                                      ? "bg-blue-100 text-blue-700"
                                      : result.channel === "SMS"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {result.channel}
                                </span>
                                {result.scheduled && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                    Programado
                                  </span>
                                )}
                              </div>
                              {!result.success && result.error && (
                                <div className="mt-2 text-sm text-red-600 bg-red-100/50 p-2 rounded">
                                  <span className="font-medium">Error:</span>{" "}
                                  {result.error}
                                </div>
                              )}
                              {result.success && (
                                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Enviado correctamente
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date().toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}

                  {/* Mensaje si no hay resultados en el filtro */}
                  {errorDetails.allResults?.filter((result) => {
                    if (filterType === "success") return result.success;
                    if (filterType === "failed") return !result.success;
                    return true;
                  }).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay{" "}
                      {filterType === "success"
                        ? "envíos exitosos"
                        : filterType === "failed"
                          ? "errores"
                          : "resultados"}{" "}
                      para mostrar
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer con acciones */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    setErrorDetails(null);
                    setFilterType("all"); // Resetear filtro
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Cerrar
                </button>
                {errorDetails.failedCount && errorDetails.failedCount > 0 && (
                  <button
                    onClick={() => {
                      // Reintentar solo los fallidos
                      const failedRecipients =
                        errorDetails.allResults
                          ?.filter((r) => !r.success)
                          .map((r) => r.recipient) || [];

                      setSelectedContacts(failedRecipients);
                      setShowErrorModal(false);
                      setErrorDetails(null);
                      setFilterType("all");

                      showMessage(
                        `${failedRecipients.length} destinatarios listos para reintentar`,
                        "warning",
                      );
                    }}
                    className="px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium transition-colors"
                  >
                    Reintentar fallidos ({errorDetails.failedCount})
                  </button>
                )}
              </div>

              {errorDetails.failedCount && errorDetails.failedCount > 0 && (
                <p className="text-xs text-center text-gray-500 mt-4">
                  Si el problema persiste, verifica la configuración del canal o
                  contacta al administrador
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsSend;
