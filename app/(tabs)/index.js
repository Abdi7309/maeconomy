import { Picker } from '@react-native-picker/picker';
import { Box, ChevronDown, ChevronLeft, ChevronRight, FileText, KeyRound, Paintbrush, Palette, Plus, Ruler, Tag, Wrench, X } from 'lucide-react-native'; // Re-added ChevronDown
import { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

// --- Import AppStyles, colors, and shadows from a separate file ---
import AppStyles, { colors } from './AppStyles'; // Correct import path assuming AppStyles.js is in the same directory

const { width } = Dimensions.get('window');
const IS_DESKTOP = width >= 768; // Define your breakpoint for responsive behavior

// Use a single default icon since it's no longer stored per property
const DEFAULT_PROPERTY_ICON = 'Tag'; // You can change this to any icon key from IconMap

const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush };

const App = () => {
    const [currentScreen, setCurrentScreen] = useState('objects');
    const [selectedProperty, setSelectedProperty] = useState(null); // This holds the ID of the object whose properties we are viewing/adding
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [objectsHierarchy, setObjectsHierarchy] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    // New state for fetched templates, structured for direct lookup by ID (as string)
    const [fetchedTemplates, setFetchedTemplates] = useState({});

    // IMPORTANT: Replace with your actual API base URL.
    // Ensure your device running the app can reach this IP address.
    // For local development, this usually means your computer's local IP.
    const API_BASE_URL = 'http://10.3.1.19/Maeconomy/app/(tabs)/api.php';

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
            // Use Promise.allSettled to allow some fetches to fail without stopping others
            const hydrationResults = await Promise.allSettled(topLevelObjects.map(async (obj) => {
                try {
                    const fullObjectResponse = await fetch(`${API_BASE_URL}?entity=objects&id=${obj.id}`);
                    if (!fullObjectResponse.ok) {
                        console.warn(`Failed to fetch full hierarchy for object ID ${obj.id}. Status: ${fullObjectResponse.status}`);
                        return null; // Return null for this object if fetching fails
                    }
                    const data = await fullObjectResponse.json();
                    // Ensure the 'properties' and 'children' keys exist, even if empty
                    return {
                        ...data,
                        properties: data.properties || [],
                        children: data.children || []
                    };
                } catch (innerError) {
                    console.error(`Error fetching full hierarchy for object ID ${obj.id}:`, innerError);
                    return null; // Return null if any error occurs during fetch
                }
            }));

            // Filter out rejected promises and null results
            const fullyHydratedObjects = hydrationResults
                .filter(result => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value);

            setObjectsHierarchy(fullyHydratedObjects);

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
            console.log('Fetching templates...');
            const response = await fetch(`${API_BASE_URL}?entity=templates`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for templates`);
            }
            const templatesData = await response.json();

            const formattedTemplates = {};
            await Promise.all(templatesData.map(async (template) => {
                try {
                    const propertiesResponse = await fetch(`${API_BASE_URL}?entity=templates&id=${template.id}`);
                    if (!propertiesResponse.ok) {
                        console.warn(`Failed to fetch properties for template ID ${template.id}. Skipping. Status: ${propertiesResponse.status}`);
                        return; // Skip this template if properties fetch fails
                    }
                    const templateWithProperties = await propertiesResponse.json();

                    formattedTemplates[String(template.id)] = {
                        name: template.name,
                        properties: (templateWithProperties.properties || []).map(prop => ({
                            ...prop,
                            name: prop.property_name, // Map to 'name' for consistency
                            value: prop.property_value || '' // Map to 'value', default to empty string
                        }))
                    };
                } catch (innerError) {
                    console.error(`Error fetching properties for template ID ${template.id}:`, innerError);
                }
            }));
            setFetchedTemplates(formattedTemplates);
            console.log('Fetched templates:', formattedTemplates);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            // Alert.alert('Error', 'Failed to load templates.'); // Not showing alert for templates to avoid excessive popups
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

    // Modified handleAddObject: Reverted to only adding the object, no template application here
    const handleAddObject = async (parentPath, newObjectData) => {
        const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;
        const { name } = newObjectData; // Only extract name, templateId is not passed from AddObjectModal anymore

        try {
            // Add the new object
            const objectResponse = await fetch(`${API_BASE_URL}?entity=objects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    parent_id: parentId,
                }),
            });

            const objectResult = await objectResponse.json();

            if (!objectResponse.ok) {
                Alert.alert('Error', objectResult.message || 'Failed to add object.');
                return;
            }

            Alert.alert('Success', objectResult.message);
            // After adding, re-fetch the entire hierarchy to ensure UI updates
            await fetchAndSetAllObjects();
        } catch (error) {
            console.error('Error adding object:', error);
            Alert.alert('Error', 'An unexpected error occurred while adding the item.');
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
                        name: item.naam, // Assuming 'naam' is the display name
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
                        {/* Breadcrumbs */}
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
                                        setSelectedProperty(null); // Clear selected property when navigating deeper
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
                                            e.stopPropagation(); // Prevent card's onPress from firing
                                            setSelectedProperty(item.id); // Set the specific object's ID for property screen
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
        // Find the specific object whose properties we need to display
        const item = findItemByPath(objectsHierarchy, currentPath);

        // --- Debugging for white screen ---
        useEffect(() => {
            console.log("PropertiesScreen mounted/updated:");
            console.log("  currentPath:", currentPath);
            console.log("  item found:", item ? item.naam : "Not Found");
            if (item && (!item.properties || item.properties.length === 0)) {
                console.log("  Item has no properties or properties array is empty.");
            }
        }, [item, currentPath]);
        // --- End Debugging ---

        if (!item) {
            // Render a loading or error state if item is not found
            return (
                <View style={[AppStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={AppStyles.emptyStateText}>Item niet gevonden of wordt geladen...</Text>
                </View>
            );
        }

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
        // The currentPath here is already the full path to the object (e.g., [1, 101])
        const objectIdForProperties = currentPath[currentPath.length - 1];
        // Find the actual item based on the full path
        const item = findItemByPath(objectsHierarchy, currentPath);

        if (!item) return null; // Should not happen if navigation is correct

        const [newPropertiesList, setNewPropertiesList] = useState([]);
        const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
        const [selectedTemplateForPropertyAdd, setSelectedTemplateForPropertyAdd] = useState(null); // New state for selected template in this screen

        // Helper to get template name for display
        const getTemplateName = (templateId) => {
            if (templateId === null) {
                return "Geen sjabloon";
            }
            return fetchedTemplates[templateId]?.name || "Onbekend sjabloon";
        };

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

        // Effect to ensure there's always at least one empty field for input
        useEffect(() => {
            // Only add an empty field if newPropertiesList.length === 0 AND no template is selected
            if (newPropertiesList.length === 0 && selectedTemplateForPropertyAdd === null) {
                addNewPropertyField();
            }
        }, [newPropertiesList, selectedTemplateForPropertyAdd]); // Add selectedTemplateForPropertyAdd to dependencies

        // Function to handle saving unsaved properties on back navigation
        const handleSaveOnBack = async () => {
            const validPropertiesToSave = [];
            newPropertiesList.forEach(prop => {
                if (prop.name.trim() !== '') { // Only name is required for saving
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
                                object_id: objectIdForProperties, // Use the ID of the object we are adding properties to
                                name: prop.name,
                                waarde: prop.waarde,
                            }),
                        });

                        const result = await response.json();
                        if (!response.ok) {
                            console.error('Failed to add property:', result.message);
                            Alert.alert('Error', `Failed to add property ${prop.name}: ${result.message}`);
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
                console.log("No valid properties to save.");
            }

            // Reset state and navigate back regardless of save success
            setNewPropertiesList([]);
            setNextNewPropertyId(0);
            setSelectedTemplateForPropertyAdd(null); // Reset selected template
            setCurrentScreen('properties'); // Navigate back to properties view
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

                            {/* Template Selector - iOS Fixed Version */}
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                                {Platform.OS === 'ios' ? (
                                    <>
                                        <Picker
                                            selectedValue={selectedTemplateForPropertyAdd}
                                            onValueChange={(itemValue) => {
                                                setSelectedTemplateForPropertyAdd(itemValue);
                                                if (itemValue && fetchedTemplates[itemValue]) {
                                                    const templateProps = fetchedTemplates[itemValue].properties.map((prop, index) => ({
                                                        id: index,
                                                        name: prop.name,
                                                        value: prop.value || ''
                                                    }));
                                                    setNewPropertiesList(templateProps);
                                                    setNextNewPropertyId(templateProps.length);
                                                } else {
                                                    setNewPropertiesList([]);
                                                    setNextNewPropertyId(0);
                                                    addNewPropertyField();
                                                }
                                            }}
                                            style={{
                                                height: 44,
                                                color: colors.lightGray900,
                                                backgroundColor: 'transparent',
                                            }}
                                            itemStyle={{
                                                height: 44,
                                                color: colors.lightGray900,
                                                fontSize: 16,
                                                textAlign: 'left',
                                            }}
                                        >
                                            <Picker.Item 
                                                label="Geen sjabloon" 
                                                value={null}
                                                color={colors.lightGray600}
                                            />
                                            {Object.entries(fetchedTemplates).map(([templateId, tpl]) => (
                                                <Picker.Item 
                                                    key={templateId} 
                                                    label={tpl.name} 
                                                    value={templateId}
                                                    color={colors.lightGray900}
                                                />
                                            ))}
                                        </Picker>
                                        {/* Add a chevron down icon for iOS to make it look more native */}
                                        <View style={{
                                            position: 'absolute',
                                            right: 12,
                                            top: '50%',
                                            transform: [{ translateY: -8 }],
                                            pointerEvents: 'none',
                                        }}>
                                            <ChevronDown color={colors.lightGray600} size={16} />
                                        </View>
                                    </>
                                ) : (
                                    <View style={[
                                        AppStyles.pickerContainer,
                                        {
                                            backgroundColor: colors.white,
                                            borderWidth: 1,
                                            borderColor: colors.lightGray300,
                                            borderRadius: 8,
                                            minHeight: 48,
                                            justifyContent: 'center',
                                        }
                                    ]}>
                                        <Picker
                                            selectedValue={selectedTemplateForPropertyAdd}
                                            onValueChange={(itemValue) => {
                                                setSelectedTemplateForPropertyAdd(itemValue);
                                                if (itemValue && fetchedTemplates[itemValue]) {
                                                    const templateProps = fetchedTemplates[itemValue].properties.map((prop, index) => ({
                                                        id: index,
                                                        name: prop.name,
                                                        value: prop.value || ''
                                                    }));
                                                    setNewPropertiesList(templateProps);
                                                    setNextNewPropertyId(templateProps.length);
                                                } else {
                                                    setNewPropertiesList([]);
                                                    setNextNewPropertyId(0);
                                                    addNewPropertyField();
                                                }
                                            }}
                                            style={{
                                                height: 48,
                                                color: colors.lightGray700,
                                                backgroundColor: 'transparent',
                                            }}
                                        >
                                            <Picker.Item 
                                                label="Geen sjabloon" 
                                                value={null}
                                                color={colors.lightGray700}
                                            />
                                            {Object.entries(fetchedTemplates).map(([templateId, tpl]) => (
                                                <Picker.Item 
                                                    key={templateId} 
                                                    label={tpl.name} 
                                                    value={templateId}
                                                    color={colors.lightGray700}
                                                />
                                            ))}
                                        </Picker>
                                    </View>
                                )}
                            </View>

                            {/* Button to Add New Template */}
                            <TouchableOpacity
                                onPress={() => setShowAddTemplateModal(true)} // Open the new modal
                                style={[
                                    AppStyles.btnSecondary,
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
                                onPress={handleSaveOnBack} // This button also triggers save
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
        // Removed selectedTemplateId state from here, as per your request
        // const [selectedTemplateId, setSelectedTemplateId] = useState(null); 

        const handleSaveObject = () => {
            if (name.trim()) {
                // Pass new object data without templateId
                handleAddObject(currentPath, { name }); // Removed templateId: selectedTemplateId
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

                        {/* Removed Template Selector from AddObjectModal as requested */}
                        {/* {Object.keys(fetchedTemplates).length > 0 && (
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Gebruik een Sjabloon (optioneel)</Text>
                                <View
                                    pointerEvents="box-none"
                                    style={[
                                        AppStyles.pickerContainer,
                                        Platform.OS === 'android' && {
                                            backgroundColor: colors.white,
                                            borderWidth: 1,
                                            borderColor: colors.lightGray300,
                                            borderRadius: 8,
                                            minHeight: 48,
                                            justifyContent: 'center',
                                        }
                                    ]}
                                >
                                    <Picker
                                        selectedValue={selectedTemplateId}
                                        onValueChange={(itemValue) => setSelectedTemplateId(itemValue)}
                                        style={[
                                            AppStyles.pickerStyle,
                                            Platform.OS === 'android' && { color: colors.lightGray700 }
                                        ]}
                                        itemStyle={Platform.OS === 'ios' ? AppStyles.pickerItem : null}
                                        dropdownIconColor={colors.lightGray600}
                                    >
                                        <Picker.Item label="Geen sjabloon" value={null} />
                                        {Object.entries(fetchedTemplates).map(([templateId, tpl]) => (
                                            <Picker.Item key={templateId} label={tpl.name} value={templateId} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        )} */}


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

    // AddTemplateModal component
    const AddTemplateModal = () => {
        const [templateName, setTemplateName] = useState('');
        // Initialize with one empty property field
        const [templateProperties, setTemplateProperties] = useState([{ name: '', value: '' }]);
        const [error, setError] = useState('');

        const handlePropertyChange = (idx, field, value) => {
            const updated = [...templateProperties];
            updated[idx][field] = value;
            setTemplateProperties(updated);
        };

        const handleRemoveProperty = (idx) => {
            // Ensure there's always at least one field, or if the only field is empty, allow removal.
            if (templateProperties.length === 1 && (templateProperties[0].name.trim() === '' && templateProperties[0].value.trim() === '')) {
                // If the last field is empty, just clear it rather than removing
                setTemplateProperties([{ name: '', value: '' }]);
                return;
            }
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
            // Filter out empty property names. Value can be empty.
            const validProps = templateProperties.filter(
                (p) => p.name.trim() !== ''
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
                        // Map property_name and property_value for the API
                        properties: validProps.map(p => ({
                            property_name: p.name.trim(),
                            property_value: p.value.trim() // Send value even if empty
                        })),
                    }),
                });

                const result = await response.json();

                if (response.ok) {
                    Alert.alert('Success', result.message || 'Sjabloon succesvol opgeslagen.');
                    fetchTemplates(); // Reload templates in the app's main state
                    setShowAddTemplateModal(false);
                    // Reset modal state
                    setTemplateName('');
                    setTemplateProperties([{ name: '', value: '' }]);
                    setError('');
                } else {
                    setError(result.message || 'Opslaan mislukt.');
                }
            } catch (error) {
                console.error('Network error during template save:', error);
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
                            width: IS_DESKTOP ? 700 : '90%',       // <-- optioneel: vaste px breedte op desktop
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
                                        placeholder="Waarde (optioneel)" // Make value optional
                                        value={prop.value}
                                        onChangeText={(text) => handlePropertyChange(idx, 'value', text)}
                                    />
                                    {/* Only show remove button if there's more than one property OR if the current one is not empty */}
                                    {(templateProperties.length > 1 || prop.name.trim() !== '' || prop.value.trim() !== '') && (
                                        <TouchableOpacity onPress={() => handleRemoveProperty(idx)} style={{ padding: 4 }}>
                                            <X color={colors.red500} size={20} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
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
    // This logic relies on `findItemByPath` returning the correct object, then accessing its children.
    const currentLevelItems = currentPath.length === 0
        ? objectsHierarchy
        : findItemByPath(objectsHierarchy, currentPath)?.children || [];


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
                            // Pass the full path to the selected object for the PropertiesScreen
                            return <PropertiesScreen currentPath={[...currentPath, selectedProperty]} />;
                        case 'addProperty':
                            // Pass the full path to the selected object for the AddPropertyScreen
                            return <AddPropertyScreen currentPath={[...currentPath, selectedProperty]} />;
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
                {/* Modals are rendered conditionally outside the main screen switch */}
                {showAddObjectModal && <AddObjectModal />}
                {showAddTemplateModal && <AddTemplateModal />}
            </View>
        </>
    );
};

export default App;
