import { useState } from 'react';
import { Plus, X, Home, ArrowLeft } from 'lucide-react';

const PropertyApp = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [properties, setProperties] = useState([]);

  const [newProperty, setNewProperty] = useState({
    name: '',
    location: '',
    eigenschappen: []
  });

  const [currentEigenschap, setCurrentEigenschap] = useState({
    naam: '',
    waarde: ''
  });

  const addEigenschap = () => {
    if (currentEigenschap.naam.trim() && currentEigenschap.waarde.trim()) {
      setNewProperty(prev => ({
        ...prev,
        eigenschappen: [...prev.eigenschappen, { ...currentEigenschap, id: Date.now() }]
      }));
      setCurrentEigenschap({ naam: '', waarde: '' });
    }
  };

  const removeEigenschap = (id) => {
    setNewProperty(prev => ({
      ...prev,
      eigenschappen: prev.eigenschappen.filter(e => e.id !== id)
    }));
  };

  const saveProperty = () => {
    if (newProperty.name.trim() && newProperty.location.trim()) {
      setProperties(prev => [...prev, {
        ...newProperty,
        id: Date.now()
      }]);
      resetForm();
      setCurrentPage('home');
    }
  };

  const resetForm = () => {
    setNewProperty({ name: '', location: '', eigenschappen: [] });
    setCurrentEigenschap({ naam: '', waarde: '' });
  };
  
  if (currentPage === 'add') {
    return (
      <div className="min-h-screen bg-black text-white max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pt-12">
          <button 
            onClick={() => {
              setCurrentPage('home');
              resetForm();
            }}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} color="white" />
          </button>
          <h1 className="text-lg font-semibold">Eigenschap Toevoegen</h1>
          <div className="w-8"></div>
        </div>

        <div className="p-4 space-y-6">
          {/* Property Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Naam</label>
              <input
                type="text"
                value={newProperty.name}
                onChange={(e) => setNewProperty(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-gray-800 rounded-lg p-3 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="Bijv. Kerkstraat 45"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Locatie</label>
              <input
                type="text"
                value={newProperty.location}
                onChange={(e) => setNewProperty(prev => ({ ...prev, location: e.target.value }))}
                className="w-full bg-gray-800 rounded-lg p-3 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="Bijv. Amsterdam • 1017 GC"
              />
            </div>
          </div>

          {/* Add New Eigenschap */}
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Home size={16} className="text-green-500" />
              <span className="text-sm">Nieuwe Eigenschap</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
              <span>EIGENSCHAP</span>
              <span>WAARDE</span>
              <span></span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4">
              <input
                type="text"
                value={currentEigenschap.naam}
                onChange={(e) => setCurrentEigenschap(prev => ({ ...prev, naam: e.target.value }))}
                className="bg-gray-800 rounded p-2 text-white text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="Eigenschap"
              />
              <input
                type="text"
                value={currentEigenschap.waarde}
                onChange={(e) => setCurrentEigenschap(prev => ({ ...prev, waarde: e.target.value }))}
                className="bg-gray-800 rounded p-2 text-white text-sm border border-gray-700 focus:border-blue-500 focus:outline-none"
                placeholder="Waarde"
              />
              <button
                onClick={addEigenschap}
                className="bg-blue-600 hover:bg-blue-700 rounded p-2 flex items-center justify-center transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Existing Eigenschappen */}
          {newProperty.eigenschappen.length > 0 && (
            <div>
              <h3 className="text-white mb-4">Aangepaste Eigenschappen</h3>
              
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
                <span>EIGENSCHAP</span>
                <span>WAARDE</span>
                <span></span>
              </div>
              
              <div className="space-y-2">
                {newProperty.eigenschappen.map((eigenschap) => (
                  <div key={eigenschap.id} className="grid grid-cols-3 gap-2 items-center">
                    <span className="text-white text-sm">{eigenschap.naam}</span>
                    <span className="text-white text-sm">{eigenschap.waarde}</span>
                    <button
                      onClick={() => removeEigenschap(eigenschap.id)}
                      className="bg-red-600 hover:bg-red-700 rounded p-2 flex items-center justify-center transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={saveProperty}
            className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg p-4 font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!newProperty.name.trim() || !newProperty.location.trim()}
          >
            <Home size={18} />
            Eigenschap Opslaan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center p-4 pt-12">
        <Home size={24} className="mr-3 text-orange-500" />
        <h1 className="text-2xl font-bold">Huizen</h1>
      </div>

      {/* Properties List */}
      <div className="p-4 space-y-3">
        {properties.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <Home size={48} className="mx-auto mb-4 opacity-50" />
            <p>Geen huizen toegevoegd</p>
            <p className="text-sm mt-1">Klik op de + knop om te beginnen</p>
          </div>
        ) : (
          properties.map((property) => (
            <div key={property.id} className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors cursor-pointer">
              <h3 className="text-white font-semibold text-lg">{property.name}</h3>
              <p className="text-gray-400 text-sm">{property.location}</p>
              {property.eigenschappen.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {property.eigenschappen.length} eigenschap{property.eigenschappen.length !== 1 ? 'pen' : ''}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Button */}
      <div className="fixed bottom-8 right-6">
        <button
          onClick={() => setCurrentPage('add')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-105"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
};

export default PropertyApp;