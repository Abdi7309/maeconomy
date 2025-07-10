import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import AppStyles, { colors } from './AppStyles'; 
import AuthScreen from './screens/AuthScreen';
import HierarchicalObjectsScreen from './screens/HierarchicalObjectsScreen';
import PropertiesScreen from './screens/PropertiesScreen';
import AddPropertyScreen from './screens/AddPropertyScreen';
import { 
    fetchAllUsers, 
    handleLogin as apiLogin, 
    handleRegister as apiRegister, 
    fetchAndSetAllObjects as apiFetchObjects, 
    fetchTemplates as apiFetchTemplates, 
    handleAddObject as apiAddObject,
    addProperties as apiAddProperties
} from './api';
import AsyncStorage from '@react-native-async-storage/async-storage'; // --- 1. IMPORT ASYNCSTORAGE ---

const App = () => {
    const [userToken, setUserToken] = useState(null);
    const [currentView, setCurrentView] = useState('login');
    const [isLoading, setIsLoading] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(true); // --- 2. ADD APP LOADING STATE ---
    const [authError, setAuthError] = useState('');
    const [currentScreen, setCurrentScreen] = useState('objects');
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [currentPath, setCurrentPath] = useState([]);
    const [objectsHierarchy, setObjectsHierarchy] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [fetchedTemplates, setFetchedTemplates] = useState({});
    const [allUsers, setAllUsers] = useState([]);
    const [totalObjectCount, setTotalObjectCount] = useState(0);
    const [filterOption, setFilterOption] = useState(null);

    // --- 3. ADD EFFECT TO CHECK STORAGE ON APP START ---
    useEffect(() => {
        const loadUserFromStorage = async () => {
            try {
                const storedUserToken = await AsyncStorage.getItem('userToken');
                if (storedUserToken) {
                    setUserToken(JSON.parse(storedUserToken));
                    setFilterOption('all'); // Set default filter
                    await handleFetchUsers(); // Fetch initial data
                    await handleFetchTemplates();
                }
            } catch (error) {
                console.error("Failed to load user from storage", error);
            } finally {
                setIsAppLoading(false);
            }
        };
        loadUserFromStorage();
    }, []);

    useEffect(() => {
        if (userToken) {
            handleFetchObjects();
        }
    }, [filterOption]);

    const handleFetchUsers = async () => {
        const data = await fetchAllUsers();
        if (data) {
            setAllUsers(data.users);
            setTotalObjectCount(data.total_objects);
        }
    };

    const handleLogin = async (username, password) => {
        setIsLoading(true);
        setAuthError('');
        const result = await apiLogin(username, password);
        if (result && result.success) {
            const userId = result.user.id;
            setUserToken(userId);
            setFilterOption('all');
            setCurrentView('app');
            await handleFetchUsers();
            await handleFetchTemplates();

            // --- 4. SAVE USER TOKEN ON LOGIN ---
            try {
                await AsyncStorage.setItem('userToken', JSON.stringify(userId));
            } catch (error) {
                console.error("Failed to save user token to storage", error);
            }

        } else {
            setAuthError(result ? result.message : 'An error occurred during login.');
        }
        setIsLoading(false);
    };
    
    const handleRegister = async (username, password) => {
        setIsLoading(true);
        setAuthError('');
        const result = await apiRegister(username, password);
        if (result && result.success) {
            Alert.alert('Registration Successful', 'You can now log in.');
            setCurrentView('login');
        } else {
            setAuthError(result ? result.message : 'An error occurred during registration.');
        }
        setIsLoading(false);
    };

    const handleLogout = async () => { // --- 5. MAKE LOGOUT ASYNC ---
        setUserToken(null);
        setCurrentView('login');
        setObjectsHierarchy([]);
        setCurrentPath([]);
        setAllUsers([]);
        setFilterOption(null);
        setTotalObjectCount(0);

        // --- 6. CLEAR USER TOKEN ON LOGOUT ---
        try {
            await AsyncStorage.removeItem('userToken');
        } catch (error) {
            console.error("Failed to remove user token from storage", error);
        }
    };

    const handleFetchObjects = async (isRefreshing = false) => {
        if (!filterOption) return;
        if(isRefreshing) setRefreshing(true);
        else setIsLoading(true);

        const data = await apiFetchObjects(filterOption);
        if(data) {
            setObjectsHierarchy(data);
        }

        if(isRefreshing) setRefreshing(false);
        else setIsLoading(false);
    };

    const handleFetchTemplates = async () => {
        const data = await apiFetchTemplates();
        if(data) {
            setFetchedTemplates(data);
        }
    };

    const onRefresh = () => {
        handleFetchObjects(true);
        handleFetchTemplates();
        handleFetchUsers();
    };



    const handleAddObject = async (parentPath, newObjectData) => {
        const success = await apiAddObject(parentPath, newObjectData, userToken);
        if (success) {
            await handleFetchObjects();
            await handleFetchUsers();
        }
    };

    const handleAddProperties = async (objectId, properties) => {
        const success = await apiAddProperties(objectId, properties);
        if (success) {
            await handleFetchObjects();
        }
        return success;
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

    const renderContent = () => {
        // --- 7. ADD INITIAL LOADING INDICATOR ---
        if (isAppLoading) {
            return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color={colors.blue600} /></View>;
        }

        if (!userToken) {
            return (
                <AuthScreen 
                    onLogin={handleLogin}
                    onRegister={handleRegister}
                    authError={authError}
                    setAuthError={setAuthError}
                    isLoading={isLoading}
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                />
            );
        }

        if (isLoading && !refreshing) {
             return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color={colors.blue600} /></View>;
        }

        const objectsScreen = (
            <HierarchicalObjectsScreen
                items={currentPath.length === 0 ? objectsHierarchy : findItemByPath(objectsHierarchy, currentPath)?.children || []}
                currentLevelPath={currentPath}
                setCurrentPath={setCurrentPath}
                setCurrentScreen={setCurrentScreen}
                setSelectedProperty={setSelectedProperty}
                handleLogout={handleLogout}
                onRefresh={onRefresh}
                refreshing={refreshing}
                allUsers={allUsers}
                userToken={userToken}
                totalObjectCount={totalObjectCount}
                filterOption={filterOption}
                setFilterOption={setFilterOption}
                onAddObject={handleAddObject}
                objectsHierarchy={objectsHierarchy}
            />
        );

        switch (currentScreen) {
            case 'objects':
                return objectsScreen;
            case 'properties':
                return (
                    <PropertiesScreen 
                        currentPath={[...currentPath, selectedProperty]}
                        objectsHierarchy={objectsHierarchy}
                        setCurrentScreen={setCurrentScreen}
                        onRefresh={onRefresh}
                        refreshing={refreshing}
                        findItemByPath={findItemByPath}
                    />

                );
            case 'addProperty':
                return (
                    <AddPropertyScreen 
                        currentPath={[...currentPath, selectedProperty]}
                        objectsHierarchy={objectsHierarchy}
                        fetchedTemplates={fetchedTemplates}
                        setCurrentScreen={setCurrentScreen}
                        onSave={handleAddProperties}
                        onTemplateAdded={handleFetchTemplates}
                        findItemByPath={findItemByPath}
                    />
                );
            default:
                return objectsScreen;
        }
    };

    return (
        <View style={AppStyles.appContainer}>
            {renderContent()}
        </View>
    );
};

export default App;