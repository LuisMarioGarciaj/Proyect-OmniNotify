import React, { useState ,useEffect} from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import ProtectedRoute from "./components/ProtectedRoute"; // Asegúrate de usarlo para proteger las rutas
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/Dashboard";
import TemplatesPage from "./pages/Templates/Templates";
import ContactsPage from "./pages/contacts/ContactsPage";
import TagsPage from "./pages/Tags";
import NotificationsPage from "./pages/NotificationsSend/Notifications";
import ProfilePage from "./pages/Profile";
import EmailConfiguration from "./pages/EmailConfiguration";
import CompanyPage from "./pages/company/CompanyPage"; // Asegúrate de que la ruta del archivo sea correcta
import SMSConfiguration from "./pages/SMSConfiguration";
import RechargeCredits from "./pages/Credits/RechargeCredits";
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import RoleGuard from "./components/RoleGuard";
import ResetPassword from "./pages/ResetPassword";
import FirstLoginWizard from "./components/FirstLoginWizard";

function App() {
  // Obtenemos los datos del usuario guardados al iniciar sesión
  // ← NUEVO: Lee si debe mostrar el wizard (persiste entre recargas)
  const [showWizard, setShowWizard] = useState(() => {
    return localStorage.getItem("show_wizard") === "true";
  });
     useEffect(() => {
    // También polling ligero por si el evento storage no dispara en misma pestaña
    const interval = setInterval(() => {
      if (localStorage.getItem("show_wizard") === "true" && !showWizard) {
        setShowWizard(true);
      }
    }, 300);

    return () => {
      clearInterval(interval);
    };
  }, [showWizard]);


  const handleWizardComplete = () => {
    localStorage.removeItem("show_wizard");
    setShowWizard(false);
  };
  const currentUserData = JSON.parse(localStorage.getItem("user_data") || "{}");
  const companyId = currentUserData.company_id;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />

        {/* Rutas protegidas dentro del DashboardLayout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <RoleGuard requiredPermission="dashboard">
                <DashboardPage />
              </RoleGuard>
            }
          />
          <Route
            path="templates"
            element={
              <RoleGuard requiredPermission="templates">
                <TemplatesPage />
              </RoleGuard>
            }
          />
          <Route
            path="contacts"
            element={
              <RoleGuard requiredPermission="contacts">
                <ContactsPage />
              </RoleGuard>
            }
          />
          <Route
            path="tags"
            element={
              <RoleGuard requiredPermission="tags">
                <TagsPage />
              </RoleGuard>
            }
          />
          <Route
            path="notifications"
            element={
              <RoleGuard requiredPermission="notifications">
                <NotificationsPage />
              </RoleGuard>
            }
          />
          <Route
            path="profile"
            element={
              <RoleGuard requiredPermission="profile">
                <ProfilePage />
              </RoleGuard>
            }
          />
          <Route
            path="company"
            element={
              <RoleGuard requiredPermission="company">
                <CompanyPage user={currentUserData} />
              </RoleGuard>
            }
          />
          {/* Nueva ruta para créditos */}
          <Route
            path="credits/recharge"
            element={
              <RoleGuard requiredPermission="credits">
                <RechargeCredits />
              </RoleGuard>
            }
          />

          {/* Configuración de Email usando el ID dinámico del usuario logueado */}
          <Route
            path="email-configuration"
            element={
              <RoleGuard requiredPermission="email-configuration">
                <EmailConfiguration companyId={companyId} />
              </RoleGuard>
            }
          />
          <Route
            path="sms-configuration"
            element={
              <RoleGuard requiredPermission="sms-config">
                <SMSConfiguration companyId="25a63d10-eff4-11f0-86e6-a2aaf909b30d" />
              </RoleGuard>
            }
          />
          <Route
            path="email-configuration"
            element={
              <RoleProtectedRoute requiredPermission="email-configuration">
                <EmailConfiguration companyId={companyId} />
              </RoleProtectedRoute>
            }
          />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
       {/* ← NUEVO: Wizard montado FUERA de las rutas, sobrevive navegación */}
      {showWizard && (
        <FirstLoginWizard
          isOpen={true}
          onClose={handleWizardComplete}
          onComplete={handleWizardComplete}
          userName={currentUserData.name || ""}
          companyName={currentUserData.company_name || ""}
          companyId={currentUserData.company_id || ""}
        />
      )}
    </Router>
  );
}

export default App;
