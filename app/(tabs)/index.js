import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  // Add Alert for better error messages
  Alert 
} from 'react-native';
// You NEED to install this: npm install @react-native-picker/picker
import { Picker } from '@react-native-picker/picker'; 
// You NEED to install this: npm install lucide-react-native
import { Plus, ChevronLeft, Home, Settings, Paintbrush, Ruler, Wrench, Tag, Box, KeyRound, FileText, Palette, Sparkles } from 'lucide-react-native';

// Import your new styles
import AppStyles, { colors, IS_DESKTOP } from './AppStyles';

// Map icon names to Lucide components
const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush, Sparkles };

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('objects');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAddObjectModal, setShowAddObjectModal] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [isLargeScreen, setIsLargeScreen] = useState(Dimensions.get('window').width >= 768);

  useEffect(() => {
    const updateLayout = () => {
      setIsLargeScreen(Dimensions.get('window').width >= 768);
    };
    const dimensionListener = Dimensions.addEventListener('change', updateLayout);
    return () => {
      dimensionListener.remove(); // Correctly remove the event listener
    };
  }, []);

  const [properties, setProperties] = useState([
    { id: 1, name: 'Kerkstraat 45', location: 'Amsterdam • 1017 GC', status: 'Verhuurd' },
    { id: 2, name: 'Prinsengracht 123', location: 'Amsterdam • 1015 DZ', status: 'Leegstaand' },
    { id: 3, name: 'Vondelpark 78', location: 'Amsterdam • 1071 AA', status: 'Verhuurd' }
  ]);

  const [propertyDetails, setPropertyDetails] = useState({
    1: {
      name: 'Kerkstraat 45',
      location: 'Amsterdam • 1017 GC',
      details: { 'Woz': 'Bruto', 'Grootte': '30 m2', 'Materiaal': 'Hout' },
      properties: [
        { name: 'Object', value: 'Test', icon: 'Box' },
        { name: 'Grootte', value: '20x20cm', icon: 'Ruler' },
        { name: 'Kleur', value: 'Groen', icon: 'Palette' },
        { name: 'Materiaal', value: 'Hout', icon: 'Wrench' }
      ]
    },
    2: {
      name: 'Prinsengracht 123',
      location: 'Amsterdam • 1015 DZ',
      details: { 'Woz': 'Netto', 'Grootte': '120 m2', 'Materiaal': 'Steen' },
      properties: []
    },
    3: {
      name: 'Vondelpark 78',
      location: 'Amsterdam • 1071 AA',
      details: { 'Woz': 'Bruto', 'Grootte': '85 m2', 'Materiaal': 'Beton' },
      properties: []
    }
  });

  // --- GEMINI API FUNCTION ---
  const generatePropertyDescription = async (property) => {
    setIsGenerating(true);
    setGeneratedDescription('');

    let prompt = `Genereer een korte, aantrekkelijke verkoopbeschrijving voor het volgende pand in het Nederlands:\n\nNaam: ${property.name}\nLocatie: ${property.location}\nDetails:\n${Object.entries(property.details).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nOverige eigenschappen:\n${property.properties.map(p => `- ${p.name}: ${p.value}`).join('\n')}\n\nHoud de beschrijving professioneel, beknopt en focus op de belangrijkste verkoopargumenten.`;

    try {
      const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
      // YOUR GEMINI API KEY HERE. DO NOT HARDCODE IN PRODUCTION APPS.
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API request failed with status ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      setGeneratedDescription(text || "Kon geen beschrijving genereren. Probeer het opnieuw.");

    } catch (error) {
      console.error("Error generating description:", error);
      Alert.alert("Fout", "Fout bij het genereren van de beschrijving. Controleer de console voor details.");
      setGeneratedDescription("Fout bij het genereren van de beschrijving.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- UTILITY FUNCTIONS ---
  const handleAddProperty = (propertyId, newProperty) => {
    setPropertyDetails(prev => ({
      ...prev,
      [propertyId]: {
        ...prev[propertyId],
        properties: [...prev[propertyId].properties, newProperty]
      }
    }));
    setCurrentScreen('properties'); // Go back to properties list after adding
  };

  const handleAddObject = (newObject) => {
    const newId = (properties.length > 0 ? Math.max(...properties.map(p => p.id)) : 0) + 1;
    setProperties(prev => [...prev, { id: newId, ...newObject }]);
    setPropertyDetails(prev => ({
      ...prev,
      [newId]: {
        name: newObject.name,
        location: newObject.location,
        details: { 'Woz': '-', 'Grootte': '-', 'Materiaal': '-' },
        properties: []
      }
    }));
    setShowAddObjectModal(false);
    if (isLargeScreen) {
      setSelectedProperty(newId);
      setCurrentScreen('propertyDetail');
    }
  };

  const PropertyButton = ({ onClick }) => (
    <TouchableOpacity onPress={onClick} style={AppStyles.btnPrimary}>
      <Text style={AppStyles.btnPrimaryText}>Eigenschappen</Text>
    </TouchableOpacity>
  );

  // --- SCREENS ---
  const ObjectsScreen = () => (
    <View style={[AppStyles.screen, isLargeScreen && AppStyles.objectsScreenDesktop]}>
      <View style={AppStyles.header}>
        <View style={AppStyles.headerFlex}>
          <Text style={AppStyles.headerTitle}>Objecten</Text>
          <View style={AppStyles.headerPlaceholder} />
        </View>
      </View>
      <ScrollView style={AppStyles.contentPadding}>
        <View style={AppStyles.cardList}>
          {properties.map((property) => (
            <TouchableOpacity
              key={property.id}
              style={[AppStyles.card, selectedProperty === property.id && isLargeScreen && AppStyles.selectedCard]}
              onPress={() => { setSelectedProperty(property.id); setGeneratedDescription(''); setCurrentScreen('propertyDetail'); }}
            >
              <View style={AppStyles.cardFlex}>
                <View style={AppStyles.cardContent}>
                  <Text style={AppStyles.cardTitle}>{property.name}</Text>
                  <Text style={AppStyles.cardSubtitle}>{property.location}</Text>
                </View>
                {!isLargeScreen && ( // Only show button on small screens
                  <PropertyButton onClick={() => { setSelectedProperty(property.id); setCurrentScreen('properties'); }} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {/* FAB for mobile */}
      {!isLargeScreen && (
        <TouchableOpacity onPress={() => setShowAddObjectModal(true)} style={AppStyles.fab}>
          <Plus color="white" size={24} />
        </TouchableOpacity>
      )}
      {/* FAB for desktop (as per image, if it's there) */}
      {isLargeScreen && (
        <TouchableOpacity onPress={() => setShowAddObjectModal(true)} style={[AppStyles.fab, { position: 'relative', margin: 16, alignSelf: 'flex-end', bottom: 0, right: 0 }]}>
            <Plus color="white" size={24} />
        </TouchableOpacity>
      )}
    </View>
  );

  const PropertyDetailScreen = () => {
    const property = selectedProperty ? propertyDetails[selectedProperty] : null;
    if (!property) {
      if (isLargeScreen) {
        return (
          <View style={[AppStyles.screen, AppStyles.mainContentPanel, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={AppStyles.emptyStateText}>Selecteer een object om details te bekijken</Text>
          </View>
        );
      }
      return null;
    }

    return (
      <View style={[AppStyles.screenWhite, { flex: 1 }]}>
        <View style={AppStyles.header}>
          <View style={AppStyles.headerFlex}>
            {!isLargeScreen && (
              <TouchableOpacity onPress={() => setCurrentScreen('objects')} style={AppStyles.headerBackButton}>
                <ChevronLeft color={colors.lightGray700} size={24} />
              </TouchableOpacity>
            )}
            <Text style={AppStyles.headerTitleLg}>Object Details</Text>
            <View style={AppStyles.headerPlaceholder} />
          </View>
          <View style={AppStyles.detailHeader}>
            <Text style={AppStyles.detailName}>{property.name}</Text>
            <Text style={AppStyles.detailLocation}>{property.location}</Text>
          </View>
        </View>
        <ScrollView style={[AppStyles.contentPadding, AppStyles.screenContentWrapper]}>
          <View style={AppStyles.infoBox}>
            <Text style={[AppStyles.infoItemValue, { marginBottom: 0.75 * 16 }]}>Basisgegevens</Text>
            <View style={AppStyles.infoGrid}>
              {Object.entries(property.details).map(([key, value]) => (
                <View key={key} style={AppStyles.infoGridItem}>
                  <Text style={AppStyles.infoItemLabel}>{key}</Text>
                  <Text style={AppStyles.infoItemValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={AppStyles.aiSection}>
            <TouchableOpacity onPress={() => generatePropertyDescription(property)} disabled={isGenerating} style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnPurple, AppStyles.btnFlexCenter, isGenerating && AppStyles.btnPurpleDisabled]}>
              <Sparkles color="white" size={20} />
              <Text style={AppStyles.btnPrimaryText}>{isGenerating ? 'Beschrijving genereren...' : '✨ Genereer Beschrijving'}</Text>
            </TouchableOpacity>
          </View>
          {(isGenerating || generatedDescription) && (
            <View style={AppStyles.aiDescriptionBox}>
              <Text style={[AppStyles.infoItemValue, { marginBottom: 0.5 * 16 }]}>AI-gegenereerde Beschrijving</Text>
              {isGenerating ? (
                <View style={AppStyles.spinnerContainer}>
                  <ActivityIndicator size="small" color={colors.purple600} />
                </View>
              ) : (
                // Use a View to wrap Text if you need 'pre-wrap' like behavior
                <Text style={AppStyles.infoItemLabel}>{generatedDescription}</Text>
              )}
            </View>
          )}
          <View style={{ marginTop: 1.5 * 16 }}>
            <TouchableOpacity onPress={() => setCurrentScreen('properties')} style={[AppStyles.btnPrimary, AppStyles.btnFull]}>
              <Text style={AppStyles.btnPrimaryText}>Bekijk Eigenschappen</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const PropertiesScreen = () => {
    const property = selectedProperty ? propertyDetails[selectedProperty] : null;
    if (!property) return null;
    const renderIcon = (iconName) => { const Icon = IconMap[iconName] || Box; return <Icon color={colors.lightGray500} size={20} />; };
    return (
      <View style={[AppStyles.screen, { flex: 1 }]}>
        <View style={AppStyles.header}>
          <View style={AppStyles.headerFlex}>
            {!isLargeScreen && <TouchableOpacity onPress={() => setCurrentScreen('propertyDetail')} style={AppStyles.headerBackButton}><ChevronLeft color={colors.lightGray700} size={24} /></TouchableOpacity>}
            <Text style={AppStyles.headerTitleLg}>Eigenschappen</Text>
            <View style={AppStyles.headerPlaceholder} />
          </View>
        </View>
        <View style={{ backgroundColor: colors.white, padding: 1 * 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
          <Text style={AppStyles.detailName}>{property.name}</Text>
          <Text style={AppStyles.detailLocation}>{property.location}</Text>
        </View>
        <ScrollView style={AppStyles.contentPadding}>
          <View style={AppStyles.propertyList}>
            {property.properties.length > 0 ? (
              property.properties.map((prop, index) => (
                <View key={index} style={AppStyles.propertyItem}>
                  <View style={AppStyles.propertyItemMain}>{renderIcon(prop.icon)}<Text style={AppStyles.propertyName}>{prop.name}</Text></View>
                  <Text style={AppStyles.propertyValue}>{prop.value}</Text>
                </View>
              ))
            ) : (
              <View style={AppStyles.emptyState}>
                <Text style={AppStyles.emptyStateText}>Nog geen eigenschappen toegevoegd.</Text>
                <Text style={AppStyles.emptyStateSubtext}>Klik op de '+' knop om te beginnen.</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={() => setCurrentScreen('addProperty')} style={AppStyles.fab}>
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>
    );
  };

  const AddPropertyScreen = () => {
    const property = selectedProperty ? propertyDetails[selectedProperty] : null;
    if (!property) return null;

    const [newProperty, setNewProperty] = useState({
      name: '',
      value: '',
      icon: 'Tag'
    });

    const handleSave = () => {
      if (newProperty.name.trim() && newProperty.value.trim()) {
        handleAddProperty(selectedProperty, {
          name: newProperty.name,
          value: newProperty.value,
          icon: newProperty.icon
        });
      } else {
        Alert.alert("Invoer vereist", "Vul alstublieft zowel de eigenschap naam als de waarde in.");
      }
    };

    const renderIcon = (iconName) => {
      const Icon = IconMap[iconName] || Box;
      return <Icon color={newProperty.icon === iconName ? colors.blue600 : colors.lightGray600} size={24} />;
    };

    return (
      <View style={[AppStyles.screenWhite, { flex: 1 }]}>
        {/* Header */}
        <View style={AppStyles.header}>
          <View style={AppStyles.headerFlex}>
            {!isLargeScreen && (
              <TouchableOpacity
                onPress={() => setCurrentScreen('properties')}
                style={AppStyles.headerBackButton}
              >
                <ChevronLeft color={colors.lightGray700} size={24} />
              </TouchableOpacity>
            )}
            <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
            <View style={AppStyles.headerPlaceholder} />
          </View>
        </View>

        {/* Property Info Section (as in image) */}
        <View style={{ backgroundColor: colors.white, padding: 1 * 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
          <Text style={[AppStyles.detailName, { fontSize: 1.125 * 16, marginBottom: 0.5 * 16 }]}>{property.name}</Text>
          {/* Replicating the three lines of detail from image */}
          <View style={[AppStyles.propertyList, { gap: 0.75 * 16 }]}>
            <View style={AppStyles.propertyDetailRow}>
              <Text style={AppStyles.propertyDetailLabel}>WOZ</Text>
              <Text style={AppStyles.propertyDetailValue}>{property.details['Woz']}</Text>
            </View>
            <View style={AppStyles.propertyDetailRow}>
              <Text style={AppStyles.propertyDetailLabel}>GROOTTE</Text>
              <Text style={AppStyles.propertyDetailValue}>{property.details['Grootte']}</Text>
            </View>
            <View style={[AppStyles.propertyDetailRow, { borderBottomWidth: 0 }]}>
              <Text style={AppStyles.propertyDetailLabel}>MATERIAAL</Text>
              <Text style={AppStyles.propertyDetailValue}>{property.details['Materiaal']}</Text>
            </View>
          </View>
        </View>

        {/* Custom Properties Section */}
        <ScrollView style={[AppStyles.contentPadding, AppStyles.screenContentWrapper]}>
          <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16 }]}>Aangepaste Eigenschappen</Text>

          <View style={[AppStyles.propertyList, { gap: 0.75 * 16, marginBottom: 1.5 * 16 }]}>
            {property.properties.map((prop, index) => (
              <View key={index} style={[AppStyles.card, { padding: 0.75 * 16 }]}>
                <View style={[AppStyles.infoGrid, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={AppStyles.infoItemLabel}>EIGENSCHAP</Text>
                    <Text style={AppStyles.infoItemValue}>{prop.name}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={AppStyles.infoItemLabel}>WAARDE</Text>
                    <Text style={AppStyles.infoItemValue}>{prop.value}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* New Property Form */}
          <View style={[AppStyles.card, { marginBottom: 1.5 * 16 }]}>
            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16 }]}>Nieuwe Eigenschap</Text>

            <View style={[AppStyles.formGroup, { marginBottom: 1 * 16 }]}>
              <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
              <TextInput
                placeholder="Bijv. Gewicht"
                value={newProperty.name}
                onChangeText={(text) => setNewProperty({...newProperty, name: text})}
                style={AppStyles.formInput}
                placeholderTextColor={colors.lightGray400} // Set placeholder color
              />
            </View>

            <View style={AppStyles.formGroup}>
              <Text style={AppStyles.formLabel}>Waarde</Text>
              <TextInput
                placeholder="Bijv. 2kg"
                value={newProperty.value}
                onChangeText={(text) => setNewProperty({...newProperty, value: text})}
                style={AppStyles.formInput}
                placeholderTextColor={colors.lightGray400} // Set placeholder color
              />
            </View>
          </View>

          {/* Icon Selection */}
          <View style={AppStyles.card}>
            <Text style={[AppStyles.formLabel, { marginBottom: 0.75 * 16 }]}>Kies een icoon</Text>
            <View style={AppStyles.iconGrid}>
              {Object.keys(IconMap).map(iconKey => {
                const Icon = IconMap[iconKey];
                return (
                  <TouchableOpacity
                    key={iconKey}
                    onPress={() => setNewProperty({...newProperty, icon: iconKey})}
                    style={[AppStyles.iconWrapper, newProperty.icon === iconKey ? AppStyles.iconWrapperSelected : AppStyles.iconWrapperNotSelected]}
                  >
                    <Icon color={newProperty.icon === iconKey ? colors.blue600 : colors.lightGray600} size={24} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!newProperty.name.trim() || !newProperty.value.trim()}
            style={[AppStyles.btnPrimary, AppStyles.btnFull, { marginTop: 1.5 * 16 }, (!newProperty.name.trim() || !newProperty.value.trim()) && AppStyles.btnPurpleDisabled]}
          >
            <Text style={AppStyles.btnPrimaryText}>Eigenschap Opslaan</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const AddObjectModal = () => {
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [status, setStatus] = useState('Verhuurd');
    const handleSaveObject = () => { if (name.trim() && location.trim()) { handleAddObject({ name, location, status }); } else { Alert.alert("Invoer vereist", "Vul alstublieft zowel de naam als de locatie in."); } };
    return (
      <Modal
        animationType="fade" // Use fade for a smoother modal appearance
        transparent={true}
        visible={showAddObjectModal}
        onRequestClose={() => setShowAddObjectModal(false)}
      >
        <View style={AppStyles.modalBackdrop}>
          <View style={AppStyles.modalContent}>
            <Text style={AppStyles.modalTitle}>Object Toevoegen</Text>
            <View style={AppStyles.formGroup}>
              <Text style={AppStyles.formLabel}>Naam</Text>
              <TextInput
                placeholder="Bijvoorbeeld: Kerkstraat 45"
                value={name}
                onChangeText={setName}
                style={AppStyles.formInput}
                placeholderTextColor={colors.lightGray400}
              />
            </View>
            <View style={AppStyles.formGroup}>
              <Text style={AppStyles.formLabel}>Locatie</Text>
              <TextInput
                placeholder="Bijvoorbeeld: Amsterdam • 1017 GC"
                value={location}
                onChangeText={setLocation}
                style={AppStyles.formInput}
                placeholderTextColor={colors.lightGray400}
              />
            </View>
            <View style={AppStyles.formGroup}>
              <Text style={AppStyles.formLabel}>Status</Text>
              <View style={AppStyles.formSelect}>
                <Picker
                  selectedValue={status}
                  onValueChange={(itemValue) => setStatus(itemValue)}
                  // The 'style' prop on Picker usually applies to the inner view.
                  // For Android, you might need to wrap it in a View and style the View.
                  itemStyle={{ color: colors.lightGray900 }} // This styles the text of the picker items on iOS. Android is different.
                >
                  <Picker.Item label="Verhuurd" value="Verhuurd" />
                  <Picker.Item label="Leegstaand" value="Leegstaand" />
                  <Picker.Item label="In onderhoud" value="In onderhoud" />
                </Picker>
              </View>
            </View>
            <View style={AppStyles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddObjectModal(false)} style={AppStyles.btnSecondary}>
                <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveObject} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}>
                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={AppStyles.appContainer}>
      {isLargeScreen ? (
        <View style={AppStyles.twoPanelLayout}>
          <ObjectsScreen />
          <View style={AppStyles.mainContentPanel}>
            {selectedProperty ? (
                currentScreen === 'propertyDetail' ? <PropertyDetailScreen /> :
                currentScreen === 'properties' ? <PropertiesScreen /> :
                currentScreen === 'addProperty' ? <AddPropertyScreen /> :
                <PropertyDetailScreen /> // Default to detail if a property is selected
            ) : (
                <PropertyDetailScreen /> // Show empty state if no property is selected
            )}
          </View>
        </View>
      ) : (
        // Mobile rendering: only one screen at a time
        (() => {
          switch (currentScreen) {
            case 'objects': return <ObjectsScreen />;
            case 'propertyDetail': return <PropertyDetailScreen />;
            case 'properties': return <PropertiesScreen />;
            case 'addProperty': return <AddPropertyScreen />;
            default: return <ObjectsScreen />;
          }
        })()
      )}
      {showAddObjectModal && <AddObjectModal />}
    </View>
  );
};

export default App;