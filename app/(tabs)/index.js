import { ArrowLeft, Home, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const PropertyApp = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [properties, setProperties] = useState([]);

  const [newProperty, setNewProperty] = useState({
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
    setProperties(prev => [...prev, {
      id: Date.now(),
      name: 'Kerkstraat 45',
      location: 'Amsterdam • 1017 GC',
      eigenschappen: newProperty.eigenschappen
    }]);
    resetForm();
    setCurrentPage('home');
  };

  const resetForm = () => {
    setNewProperty({ eigenschappen: [] });
    setCurrentEigenschap({ naam: '', waarde: '' });
  };
  
  if (currentPage === 'add') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              setCurrentPage('home');
              resetForm();
            }}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#2563EB" />
            <Text style={styles.backButtonText}>Terug</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { marginLeft: 40 }]}>Eigenschap Toevoegen</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Live Preview */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Voorbeeld Eigenschap</Text>
            <View style={styles.propertyCard}>
              <Text style={styles.propertyName}>Kerkstraat 45</Text>
              <Text style={styles.propertyLocation}>Amsterdam • 1017 GC</Text>
              <Text style={styles.propertyCount}>
                {`${newProperty.eigenschappen.length} eigenschap${newProperty.eigenschappen.length !== 1 ? 'pen' : ''}`}
              </Text>
            </View>
          </View>

          {/* Add New Eigenschap */}
          <View style={styles.eigenschapContainer}>
            <View style={styles.eigenschapHeader}>
              <Home size={16} color="#2563EB" />  {/* Changed from "green" to "#2563EB" */}
              <Text style={styles.eigenschapTitle}>Nieuwe Eigenschap</Text>
            </View>
            
            <View style={styles.eigenschapInputContainer}>
              <TextInput
                value={currentEigenschap.naam}
                onChangeText={(text) => setCurrentEigenschap(prev => ({ ...prev, naam: text }))}
                style={styles.eigenschapInput}
                placeholder="Eigenschap"
                placeholderTextColor="#6B7280"
              />
              <TextInput
                value={currentEigenschap.waarde}
                onChangeText={(text) => setCurrentEigenschap(prev => ({ ...prev, waarde: text }))}
                style={styles.eigenschapInput}
                placeholder="Waarde"
                placeholderTextColor="#6B7280"
              />
              <TouchableOpacity
                onPress={addEigenschap}
                style={styles.addEigenschapButton}
              >
                <Plus size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Existing Eigenschappen */}
          {newProperty.eigenschappen.length > 0 && (
            <View style={styles.existingEigenschappenContainer}>
              <Text style={styles.existingEigenschappenTitle}>Aangepaste Eigenschappen</Text>
              
              <View style={styles.existingEigenschappenList}>
                {newProperty.eigenschappen.map((eigenschap) => (
                  <View key={eigenschap.id} style={styles.eigenschapItem}>
                    <Text style={styles.eigenschapNaam}>{eigenschap.naam}</Text>
                    <Text style={styles.eigenschapWaarde}>{eigenschap.waarde}</Text>
                    <TouchableOpacity
                      onPress={() => removeEigenschap(eigenschap.id)}
                      style={styles.removeEigenschapButton}
                    >
                      <X size={12} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={saveProperty}
            style={styles.saveButton}
          >
            <Home size={18} color="white" />
            <Text style={styles.saveButtonText}>Eigenschap Opslaan</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Home size={24} color="#2563EB" />
        <Text style={styles.mainTitle}>Huizen</Text>
      </View>

      {/* Properties List */}
      <ScrollView style={styles.content}>
        {properties.length === 0 ? (
          <View style={styles.emptyState}>
            <Home size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>Geen huizen toegevoegd</Text>
            <Text style={styles.emptyStateSubText}>Klik op de + knop om te beginnen</Text>
          </View>
        ) : (
          properties.map((property) => (
            <TouchableOpacity 
              key={property.id} 
              style={styles.propertyCard}
            >
              <Text style={styles.propertyName}>{property.name}</Text>
              <Text style={styles.propertyLocation}>{property.location}</Text>
              {property.eigenschappen.length > 0 && (
                <Text style={styles.propertyCount}>
                  {`${property.eigenschappen.length} eigenschap${property.eigenschappen.length !== 1 ? 'pen' : ''}`}
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setCurrentPage('add')}
      >
        <Plus size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',  // Changed from 'black' to 'white'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    position: 'relative',
  },
  headerTitle: {
    color: 'black',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: -1,
  },
  mainTitle: {
    color: 'black',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  content: {
    padding: 16,
  },
  inputGroup: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#374151',  // Changed from '#9CA3AF' to darker color
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',  // Changed from '#1F2937' to light gray
    borderRadius: 8,
    padding: 12,
    color: '#111827',  // Changed from 'white' to dark color
    borderWidth: 1,
    borderColor: '#E5E7EB',  // Changed to lighter border color
  },
  eigenschapContainer: {
    backgroundColor: '#F3F4F6',  // Changed from '#111827' to light gray
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  eigenschapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eigenschapTitle: {
    color: '#111827',  // Changed from 'white' to dark color
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  eigenschapInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  eigenschapInput: {
    flex: 1,
    backgroundColor: 'white',  // Changed from '#1F2937' to white
    borderRadius: 8,
    padding: 12,
    color: '#111827',  // Changed from 'white' to dark color
    borderWidth: 1,
    borderColor: '#E5E7EB',  // Changed to lighter border color
  },
  addEigenschapButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  existingEigenschappenContainer: {
    marginTop: 16,
  },
  existingEigenschappenTitle: {
    color: '#111827',  // Changed from 'white' to dark color
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  existingEigenschappenList: {
    backgroundColor: '#F3F4F6',  // Changed from '#111827' to light gray
    borderRadius: 8,
    padding: 16,
  },
  eigenschapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',  // Changed to lighter border color
  },
  eigenschapNaam: {
    color: '#111827',  // Changed from 'white' to dark color
    fontSize: 14,
  },
  eigenschapWaarde: {
    color: '#6B7280',  // Changed from '#9CA3AF' to slightly darker
    fontSize: 14,
  },
  propertyCard: {
    backgroundColor: '#F3F4F6',  // Changed from '#111827' to light gray
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  propertyName: {
    color: '#111827',  // Changed from 'white' to dark color
    fontSize: 18,
    fontWeight: '600',
  },
  propertyLocation: {
    color: '#6B7280',  // Changed from '#9CA3AF' to slightly darker
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#2563EB',  // Changed from '#16A34A' to '#2563EB'
    borderRadius: 8,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyStateText: {
    color: '#9CA3AF',
    marginTop: 16,
  },
  emptyStateSubText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: '#2563EB',
    borderRadius: 28,
    padding: 16,
    elevation: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
    gap: 4,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PropertyApp;