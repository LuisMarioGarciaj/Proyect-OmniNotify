const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export const dashboardService = {
  // Obtener estadísticas generales
  async getStats() {
    const res = await fetch(`${API_URL}/dashboard/stats`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Error fetching dashboard stats');
    return res.json();
  },

  // Obtener mensajes por canal
  async getMessagesByChannel() {
    const res = await fetch(`${API_URL}/dashboard/messages-by-channel`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Error fetching messages by channel');
    return res.json();
  },

  // Obtener actividad de los últimos N días
  async getActivity(days: number = 7) {
    const res = await fetch(`${API_URL}/dashboard/activity?days=${days}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Error fetching activity');
    return res.json();
  },

  // Obtener notificaciones recientes
  async getRecentNotifications(limit: number = 10) {
    const res = await fetch(`${API_URL}/dashboard/recent-notifications?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Error fetching recent notifications');
    return res.json();
  },

  // Obtener notificaciones programadas pendientes
  async getScheduledPending() {
    const res = await fetch(`${API_URL}/dashboard/scheduled-pending`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Error fetching scheduled notifications');
    return res.json();
  },

  // Obtener tasa de éxito
  async getSuccessRate() {
    const res = await fetch(`${API_URL}/dashboard/success-rate`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Error fetching success rate');
    return res.json();
  },
};