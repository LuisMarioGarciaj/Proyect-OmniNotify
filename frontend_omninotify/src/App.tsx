import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/Dashboard';
import TemplatesPage from './pages/Templates';
// import ContactsPage from './pages/Contacts';
import ContactsPage from './pages/contacts/ContactsPage';
import TagsPage from './pages/Tags';
import NotificationsPage from './pages/Notifications';
import ProfilePage from './pages/Profile';
import EmailConfiguration from './pages/EmailConfiguration'; // Importa el nuevo componente

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        
        {/* Rutas protegidas dentro del layout */}
        <Route path="/" element={
          
            <DashboardLayout />
          
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="tags" element={<TagsPage />} /> 
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="email-configuration" element={<EmailConfiguration companyId="25a63d10-eff4-11f0-86e6-a2aaf909b30d" />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;