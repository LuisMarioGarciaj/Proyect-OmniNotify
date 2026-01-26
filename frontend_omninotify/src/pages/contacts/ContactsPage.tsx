import React, { useEffect, useState } from 'react';
import type { Contact } from '../../types/contact';
import { getContacts } from '../../services/contacts.service';
import ContactsTable from './ContactsTable';
import ContactForm from './ContactForm';

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const loadContacts = async () => {
  try {
      setLoading(true);
      const data = await getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };
  

  useEffect(() => {
    loadContacts();
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      {mode === 'list' && (
        <ContactsTable
          contacts={contacts}
          onAdd={() => setMode('create')}
          onEdit={(contact) => {
            setSelectedContact(contact);
            setMode('edit');
          }}
          onRefresh={loadContacts}
        />
      )}

      {(mode === 'create' || mode === 'edit') && (
        <ContactForm
          contact={selectedContact}
          onCancel={() => {
            setSelectedContact(null);
            setMode('list');
          }}
          onSuccess={() => {
            loadContacts();
            setMode('list');
          }}
        />
      )}
    </div>
  );
};

export default ContactsPage;
