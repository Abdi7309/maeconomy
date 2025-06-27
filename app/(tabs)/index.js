import { Picker } from '@react-native-picker/picker';
import { Box, ChevronLeft, ChevronRight, FileText, KeyRound, Paintbrush, Palette, Plus, Ruler, Tag, Wrench, X, LogOut, User, Lock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import AppStyles, { colors } from './AppStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';


// Re-integrating AppStyles and colors directly into this file
const { width } = Dimensions.get('window');
const IS_DESKTOP = width >= 768; // Define your breakpoint for responsive behavior

// Use a single default icon since it's no longer stored per property
const DEFAULT_PROPERTY_ICON = 'Tag'; // You can change this to any icon key from IconMap

const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush };

const App = () => {
    const [userToken, setUserToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authScreen, setAuthScreen] = useState('login'); // 'login' or 'register'
    const [authError, setAuthError] = useState(''); // New state for auth error text

    const [currentScreen, setCurrentScreen] = useState('objects');
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [objectsHierarchy, setObjectsHierarchy] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [fetchedTemplates, setFetchedTemplates] = useState({});


    const API_BASE_URL = 'https://ce13-84-243-252-3.ngrok-free.app/Maeconomy/app/(tabs)/api.php';

    // --- Authentication Functions ---
    useEffect(() => {
        // Check for a stored token on app startup
        const bootstrapAsync = async () => {
            let token;
            try {
                token = await AsyncStorage.getItem('userToken');
            } catch (e) {
                console.error("Restoring token failed", e);
            }
            setUserToken(token);
            setIsLoading(false);
        };

        bootstrapAsync();
    }, []);

    const handleLogin = async (username, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}?entity=users&action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                const token = JSON.stringify(result.user); // Store user object as token
                await AsyncStorage.setItem('userToken', token);
                setAuthError(''); // Clear any previous errors
                setUserToken(token);
            } else {
                // Set the error message to be displayed as text
                setAuthError(result.message || 'An error occurred.');
            }
        } catch (error) {
            console.error('Login error:', error);
            setAuthError('An unexpected network error occurred.');
        }
    };

    const handleRegister = async (username, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}?entity=users&action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (response.ok && result.success) {
                // On success, clear errors and switch to login screen without a popup
                setAuthError('');
                setAuthScreen('login');
            } else {
                // Set the error message to be displayed as text
                setAuthError(result.message || 'An error occurred.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setAuthError('An unexpected network error occurred.');
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userToken');
        setUserToken(null);
        // Reset app state on logout
        setCurrentScreen('objects');
        setCurrentPath([]);
        setObjectsHierarchy([]);
    };

    // --- Data Fetching ---
    useEffect(() => {
        // Only fetch data if user is logged in
        if (userToken) {
            fetchAndSetAllObjects();
            fetchTemplates();
        }
    }, [userToken]); // Re-run when userToken changes


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
            Alert.alert('Data Error', 'Failed to load data. Please check your network connection and API.');
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
            Alert.alert('Template Error', 'Failed to load templates. Please check your network connection and API.');
        }
    };


    // Handle pull-to-refresh
    const onRefresh = () => {
        fetchAndSetAllObjects(true);
        fetchTemplates(); // Also refresh templates on pull-to-refresh
    };

    const handleAddObject = async (parentPath, newObject) => {
        try {
            const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;

            const response = await fetch(`${API_BASE_URL}?entity=objects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newObject.name,
                    parent_id: parentId,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                await fetchAndSetAllObjects();
                Alert.alert('Success', result.message);
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
                        {/* The ScrollView will now take up the available space, pushing the logout button to the right */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 16 }}>
                            {breadcrumbs.map((crumb, index) => (
                                <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {index > 0 && (
                                        <ChevronRight color={colors.lightGray700} size={16} style={{ marginHorizontal: 4 }} />
                                    )}
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (index !== breadcrumbs.length - 1) {
                                                setCurrentPath(crumb.path);
                                                setCurrentScreen('objects');
                                                setSelectedProperty(null);
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            AppStyles.headerTitleSmall,
                                            { color: colors.lightGray900 },
                                            index === breadcrumbs.length - 1 && { fontWeight: 'bold' }
                                        ]}>
                                            {crumb.name}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                        
                        {/* Logout Button on the right */}
                        <TouchableOpacity onPress={handleLogout} style={AppStyles.headerBackButton}>
                            <LogOut color={colors.red600} size={24} />
                        </TouchableOpacity>
                    </View>
                </View>
                <ScrollView
                    style={AppStyles.contentPadding}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.blue600]}
                            tintColor={colors.blue600}
                            title="Vernieuwen..."
                            titleColor={colors.lightGray600}
                        />
                    }
                >
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
                                            <Text style={AppStyles.cardTitle}>{item.naam}</Text>
                                            <Text style={AppStyles.cardSubtitle}>
                                                {(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}
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

    const PropertiesScreen = ({ currentPath }) => {
        const item = findItemByPath(objectsHierarchy, currentPath);
        if (!item) return null;

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
                            colors={[colors.blue600]}
                            tintColor={colors.blue600}
                            title="Vernieuwen..."
                            titleColor={colors.lightGray600}
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
        const [selectedTemplate, setSelectedTemplate] = useState(null);

        useEffect(() => {
            if (newPropertiesList.length === 0 && selectedTemplate === null) {
                addNewPropertyField();
            }
        }, [newPropertiesList, selectedTemplate]);

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
                return prevList.map(prop =>
                    prop.id === idToUpdate ? { ...prop, [field]: value } : prop
                );
            });
        };

        const handleSaveOnBack = async () => {
            const validPropertiesToSave = newPropertiesList.filter(prop => prop.name.trim() !== '' && prop.value.trim() !== '')
                .map(prop => ({ name: prop.name.trim(), waarde: prop.value.trim() }));

            if (validPropertiesToSave.length > 0) {
                try {
                    for (const prop of validPropertiesToSave) {
                        await fetch(`${API_BASE_URL}?entity=properties`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                object_id: item.id,
                                name: prop.name,
                                waarde: prop.waarde,
                            }),
                        });
                    }
                    await fetchAndSetAllObjects();
                    Alert.alert('Success', 'Eigenschappen succesvol toegevoegd!');
                } catch (error) {
                    console.error('Error adding properties:', error);
                    Alert.alert('Error', 'Er is een onverwachte fout opgetreden bij het toevoegen van eigenschappen.');
                }
            }

            setNewPropertiesList([]);
            setNextNewPropertyId(0);
            setSelectedTemplate(null);
            setCurrentScreen('properties');
        };

        return (
            <View style={[AppStyles.screen, { backgroundColor: colors.white }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={AppStyles.header}>
                        <View style={AppStyles.headerFlex}>
                            <TouchableOpacity onPress={handleSaveOnBack} style={AppStyles.headerBackButton}>
                                <ChevronLeft color={colors.lightGray700} size={24} />
                            </TouchableOpacity>
                            <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                            <View style={AppStyles.headerPlaceholder} />
                        </View>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={AppStyles.contentPadding}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
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

                        <View style={[AppStyles.card, { marginBottom: 1.5 * 16, padding: 1 * 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 1 * 16, fontSize: 1 * 16, fontWeight: '600' }]}>
                                Nieuwe Eigenschappen Toevoegen
                            </Text>

                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                                <View style={[AppStyles.pickerContainer, Platform.OS === 'android' && { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightGray300, borderRadius: 8, minHeight: 48, justifyContent: 'center' }]}>
                                    <Picker
                                        selectedValue={selectedTemplate}
                                        onValueChange={(itemValue) => {
                                            setSelectedTemplate(itemValue);
                                            if (itemValue && fetchedTemplates[itemValue]) {
                                                const templateProps = fetchedTemplates[itemValue].map((prop, index) => ({
                                                    id: nextNewPropertyId + index,
                                                    name: prop.name,
                                                    value: ''
                                                }));
                                                setNewPropertiesList(templateProps);
                                                setNextNewPropertyId(prevId => prevId + templateProps.length);
                                            } else {
                                                setNewPropertiesList([]);
                                                setNextNewPropertyId(0);
                                                addNewPropertyField();
                                            }
                                        }}
                                        style={[AppStyles.formInput, { backgroundColor: 'transparent' }, Platform.OS === 'android' && { color: colors.lightGray700 }]}
                                        itemStyle={Platform.OS === 'ios' ? AppStyles.pickerItem : null}
                                        dropdownIconColor={colors.lightGray600}
                                    >
                                        <Picker.Item label="Geen sjabloon" value={null} />
                                        {Object.keys(fetchedTemplates).map((templateName) => (
                                            <Picker.Item key={templateName} label={templateName} value={templateName} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowAddTemplateModal(true)}
                                style={[AppStyles.btnSecondary, { marginBottom: 1.5 * 16, alignSelf: 'center' }]}
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
                                onPress={handleSaveOnBack}
                                style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnFlexCenter, { marginTop: 0.5 * 16 }]}
                            >
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>

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
                Alert.alert("Input Required", "Please enter a name for the object.");
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
            const validProps = templateProperties.filter(p => p.name.trim());
            if (validProps.length === 0) {
                setError('Voeg minimaal één eigenschap toe.');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}?entity=templates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: templateName.trim(),
                        properties: validProps.map(p => ({ property_name: p.name.trim() })),
                    }),
                });

                const result = await response.json();

                if (response.ok) {
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
                    <View style={[AppStyles.modalContent, { maxWidth: IS_DESKTOP ? '70%' : '90%', width: IS_DESKTOP ? 700 : '90%' }]}>
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

    const AuthScreen = ({ error, setError }) => {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        const [isSubmitting, setIsSubmitting] = useState(false);
    
        const handleSubmit = async () => {
            if (!username || !password) {
                setError('Please enter both username and password.');
                return;
            }
            setIsSubmitting(true);
            if (authScreen === 'login') {
                await handleLogin(username, password);
            } else {
                await handleRegister(username, password);
            }
            setIsSubmitting(false);
        };

        const handleUsernameChange = (text) => {
            if (error) setError('');
            setUsername(text);
        }

        const handlePasswordChange = (text) => {
            if (error) setError('');
            setPassword(text);
        }
    
        return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={AppStyles.authContainer}>
                    <Text style={AppStyles.authTitle}>
                        {authScreen === 'login' ? 'Welcome Back' : 'Create Account'}
                    </Text>
                    <Text style={AppStyles.authSubtitle}>
                        {authScreen === 'login' ? 'Sign in to continue' : 'Sign up to get started'}
                    </Text>
    
                    <View style={AppStyles.formGroup}>
                        <Text style={AppStyles.formLabel}>Username</Text>
                        <View style={AppStyles.authInputContainer}>
                            <User style={AppStyles.authInputIcon} color={colors.lightGray400} size={20}/>
                            <TextInput
                                placeholder="Enter your username"
                                value={username}
                                onChangeText={handleUsernameChange}
                                style={[AppStyles.formInput, AppStyles.authInput]}
                                placeholderTextColor={colors.lightGray400}
                                autoCapitalize="none"
                                returnKeyType="next"
                            />
                        </View>
                    </View>
                    <View style={AppStyles.formGroup}>
                        <Text style={AppStyles.formLabel}>Password</Text>
                         <View style={AppStyles.authInputContainer}>
                            <Lock style={AppStyles.authInputIcon} color={colors.lightGray400} size={20}/>
                            <TextInput
                                placeholder="Enter your password"
                                value={password}
                                onChangeText={handlePasswordChange}
                                style={[AppStyles.formInput, AppStyles.authInput]}
                                placeholderTextColor={colors.lightGray400}
                                secureTextEntry
                                returnKeyType="done"
                                onSubmitEditing={handleSubmit}
                            />
                        </View>
                    </View>

                    {error ? <Text style={AppStyles.authErrorText}>{error}</Text> : null}
    
                    <TouchableOpacity onPress={handleSubmit} style={[AppStyles.btnPrimary, AppStyles.btnFull, {marginTop: 16}]} disabled={isSubmitting}>
                        {isSubmitting ? <ActivityIndicator color={colors.white} /> : <Text style={AppStyles.btnPrimaryText}>{authScreen === 'login' ? 'Login' : 'Register'}</Text>}
                    </TouchableOpacity>
    
                    <View style={AppStyles.authSwitchContainer}>
                         <Text style={AppStyles.authSwitchText}>{authScreen === 'login' ? "Don't have an account?" : "Already have an account?"}</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                setAuthScreen(authScreen === 'login' ? 'register' : 'login');
                                setError('');
                            }} 
                            style={AppStyles.authSwitchButton}
                        >
                             <Text style={AppStyles.authSwitchButtonText}>{authScreen === 'login' ? 'Register' : 'Login'}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        );
    };

    const currentLevelItems = currentPath.length === 0 ? objectsHierarchy : findItemByPath(objectsHierarchy, currentPath)?.children || [];

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.lightGray100 }}>
                <ActivityIndicator size="large" color={colors.blue600} />
            </View>
        );
    }

    return (
        <>
            <StatusBar
                barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
                backgroundColor="white"
            />
            <View style={AppStyles.appContainer}>
                {userToken == null ? (
                    <AuthScreen error={authError} setError={setAuthError} />
                ) : (
                    (() => {
                        switch (currentScreen) {
                            case 'objects':
                                return (
                                    <HierarchicalObjectsScreen
                                        key={objectsHierarchy.length}
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
                    })()
                )}
                {/* Render All Modals at the top level */}
                {userToken && showAddObjectModal && <AddObjectModal />}
                {userToken && showAddTemplateModal && <AddTemplateModal />}
            </View>
        </>
    );
};

export default App;
