import React, { useEffect, useState, useRef } from 'react'; // Añadimos useRef
import * as XLSX from 'xlsx'; // Importamos la librería para Excel
import type { Contact } from '../../types/contact';
import type { Tag } from '../../types/tag';
import { getContacts, createContact } from '../../services/contacts.service'; // Asegúrate de tener createContact
import { tagsService } from '../../services/tags.service';
import { getCompanyId } from '../../utils/auth.helpers';
import { Search, Filter, Upload, Plus, RefreshCw, FileSpreadsheet } from 'lucide-react';
import ContactsTable from './ContactsTable';
import ContactForm from './ContactForm';

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Referencia para el input de archivo oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const companyId = getCompanyId();

  // --- FUNCIÓN DE CARGA ---
  const loadData = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [contactsData, tagsData] = await Promise.all([
        getContacts(companyId),
        tagsService.getAll()
      ]);
      setContacts(contactsData);
      setAvailableTags(tagsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- LÓGICA DE IMPORTACIÓN Y VALIDACIÓN ---
  const handleImportClick = () => {
    // Esto simula el click en el input oculto
    fileInputRef.current?.click();
  };

  const processExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      // Aplicar tus reglas de validación
      const validContacts = data.filter(row => {
        const name = row.Nombre || row.name;
        const email = row.Email || row.email;
        const phone = row.Telefono || row.phone;

        const hasName = !!String(name || '').trim();
        const hasEmail = !!String(email || '').trim();
        const hasPhone = !!String(phone || '').trim();

        // ❌ Solo nombre: NO
        if (hasName && !hasEmail && !hasPhone) return false;
        // ✅ Correo o Teléfono (con o sin nombre): SÍ
        if (hasEmail || hasPhone) return true;

        return false;
      });

      console.log("Contactos válidos para subir:", validContacts);

      // Aquí podrías enviar validContacts al backend uno por uno o en batch
      // Ejemplo rápido (asumiendo que tienes un servicio):
      for (const c of validContacts) {
        try {
          await createContact(companyId, {
            name: c.Nombre || c.name || 'Sin Nombre',
            email: c.Email || c.email || '',
            phone: String(c.Telefono || c.phone || ''),
            tagIds: [] 
          });
        } catch (err) { console.error("Error subiendo uno:", err); }
      }
      
      alert(`Importación finalizada. Se procesaron ${validContacts.length} contactos.`);
      loadData();
      e.target.value = ''; // Limpiar input
    };
    reader.readAsBinaryString(file);
  };

  // --- FILTRADO ---
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = filterTag === "" || c.tags?.some(t => t.id === filterTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Input de archivo oculto */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={processExcel} 
        accept=".xlsx, .xls, .csv" 
        className="hidden" 
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Contact Directory</h1>
          <p className="text-gray-500 text-sm">Manage your clients intuitively.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleImportClick} // Ahora sí dispara el selector de archivos
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
          >
            <FileSpreadsheet size={18} />
            Import Excel
          </button>
          <button
            onClick={() => { setSelectedContact(null); setMode('create'); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus size={18} />
            New Contact
          </button>
        </div>
      </div>

      {mode === 'list' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select 
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">All tags</option>
                {availableTags.map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <ContactsTable
              contacts={filteredContacts}
              onAdd={() => setMode('create')}
              onEdit={(contact) => { setSelectedContact(contact); setMode('edit'); }}
              onRefresh={loadData}
            />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <button onClick={() => setMode('list')} className="text-blue-600 mb-4 flex items-center gap-1 text-sm font-medium">
            ← Back to the list
          </button>
          <ContactForm
            contact={selectedContact}
            companyId={companyId!}  
            onCancel={() => { setSelectedContact(null); setMode('list'); }}
            onSuccess={() => { loadData(); setMode('list'); }}
          />
        </div>
      )}
    </div>
  );
};

export default ContactsPage;