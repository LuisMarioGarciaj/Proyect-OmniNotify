import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Tag as TagIcon, Edit2, Trash2, Filter, Search, AlertTriangle, X, Users, Mail, Phone, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { tagsService } from '../services/tags.service';
import type { Tag } from '../types/tag';
import { getCompanyId } from '../utils/auth.helpers';
import TagForm from '../components/tags/TagForm';
import TagChip from '../components/tags/TagChip';
console.log('tagsService object:', tagsService);
console.log('getTagContacts exists?', typeof tagsService.getTagContacts);
interface Contact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  created_at?: string;
}

const TagsPage: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  
  // Nuevos estados para manejar contactos expandidos
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [tagContacts, setTagContacts] = useState<Record<string, Contact[]>>({});
  const [loadingContacts, setLoadingContacts] = useState<Record<string, boolean>>({});

  const companyId = getCompanyId();

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const data = await tagsService.getAll(); 
      setTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  }, []); 

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const loadAllContacts = async (tagId: string) => {
    try {
      setLoadingContacts(prev => ({ ...prev, [tagId]: true }));
      const contacts = await tagsService.getTagContacts(tagId);
      setTagContacts(prev => ({ ...prev, [tagId]: contacts }));
      
      // Expandir el tag
      setExpandedTag(tagId);
    } catch (error) {
      console.error('Error loading all contacts:', error);
    } finally {
      setLoadingContacts(prev => ({ ...prev, [tagId]: false }));
    }
  };

  const toggleTagExpansion = (tagId: string) => {
    if (expandedTag === tagId) {
      // Si ya está expandido, colapsar
      setExpandedTag(null);
    } else {
      // Si no está expandido, cargar todos los contactos
      loadAllContacts(tagId);
    }
  };

  const handleCreateTag = async (tagData: { name: string }) => {
    if (!companyId) return;
    try {
      await tagsService.create({ name: tagData.name, company_id: companyId });
      await fetchTags();
      setShowForm(false);
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleUpdateTag = async (tagId: string, tagData: { name: string }) => {
    try {
      await tagsService.update(tagId, tagData.name);
      await fetchTags();
      setEditingTag(null);
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      await tagsService.delete(tagToDelete.id);
      await fetchTags();
      
      // Limpiar datos del tag eliminado
      const newTagContacts = { ...tagContacts };
      delete newTagContacts[tagToDelete.id];
      setTagContacts(newTagContacts);
      
      if (expandedTag === tagToDelete.id) {
        setExpandedTag(null);
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
    } finally {
      setShowDeleteModal(false);
      setTagToDelete(null);
    }
  };

  const cancelDeleteTag = () => {
    setShowDeleteModal(false);
    setTagToDelete(null);
  };
  
  const openDeleteConfirmation = (tag: Tag) => {
    setTagToDelete(tag);
    setShowDeleteModal(true);
  };

  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderContactList = (tag: Tag) => {
    const contacts = tagContacts[tag.id] || [];
    const isLoading = loadingContacts[tag.id];
    const isExpanded = expandedTag === tag.id;

    if (!isExpanded) return null;

    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-6">
          <Loader className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      );
    }

    if (contacts.length === 0) {
      return (
        <div className="text-center py-6 text-gray-500">
          <Users className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm">No contacts in this tag</p>
        </div>
      );
    }

    return (
      <div className="mt-4 border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-700 flex items-center gap-2">
            <Users size={16} />
            All Contacts ({contacts.length})
          </h4>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {contact.name || 'Unnamed Contact'}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1 text-sm text-gray-600">
                  {contact.email && (
                    <div className="flex items-center gap-1 truncate">
                      <Mail size={12} />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-1">
                      <Phone size={12} />
                      <span>{contact.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              {contact.created_at && (
                <div className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                  {new Date(contact.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderContactPreview = (tag: Tag) => {
    if (expandedTag === tag.id) return null;
    
    const preview = tag.contacts_preview || [];
    
    if (preview.length === 0) {
      return (
        <div className="mt-2 text-sm text-gray-500">
          No contacts yet
        </div>
      );
    }

    return (
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">
            Recent Contacts
          </h4>
          {tag.contacts_count && tag.contacts_count > 5 && (
            <span className="text-xs text-gray-500">
              Showing 5 of {tag.contacts_count}
            </span>
          )}
        </div>
        
        <div className="space-y-2">
          {preview.map((contact: any) => (
            <div key={contact.id} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-gray-700 truncate">
                {contact.name || contact.email || contact.phone || 'Unnamed Contact'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Modal de confirmación para eliminar */}
      {showDeleteModal && tagToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="text-red-600" size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Delete Tag</h2>
              </div>
              <button
                onClick={cancelDeleteTag}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700">
                Are you sure you want to delete the tag <span className="font-semibold">"{tagToDelete.name}"</span>? 
                This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <button
                onClick={cancelDeleteTag}
                className="px-5 py-2.5 text-gray-700 hover:text-gray-900 font-medium rounded-lg transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTag}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <TagIcon className="text-blue-600" />
              Tags Management
            </h1>
            <p className="text-gray-600 mt-1">
              Organize and categorize your contacts with tags
            </p>
          </div>
          
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            <Plus size={20} />
            New Tag
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-500" />
            <select className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
              <option value="">All Tags</option>
              <option value="recent">Recently Created</option>
              <option value="popular">Most Used</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tag Form Modal */}
      {(showForm || editingTag) && (
        <TagForm
          tag={editingTag}
          onSubmit={editingTag ? 
            (data) => handleUpdateTag(editingTag.id, data) : 
            handleCreateTag
          }
          onClose={() => {
            setShowForm(false);
            setEditingTag(null);
          }}
        />
      )}

      {/* Tags Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTags.map((tag) => {
            const isExpanded = expandedTag === tag.id;
            
            return (
              <div
                key={tag.id}
                className={`bg-white rounded-xl shadow-lg p-5 transition-all hover:shadow-xl ${
                  isExpanded ? 'border-2 border-blue-500' : 'border border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <TagChip label={tag.name} showRemove={false} />
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingTag(tag)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit tag"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => openDeleteConfirmation(tag)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete tag"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      <span className="font-medium">Contacts:</span> {tag.contacts_count || 0}
                    </span>
                    <span className="text-gray-400">
                      {tag.created_at && new Date(tag.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Mostrar preview de contactos */}
                {renderContactPreview(tag)}
                
                {/* Mostrar TODOS los contactos cuando está expandido */}
                {renderContactList(tag)}
                
                {/* Botón para expandir/colapsar */}
                <button
                  onClick={() => toggleTagExpansion(tag.id)}
                  disabled={loadingContacts[tag.id]}
                  className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition ${
                    isExpanded
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${loadingContacts[tag.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loadingContacts[tag.id] ? (
                    <>
                      <Loader className="animate-spin h-4 w-4" />
                      Loading...
                    </>
                  ) : isExpanded ? (
                    <>
                      <ChevronUp size={16} />
                      Hide All Contacts
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} />
                      View All Contacts
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTags.length === 0 && (
        <div className="text-center py-12">
          <TagIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No tags found</h3>
          <p className="mt-2 text-gray-600">
            {searchTerm ? 'Try adjusting your search' : 'Get started by creating your first tag'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              <Plus size={20} />
              Create Tag
            </button>
          )}
        </div>
      )}

      {/* Stats Summary */}
      {tags.length > 0 && (
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">{tags.length}</div>
              <div className="text-gray-600">Total Tags</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-700">
                {tags.reduce((acc, tag) => acc + (tag.contacts_count || 0), 0)}
              </div>
              <div className="text-gray-600">Total Tagged Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700">
                {Math.round(tags.reduce((acc, tag) => acc + (tag.contacts_count || 0), 0) / tags.length) || 0}
              </div>
              <div className="text-gray-600">Avg Contacts per Tag</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagsPage;