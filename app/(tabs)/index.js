import { Picker } from '@react-native-picker/picker';
import { Box, ChevronLeft, ChevronRight, FileText, KeyRound, Paintbrush, Palette, Plus, Ruler, Tag, Wrench, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from './AppStyles';

// Re-integrating AppStyles and colors directly into this file
const { width } = Dimensions.get('window');
const IS_DESKTOP = width >= 768; // Define your breakpoint for responsive behavior

// REMOVE lines 32-540 (shadows and AppStyles definition)

// Use a single default icon since it's no longer stored per property
const DEFAULT_PROPERTY_ICON = 'Tag'; // You can change this to any icon key from IconMap

const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush };

const App = () => {
    const [currentScreen, setCurrentScreen] = useState('objects');
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    // New state for showing the Add Template modal
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false); // <--- NEW STATE
    const [currentPath, setCurrentPath] = useState([]);
    const [objectsHierarchy, setObjectsHierarchy] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    // New state for fetched templates
    const [fetchedTemplates, setFetchedTemplates] = useState({}); // Changed to an object for direct lookup by name

    // IMPORTANT: Replace with your actual API base URL.
    // Ensure your device running the app can reach this IP address.
    // For local development, this usually means your computer's local IP.
    const API_BASE_URL = 'https://ef79-84-243-252-3.ngrok-free.app/Maeconomy/app/(tabs)/api.php';

    // Helper to find an item by path (e.g., [1, 101] finds item with id 101 inside item with id 1)
    const findItemByPath = (data, path) => {
        let currentItems = data;
        let foundItem = null;

        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];

            if (!Array.isArray(currentItems)) {
                console.error("findItemByPath: currentItems is not an array at iteration", i, "path segment:", idToFind, "Value:", currentItems);
                return null;
            }

            const item = currentItems.find(item => item.id === idToFind);

            if (!item) {
                foundItem = null;
                break;
            }

            foundItem = item;
            currentItems = Array.isArray(item.children) ? item.children : [];
        }
        return foundItem;
    };

    // Function to fetch the entire hierarchy from the root and update state
    const fetchAndSetAllObjects = async (isRefreshing = false) => {
        console.log('Fetching all objects hierarchy...');
        if (isRefreshing) {
            setRefreshing(true);
        }

        try {
            // 1. Fetch all top-level objects (parent_id IS NULL)
            const topLevelResponse = await fetch(`${API_BASE_URL}?entity=objects`);
            if (!topLevelResponse.ok) {
                throw new Error(`HTTP error! status: ${topLevelResponse.status} for top-level objects`);
            }
            const topLevelObjects = await topLevelResponse.json();

            // 2. For each top-level object, recursively fetch its full hierarchy
            const hydrationPromises = topLevelObjects.map(async (obj) => {
                try {
                    const fullObjectResponse = await fetch(`${API_BASE_URL}?entity=objects&id=${obj.id}`);
                    if (!fullObjectResponse.ok) {
                        console.warn(`Failed to fetch full hierarchy for object ID ${obj.id}. Skipping. Status: ${fullObjectResponse.status}`);
                        return null; // Return null for this object if fetching fails
                    }
                    return await fullObjectResponse.json();
                } catch (innerError) {
                    console.error(`Error fetching full hierarchy for object ID ${obj.id}:`, innerError);
                    return null; // Return null if any error occurs during fetch
                }
            });

            const fullyHydratedObjects = (await Promise.all(hydrationPromises)).filter(Boolean);

            setObjectsHierarchy(fullyHydratedObjects.filter(Boolean)); // Ensure only valid objects are set

        } catch (error) {
            console.error('Failed to fetch and set all objects (overall error):', error);
            Alert.alert(
                'Error',
                'Failed to load data. Please check your network connection and ensure the PHP API is running correctly and accessible.'
            );
        } finally {
            if (isRefreshing) {
                setRefreshing(false);
            }
        }
    };

    // Function to fetch templates from the API
    const fetchTemplates = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}?entity=templates`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for templates`);
            }
            const templatesData = await response.json();
            // Format templates into an object where keys are template names
            const formattedTemplates = {};
            // Use Promise.all to fetch all template properties concurrently
            await Promise.all(templatesData.map(async (template) => {
                try {
                    const propertiesResponse = await fetch(`${API_BASE_URL}?entity=templates&id=${template.id}`);
                    if (!propertiesResponse.ok) {
                        console.warn(`Failed to fetch properties for template ID ${template.id}. Skipping.`);
                        return; // Skip this template if properties cannot be fetched
                    }
                    const templateWithProperties = await propertiesResponse.json();
                    if (templateWithProperties && templateWithProperties.properties) {
                        // Zet property_name om naar name
                        formattedTemplates[template.name] = templateWithProperties.properties.map(prop => ({
                            ...prop,
                            name: prop.property_name // Voeg een 'name' veld toe voor frontend gebruik
                        }));
                    }
                } catch (innerError) {
                    console.error(`Error fetching properties for template ID ${template.id}:`, innerError);
                }
            }));
            setFetchedTemplates(formattedTemplates);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            Alert.alert(
                'Error',
                'Failed to load templates. Please check your network connection and API.'
            );
        }
    };


    // Handle pull-to-refresh
    const onRefresh = () => {
        fetchAndSetAllObjects(true);
        fetchTemplates(); // Also refresh templates on pull-to-refresh
    };

    // Initial fetch for top-level objects and templates when component mounts
    useEffect(() => {
        fetchAndSetAllObjects();
        fetchTemplates(); // Fetch templates on initial mount
    }, []); // Empty dependency array means this runs once on component mount

    const handleAddObject = async (parentPath, newObject) => {
        try {
            const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;

            const response = await fetch(`${API_BASE_URL}?entity=objects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newObject.name, // Use 'name' as expected by PHP API's POST endpoint
                    parent_id: parentId,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                Alert.alert('Success', result.message);
                // After adding, re-fetch the entire hierarchy to ensure UI updates
                await fetchAndSetAllObjects();
            } else {
                Alert.alert('Error', result.message || 'Failed to add object.');
            }
        } catch (error) {
            console.error('Error adding object:', error);
            Alert.alert('Error', 'An unexpected error occurred while adding the object.');
        } finally {
            setShowAddObjectModal(false);
        }
    };

    // Update the PropertyButton component
    const PropertyButton = ({ onClick }) => (
        <TouchableOpacity onPress={onClick} style={AppStyles.btnPropertyChevron}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={AppStyles.btnPropertyChevronText}>Eigenschappen</Text>
                <ChevronRight color={colors.lightGray400} size={16} />
            </View>
        </TouchableOpacity>
    );

    const HierarchicalObjectsScreen = ({ items, currentLevelPath }) => {
        const isRootLevel = currentLevelPath.length === 0;

        // --- Breadcrumb Logic Start ---
        const getBreadcrumbs = () => {
            let breadcrumbs = [{ id: 'root', name: 'Objecten', path: [] }]; // Always start with "Objecten"
            let currentItems = objectsHierarchy;

            currentLevelPath.forEach((id, index) => {
                const item = currentItems.find(obj => obj.id === id);
                if (item) {
                    breadcrumbs.push({
                        id: item.id,
                        name: item.naam,
                        path: currentLevelPath.slice(0, index + 1)
                    });
                    currentItems = item.children || [];
                }
            });
            return breadcrumbs;
        };

        const breadcrumbs = getBreadcrumbs();
        // --- Breadcrumb Logic End ---

        return (
            <View style={AppStyles.screen}>
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        {/* No back button here as per user request */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 1 }}>
                            {breadcrumbs.map((crumb, index) => (
                                <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* Don't show chevron for the first breadcrumb or if it's the only one */}
                                    {index > 0 && (
                                        <ChevronRight color={colors.lightGray700} size={16} style={{ marginHorizontal: 4 }} />
                                    )}
                                    <TouchableOpacity
                                        // Only make the crumb clickable if it's not the current active one
                                        onPress={() => {
                                            if (index !== breadcrumbs.length - 1) {
                                                setCurrentPath(crumb.path);
                                                setCurrentScreen('objects');
                                                setSelectedProperty(null);
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            AppStyles.headerTitleSmall, // Applying the new smaller, left-aligned style
                                            // Always use lightGray900 for color, make bold only for the active crumb
                                            { color: colors.lightGray900 },
                                            index === breadcrumbs.length - 1 && { fontWeight: 'bold' }
                                        ]}>
                                            {crumb.name}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                        {/* Placeholder is also removed as there is no back button to balance */}
                    </View>
                </View>
                <ScrollView
                    style={AppStyles.contentPadding}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.blue600]} // Android
                            tintColor={colors.blue600} // iOS
                            title="Vernieuwen..." // iOS
                            titleColor={colors.lightGray600} // iOS
                        />
                    }
                >
                    <View style={AppStyles.cardList}>
                        {items.length > 0 ? (
                            items.map((item) => (
                                <TouchableOpacity
                                    key={item.id} // Key is essential for React list rendering
                                    style={AppStyles.card}
                                    onPress={() => {
                                        setSelectedProperty(null);
                                        setCurrentPath(currentLevelPath.concat(item.id));
                                        setCurrentScreen('objects');
                                    }}
                                >
                                    <View style={AppStyles.cardFlex}>
                                        <View style={AppStyles.cardContent}>
                                            <Text style={AppStyles.cardTitle}>{item.naam}</Text>
                                            <Text style={AppStyles.cardSubtitle}>
                                                {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
                                                {/* children.length is now accurate as the hierarchy is fully loaded */}
                                                {(item.children || []).length > 0 ? ` - ${(item.children || []).length} sub-item(s)` : ''}
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

    // Update the property item rendering in PropertiesScreen
    const PropertiesScreen = ({ currentPath }) => {
        const item = findItemByPath(objectsHierarchy, currentPath);
        if (!item) return null;

        // Always render the default icon
        const renderIcon = (customColor = colors.lightGray500) => {
            const Icon = IconMap[DEFAULT_PROPERTY_ICON] || Tag;
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
                    <Text style={AppStyles.detailName}>{item.naam}</Text>
                    <Text style={AppStyles.detailSubtitle}>
                        {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
                    </Text>
                </View>
                <ScrollView
                    style={AppStyles.contentPadding}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.blue600]} // Android
                            tintColor={colors.blue600} // iOS
                            title="Vernieuwen..." // iOS
                            titleColor={colors.lightGray600} // iOS
                        />
                    }
                >
                    <View style={AppStyles.propertyList}>
                        {(item.properties && item.properties.length > 0) ? (
                            item.properties.map((prop, index) => (
                                <View key={index} style={AppStyles.propertyItem}>
                                    <View style={AppStyles.propertyItemMain}>
                                        {renderIcon()}
                                        <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                    </View>
                                    <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
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
        const [selectedTemplate, setSelectedTemplate] = useState(null); // New state for selected template

        // Effect to ensure there's always at least one empty field for input
        useEffect(() => {
            // Only add an empty field if newPropertiesList.length is 0 AND no template is selected
            if (newPropertiesList.length === 0 && selectedTemplate === null) {
                addNewPropertyField();
            }
        }, [newPropertiesList, selectedTemplate]); // Add selectedTemplate to dependencies

        // Always render the default icon
        const renderIcon = (customColor = colors.lightGray500) => {
            const Icon = IconMap[DEFAULT_PROPERTY_ICON] || Tag;
            return <Icon color={customColor} size={20} />;
        };

        const addNewPropertyField = () => {
            setNewPropertiesList(prevList => {
                const newField = { id: nextNewPropertyId, name: '', value: '' };
                setNextNewPropertyId(prevId => prevId + 1);
                return [...prevList, newField];
            });
        };

        const removePropertyField = (idToRemove) => {
            setNewPropertiesList(prevList => prevList.filter(prop => prop.id !== idToRemove));
        };

        const handlePropertyFieldChange = (idToUpdate, field, value) => {
            setNewPropertiesList(prevList => {
                const updatedList = prevList.map(prop =>
                    prop.id === idToUpdate ? { ...prop, [field]: value } : prop
                );
                return updatedList;
            });
        };

        // Function to handle saving unsaved properties on back navigation
        const handleSaveOnBack = async () => {
            const validPropertiesToSave = [];
            newPropertiesList.forEach(prop => {
                if (prop.name.trim() !== '' && prop.value.trim() !== '') {
                    validPropertiesToSave.push({ name: prop.name.trim(), waarde: prop.value.trim() });
                }
            });

            if (validPropertiesToSave.length > 0) {
                try {
                    for (const prop of validPropertiesToSave) {
                        const response = await fetch(`${API_BASE_URL}?entity=properties`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                object_id: item.id,
                                name: prop.name,
                                waarde: prop.waarde,
                            }),
                        });

                        const result = await response.json();
                        if (!response.ok) {
                            console.error('Failed to add property:', result.message);
                            // Optionally, break here or collect failed ones
                        }
                    }
                    Alert.alert('Success', 'Eigenschappen succesvol toegevoegd!');
                    // After adding, re-fetch the entire hierarchy to ensure UI updates
                    await fetchAndSetAllObjects();
                } catch (error) {
                    console.error('Error adding properties:', error);
                    Alert.alert('Error', 'Er is een onverwachte fout opgetreden bij het toevoegen van eigenschappen.');
                }
            } else {
                // If no valid properties to save, just navigate back
                console.log("No valid properties to save.");
            }

            // Reset state and navigate back regardless of save success
            setNewPropertiesList([]);
            setNextNewPropertyId(0);
            setSelectedTemplate(null); // Reset selected template
            setCurrentScreen('properties');
        };

        return (
            <View style={[AppStyles.screen, { backgroundColor: colors.white }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }} // KAV now handles the entire screen content area below the status bar
                >
                    {/* Header is part of the content KeyboardAvoidingView manages */}
                    <View style={AppStyles.header}>
                        <View style={AppStyles.headerFlex}>
                            <TouchableOpacity
                                onPress={handleSaveOnBack}
                                style={AppStyles.headerBackButton}
                            >
                                <ChevronLeft color={colors.lightGray700} size={24} />
                            </TouchableOpacity>
                            <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                            <View style={AppStyles.headerPlaceholder} />
                        </View>
                    </View>

                    {/* Main content directly inside KeyboardAvoidingView, wrapped in a ScrollView for scrollability and padding */}
                    <ScrollView
                        style={{ flex: 1 }} // Allow ScrollView to take remaining vertical space
                        contentContainerStyle={AppStyles.contentPadding} // Apply padding here
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Existing Properties Card */}
                        <View style={[AppStyles.card, { marginTop: 0, marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
                                Bestaande Eigenschappen
                            </Text>
                            <View style={AppStyles.propertyList}>
                                {(item.properties || []).length > 0 ? (
                                    (item.properties || []).map((prop, index) => (
                                        <View key={index} style={AppStyles.propertyItem}>
                                            <View style={AppStyles.propertyItemMain}>
                                                {renderIcon()}
                                                <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                            </View>
                                            <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={AppStyles.emptyState}>
                                        <Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* New Properties Card */}
                        <View style={[AppStyles.card, { marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
                                Nieuwe Eigenschappen Toevoegen
                            </Text>

                            {/* Template Selector */}
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                                <View style={[
    AppStyles.pickerContainer,
    Platform.OS === 'android' && {
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.lightGray300,
        borderRadius: 8,
        minHeight: 48,
        justifyContent: 'center',
    }
]}>
                                    <Picker
                                        selectedValue={selectedTemplate}
                                        onValueChange={(itemValue) => {
                                            setSelectedTemplate(itemValue);
                                            if (itemValue && fetchedTemplates[itemValue]) { // Use fetchedTemplates
                                                // When a template is selected, populate newPropertiesList
                                                const templateProps = fetchedTemplates[itemValue].map((prop, index) => ({
                                                    id: nextNewPropertyId + index, // Ensure unique IDs
                                                    name: prop.name,
                                                    value: ''
                                                }));
                                                setNewPropertiesList(templateProps);
                                                // Ensure nextNewPropertyId is incremented by the number of template items
                                                setNextNewPropertyId(prevId => prevId + templateProps.length);
                                            } else {
                                                // Clear if "Geen sjabloon" or no template selected
                                                setNewPropertiesList([]);
                                                setNextNewPropertyId(0); // Reset ID counter
                                                addNewPropertyField(); // Add an empty field if no template selected
                                            }
                                        }}
                                        style={[
            AppStyles.formInput,
            { backgroundColor: 'transparent' }, // <-- Force transparent background
            Platform.OS === 'android' && { color: colors.lightGray700 }
        ]}
                                        itemStyle={Platform.OS === 'ios' ? AppStyles.pickerItem : null}
                                        dropdownIconColor={colors.lightGray600} // Optional: for Android
                                    >
                                        <Picker.Item label="Geen sjabloon" value={null} />
                                        {Object.keys(fetchedTemplates).map((templateName) => (
                                            <Picker.Item key={templateName} label={templateName} value={templateName} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            {/* Button to Add New Template --- NEW BUTTON HERE --- */}
                            <TouchableOpacity
                                onPress={() => setShowAddTemplateModal(true)} // Open the new modal
                                style={[
                                    AppStyles.btnSecondary, // Re-using a secondary button style
                                    { marginBottom: 1.5 * 16, alignSelf: 'center' }
                                ]}
                            >
                                <Text style={AppStyles.btnSecondaryText}>+ Nieuw sjabloon toevoegen</Text>
                            </TouchableOpacity>

                            {newPropertiesList.map(prop => (
                                <View key={prop.id} style={{ marginBottom: 1 * 16, borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 8, padding: 1 * 16 }}>
                                    <View style={AppStyles.formRow}>
                                        <View style={[AppStyles.formGroupHalf, { marginRight: 8 }]}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
                                                placeholderTextColor={colors.lightGray400}
                                                returnKeyType="next"
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
                                                returnKeyType="done"
                                                onSubmitEditing={addNewPropertyField}
                                            />
                                        </View>
                                        {/* Show remove button only if there's more than one field OR if the current field has content */}
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

                            {/* Save Button */}
                            <TouchableOpacity
                                onPress={handleSaveOnBack}
                                style={[
                                    AppStyles.btnPrimary,
                                    AppStyles.btnFull,
                                    AppStyles.btnFlexCenter,
                                    { marginTop: 0.5 * 16 }
                                ]}
                            >
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

                    {/* Add Property FAB */}
                    <TouchableOpacity
                        onPress={addNewPropertyField}
                        style={AppStyles.fab}
                    >
                        <Plus color="white" size={24} />
                    </TouchableOpacity>
                </KeyboardAvoidingView>
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
                transparent={true}
                visible={showAddObjectModal}
                onRequestClose={() => setShowAddObjectModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={AppStyles.modalBackdrop}
                >
                    <View style={[AppStyles.modalContent, { backgroundColor: 'white' }]}>
                        <Text style={AppStyles.modalTitle}>Item Toevoegen</Text>
                        <View style={AppStyles.formGroup}>
                            <Text style={AppStyles.formLabel}>Naam</Text>
                            <TextInput
                                placeholder="Bijvoorbeeld: Nieuwe Kamer"
                                value={name}
                                onChangeText={setName}
                                style={AppStyles.formInput}
                                placeholderTextColor={colors.lightGray400}
                                returnKeyType="done"
                            />
                        </View>
                        <View style={AppStyles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setShowAddObjectModal(false)}
                                style={AppStyles.btnSecondary}
                            >
                                <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveObject}
                                style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}
                            >
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };

    // Voeg deze component toe in je index.js of waar je AddTemplateModal gebruikt
    const AddTemplateModal = () => {
        const [templateName, setTemplateName] = useState('');
        const [templateProperties, setTemplateProperties] = useState([{ name: '', value: '' }]);
        const [error, setError] = useState('');

        const handlePropertyChange = (idx, field, value) => {
            const updated = [...templateProperties];
            updated[idx][field] = value;
            setTemplateProperties(updated);
        };

        const handleRemoveProperty = (idx) => {
            if (templateProperties.length === 1) return;
            setTemplateProperties(templateProperties.filter((_, i) => i !== idx));
        };

        const handleAddProperty = () => {
            setTemplateProperties([...templateProperties, { name: '', value: '' }]);
        };

        const handleSave = async () => {
            setError('');
            if (!templateName.trim()) {
                setError('Geef het sjabloon een naam.');
                return;
            }
            const validProps = templateProperties.filter(
                (p) => p.name.trim() // Alleen naam is verplicht, waarde mag leeg zijn
            );
            if (validProps.length === 0) {
                setError('Voeg minimaal één eigenschap toe.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}?entity=templates`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: templateName.trim(),
                        properties: validProps.map(p => ({ property_name: p.name.trim() })), // <-- DIT IS DE JUISTE MAPPING
                    }),
                });

                const result = await response.json();

                if (response.ok) {
                    // Optioneel: herlaad templates in je app
                    fetchTemplates && fetchTemplates();
                    setShowAddTemplateModal(false);
                } else {
                    setError(result.message || 'Opslaan mislukt.');
                }
            } catch (error) {
                setError('Netwerkfout bij opslaan.');
            }
        };

        return (
            <Modal
                transparent={true}
                visible={showAddTemplateModal}
                onRequestClose={() => setShowAddTemplateModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={AppStyles.modalBackdrop}
                >
                    <View style={[
    AppStyles.modalContent,
    {
        backgroundColor: 'white',
        maxWidth: IS_DESKTOP ? '70%' : '90%', // <-- maak breder op desktop
        width: IS_DESKTOP ? 700 : '90%',      // <-- optioneel: vaste px breedte op desktop
    }
]}>
                        <Text style={AppStyles.modalTitle}>Nieuw Sjabloon Toevoegen</Text>

                        <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.6 }}>
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Sjabloonnaam</Text>
                                <TextInput
                                    placeholder="Bijv. Standaard woning"
                                    value={templateName}
                                    onChangeText={setTemplateName}
                                    style={AppStyles.formInput}
                                    placeholderTextColor={colors.lightGray400}
                                    returnKeyType="next"
                                />
                            </View>

                            <Text style={[AppStyles.formLabel, { marginTop: 1 * 16, marginBottom: 0.5 * 16 }]}>Sjablooneigenschappen</Text>
                            {templateProperties.map((prop, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TextInput
                                        style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]}
                                        placeholder="Naam"
                                        value={prop.name}
                                        onChangeText={(text) => handlePropertyChange(idx, 'name', text)}
                                    />
                                    <TextInput
                                        style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]}
                                        placeholder="Waarde"
                                        value={prop.value}
                                        onChangeText={(text) => handlePropertyChange(idx, 'value', text)}
                                    />
                                    {templateProperties.length > 1 && (
                                        <TouchableOpacity onPress={() => handleRemoveProperty(idx)}>
                                            <Text style={{ color: colors.red500, fontSize: 18 }}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            {/* --- HIER DE KNOP TOEVOEGEN --- */}
                            <TouchableOpacity
                                onPress={handleAddProperty}
                                style={[AppStyles.btnSecondary, { alignSelf: 'flex-start', marginBottom: 12 }]}
                            >
                                <Text style={AppStyles.btnSecondaryText}>+ Eigenschap toevoegen</Text>
                            </TouchableOpacity>

                            {error ? (
                                <Text style={{ color: colors.red500, marginBottom: 8, textAlign: 'center' }}>{error}</Text>
                            ) : null}
                            <View style={AppStyles.modalActions}>
                                <TouchableOpacity
                                    style={[AppStyles.btnSecondary, AppStyles.btnPrimaryModal]}
                                    onPress={() => setShowAddTemplateModal(false)}
                                >
                                    <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}
                                    onPress={handleSave}
                                >
                                    <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };


    // currentLevelItems now directly references the nested children from the fully loaded objectsHierarchy
    const currentLevelItems = currentPath.length === 0 ? objectsHierarchy : findItemByPath(objectsHierarchy, currentPath)?.children || [];

    return (
        <>
            {/* Set status bar style for iOS */}
            <StatusBar
                barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
                backgroundColor="white" // Set your desired background color
            />
            <View style={AppStyles.appContainer}>
                {(() => {
                    switch (currentScreen) {
                        case 'objects':
                            return (
                                <HierarchicalObjectsScreen
                                    key={objectsHierarchy.length} // Force remount when top-level hierarchy size changes
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
                                    key={objectsHierarchy.length}
                                    items={currentLevelItems}
                                    currentLevelPath={currentPath}
                                />
                            );
                    }
                })()}
                {showAddObjectModal && <AddObjectModal />}
                {/* Render the new AddTemplateModal */}
                {showAddTemplateModal && <AddTemplateModal />} {/* <--- NEW MODAL RENDER */}
            </View>
        </>
    );
};

export default App;
