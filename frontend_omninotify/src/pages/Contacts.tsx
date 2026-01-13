import React from 'react';

const ContactsPage: React.FC = () => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Contacts</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex space-x-4">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">All Contacts</button>
            <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">Groups</button>
            <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">Import</button>
          </div>
          <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg">
            + Add Contact
          </button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 text-left text-gray-600 font-semibold">Name</th>
              <th className="p-4 text-left text-gray-600 font-semibold">Email</th>
              <th className="p-4 text-left text-gray-600 font-semibold">Phone</th>
              <th className="p-4 text-left text-gray-600 font-semibold">Status</th>
              <th className="p-4 text-left text-gray-600 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((contact) => (
              <tr key={contact} className="border-b hover:bg-gray-50">
                <td className="p-4">Contact {contact}</td>
                <td className="p-4">contact{contact}@example.com</td>
                <td className="p-4">+1 234 567 890{contact}</td>
                <td className="p-4">
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Active
                  </span>
                </td>
                <td className="p-4">
                  <button className="text-blue-600 hover:text-blue-800 mr-3">Edit</button>
                  <button className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContactsPage;