import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import {
    handleAddObject as apiAddObject,
    addProperties as apiAddProperties,
    fetchAndSetAllObjects as apiFetchObjects,
    fetchTemplates as apiFetchTemplates,
    updateProperty as apiUpdateProperty,
    fetchAllUsers,
} from './api';
import AppStyles, { colors } from './AppStyles';
import { auth, db } from './config/firebase';
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
    // Persistent store for active temp objects across screen transitions (e.g. objects -> properties -> objects)
    const activeTempObjectsRef = useRef([]);

    // Initialize app state and listen for Firebase auth state
    useEffect(() => {
        let firstRun = true;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    // Firebase user is signed in
                    setSession(user);
                    setCurrentUser(user);
                    setUserToken(user.uid);
                    setCurrentView('app');
                    setFilterOption('all');
                    console.log('[Auth] Firebase user signed in:', user.email);

                    // 1. Special migration for your specific account (Old ID -> New Auth UID)
                    if (user.uid === 'U9WVtQJVuyas0L9W9u7uv6vF9Cv1') {
                        try {
                            const oldProfileRef = doc(db, 'profiles', '2d2ba66c-6a65-4ba2-92e0-bccaece24809');
                            const oldProfileSnap = await getDoc(oldProfileRef);
                            
                            if (oldProfileSnap.exists()) {
                                const oldData = oldProfileSnap.data();
                                const currentProfileRef = doc(db, 'profiles', user.uid);
                                
                                // Always update/overwrite with old profile data to ensure it's correct
                                await setDoc(currentProfileRef, {
                                    email: user.email,
                                    username: oldData.username || user.email.split('@')[0],
                                    full_name: oldData.full_name || '',
                                    updated_at: serverTimestamp()
                                }, { merge: true });
                                console.log('[Auth] Migrated old profile data to new UID');
                            }
                        } catch (err) {
                            console.warn('[Auth] Migration error:', err);
                        }
                    }

                    // 2. Standard check: Ensure profile exists for any user
                    try {
                        const profileRef = doc(db, 'profiles', user.uid);
                        const profileSnap = await getDoc(profileRef);
                        if (!profileSnap.exists()) {
                            console.log('[Auth] Profile missing for UID, creating new one...');
                            await setDoc(profileRef, {
                                email: user.email,
                                username: user.displayName || user.email.split('@')[0],
                                created_at: serverTimestamp(),
                                updated_at: serverTimestamp()
                            });
                            console.log('[Auth] Created missing profile for', user.uid);
                        }
                    } catch (profileErr) {
                        console.warn('[Auth] Failed to check/create profile:', profileErr);
                    }
                } else {
                    // Signed out
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
                    console.log('[Auth] No Firebase user');
                }
            } catch (e) {
                console.error('[Auth] onAuthStateChanged handler error:', e);
            } finally {
                // Ensure initial loading state is cleared after first callback
                if (firstRun) {
                    setIsAppLoading(false);
                    firstRun = false;
                }
            }
        });

        return () => unsubscribe();
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
        try {
            await signInWithEmailAndPassword(auth, email, password);
            console.log('[handleLogin] Firebase sign-in successful for:', email);
            // onAuthStateChanged will update app state
        } catch (err) {
            console.error('[handleLogin] Firebase sign-in error:', err);
            setAuthError(err?.message || 'An error occurred during login.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRegister = async (email, password, username) => {
        setIsLoading(true);
        setAuthError('');
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            // Create a minimal profile document in Firestore
            try {
                await setDoc(doc(db, 'profiles', uid), {
                    email,
                    username: username || null,
                    created_at: serverTimestamp()
                });
                console.log('[handleRegister] Created profile for', uid);
            } catch (profileErr) {
                console.warn('[handleRegister] Failed to create profile doc:', profileErr);
            }

            Alert.alert('Registration Successful', 'Account created successfully!');
            // onAuthStateChanged will update the app state
        } catch (err) {
            console.error('[handleRegister] Firebase sign-up error:', err);
            setAuthError(err?.message || 'An error occurred during registration.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            console.log('[handleLogout] Logout button pressed');
            setIsLoading(true);

            // Clear local state immediately for better UX
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

            // Sign out from Firebase
            await signOut(auth);
            console.log('[handleLogout] Firebase sign-out successful');
        } catch (error) {
            console.error('[handleLogout] Error during logout:', error);
        } finally {
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

    const clearCachedData = async (type) => {
        try {
            const cacheKey = getCacheKey(type);
            await AsyncStorage.removeItem(cacheKey);
            console.log(`[Cache] Cleared ${type}`);
        } catch (e) {
            console.warn(`[Cache] Error clearing ${type}:`, e);
        }
    };

    const handleFetchObjects = async (isRefreshing = false) => {
        if (!filterOption) return;
        if(isRefreshing) {
            setRefreshing(true);
            // Force clear cache to ensure we don't have any stale state
            await clearCachedData('objects');
        }
        else setIsLoading(true);

        try {
            // Load from cache first (if not refreshing)
            if (!isRefreshing) {
                const cached = await getCachedData('objects');
                if (cached) {
                    console.log('[handleFetchObjects] Using cached objects');
                    setObjectsHierarchy(cached);
                    setIsLoading(false);
                    // Do NOT return here. Continue to fetch fresh data in background (stale-while-revalidate)
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
            // Force refresh to get the new object and any other updates
            await handleFetchObjects(true);
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
            await handleFetchObjects(true);
        }
        return success;
    };

    const handleUpdateProperty = async (propertyId, payload) => {
        // We don't have the objectId here easily to update local state deeply, 
        // but we can try to find it or just rely on the refresh.
        // However, to fix the "stale data on back navigation" issue, we should try to update local state if possible.
        // Since we don't have the objectId passed to this function, we'll rely on the global cache mechanism 
        // which we improved in AddPropertyScreen/PropertiesScreen.
        
        // But wait, AddPropertyScreen calls this. It knows the objectId.
        // Let's update the signature if we can, but for now let's just do the API call.
        
        // Actually, AddPropertyScreen calls onUpdate={handleUpdateProperty}.
        // Let's check AddPropertyScreen usage.
        // It calls props.onUpdate(property.id, payload).
        
        const success = await apiUpdateProperty(propertyId, payload);

        if (success) {
            // Cache ongeldig maken zodat een refresh nieuwe data uit Supabase haalt
            await clearCachedData('objects');
            
            // Trigger a background refresh to keep UI in sync eventually
            // handleFetchObjects(true); // Don't await to keep UI responsive? 
            // No, that might cause a flicker.
        }
        return success;
    };

    // New handler to update local state from AddPropertyScreen
    const handleLocalPropertyUpdate = (objectId, updatedProperty) => {
        console.log('[index.js] handleLocalPropertyUpdate', objectId, updatedProperty.name);
        
        // Helper to recursively update the object hierarchy
        const updateHierarchy = (items) => {
            return items.map(item => {
                if (item.id === objectId) {
                    // Found the object, update its properties
                    let newProps = item.properties || [];
                    // Check if property exists
                    const exists = newProps.find(p => p.id === updatedProperty.id || (p.name === updatedProperty.name && String(p.id).startsWith('temp_')));
                    
                    if (exists) {
                        newProps = newProps.map(p => {
                            if (p.id === updatedProperty.id || (p.name === updatedProperty.name && String(p.id).startsWith('temp_'))) {
                                return { ...p, ...updatedProperty };
                            }
                            return p;
                        });
                    } else {
                        // Add if not exists (shouldn't happen for update, but safe)
                        newProps = [...newProps, updatedProperty];
                    }
                    return { ...item, properties: newProps };
                }
                // Check children
                if (item.children) {
                    return { ...item, children: updateHierarchy(item.children) };
                }
                return item;
            });
        };

        setObjectsHierarchy(prev => updateHierarchy(prev));
        
        // Also update activeTempObjects if needed
        if (activeTempObjectsRef.current) {
            activeTempObjectsRef.current = activeTempObjectsRef.current.map(item => {
                if (item.id === objectId) {
                    let newProps = item.properties || [];
                    const exists = newProps.find(p => p.id === updatedProperty.id || (p.name === updatedProperty.name && String(p.id).startsWith('temp_')));
                    if (exists) {
                        newProps = newProps.map(p => {
                            if (p.id === updatedProperty.id || (p.name === updatedProperty.name && String(p.id).startsWith('temp_'))) {
                                return { ...p, ...updatedProperty };
                            }
                            return p;
                        });
                    } else {
                        newProps = [...newProps, updatedProperty];
                    }
                    return { ...item, properties: newProps };
                }
                return item;
            });
        }
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
                activeTempObjectsRef={activeTempObjectsRef}
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
                        activeTempObjects={activeTempObjectsRef.current}
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
                        onLocalUpdate={handleLocalPropertyUpdate}
                        onTemplateAdded={handleFetchTemplates}
                        onRefresh={onRefresh}
                        onFormuleSaved={handleFormuleSaved}
                        findItemByPath={findItemByPath}
                        activeTempObjects={activeTempObjectsRef.current}
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