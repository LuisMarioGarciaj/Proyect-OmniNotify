import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Users, 
  FileText, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  BarChart3,
  Activity
} from 'lucide-react';
import { dashboardService } from '../services/dashboard.service';

interface Stats {
  totalContacts: number;
  totalTemplates: number;
  totalNotifications: number;
  totalSent: number;
  totalFailed: number;
  scheduledPending: number;
  successRate: number;
}

interface MessagesByChannel {
  channel: string;
  count: number;
}

interface RecentNotification {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  error_message?: string;
  created_at: string;
}

interface ScheduledNotification {
  id: string;
  channel: string;
  recipient: string;
  scheduled_at: string;
  status: string;
}

interface SuccessRate {
  channel: string;
  SENT: number;
  FAILED: number;
  total: number;
  successRate: number;
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [messagesByChannel, setMessagesByChannel] = useState<MessagesByChannel[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [scheduledPending, setScheduledPending] = useState<ScheduledNotification[]>([]);
  const [successRateData, setSuccessRateData] = useState<SuccessRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, channelData, recentData, scheduledData, successData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getMessagesByChannel(),
        dashboardService.getRecentNotifications(10),
        dashboardService.getScheduledPending(),
        dashboardService.getSuccessRate(),
      ]);

      setStats(statsData);
      setMessagesByChannel(channelData);
      setRecentNotifications(recentData);
      setScheduledPending(scheduledData);
      setSuccessRateData(successData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail className="w-4 h-4" />;
      case 'WHATSAPP': return <MessageSquare className="w-4 h-4" />;
      case 'SMS': return <Send className="w-4 h-4" />;
      default: return <Send className="w-4 h-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return 'from-blue-500 to-cyan-500';
      case 'WHATSAPP': return 'from-green-500 to-emerald-500';
      case 'SMS': return 'from-purple-500 to-pink-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      SENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      FAILED: 'bg-red-100 text-red-700 border-red-200',
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      SCHEDULED: 'bg-blue-100 text-blue-700 border-blue-200',
      DELIVERED: 'bg-green-100 text-green-700 border-green-200',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-lg font-semibold text-slate-700 animate-pulse">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-blue-600 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-600 font-medium">Welcome back! Here's what's happening today.</p>
          </div>
          <button 
            onClick={loadDashboardData}
            className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            <Activity className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Messages */}
          <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shadow-lg">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Messages</p>
              <p className="text-4xl font-black bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {stats?.totalNotifications.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Success Rate */}
          <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-green-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl shadow-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                  +{stats?.successRate}%
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Success Rate</p>
              <p className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                {stats?.successRate}%
              </p>
            </div>
          </div>

          {/* Total Contacts */}
          <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Contacts</p>
              <p className="text-4xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {stats?.totalContacts.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Scheduled Pending */}
          <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Scheduled</p>
              <p className="text-4xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {stats?.scheduledPending.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Messages by Channel */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Messages by Channel</h3>
            </div>
            <div className="space-y-4">
              {messagesByChannel.map((item, idx) => {
                const total = messagesByChannel.reduce((sum, i) => sum + i.count, 0);
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 bg-gradient-to-r ${getChannelColor(item.channel)} rounded-lg`}>
                          {getChannelIcon(item.channel)}
                        </div>
                        <span className="font-bold text-slate-700">{item.channel}</span>
                      </div>
                      <span className="text-2xl font-black text-slate-800">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${getChannelColor(item.channel)} rounded-full transition-all duration-1000 ease-out group-hover:opacity-80`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Success Rate by Channel */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Success Rate by Channel</h3>
            </div>
            <div className="space-y-4">
              {successRateData.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 bg-gradient-to-r ${getChannelColor(item.channel)} rounded-lg`}>
                        {getChannelIcon(item.channel)}
                      </div>
                      <span className="font-bold text-slate-700">{item.channel}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-emerald-600">{item.successRate}%</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-bold">{item.SENT}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-4 h-4" />
                      <span className="font-bold">{item.FAILED}</span>
                    </div>
                    <div className="font-bold text-slate-500">{item.total} total</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity & Scheduled */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Notifications */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Recent Activity</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentNotifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className="p-4 border-l-4 border-slate-200 bg-slate-50 rounded-r-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 bg-gradient-to-r ${getChannelColor(notif.channel)} rounded-lg`}>
                          {getChannelIcon(notif.channel)}
                        </div>
                        <span className="font-bold text-slate-700 text-sm">{notif.channel}</span>
                        <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusBadge(notif.status)}`}>
                          {notif.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-600 truncate">{notif.recipient}</p>
                      {notif.error_message && (
                        <p className="text-xs text-red-600 mt-1 truncate">{notif.error_message}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scheduled Pending */}
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Upcoming Scheduled</h3>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scheduledPending.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-semibold">No scheduled messages</p>
                </div>
              ) : (
                scheduledPending.map((notif) => (
                  <div 
                    key={notif.id} 
                    className="p-4 border-l-4 border-amber-300 bg-amber-50 rounded-r-xl hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 bg-gradient-to-r ${getChannelColor(notif.channel)} rounded-lg`}>
                        {getChannelIcon(notif.channel)}
                      </div>
                      <span className="font-bold text-slate-700 text-sm">{notif.channel}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-600 truncate">{notif.recipient}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-amber-700">
                      <Clock className="w-3 h-3" />
                      <span className="font-bold">{new Date(notif.scheduled_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
            <FileText className="w-10 h-10 mb-3 opacity-80" />
            <p className="text-sm font-bold uppercase tracking-wider opacity-90 mb-1">Templates</p>
            <p className="text-4xl font-black">{stats?.totalTemplates}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-green-600 rounded-2xl p-6 text-white shadow-lg">
            <CheckCircle className="w-10 h-10 mb-3 opacity-80" />
            <p className="text-sm font-bold uppercase tracking-wider opacity-90 mb-1">Messages Sent</p>
            <p className="text-4xl font-black">{stats?.totalSent.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-red-600 to-rose-600 rounded-2xl p-6 text-white shadow-lg">
            <XCircle className="w-10 h-10 mb-3 opacity-80" />
            <p className="text-sm font-bold uppercase tracking-wider opacity-90 mb-1">Failed Messages</p>
            <p className="text-4xl font-black">{stats?.totalFailed.toLocaleString()}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;