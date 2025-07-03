import { Picker } from '@react-native-picker/picker';
import { Box, ChevronDown, ChevronLeft, ChevronRight, FileText, KeyRound, Paintbrush, Palette, Plus, Ruler, Tag, Wrench, X, User, Lock, Filter } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import AppStyles, { colors } from './AppStyles'; 

const { width } = Dimensions.get('window');
const IS_DESKTOP = width >= 768;

const DEFAULT_PROPERTY_ICON = 'Tag';

const IconMap = { Palette, Ruler, Box, Wrench, Tag, KeyRound, FileText, Paintbrush };

const App = () => {
    const [userToken, setUserToken] = useState(null);
    const [currentView, setCurrentView] = useState('login');
    const [isLoading, setIsLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [currentScreen, setCurrentScreen] = useState('objects');
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);
    const [objectsHierarchy, setObjectsHierarchy] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [fetchedTemplates, setFetchedTemplates] = useState({});
    const [allUsers, setAllUsers] = useState([]);
    const [totalObjectCount, setTotalObjectCount] = useState(0);
    const [filterOption, setFilterOption] = useState(null);

    const API_BASE_URL = 'http://10.3.1.42/Maeconomy/app/(tabs)/api.php';

    useEffect(() => {
        if (userToken) {
            fetchAndSetAllObjects();
        }
    }, [filterOption]);

    const fetchAllUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}?entity=users`);
            const data = await response.json();
            if (response.ok) {
                setAllUsers(data.users);
                setTotalObjectCount(data.total_objects);
            }
        } catch (error) {
            console.error('Failed to fetch users and counts:', error);
        }
    };

    const handleLogin = async (username, password) => {
        setIsLoading(true);
        setAuthError('');
        try {
            const response = await fetch(`${API_BASE_URL}?entity=users&action=login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (result.success) {
                setUserToken(result.user.id);
                setFilterOption('all'); // Default filter to "All Objects"
                setCurrentView('app');
                await fetchAllUsers();
                await fetchTemplates();
            } else {
                setAuthError(result.message);
            }
        } catch (error) {
            console.error('Login error:', error);
            setAuthError('An error occurred during login.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRegister = async (username, password) => {
        setIsLoading(true);
        setAuthError('');
        try {
            const response = await fetch(`${API_BASE_URL}?entity=users&action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const result = await response.json();
            if (result.success) {
                Alert.alert('Registration Successful', 'You can now log in.');
                setCurrentView('login');
            } else {
                setAuthError(result.message);
            }
        } catch (error) {
            console.error('Registration error:', error);
            setAuthError('An error occurred during registration.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        setUserToken(null);
        setCurrentView('login');
        setObjectsHierarchy([]);
        setCurrentPath([]);
        setAllUsers([]);
        setFilterOption(null);
        setTotalObjectCount(0);
    };

    const AuthScreen = () => {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
    
        return (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={AppStyles.authContainer}>
                <StatusBar barStyle="dark-content" />
                <View>
                    <Text style={AppStyles.authTitle}>
                        {currentView === 'login' ? 'Welcome Back!' : 'Create Account'}
                    </Text>
                    <Text style={AppStyles.authSubtitle}>
                        {currentView === 'login' ? 'Sign in to continue' : 'Get started by creating a new account'}
                    </Text>
    
                    <View style={AppStyles.formGroup}>
                        <Text style={AppStyles.formLabel}>Username</Text>
                        <View style={AppStyles.authInputContainer}>
                            <User style={AppStyles.authInputIcon} color={colors.lightGray400} size={20} />
                            <TextInput
                                style={[AppStyles.formInput, AppStyles.authInput]}
                                placeholder="Enter your username"
                                value={username}
                                onChangeText={setUsername}
                                onFocus={() => setAuthError('')}
                                autoCapitalize="none"
                                placeholderTextColor={colors.lightGray400}
                            />
                        </View>
                    </View>
    
                    <View style={AppStyles.formGroup}>
                        <Text style={AppStyles.formLabel}>Password</Text>
                         <View style={AppStyles.authInputContainer}>
                            <Lock style={AppStyles.authInputIcon} color={colors.lightGray400} size={20} />
                            <TextInput
                                style={[AppStyles.formInput, AppStyles.authInput]}
                                placeholder="Enter your password"
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setAuthError('')}
                                secureTextEntry
                                placeholderTextColor={colors.lightGray400}
                            />
                        </View>
                    </View>

                    {authError ? (
                        <Text style={{color: colors.red500, textAlign: 'center', marginBottom: 16, fontSize: 16}}>
                            {authError}
                        </Text>
                    ) : null}
    
                    <TouchableOpacity
                        style={[AppStyles.btnPrimary, AppStyles.btnFull, { marginTop: 16 }]}
                        onPress={() => currentView === 'login' ? handleLogin(username, password) : handleRegister(username, password)}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={AppStyles.btnPrimaryText}>{currentView === 'login' ? 'Login' : 'Register'}</Text>
                        )}
                    </TouchableOpacity>
    
                    <View style={AppStyles.authSwitchContainer}>
                        <Text style={AppStyles.authSwitchText}>
                            {currentView === 'login' ? "Don't have an account?" : "Already have an account?"}
                        </Text>
                        <TouchableOpacity
                            style={AppStyles.authSwitchButton}
                            onPress={() => {
                                setCurrentView(currentView === 'login' ? 'register' : 'login');
                                setAuthError('');
                            }}
                        >
                            <Text style={AppStyles.authSwitchButtonText}>
                                {currentView === 'login' ? 'Sign Up' : 'Sign In'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        );
    };

    const findItemByPath = (data, path) => {
        let currentItems = data;
        let foundItem = null;
        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];
            if (!Array.isArray(currentItems)) return null;
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

    const fetchAndSetAllObjects = async (isRefreshing = false) => {
        if (!filterOption) return;
        
        console.log(`Fetching all objects hierarchy with filter: ${filterOption}`);
        if (isRefreshing) {
            setRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const topLevelResponse = await fetch(`${API_BASE_URL}?entity=objects&filter_user_id=${filterOption}`);
            if (!topLevelResponse.ok) {
                throw new Error(`HTTP error! status: ${topLevelResponse.status} for top-level objects`);
            }
            const topLevelObjects = await topLevelResponse.json();

            const hydrationResults = await Promise.allSettled(topLevelObjects.map(async (obj) => {
                try {
                    const fullObjectResponse = await fetch(`${API_BASE_URL}?entity=objects&id=${obj.id}`);
                    if (!fullObjectResponse.ok) {
                        console.warn(`Failed to fetch full hierarchy for object ID ${obj.id}. Status: ${fullObjectResponse.status}`);
                        return null;
                    }
                    const data = await fullObjectResponse.json();
                    return { ...data, properties: data.properties || [], children: data.children || [] };
                } catch (innerError) {
                    console.error(`Error fetching full hierarchy for object ID ${obj.id}:`, innerError);
                    return null;
                }
            }));

            const fullyHydratedObjects = hydrationResults
                .filter(result => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value);

            setObjectsHierarchy(fullyHydratedObjects);

        } catch (error) {
            console.error('Failed to fetch and set all objects (overall error):', error);
            Alert.alert('Error', 'Failed to load data.');
        } finally {
             if (isRefreshing) {
                setRefreshing(false);
            } else {
                setIsLoading(false);
            }
        }
    };

    const fetchTemplates = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}?entity=templates`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const templatesData = await response.json();

            const formattedTemplates = {};
            await Promise.all(templatesData.map(async (template) => {
                try {
                    const propertiesResponse = await fetch(`${API_BASE_URL}?entity=templates&id=${template.id}`);
                    if (!propertiesResponse.ok) return;
                    const templateWithProperties = await propertiesResponse.json();
                    formattedTemplates[String(template.id)] = {
                        name: template.name,
                        properties: (templateWithProperties.properties || []).map(prop => ({
                            ...prop,
                            name: prop.property_name,
                            value: prop.property_value || ''
                        }))
                    };
                } catch (innerError) {
                    console.error(`Error fetching properties for template ID ${template.id}:`, innerError);
                }
            }));
            setFetchedTemplates(formattedTemplates);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        }
    };

    const onRefresh = () => {
        fetchAndSetAllObjects(true);
        fetchTemplates();
        fetchAllUsers(); // Also refresh counts
    };

    const handleAddObject = async (parentPath, newObjectData) => {
        const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;
        const { name } = newObjectData;
    
        console.log('Attempting to add object with name:', name, 'and user_id:', userToken);
    
        try {
            const apiResponse = await fetch(`${API_BASE_URL}?entity=objects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    parent_id: parentId,
                    user_id: userToken,
                }),
            });
    
            console.log('API response received:', apiResponse.status, apiResponse.statusText);
    
            const resultJson = await apiResponse.json();
            console.log('API result JSON:', resultJson);
    
            if (!apiResponse.ok) {
                Alert.alert('Error', resultJson.message || 'Failed to add object.');
                return;
            }
            
            Alert.alert('Success', resultJson.message);
            
            console.log('Refreshing all objects...');
            await fetchAndSetAllObjects();
            
            console.log('Refreshing user list and counts...');
            await fetchAllUsers();
    
        } catch (error) {
            console.error('Error in handleAddObject catch block:', error);
            Alert.alert('Error', 'An unexpected error occurred while adding the item.');
        } finally {
            setShowAddObjectModal(false);
        }
    };

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

        const getBreadcrumbs = () => {
            let breadcrumbs = [{ id: 'root', name: 'Objecten', path: [] }];
            let currentItems = objectsHierarchy;
            currentLevelPath.forEach((id, index) => {
                const item = currentItems.find(obj => obj.id === id);
                if (item) {
                    breadcrumbs.push({ id: item.id, name: item.naam, path: currentLevelPath.slice(0, index + 1) });
                    currentItems = item.children || [];
                }
            });
            return breadcrumbs;
        };
        const breadcrumbs = getBreadcrumbs();

        return (
            <View style={AppStyles.screen}>
                <StatusBar barStyle="dark-content" />
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 1 }}>
                            {breadcrumbs.map((crumb, index) => (
                                <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {index > 0 && <ChevronRight color={colors.lightGray700} size={16} style={{ marginHorizontal: 4 }} />}
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (index !== breadcrumbs.length - 1) {
                                                setCurrentPath(crumb.path);
                                                setCurrentScreen('objects');
                                                setSelectedProperty(null);
                                            }
                                        }}
                                    >
                                        <Text style={[AppStyles.headerTitleSmall, { color: colors.lightGray900 }, index === breadcrumbs.length - 1 && { fontWeight: 'bold' }]}>
                                            {crumb.name}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity onPress={handleLogout} style={{ padding: 8 }}>
                           <Text style={{color: colors.blue600}}>Loguit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <ScrollView
                    style={AppStyles.contentPadding}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
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
                                                Maker: {item.owner_name || 'Unknown'}
                                            </Text>
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
                                <Text style={AppStyles.emptyStateText}>No items found for this filter.</Text>
                                <Text style={AppStyles.emptyStateSubtext}>
                                    Try a different filter or add a new item.
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
                
                <TouchableOpacity onPress={() => setShowFilterModal(true)} style={AppStyles.filterFab}>
                    <Filter color={colors.blue600} size={24} />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowAddObjectModal(true)} style={AppStyles.fab}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </View>
        );
    };

    const FilterModal = () => {
        const handleSelectFilter = (option) => {
            setFilterOption(option);
            setShowFilterModal(false);
        };

        const currentUser = allUsers.find(u => u.id === userToken);
        const myObjectsCount = currentUser ? currentUser.object_count : 0;
    
        return (
            <Modal
                transparent={true}
                visible={showFilterModal}
                onRequestClose={() => setShowFilterModal(false)}
                animationType="fade"
            >
                <TouchableOpacity style={AppStyles.modalBackdrop} activeOpacity={1} onPressOut={() => setShowFilterModal(false)}>
                    <View style={[AppStyles.modalContent, {width: '80%'}]}>
                        <Text style={AppStyles.modalTitle}>Filter Objects</Text>
                        
                        <ScrollView>
                            <TouchableOpacity style={AppStyles.filterOptionButton} onPress={() => handleSelectFilter('all')}>
                                <Text style={AppStyles.filterOptionText}>{`All Objects (${totalObjectCount})`}</Text>
                            </TouchableOpacity>
                             <TouchableOpacity style={AppStyles.filterOptionButton} onPress={() => handleSelectFilter(userToken)}>
                                <Text style={AppStyles.filterOptionText}>{`My Objects (${myObjectsCount})`}</Text>
                            </TouchableOpacity>
                            {allUsers.filter(u => u.id !== userToken).map(user => (
                                <TouchableOpacity key={user.id} style={AppStyles.filterOptionButton} onPress={() => handleSelectFilter(user.id)}>
                                    <Text style={AppStyles.filterOptionText}>{`Objects from ${user.username} (${user.object_count})`}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
    
                        <TouchableOpacity
                            onPress={() => setShowFilterModal(false)}
                            style={[AppStyles.btnSecondary, {marginTop: 16}]}
                        >
                            <Text style={AppStyles.btnSecondaryText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    const PropertiesScreen = ({ currentPath }) => {
        const item = findItemByPath(objectsHierarchy, currentPath);
        if (!item) {
            return <View style={[AppStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}><Text style={AppStyles.emptyStateText}>Item not found...</Text></View>;
        }
        const renderIcon = (customColor = colors.lightGray500) => {
            const Icon = IconMap[DEFAULT_PROPERTY_ICON] || Tag;
            return <Icon color={customColor} size={20} />;
        };
        return (
            <View style={[AppStyles.screen, { flex: 1 }]}>
                <StatusBar barStyle="dark-content" />
                <View style={AppStyles.header}><View style={AppStyles.headerFlex}><TouchableOpacity onPress={() => setCurrentScreen('objects')} style={AppStyles.headerBackButton}><ChevronLeft color={colors.lightGray700} size={24} /></TouchableOpacity><Text style={AppStyles.headerTitleLg}>Eigenschappen</Text><View style={AppStyles.headerPlaceholder} /></View></View>
                <View style={{ backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}><Text style={AppStyles.detailName}>{item.naam}</Text><Text style={AppStyles.detailSubtitle}>{(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}</Text></View>
                <ScrollView style={AppStyles.contentPadding} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}>
                    <View style={AppStyles.propertyList}>
                        {(item.properties && item.properties.length > 0) ? (item.properties.map((prop, index) => (<View key={index} style={AppStyles.propertyItem}><View style={AppStyles.propertyItemMain}>{renderIcon()}<Text style={AppStyles.propertyName}>{prop.name}</Text></View><Text style={AppStyles.propertyValue}>{prop.waarde}</Text></View>))) : (<View style={AppStyles.emptyState}><Text style={AppStyles.emptyStateText}>Nog geen eigenschappen toegevoegd.</Text><Text style={AppStyles.emptyStateSubtext}>Klik op de '+' knop om te beginnen.</Text></View>)}
                    </View>
                </ScrollView>
                <TouchableOpacity onPress={() => setCurrentScreen('addProperty')} style={AppStyles.fab}><Plus color="white" size={24} /></TouchableOpacity>
            </View>
        );
    };
    
    const AddPropertyScreen = ({ currentPath }) => {
        const objectIdForProperties = currentPath[currentPath.length - 1];
        const item = findItemByPath(objectsHierarchy, currentPath);

        if (!item) return null;

        const [newPropertiesList, setNewPropertiesList] = useState([]);
        const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
        const [selectedTemplateForPropertyAdd, setSelectedTemplateForPropertyAdd] = useState(null);
        const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);

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

        useEffect(() => {
            if (newPropertiesList.length === 0 && selectedTemplateForPropertyAdd === null) {
                addNewPropertyField();
            }
        }, [newPropertiesList, selectedTemplateForPropertyAdd]);

        const handleSaveOnBack = async () => {
            // Check for partially filled properties first
            const partiallyFilled = newPropertiesList.find(prop => 
                (prop.name.trim() !== '' && prop.value.trim() === '') ||
                (prop.name.trim() === '' && prop.value.trim() !== '')
            );
        
            if (partiallyFilled) {
                Alert.alert('Incomplete Entry', 'Please provide both a name and a value for each property, or leave both fields empty to ignore.');
                return; // Stop execution
            }
        
            // Filter for valid properties to save (both fields must be filled)
            const validPropertiesToSave = newPropertiesList.filter(prop => 
                prop.name.trim() !== '' && prop.value.trim() !== ''
            );
        
            if (validPropertiesToSave.length > 0) {
                try {
                    await Promise.all(validPropertiesToSave.map(async (prop) => {
                        const response = await fetch(`${API_BASE_URL}?entity=properties`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                object_id: objectIdForProperties,
                                name: prop.name.trim(),
                                waarde: prop.value.trim(),
                            }),
                        });
                        if (!response.ok) {
                            const errorResult = await response.json();
                            throw new Error(`Failed to save property '${prop.name}': ${errorResult.message || 'Unknown error'}`);
                        }
                    }));
        
                    Alert.alert('Success', 'Properties added successfully!');
                    await fetchAndSetAllObjects(); // Refresh data
                } catch (error) {
                    console.error('Error adding properties:', error);
                    Alert.alert('Error', error.message);
                    return; // Stop if there was an error
                }
            }
        
            // Navigate back only if validation passed and save was successful (or if there was nothing to save)
            setCurrentScreen('properties');
        };

        const TemplatePickerModal = () => (
            <Modal
                transparent={true}
                visible={showTemplatePickerModal}
                onRequestClose={() => setShowTemplatePickerModal(false)}
                animationType="fade"
            >
                <TouchableOpacity style={AppStyles.modalBackdrop} activeOpacity={1} onPressOut={() => setShowTemplatePickerModal(false)}>
                    <View style={[AppStyles.modalContent, {width: '80%'}]}>
                        <Text style={AppStyles.modalTitle}>Kies een Sjabloon</Text>
                        <ScrollView>
                             <TouchableOpacity style={AppStyles.filterOptionButton} onPress={() => {
                                setSelectedTemplateForPropertyAdd(null);
                                setNewPropertiesList([]);
                                addNewPropertyField();
                                setShowTemplatePickerModal(false);
                            }}>
                                <Text style={AppStyles.filterOptionText}>Geen sjabloon</Text>
                            </TouchableOpacity>
                            {Object.entries(fetchedTemplates).map(([templateId, tpl]) => (
                                <TouchableOpacity key={templateId} style={AppStyles.filterOptionButton} onPress={() => {
                                    setSelectedTemplateForPropertyAdd(templateId);
                                    const templateProps = tpl.properties.map((prop, index) => ({
                                        id: index, name: prop.name, value: prop.value || ''
                                    }));
                                    setNewPropertiesList(templateProps);
                                    setNextNewPropertyId(templateProps.length);
                                    setShowTemplatePickerModal(false);
                                }}>
                                    <Text style={AppStyles.filterOptionText}>{tpl.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        );

        return (
            <View style={[AppStyles.screen, { backgroundColor: colors.white }]}>
                <StatusBar barStyle="dark-content" />
                {showTemplatePickerModal && <TemplatePickerModal />}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                    >
                        <View style={[AppStyles.card, { marginTop: 0, marginBottom: 24, padding: 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 16, fontSize: 16, fontWeight: '600' }]}>
                                Bestaande Eigenschappen
                            </Text>
                            <View style={AppStyles.propertyList}>
                                {(item.properties || []).length > 0 ? (
                                    (item.properties || []).map((prop, index) => (
                                        <View key={index} style={AppStyles.propertyItem}>
                                            <View style={AppStyles.propertyItemMain}>{renderIcon()}<Text style={AppStyles.propertyName}>{prop.name}</Text></View>
                                            <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={AppStyles.emptyState}><Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text></View>
                                )}
                            </View>
                        </View>
                        <View style={[AppStyles.card, { marginBottom: 24, padding: 16 }]}>
                            <Text style={[AppStyles.infoItemValue, { marginBottom: 16, fontSize: 16, fontWeight: '600' }]}>
                                Nieuwe Eigenschappen Toevoegen
                            </Text>
                            
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Kies een sjabloon (optioneel)</Text>
                                <TouchableOpacity onPress={() => setShowTemplatePickerModal(true)} style={[AppStyles.formInput, { justifyContent: 'center' }]}>
                                    <Text style={{ color: selectedTemplateForPropertyAdd ? colors.lightGray800 : colors.lightGray400 }}>
                                        {selectedTemplateForPropertyAdd ? fetchedTemplates[selectedTemplateForPropertyAdd]?.name : 'Kies een sjabloon...'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowAddTemplateModal(true)}
                                style={[AppStyles.btnSecondary, { marginBottom: 16, alignSelf: 'center' }]}
                            >
                                <Text style={AppStyles.btnSecondaryText}>+ Nieuw sjabloon toevoegen</Text>
                            </TouchableOpacity>
                            
                            {newPropertiesList.map(prop => (
                                <View key={prop.id} style={{ marginBottom: 16, borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 8, padding: 16 }}>
                                    <View style={AppStyles.formRow}>
                                        <View style={[AppStyles.formGroupHalf, { marginRight: 8 }]}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
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
                                                returnKeyType="done"
                                                onSubmitEditing={addNewPropertyField}
                                            />
                                        </View>
                                        {(newPropertiesList.length > 1 || (prop.name.trim() !== '' || prop.value.trim() !== '')) && (
                                            <TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 4, alignSelf: 'flex-start', marginTop: 30, left: 5 }}>
                                                <X color={colors.red600} size={20} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))}
                            <TouchableOpacity onPress={handleSaveOnBack} style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnFlexCenter, { marginTop: 8 }]}>
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                    <TouchableOpacity onPress={addNewPropertyField} style={AppStyles.fab}>
                        <Plus color="white" size={24} />
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </View>
        );
    };

    const AddObjectModal = () => {
        const [name, setName] = useState('');
        const handleSaveObject = () => name.trim() ? handleAddObject(currentPath, { name }) : Alert.alert("Input required", "Please enter a name.");
        return (<Modal transparent visible={showAddObjectModal} onRequestClose={() => setShowAddObjectModal(false)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={AppStyles.modalBackdrop}><View style={[AppStyles.modalContent, { backgroundColor: 'white' }]}><Text style={AppStyles.modalTitle}>Object Toevoegen</Text><View style={AppStyles.formGroup}><Text style={AppStyles.formLabel}>Naam</Text><TextInput placeholder="Bijv. Kamer" value={name} onChangeText={setName} style={AppStyles.formInput} /></View><View style={AppStyles.modalActions}><TouchableOpacity onPress={() => setShowAddObjectModal(false)} style={AppStyles.btnSecondary}><Text style={AppStyles.btnSecondaryText}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={handleSaveObject} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}><Text style={AppStyles.btnPrimaryText}>Save</Text></TouchableOpacity></View></View></KeyboardAvoidingView></Modal>);
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
            if (templateProperties.length === 1 && (templateProperties[0].name.trim() === '' && templateProperties[0].value.trim() === '')) {
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
            const validProps = templateProperties.filter(p => p.name.trim() !== '');
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
                        properties: validProps.map(p => ({
                            property_name: p.name.trim(),
                            property_value: p.value.trim()
                        })),
                    }),
                });

                const result = await response.json();
                if (response.ok) {
                    Alert.alert('Success', result.message || 'Sjabloon succesvol opgeslagen.');
                    fetchTemplates();
                    setShowAddTemplateModal(false);
                    setTemplateName('');
                    setTemplateProperties([{ name: '', value: '' }]);
                    setError('');
                } else {
                    setError(result.message || 'Opslaan mislukt.');
                }
            } catch (error) {
                setError('Netwerkfout bij opslaan.');
            }
        };

        return (
            <Modal transparent visible={showAddTemplateModal} onRequestClose={() => setShowAddTemplateModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={AppStyles.modalBackdrop}>
                    <View style={[AppStyles.modalContent, { maxWidth: IS_DESKTOP ? '70%' : '90%', width: IS_DESKTOP ? 700 : '90%' }]}>
                        <Text style={AppStyles.modalTitle}>Nieuw Sjabloon Toevoegen</Text>
                        <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.6 }}>
                            <View style={AppStyles.formGroup}>
                                <Text style={AppStyles.formLabel}>Sjabloonnaam</Text>
                                <TextInput placeholder="Bijv. Standaard woning" value={templateName} onChangeText={setTemplateName} style={AppStyles.formInput} />
                            </View>
                            <Text style={[AppStyles.formLabel, { marginTop: 16, marginBottom: 8 }]}>Sjablooneigenschappen</Text>
                            {templateProperties.map((prop, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TextInput style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]} placeholder="Naam" value={prop.name} onChangeText={(text) => handlePropertyChange(idx, 'name', text)} />
                                    <TextInput style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]} placeholder="Waarde (optioneel)" value={prop.value} onChangeText={(text) => handlePropertyChange(idx, 'value', text)} />
                                    {(templateProperties.length > 1 || prop.name.trim() !== '' || prop.value.trim() !== '') && (
                                        <TouchableOpacity onPress={() => handleRemoveProperty(idx)} style={{ padding: 4 }}>
                                            <X color={colors.red500} size={20} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                            <TouchableOpacity onPress={handleAddProperty} style={[AppStyles.btnSecondary, { alignSelf: 'flex-start', marginBottom: 12 }]}>
                                <Text style={AppStyles.btnSecondaryText}>+ Eigenschap toevoegen</Text>
                            </TouchableOpacity>
                            {error ? <Text style={{ color: colors.red500, marginBottom: 8, textAlign: 'center' }}>{error}</Text> : null}
                            <View style={AppStyles.modalActions}>
                                <TouchableOpacity style={[AppStyles.btnSecondary, AppStyles.btnPrimaryModal]} onPress={() => setShowAddTemplateModal(false)}>
                                    <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]} onPress={handleSave}>
                                    <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };


    const currentLevelItems = currentPath.length === 0
        ? objectsHierarchy
        : findItemByPath(objectsHierarchy, currentPath)?.children || [];


    const renderContent = () => {
        if (!userToken) {
            return <AuthScreen />;
        }

        if (isLoading) {
             return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color={colors.blue600} /></View>;
        }

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
                return <PropertiesScreen currentPath={[...currentPath, selectedProperty]} />;
            case 'addProperty':
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
    };

    return (
        <>
            <View style={AppStyles.appContainer}>
                {renderContent()}
                {userToken && showAddObjectModal && <AddObjectModal />}
                {userToken && showAddTemplateModal && <AddTemplateModal />}
                {userToken && showFilterModal && <FilterModal />}
            </View>
        </>
    );
};

export default App;
