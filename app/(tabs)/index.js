import { Box, ChevronLeft, ChevronRight, FileText, KeyRound, Paintbrush, Palette, Plus, Ruler, Tag, Wrench, X } from 'lucide-react-native';
import { useEffect, useState } from 'react'; // useRef is still imported but not used for debounce
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import AppStyles, { colors } from './AppStyles';

const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush };

// Helper to find an item by path (e.g., [1, 101] finds item with id 101 inside item with id 1)
const findItemByPath = (data, path) => {
  let currentItems = data;
  let foundItem = null;

  for (let i = 0; i < path.length; i++) {
    const idToFind = path[i];
    const item = currentItems.find(item => item.id === idToFind);

    if (!item) {
      foundItem = null;
      break;
    }

    foundItem = item;
    currentItems = item.children || [];
  }
  return foundItem;
};

// Helper to update an item by path (e.g., add a child, or update properties)
const updateItemByPath = (data, path, updateFn) => {
  if (path.length === 0) {
    // This case is for updating the root level if path is empty.
    // For properties, path will always have at least one element.
    const updatedData = updateFn(data);
    return updatedData;
  }

  const newData = [...data]; // Create a shallow copy of the top-level array
  let currentLevel = newData;

  for (let i = 0; i < path.length; i++) {
    const idToFind = path[i];
    const itemIndex = currentLevel.findIndex(item => item.id === idToFind);

    if (itemIndex === -1) {
      // Item not found, return original data or handle error
      console.error(`Item with ID ${idToFind} not found at path segment ${i}`);
      return data;
    }

    // If it's the last item in the path, apply the update function
    if (i === path.length - 1) {
      currentLevel[itemIndex] = {
        ...currentLevel[itemIndex],
        ...updateFn(currentLevel[itemIndex])
      };
    } else {
      // Not the target item, so create a new object for the parent
      // and recurse into its children to maintain immutability
      currentLevel[itemIndex] = {
        ...currentLevel[itemIndex],
        children: [...(currentLevel[itemIndex].children || [])] // Ensure children array is also copied
      };
      currentLevel = currentLevel[itemIndex].children;
    }
  }
  return newData;
};

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('objects');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAddObjectModal, setShowAddObjectModal] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);

  const [objectsHierarchy, setObjectsHierarchy] = useState([
    {
      id: 1,
      name: 'Kerkstraat 45',
      location: 'Amsterdam • 1017 GC',
      status: 'Verhuurd',
      type: 'object',
      details: { 'Woz': 'Bruto', 'Grootte': '30 m2', 'Materiaal': 'Hout' },
      properties: [
        { name: 'Object', value: 'Test', icon: 'Box' },
        { name: 'Grootte', value: '20x20cm', icon: 'Ruler' },
        { name: 'Kleur', value: 'Groen', icon: 'Palette' }, // Fixed duplicate value
        { name: 'Materiaal', value: 'Hout', icon: 'Wrench' }
      ],
      children: [
        {
          id: 101,
          name: 'Verdieping 1',
          location: '1e etage',
          status: 'Verhuurd',
          type: 'floor',
          details: { 'Woz': 'N.v.t.', 'Grootte': '15 m2', 'Materiaal': 'Beton' },
          properties: [],
          children: [
            { id: 1011, name: 'Kamer 1', location: 'Links voor', status: 'Leegstaand', type: 'room', details: { 'Woz': 'N.v.t.', 'Grootte': '8 m2', 'Materiaal': 'Hout' }, properties: [], children: [] },
            { id: 1012, name: 'Kamer 2', location: 'Rechts achter', status: 'Verhuurd', type: 'room', details: { 'Woz': 'N.v.t.', 'Grootte': '7 m2', 'Materiaal': 'Hout' }, properties: [], children: [] }
          ]
        },
        { id: 102, name: 'Verdieping 2', location: '2e etage', status: 'Leegstaand', type: 'floor', details: { 'Woz': 'N.v.t.', 'Grootte': '15 m2', 'Materiaal': 'Beton' }, properties: [], children: [] },
        { id: 103, name: 'Zolder', location: 'Bovenste etage', status: 'In onderhoud', type: 'attic', details: { 'Woz': 'N.v.t.', 'Grootte': '10 m2', 'Materiaal': 'Hout' }, properties: [], children: [] }
      ]
    },
    {
      id: 2,
      name: 'Prinsengracht 123',
      location: 'Amsterdam • 1015 DZ',
      status: 'Leegstaand',
      type: 'object',
      details: { 'Woz': 'Netto', 'Grootte': '120 m2', 'Materiaal': 'Steen' },
      properties: [],
      children: []
    },
    {
      id: 3,
      name: 'Vondelpark 78',
      location: 'Amsterdam • 1071 AA',
      status: 'Verhuurd',
      type: 'object',
      details: { 'Woz': 'Bruto', 'Grootte': '85 m2', 'Materiaal': 'Beton' },
      properties: [],
      children: []
    }
  ]);

  // Function for adding a single property, used for auto-save (though now only on back)
  const addSinglePropertyToItem = (targetPath, newProperty) => {
    setObjectsHierarchy(prev => updateItemByPath(prev, targetPath, (item) => ({
      ...item,
      properties: [...(item.properties || []), newProperty]
    })));
  };

  const handleAddObject = (parentPath, newObject) => {
    setObjectsHierarchy(prev => updateItemByPath(prev, parentPath, (parentItem) => {
      const currentChildren = parentItem ? (parentItem.children || []) : prev;
      const newId = (currentChildren.length > 0 ? Math.max(...currentChildren.map(p => p.id)) : 0) + 1;
      const newItem = {
        id: newId,
        name: newObject.name,
        location: '',
        status: 'Niet gespecificeerd',
        type: 'item',
        details: {},
        properties: [],
        children: []
      };
      if (parentItem) {
        return { ...parentItem, children: [...(parentItem.children || []), newItem] };
      } else {
        return [...prev, newItem];
      }
    }));
    setShowAddObjectModal(false);
  };

  const PropertyButton = ({ onClick }) => (
    <TouchableOpacity onPress={onClick} style={AppStyles.btnPropertyChevron}>
      <Text style={AppStyles.btnPropertyChevronText}>Eigenschappen</Text>
      <ChevronRight color={colors.lightGray400} size={16} />
    </TouchableOpacity>
  );

  const HierarchicalObjectsScreen = ({ items, currentLevelPath }) => {
    const isRootLevel = currentLevelPath.length === 0;
    const headerTitle = isRootLevel ? 'Objecten' : findItemByPath(objectsHierarchy, currentLevelPath)?.name || 'Items';

    return (
      <View style={AppStyles.screen}>
        <View style={AppStyles.header}>
          <View style={AppStyles.headerFlex}>
            {!isRootLevel && (
              <TouchableOpacity onPress={() => {
                setCurrentPath(currentLevelPath.slice(0, -1));
                setCurrentScreen('objects');
                setSelectedProperty(null);
              }} style={AppStyles.headerBackButton}>
                <ChevronLeft color={colors.lightGray700} size={24} />
              </TouchableOpacity>
            )}
            <Text style={AppStyles.headerTitle}>{headerTitle}</Text>
            <View style={AppStyles.headerPlaceholder} />
          </View>
        </View>
        <ScrollView style={AppStyles.contentPadding}>
          <View style={AppStyles.cardList}>
            {items.length > 0 ? (
              items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={AppStyles.card}
                  onPress={() => {
                    setSelectedProperty(null);
                    setCurrentPath(currentLevelPath.concat(item.id));
                    setCurrentScreen('objects');
                  }}
                >
                  <View style={AppStyles.cardFlex}>
                    <View style={AppStyles.cardContent}>
                      <Text style={AppStyles.cardTitle}>{item.name}</Text>
                      <Text style={AppStyles.cardSubtitle}>
                        {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
                      </Text>
                    </View>
                    <PropertyButton onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProperty(item.id);
                      setCurrentScreen('properties');
                    }} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={AppStyles.emptyState}>
                <Text style={AppStyles.emptyStateText}>Geen items gevonden.</Text>
                <Text style={AppStyles.emptyStateSubtext}>
                  Klik op de '+' knop om een nieuw item toe te voegen aan deze {isRootLevel ? 'lijst' : 'locatie'}.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        <TouchableOpacity onPress={() => setShowAddObjectModal(true)} style={AppStyles.fab}>
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>
    );
  };

  const PropertiesScreen = ({ currentPath }) => {
    const item = findItemByPath(objectsHierarchy, currentPath);
    if (!item) return null;

    const renderIcon = (iconName, customColor = colors.lightGray500) => {
      const Icon = IconMap[iconName] || Box;
      return <Icon color={customColor} size={20} />;
    };

    return (
      <View style={[AppStyles.screen, { flex: 1 }]}>
        <View style={AppStyles.header}>
          <View style={AppStyles.headerFlex}>
            <TouchableOpacity onPress={() => setCurrentScreen('objects')} style={AppStyles.headerBackButton}>
              <ChevronLeft color={colors.lightGray700} size={24} />
            </TouchableOpacity>
            <Text style={AppStyles.headerTitleLg}>Eigenschappen</Text>
            <View style={AppStyles.headerPlaceholder} />
          </View>
        </View>
        <View style={{ backgroundColor: colors.white, padding: 1 * 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
          <Text style={AppStyles.detailName}>{item.name}</Text>
          <Text style={AppStyles.detailSubtitle}>
            {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
          </Text>
        </View>
        <ScrollView style={AppStyles.contentPadding}>
          <View style={AppStyles.propertyList}>
            {(item.properties && item.properties.length > 0) ? (
              item.properties.map((prop, index) => (
                <View key={index} style={AppStyles.propertyItem}>
                  <View style={AppStyles.propertyItemMain}>
                    {renderIcon(prop.icon)}
                    <Text style={AppStyles.propertyName}>{prop.name}</Text>
                  </View>
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

  const AddPropertyScreen = ({ currentPath }) => {
    const item = findItemByPath(objectsHierarchy, currentPath);
    if (!item) return null;

    const [newPropertiesList, setNewPropertiesList] = useState([]);
    const [nextNewPropertyId, setNextNewPropertyId] = useState(0);

    // Effect to ensure there's always at least one empty field for input
    useEffect(() => {
      if (newPropertiesList.length === 0) {
        addNewPropertyField();
      }
    }, [newPropertiesList]);

    const renderIcon = (iconName, customColor = colors.lightGray500) => {
      const Icon = IconMap[iconName] || Box;
      return <Icon color={customColor} size={20} />;
    };

    const addNewPropertyField = () => {
      setNewPropertiesList(prevList => {
        // Only add a new field if the list is empty or the last field is not empty
        const lastProp = prevList[prevList.length - 1];
        if (prevList.length > 0 && lastProp.name.trim() === '' && lastProp.value.trim() === '') {
          return prevList; // An empty field already exists, don't add another
        }
        const newField = { id: nextNewPropertyId, name: '', value: '', icon: 'Tag' };
        setNextNewPropertyId(prevId => prevId + 1); // Increment ID for the next field
        return [...prevList, newField];
      });
    };

    const removePropertyField = (idToRemove) => {
      setNewPropertiesList(prevList => prevList.filter(prop => prop.id !== idToRemove));
    };

    const handlePropertyFieldChange = (idToUpdate, field, value) => {
      // This function now only updates the local state; no auto-save logic here.
      setNewPropertiesList(prevList => {
        const updatedList = prevList.map(prop =>
          prop.id === idToUpdate ? { ...prop, [field]: value } : prop
        );
        return updatedList;
      });
    };

    // Function to handle saving unsaved properties on back navigation
    const handleSaveOnBack = () => {
      const validPropertiesToSave = [];
      newPropertiesList.forEach(prop => {
        if (prop.name.trim() !== '' && prop.value.trim() !== '') {
          validPropertiesToSave.push({ name: prop.name.trim(), value: prop.value.trim(), icon: prop.icon });
        }
      });

      if (validPropertiesToSave.length > 0) {
        // Add all valid unsaved properties to the item
        setObjectsHierarchy(prev => updateItemByPath(prev, currentPath, (itemToUpdate) => ({
          ...itemToUpdate,
          properties: [...(itemToUpdate.properties || []), ...validPropertiesToSave]
        })));
      }

      // Clear the new properties list after saving/discarding
      setNewPropertiesList([]);
      setNextNewPropertyId(0);
      setCurrentScreen('properties'); // Navigate back to properties screen
    };

    return (
      <View style={[AppStyles.screenWhite, { flex: 1 }]}>
        <View style={AppStyles.header}>
          <View style={AppStyles.headerFlex}>
            <TouchableOpacity
              onPress={handleSaveOnBack} // Call the new save function on back
              style={AppStyles.headerBackButton}
            >
              <ChevronLeft color={colors.lightGray700} size={24} />
            </TouchableOpacity>
            <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
            <View style={AppStyles.headerPlaceholder} />
          </View>
        </View>

        <ScrollView style={[AppStyles.contentPadding, { flex: 1 }]}>
          <View style={[AppStyles.card, { marginTop: 0, marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
              Bestaande Eigenschappen
            </Text>
            <View style={AppStyles.propertyList}>
              {(item.properties || []).length > 0 ? (
                (item.properties || []).map((prop, index) => (
                  <View key={index} style={AppStyles.propertyItem}>
                    <View style={AppStyles.propertyItemMain}>
                      {renderIcon(prop.icon)}
                      <Text style={AppStyles.propertyName}>{prop.name}</Text>
                    </View>
                    <Text style={AppStyles.propertyValue}>{prop.value}</Text>
                  </View>
                ))
              ) : (
                <View style={AppStyles.emptyState}>
                  <Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[AppStyles.card, { marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
              Nieuwe Eigenschappen Toevoegen
            </Text>

            {newPropertiesList.map(prop => (
              <View key={prop.id} style={{ marginBottom: 1.5 * 16, borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 8, padding: 1 * 16 }}>
                <View style={AppStyles.formRow}>
                  <View style={[AppStyles.formGroupHalf, { marginRight: 8 }]}>
                    <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                    <TextInput
                      placeholder="Bijv. Gewicht"
                      value={prop.name}
                      onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                      style={AppStyles.formInput}
                      placeholderTextColor={colors.lightGray400}
                    />
                  </View>

                  <View style={[AppStyles.formGroupHalf, { marginLeft: 8 }]}>
                    <Text style={AppStyles.formLabel}>Waarde</Text>
                    <TextInput
                      placeholder="Bijv. 2kg"
                      value={prop.value}
                      onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)}
                      style={AppStyles.formInput}
                      placeholderTextColor={colors.lightGray400}
                    />
                  </View>
                  {/* Show remove button if there's more than one field, or if it's the only one and not empty */}
                  {newPropertiesList.length > 1 || (newPropertiesList.length === 1 && (prop.name.trim() !== '' || prop.value.trim() !== '')) ? (
                      <TouchableOpacity
                          onPress={() => removePropertyField(prop.id)}
                          style={{ padding: 4, alignSelf: 'flex-start', marginTop: 30, left: 5 }}
                      >
                          <X color={colors.red600} size={20} />
                      </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}

            <TouchableOpacity 
                onPress={addNewPropertyField} 
                style={[
                    AppStyles.btnPrimary, 
                    AppStyles.btnFull, 
                    AppStyles.btnSecondary, 
                    AppStyles.btnFlexCenter,
                    { marginTop: 1 * 16 }
                ]}
            >
                <Plus color={colors.blue600} size={20} />
                <Text style={[AppStyles.btnPrimaryText, { color: colors.blue600 }]}>Voeg Eigenschap Toe</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  const AddObjectModal = () => {
    const [name, setName] = useState('');

    const handleSaveObject = () => {
      if (name.trim()) {
        handleAddObject(currentPath, { name });
      } else {
        Alert.alert("Invoer vereist", "Vul alstublieft de naam in.");
      }
    };

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showAddObjectModal}
        onRequestClose={() => setShowAddObjectModal(false)}
      >
        <View style={AppStyles.modalBackdrop}>
          <View style={AppStyles.modalContent}>
            <Text style={AppStyles.modalTitle}>Item Toevoegen</Text>
            <View style={AppStyles.formGroup}>
              <Text style={AppStyles.formLabel}>Naam</Text>
              <TextInput
                placeholder="Bijvoorbeeld: Nieuwe Kamer"
                value={name}
                onChangeText={setName}
                style={AppStyles.formInput}
                placeholderTextColor={colors.lightGray400}
              />
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

  const currentLevelItems = findItemByPath(objectsHierarchy, currentPath)?.children || (currentPath.length === 0 ? objectsHierarchy : []);

  return (
    <View style={AppStyles.appContainer}>
      {(() => {
        switch (currentScreen) {
          case 'objects':
            return (
              <HierarchicalObjectsScreen
                items={currentLevelItems}
                currentLevelPath={currentPath}
              />
            );
          case 'properties':
            return <PropertiesScreen currentPath={currentPath.concat(selectedProperty)} />;
          case 'addProperty':
            return <AddPropertyScreen currentPath={currentPath.concat(selectedProperty)} />;
          default:
            return (
              <HierarchicalObjectsScreen
                items={currentLevelItems}
                currentLevelPath={currentPath}
              />
            );
        }
      })()}
      {showAddObjectModal && <AddObjectModal />}
    </View>
  );
};

export default App;
