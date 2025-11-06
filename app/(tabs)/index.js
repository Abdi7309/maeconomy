import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    // Allow navigating into temp object properties immediately
    const [selectedTempItem, setSelectedTempItem] = useState(null); // { id, naam, group_key? }
    // Queue properties for temp objects until DB id is known
    const [pendingPropsByTempId, setPendingPropsByTempId] = useState({}); // tempId -> properties array
    // Use useRef to ensure we always read the latest queued properties in async callbacks
    const pendingPropsRef = useRef({});

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
            // Try cache first (users don't change as often)
            const cached = await getCachedData('users');
            if (cached) {
                console.log('[handleFetchUsers] Using cached users');
                setAllUsers(cached.users);
                setTotalObjectCount(cached.totalObjectCount);
                return;
            }

            // Fetch fresh data
            const data = await fetchAllUsers();
            if (data) {
                setAllUsers(data.users);
                setTotalObjectCount(data.totalObjectCount);
                await setCachedData('users', data);
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

    // ===== PERFORMANCE: Caching helpers =====
    const getCacheKey = (type) => `cache_${userToken}_${type}`;
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
    
    const getCachedData = async (type) => {
        try {
            const cacheKey = getCacheKey(type);
            const cached = await AsyncStorage.getItem(cacheKey);
            if (!cached) return null;
            
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            // Return cache if less than 10 minutes old
            if (age < CACHE_DURATION) {
                console.log(`[Cache] Hit for ${type}, age: ${Math.round(age / 1000)}s`);
                return data;
            }
            
            // Cache expired
            console.log(`[Cache] Expired for ${type}, age: ${Math.round(age / 1000)}s`);
            return null;
        } catch (e) {
            console.warn(`[Cache] Error reading ${type}:`, e);
            return null;
        }
    };
    
    const setCachedData = async (type, data) => {
        try {
            const cacheKey = getCacheKey(type);
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
            console.log(`[Cache] Saved ${type}`);
        } catch (e) {
            console.warn(`[Cache] Error saving ${type}:`, e);
        }
    };

    const handleFetchObjects = async (isRefreshing = false) => {
        if (!filterOption) return;
        if(isRefreshing) setRefreshing(true);
        else setIsLoading(true);

        try {
            // Load from cache first (if not refreshing)
            if (!isRefreshing) {
                const cached = await getCachedData('objects');
                if (cached) {
                    console.log('[handleFetchObjects] Using cached objects');
                    setObjectsHierarchy(cached);
                    setIsLoading(false);
                    return;
                }
            }

            // Fetch fresh data
            const data = await apiFetchObjects('all');
            if(data) {
                setObjectsHierarchy(data);
                // Cache the fresh data
                await setCachedData('objects', data);
            }
        } finally {
            if(isRefreshing) setRefreshing(false);
            else setIsLoading(false);
        }
    };

    const handleFetchTemplates = async () => {
        try {
            // Try cache first
            const cached = await getCachedData('templates');
            if (cached) {
                console.log('[handleFetchTemplates] Using cached templates');
                setFetchedTemplates(cached);
                return;
            }

            // Fetch fresh data
            const data = await apiFetchTemplates();
            if(data) {
                setFetchedTemplates(data);
                await setCachedData('templates', data);
            }
        } catch (e) {
            console.error('[handleFetchTemplates] Error:', e);
        }
    };

    const onRefresh = async () => {
        // Ensure we wait for all refresh tasks to complete so callers can await onRefresh()
        await Promise.all([
            handleFetchObjects(true),
            handleFetchTemplates(),
            handleFetchUsers(),
        ]).catch((e) => console.warn('[onRefresh] One or more refresh tasks failed', e));
    };



    const handleAddObject = async (parentPath, newObjectData) => {
        const res = await apiAddObject(parentPath, newObjectData, userToken);
        if (res && res.success) {
            await handleFetchObjects();
            await handleFetchUsers();
        }
        return res;
    };

    const handleAddProperties = async (objectId, properties) => {
        // If object is still optimistic (temp_), queue the properties and return success immediately
        if (typeof objectId === 'string' && objectId.startsWith('temp_')) {
            setPendingPropsByTempId((prev) => ({
                ...prev,
                [objectId]: [...(prev[objectId] || []), ...properties],
            }));
            // Also update the ref so async callbacks can access it
            pendingPropsRef.current = {
                ...pendingPropsRef.current,
                [objectId]: [...(pendingPropsRef.current[objectId] || []), ...properties],
            };
            console.log('[handleAddProperties] Queued properties for temp object', objectId, properties.length);
            console.log('[handleAddProperties] Queued properties ref now:', pendingPropsRef.current);
            return true;
        }
        // Otherwise, persist to DB now
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

    // Resolve callback from objects list when a temp object is matched with a DB object
    const handleTempObjectResolved = async (tempId, dbId) => {
        try {
            // Read from ref instead of state to avoid stale closure issues
            const queued = pendingPropsRef.current[tempId];
            console.log('[App] handleTempObjectResolved called', { tempId, dbId, queuedCount: queued?.length || 0 });
            console.log('[App] pendingPropsRef.current:', pendingPropsRef.current);
            if (queued && queued.length) {
                console.log('[App] Flushing queued properties for', tempId, '=>', dbId, queued.length);
                console.log('[App] Queued properties:', queued);
                const ok = await apiAddProperties(dbId, queued);
                console.log('[App] apiAddProperties result:', ok);
                if (ok) {
                    // Clear from both state and ref
                    setPendingPropsByTempId((prev) => {
                        const copy = { ...prev };
                        delete copy[tempId];
                        return copy;
                    });
                    delete pendingPropsRef.current[tempId];
                    // Update the object hierarchy with the new properties (silent update, no skeleton)
                    console.log('[App] Updating object hierarchy with new properties');
                    setObjectsHierarchy((prev) => {
                        const updateObjectProps = (items) => {
                            return (items || []).map((item) => {
                                if (item.id === dbId) {
                                    // Add the new properties to this object
                                    return {
                                        ...item,
                                        properties: [...(item.properties || []), ...queued],
                                    };
                                }
                                // Recursively update children
                                if (item.children && item.children.length) {
                                    return {
                                        ...item,
                                        children: updateObjectProps(item.children),
                                    };
                                }
                                return item;
                            });
                        };
                        return updateObjectProps(prev);
                    });
                }
            }
            // If the user is currently viewing the temp object, switch selection to the real object id
            console.log('[App] Switching selectedProperty from', tempId, 'to', dbId);
            setSelectedProperty((prev) => (prev === tempId ? dbId : prev));
        } catch (e) {
            console.warn('[App] Failed to flush queued properties', e);
        }
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
                setSelectedTempItem={setSelectedTempItem}
                onTempObjectResolved={handleTempObjectResolved}
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
                        fallbackTempItem={selectedTempItem}
                        setCurrentScreen={setCurrentScreen}
                        onRefresh={onRefresh}
                        refreshing={refreshing}
                        findItemByPath={findItemByPath}
                    />

                );
            case 'addProperty':
                return (
                    <AddPropertyScreen 
                        fallbackTempItem={selectedTempItem}
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
                // Materials screen not implemented/available
                return objectsScreen;
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