import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import ProtectedRoute from './components/ProtectedRoute'; // Asegúrate de usarlo para proteger las rutas
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/Dashboard';
import TemplatesPage from './pages/Templates/Templates';
import ContactsPage from './pages/contacts/ContactsPage';
import TagsPage from './pages/Tags';
import NotificationsPage from './pages/Notifications';
import ProfilePage from './pages/Profile';
import EmailConfiguration from './pages/EmailConfiguration';
import CompanyPage from "./pages/company/CompanyPage"; // Asegúrate de que la ruta del archivo sea correcta
import SMSConfiguration from './pages/SMSConfiguration';
function App() {
  // Obtenemos los datos del usuario guardados al iniciar sesión
  const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
  const companyId = userData.company_id;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        
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
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="tags" element={<TagsPage />} /> 
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="company" element={<CompanyPage user={userData} />} />
          
          {/* Configuración de Email usando el ID dinámico del usuario logueado */}
          <Route path="email-configuration" element={<EmailConfiguration companyId={companyId} />} />
          <Route path="sms-configuration" element={<SMSConfiguration companyId="25a63d10-eff4-11f0-86e6-a2aaf909b30d" />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;