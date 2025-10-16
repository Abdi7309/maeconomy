import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import {
    handleAddObject as apiAddObject,
    addProperties as apiAddProperties,
    fetchAndSetAllObjects as apiFetchObjects,
    fetchTemplates as apiFetchTemplates,
    supabaseLogin as apiLogin,
    supabaseLogout as apiLogout,
    supabaseRegister as apiRegister,
    updateProperty as apiUpdateProperty,
    fetchAllUsers,
    getCurrentSession,
    getCurrentUser
} from './api';
import AppStyles, { colors } from './AppStyles';
import { supabase } from './config/config';
import AddPropertyScreen from './screens/AddPropertyScreen';
import AuthScreen from './screens/AuthScreen';
import HierarchicalObjectsScreen from './screens/HierarchicalObjectsScreen';
import PropertiesScreen from './screens/PropertiesScreen';

const App = () => {
    const [userToken, setUserToken] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [session, setSession] = useState(null);
    const [currentView, setCurrentView] = useState('login');
    const [isLoading, setIsLoading] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(true);
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

    // Initialize app state and check for Supabase session
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Get current Supabase session
                const currentSession = await getCurrentSession();
                
                if (currentSession) {
                    console.log('[initializeApp] Found active Supabase session');
                    
                    // Get user data
                    const userData = await getCurrentUser();
                    
                    if (userData && userData.user) {
                        setSession(currentSession);
                        setCurrentUser(userData.user);
                        setUserToken(userData.user.id);
                        setCurrentView('app');
                        setFilterOption('all');
                        console.log('[initializeApp] User authenticated:', userData.user.email);
                    }
                } else {
                    console.log('[initializeApp] No active session found');
                }
            } catch (error) {
                console.error('[initializeApp] Error checking Supabase session:', error);
            } finally {
                setIsAppLoading(false);
            }
        };
        
        initializeApp();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[AuthStateChange] Event:', event, 'Session:', !!session);
                
                if (event === 'SIGNED_IN' && session) {
                    const userData = await getCurrentUser();
                    if (userData && userData.user) {
                        setSession(session);
                        setCurrentUser(userData.user);
                        setUserToken(userData.user.id);
                        setCurrentView('app');
                        setFilterOption('all');
                    }
                } else if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setCurrentUser(null);
                    setUserToken(null);
                    setCurrentView('login');
                    // Clear app state
                    setObjectsHierarchy([]);
                    setAllUsers([]);
                    setFetchedTemplates({});
                    setCurrentScreen('objects');
                    setCurrentPath([]);
                    setFilterOption(null);
                }
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // Fetch data when user is logged in - load in parallel for better performance
    useEffect(() => {
        if (userToken && currentView === 'app') {
            // Load data in parallel instead of sequentially
            Promise.all([
                handleFetchUsers(),
                handleFetchTemplates()
            ]).catch(error => {
                console.error('[useEffect] Error loading initial data:', error);
            });
        }
    }, [userToken, currentView]);

    useEffect(() => {
        if (userToken) {
            handleFetchObjects();
        }
    }, [filterOption]);

    const handleFetchUsers = async () => {
        try {
            // Only fix missing profiles on first load or when explicitly needed
            // This reduces unnecessary database calls
            const data = await fetchAllUsers();
            if (data) {
                setAllUsers(data.users);
                setTotalObjectCount(data.totalObjectCount);
            }
        } catch (error) {
            console.error('[handleFetchUsers] Error fetching users:', error);
        }
    };

    const handleLogin = async (email, password) => {
        setIsLoading(true);
        setAuthError('');
        const result = await apiLogin(email, password);
        if (result && result.success) {
            // Supabase Auth will handle session management automatically
            // The auth state change listener will update our state
            console.log('[handleLogin] Login successful for:', email);
        } else {
            setAuthError(result ? result.message : 'An error occurred during login.');
        }
        setIsLoading(false);
    };
    
    const handleRegister = async (email, password, username) => {
        setIsLoading(true);
        setAuthError('');
        const result = await apiRegister(email, password, username);
        if (result && result.success) {
            if (result.needsConfirmation) {
                Alert.alert(
                    'Check Your Email', 
                    'We sent you a confirmation link. Please check your email and click the link to confirm your account.',
                    [{ text: 'OK', onPress: () => setCurrentView('login') }]
                );
            } else {
                Alert.alert('Registration Successful', 'Account created successfully!');
                // Auth state change will handle the login automatically
            }
        } else {
            setAuthError(result ? result.message : 'An error occurred during registration.');
        }
        setIsLoading(false);
    };

    const handleLogout = async () => {
        try {
            console.log('[handleLogout] Logout button pressed');
            
            // Show loading state
            setIsLoading(true);
            
            // Clear state immediately for better UX
            setSession(null);
            setCurrentUser(null);
            setUserToken(null);
            setCurrentView('login');
            setObjectsHierarchy([]);
            setAllUsers([]);
            setFetchedTemplates({});
            setCurrentScreen('objects');
            setCurrentPath([]);
            setFilterOption(null);
            
            // Call logout API in background
            const success = await apiLogout();
            
            if (!success) {
                console.warn('[handleLogout] Logout API call failed, but state cleared locally');
                // Don't show error - user is already logged out from UI perspective
            } else {
                console.log('[handleLogout] Logout API call successful');
            }
            
        } catch (error) {
            console.error('[handleLogout] Error during logout:', error);
            // Don't show error alert - user is already logged out from UI perspective
        } finally {
            // Ensure loading is always cleared
            setIsLoading(false);
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

    const handleUpdateProperty = async (propertyId, payload) => {
        const success = await apiUpdateProperty(propertyId, payload);
        // No automatic refresh here to prevent UI jumps. The calling screen handles the local state.
        return success;
    };

    // Global formule save handler with auto-refresh
    const handleFormuleSaved = (formuleData) => {
        // Check if this is a refresh trigger
        if (formuleData && formuleData.__refresh) {
            onRefresh();
            return;
        }
        
        // If a formule was edited and properties were recalculated, refresh the app
        if (formuleData && formuleData.__edited) {
            setTimeout(() => {
                onRefresh();
            }, 1000); // Small delay to ensure backend processing is complete
        }
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

        // No global loader here; screen will show its own skeleton list when isLoading is true

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
                onFormuleSaved={handleFormuleSaved}
                isLoading={isLoading}
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
                        onUpdate={handleUpdateProperty}
                        onTemplateAdded={handleFetchTemplates}
                        onRefresh={onRefresh}
                        onFormuleSaved={handleFormuleSaved}
                        findItemByPath={findItemByPath}
                    />
                );
            case 'materials':
                return (
                    <MaterialsScreen
                        setCurrentScreen={setCurrentScreen}
                        objectsHierarchy={objectsHierarchy}
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