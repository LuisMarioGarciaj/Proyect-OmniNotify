import React from 'react';

const NotificationsPage: React.FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Send Notifications</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Notification</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Select Template</label>
              <select className="w-full p-3 border rounded-lg">
                <option>Welcome Email</option>
                <option>Notification Alert</option>
                <option>Promotional</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Recipients</label>
              <select className="w-full p-3 border rounded-lg">
                <option>All Contacts</option>
                <option>Active Users</option>
                <option>Specific Group</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Schedule</label>
              <input type="datetime-local" className="w-full p-3 border rounded-lg" />
            </div>
            <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition">
              Send Notification
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Notifications</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Notification {item}</span>
                  <span className="text-sm text-green-600">Sent</span>
                </div>
                <p className="text-gray-600 text-sm">Sent to 150 recipients</p>
                <p className="text-gray-500 text-xs mt-2">2 hours ago</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;