import { ArrowRight, Boxes, Calculator, Filter, GitBranch, LogOut, Menu, Plus, Recycle, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import HierarchicalObjectsSkeletonList from '../../../components/HierarchicalObjectsSkeletonList';
import { fetchFormules as fetchFormulesApi, linkObjects } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddFormuleModal from '../components/modals/AddFormuleModal';
import AddObjectModal from '../components/modals/AddObjectModal';
import FilterModal from '../components/modals/FilterModal';
import FormulePickerModal from '../components/modals/FormulePickerModal';
import { supabase } from '../config/config';

const PropertyButton = ({ onClick }) => (
    <TouchableOpacity onPress={onClick} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
        <Text style={{ color: colors.black, fontWeight: '600' }}>Eigenschappen</Text>
    </TouchableOpacity>
);

// Helper to get material flow context from database value
// Helper to get material flow context from database value
const getMaterialFlowContext = (materialFlowType) => {
    switch (materialFlowType) {
        case 'raw_material':
            return { type: 'raw_material', icon: Recycle, color: colors.blue600, label: 'Raw Material' };
        case 'intermediate':
            return { type: 'intermediate', icon: GitBranch, color: colors.purple600, label: 'Intermediate' };
        case 'component':
            return { type: 'component', icon: ArrowRight, color: colors.lightGray600, label: 'Component' };
        case 'final_product':
            return { type: 'final_product', icon: Plus, color: colors.blue700, label: 'Final Product' };
        case 'default':
        default:
            return { type: 'default', icon: Square, color: colors.lightGray500, label: 'Default' };
    }
};

const HierarchicalObjectsScreen = ({ items, currentLevelPath, setCurrentPath, setCurrentScreen, setSelectedProperty, handleLogout, onRefresh, refreshing, allUsers, userToken, totalObjectCount, filterOption, setFilterOption, onAddObject, objectsHierarchy, onFormuleSaved, isLoading }) => {
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [addModalMode, setAddModalMode] = useState('single'); // 'single' | 'multiple'
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [Formules, setFormules] = useState([]);
    const [showAddFormuleModal, setShowAddFormuleModal] = useState(false);
    const [showFormulePickerModal, setShowFormulePickerModal] = useState(false);
    const [editingFormule, setEditingFormule] = useState(null);
    const [fabMenuOpen, setFabMenuOpen] = useState(false);
    const [showAddChoice, setShowAddChoice] = useState(false);
    const [fabMenuAnimation] = useState(new Animated.Value(0));
    // Track how user navigated into the current level to influence breadcrumb labels
    const selectionContextRef = useRef({ pathKey: '', preferSoloLabel: false });
    // Animated progress bar for object creation
    const [showAddLoading, setShowAddLoading] = useState(false);
    const [addProgress, setAddProgress] = useState(0);
    const lastLoadWasAddRef = useRef(false);
    const progressIntervalRef = useRef(null);
    const wrappedOnAddObject = async (...args) => {
        lastLoadWasAddRef.current = true;
        setShowAddLoading(true);
        setAddProgress(0);
        // Simulate progress bar animation
        progressIntervalRef.current = setInterval(() => {
            setAddProgress((prev) => {
                if (prev < 90) {
                    return prev + 5;
                } else {
                    return prev;
                }
            });
        }, 80);
        await onAddObject(...args);
        // Complete progress
        setAddProgress(100);
        setTimeout(() => {
            setShowAddLoading(false);
            setAddProgress(0);
            lastLoadWasAddRef.current = false;
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        }, 350);
    };
    // Skeleton loader logic: show skeleton when isLoading is true and not adding object
    const showSkeleton = isLoading && !lastLoadWasAddRef.current;

    // Fetch Formules on component mount and set up real-time subscriptions
    useEffect(() => {
        (async () => {
            try {
                const FormulesData = await fetchFormulesApi();
                setFormules(Array.isArray(FormulesData) ? FormulesData : []);
            } catch (error) {
                console.error('Error fetching Formules (mount):', error);
                setFormules([]);
            }
        })();

        // Set up real-time subscriptions
        const objectsSubscription = supabase
            .channel('objects-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'objects' },
                (payload) => {
                    console.log('Object change detected:', payload)
                    if (onRefresh) {
                        onRefresh() // Trigger a refresh of the objects
                    }
                }
            )
            .subscribe()

        const formulesSubscription = supabase
            .channel('formules-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'formules' },
                async (payload) => {
                    console.log('Formula change detected:', payload)
                    // Refresh formulas list
                    try {
                        const FormulesData = await fetchFormulesApi();
                        setFormules(Array.isArray(FormulesData) ? FormulesData : []);
                    } catch (error) {
                        console.error('Error refreshing formulas:', error);
                    }
                }
            )
            .subscribe()

        // Cleanup subscriptions
        return () => {
            objectsSubscription.unsubscribe()
            formulesSubscription.unsubscribe()
        }
    }, [onRefresh]);

    useEffect(() => {
        if (showFormulePickerModal) {
            (async () => {
                try {
                    const FormulesData = await fetchFormulesApi();
                    setFormules(Array.isArray(FormulesData) ? FormulesData : []);
                } catch (e) {
                    console.error('Error refreshing Formules on open:', e);
                }
            })();
        }
    }, [showFormulePickerModal]);

    const handleFormuleSaved = (newFormule) => {
        // Use the global formule handler if provided, otherwise use local logic
        if (onFormuleSaved) {
            onFormuleSaved(newFormule);
        } else {
            // Fallback to local logic if no global handler
            if (newFormule && newFormule.__refresh) {
                if (onRefresh) {
                    onRefresh();
                }
                return;
            }
            
            if (newFormule && newFormule.__edited) {
                setTimeout(() => {
                    if (onRefresh) {
                        onRefresh();
                    }
                }, 1000);
            }
        }
        
        // Always update local formules list
        setFormules(prev => [...prev, newFormule]);
    };

    const handleFormuleSelected = (Formule) => {
        // For now, just close the modal - could be extended to do something with the selected formula
        console.log('Formula selected:', Formule);
    };

    const toggleFabMenu = () => {
        const toValue = fabMenuOpen ? 0 : 1;
        setFabMenuOpen(!fabMenuOpen);
        
        Animated.spring(fabMenuAnimation, {
            toValue,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
        }).start();
    };

    const closeFabMenu = () => {
        setFabMenuOpen(false);
        Animated.spring(fabMenuAnimation, {
            toValue: 0,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
        }).start();
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

    // Helpers to compute grouped breadcrumb labels
    const getChildrenAtPath = (path) => {
        let currentItems = objectsHierarchy;
        if (!Array.isArray(path) || path.length === 0) return currentItems;
        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];
            if (!Array.isArray(currentItems)) return [];
            const item = currentItems.find((it) => it.id === idToFind);
            if (!item) return [];
            currentItems = Array.isArray(item.children) ? item.children : [];
        }
        return currentItems;
    };

    const getGroupLabelForPath = (path) => {
        if (!path || path.length === 0) return 'Objecten';
        const pathKey = path.join('/');
        const parentPath = path.slice(0, -1);
        const lastId = path[path.length - 1];
        const siblings = getChildrenAtPath(parentPath);
        const child = (siblings || []).find((c) => c.id === lastId) || findItemByPath(objectsHierarchy, path);
        if (!child) return 'Onbekend';
        // If user came here via a solo (linked) click, prefer the single name over grouped label
        if (selectionContextRef.current.pathKey === pathKey && selectionContextRef.current.preferSoloLabel) {
            return child.naam;
        }
        if (child.group_key) {
            const members = (siblings || []).filter((c) => c.group_key === child.group_key);
            if (members.length > 1) {
                return members.map((m) => m.naam).join(' + ');
            }
        }
        return child.naam;
    };

    const getBreadcrumbs = () => {
        let breadcrumbs = [{ id: 'root', name: 'Objecten', path: [] }];
        let pathAccumulator = [];
        currentLevelPath.forEach((id) => {
            pathAccumulator.push(id);
            const item = findItemByPath(objectsHierarchy, pathAccumulator);
            if (item) {
                breadcrumbs.push({
                    id: item.id,
                    name: getGroupLabelForPath(pathAccumulator),
                    path: [...pathAccumulator]
                });
            }
        });
        return breadcrumbs;
    };
    const breadcrumbs = getBreadcrumbs();

    return (
        <View style={AppStyles.screen}>
            <StatusBar barStyle="dark-content" />
            {/* Animated progress bar at top for object creation */}
            {showAddLoading && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, height: 4, backgroundColor: colors.lightGray300, borderRadius: 2, opacity: 0.8 }}>
                    <View style={{ height: 4, backgroundColor: colors.blue600, borderRadius: 2, width: `${addProgress}%`, transition: 'width 0.2s linear' }} />
                </View>
            )}
            <View style={AppStyles.header}>
                <View style={AppStyles.headerFlex}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 1 }}>
                        {breadcrumbs.map((crumb, index) => {
                            // ...existing code...
                            const actualItem = crumb.name !== 'Objecten' ? findItemByPath(objectsHierarchy, crumb.path) : null;
                            const flowContext = actualItem ? getMaterialFlowContext(actualItem.material_flow_type || 'default') : null;
                            const showIcon = flowContext && flowContext.icon;
                            return (
                                <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {index > 0 && (
                                        <ArrowRight 
                                            color={flowContext ? flowContext.color : colors.lightGray700} 
                                            size={16} 
                                            style={{ marginHorizontal: 4 }} 
                                        />
                                    )}
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (index !== breadcrumbs.length - 1) {
                                                setCurrentPath(crumb.path);
                                            }
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        {showIcon && (
                                            <flowContext.icon 
                                                color={flowContext.color} 
                                                size={14} 
                                                style={{ marginRight: 4 }} 
                                            />
                                        )}
                                        <Text style={[
                                            AppStyles.headerTitleSmall, 
                                            { color: flowContext ? flowContext.color : colors.lightGray900 }, 
                                            index === breadcrumbs.length - 1 && { fontWeight: 'bold' }
                                        ]}>
                                            {crumb.name}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                    <TouchableOpacity 
                        onPress={() => {
                            console.log('[LogoutButton] Logout button pressed in HierarchicalObjectsScreen');
                            handleLogout();
                        }} 
                        style={{ padding: 8, backgroundColor: 'transparent', borderRadius: 6 }}
                        activeOpacity={0.7}
                    >
                        <LogOut color={colors.blue600} size={24} />
                    </TouchableOpacity>
                </View>
            </View>
            <ScrollView
                style={AppStyles.contentPadding}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
            >
                <View style={AppStyles.cardList}>
                    {/* Loading bar is now fixed at top, not inside scrollable area */}
                    {showSkeleton ? (
                        Platform.OS === 'web' ? (
                            <HierarchicalObjectsSkeletonList />
                        ) : (
                            <View style={{ paddingVertical: 32, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={colors.blue600} />
                                <Text style={{ marginTop: 12, color: colors.lightGray600 }}>Loading…</Text>
                            </View>
                        )
                    ) : items.length > 0 ? (
                        // ...existing code for rendering object cards...
                        (Object.values(
                            (items || []).reduce((acc, it) => {
                                const ik = it.__instanceKey || '';
                                const key = it.group_key ? `grp:${it.group_key}` : `solo:${ik || it.id}`;
                                if (!acc[key]) acc[key] = { group_key: it.group_key || null, items: [] };
                                acc[key].items.push(it);
                                return acc;
                            }, {})
                        )
                            .map((group) => {
                                const times = group.items
                                    .map((it) => new Date(it.created_at || it.updated_at || Date.now()).getTime())
                                    .filter((t) => Number.isFinite(t));
                                const sortKey = times.length ? Math.min(...times) : Number.MAX_SAFE_INTEGER;
                                return { ...group, sortKey };
                            })
                            .sort((a, b) => a.sortKey - b.sortKey)
                        ).flatMap((group) => {
                            // ...existing code for rendering each group/card...
                            const anchorId = group.items[0]?.id;
                            const pathKey = (currentLevelPath && currentLevelPath.length) ? currentLevelPath.join('/') : 'root';
                            const isGrouped = !!group.group_key && group.items.length > 1;
                            if (isGrouped) {
                                // ...existing code for grouped cards...
                                const anchor = group.items[0];
                                const anchorTotalProperties = (anchor.properties || []).length;
                                const anchorTotalChildren = (anchor.children || []).length;
                                const anchorOwner = anchor.owner_name || 'Unknown';
                                return [
                                    (
                                        <View
                                            key={`${pathKey}-group-sep-top-${group.group_key}`}
                                            style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }}
                                        />
                                    ),
                                    ...group.items.map((it, idx) => {
                                        const title = it.naam;
                                        const totalProperties = anchorTotalProperties;
                                        const totalChildren = anchorTotalChildren;
                                        const owner = anchorOwner;
                                        const flowContext = getMaterialFlowContext(it.material_flow_type || 'default');
                                        const FlowIcon = flowContext.icon;
                                        return (
                                            <TouchableOpacity
                                                key={`${pathKey}-group-${group.group_key}-${it.__instanceKey || it.id}-${idx}`}
                                                style={[AppStyles.card, AppStyles.cardGroupMember]}
                                                onPress={() => {
                                                    const nextPath = [...currentLevelPath, anchorId];
                                                    selectionContextRef.current = { pathKey: nextPath.join('/'), preferSoloLabel: false };
                                                    setCurrentPath(nextPath);
                                                }}
                                            >
                                                <View style={AppStyles.cardFlex}>
                                                    {/* Material Flow Indicator */}
                                                    {FlowIcon && (
                                                        <View style={{ alignItems: 'center', marginRight: 12, minWidth: 40 }}>
                                                            <FlowIcon color={flowContext.color} size={24} />
                                                            {flowContext.label && (
                                                                <Text style={{ 
                                                                    fontSize: 10, 
                                                                    color: flowContext.color, 
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    marginTop: 2
                                                                }}>
                                                                    {flowContext.label}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    )}
                                                    <View style={AppStyles.cardContent}>
                                                        <Text style={AppStyles.cardTitle}>{title}</Text>
                                                        <Text style={AppStyles.cardSubtitle}>Maker: {owner}</Text>
                                                        <Text style={AppStyles.cardSubtitle}>
                                                            {totalProperties} eigenschap{totalProperties !== 1 ? 'pen' : ''}
                                                            {totalChildren > 0 ? ` - ${totalChildren} sub-item(s)` : ''}
                                                        </Text>
                                                    </View>
                                                    <View style={{ width: 1, backgroundColor: colors.lightGray500, marginHorizontal: 10, alignSelf: 'stretch' }} />
                                                    <PropertyButton onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedProperty(anchorId);
                                                        setCurrentScreen('properties');
                                                    }} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }),
                                    (
                                        <View
                                            key={`${pathKey}-group-sep-bottom-${group.group_key}`}
                                            style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }}
                                        />
                                    )
                                ];
                            }
                            // ...existing code for solo cards...
                            const primary = group.items[0];
                            const title = primary.naam;
                            const totalProperties = (primary.properties || []).length;
                            const totalChildren = (primary.children || []).length;
                            const owner = primary.owner_name || 'Unknown';
                            const flowContext = getMaterialFlowContext(primary.material_flow_type || 'default');
                            const FlowIcon = flowContext.icon;
                            return [
                                (
                                    <TouchableOpacity
                                        key={`${pathKey}-solo-${primary.__instanceKey || primary.id}`}
                                        style={AppStyles.card}
                                        onPress={() => {
                                            const nextPath = [...currentLevelPath, primary.id];
                                            selectionContextRef.current = { pathKey: nextPath.join('/'), preferSoloLabel: true };
                                            setCurrentPath(nextPath);
                                        }}
                                    >
                                        <View style={AppStyles.cardFlex}>
                                            {/* Material Flow Indicator */}
                                            {FlowIcon && (
                                                <View style={{ alignItems: 'center', marginRight: 12, minWidth: 40 }}>
                                                    <FlowIcon color={flowContext.color} size={24} />
                                                    {flowContext.label && (
                                                        <Text style={{ 
                                                            fontSize: 10, 
                                                            color: flowContext.color, 
                                                            fontWeight: '600',
                                                            textAlign: 'center',
                                                            marginTop: 2
                                                        }}>
                                                            {flowContext.label}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            <View style={AppStyles.cardContent}>
                                                <Text style={AppStyles.cardTitle}>{title}</Text>
                                                <Text style={AppStyles.cardSubtitle}>Maker: {owner}</Text>
                                                <Text style={AppStyles.cardSubtitle}>
                                                    {totalProperties} eigenschap{totalProperties !== 1 ? 'pen' : ''}
                                                    {totalChildren > 0 ? ` - ${totalChildren} sub-item(s)` : ''}
                                                </Text>
                                            </View>
                                            <View style={{ width: 1, backgroundColor: colors.lightGray500, marginHorizontal: 10, alignSelf: 'stretch' }} />
                                            <PropertyButton onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedProperty(primary.id);
                                                setCurrentScreen('properties');
                                            }} />
                                        </View>
                                    </TouchableOpacity>
                                ),
                            ];
                        })
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
            
            {/* FAB Menu Overlay */}
            {fabMenuOpen && (
                <TouchableOpacity 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                    }}
                    onPress={closeFabMenu}
                    activeOpacity={1}
                />
            )}
            
            {/* Filter Button */}
            <Animated.View
                style={[
                    AppStyles.filterFab,
                    { 
                        bottom: 200,
                        transform: [
                            {
                                translateY: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [171, 0],
                                })
                            },
                            {
                                scale: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                })
                            }
                        ],
                        opacity: fabMenuAnimation
                    }
                ]}
                pointerEvents={fabMenuOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity 
                    onPress={() => {
                        closeFabMenu();
                        setShowFilterModal(true);
                    }} 
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Filter color={colors.blue600} size={24} />
                </TouchableOpacity>
            </Animated.View>
            
            {/* Formula Button */}
            <Animated.View
                style={[
                    AppStyles.filterFab,
                    { 
                        bottom: 143,
                        transform: [
                            {
                                translateY: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [114, 0],
                                })
                            },
                            {
                                scale: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                })
                            }
                        ],
                        opacity: fabMenuAnimation
                    }
                ]}
                pointerEvents={fabMenuOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity 
                    onPress={() => {
                        closeFabMenu();
                        setShowFormulePickerModal(true);
                    }} 
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Calculator color={colors.blue600} size={24} />
                </TouchableOpacity>
            </Animated.View>

            {/* Main Menu FAB */}
            <Animated.View
                style={[
                    AppStyles.filterFab,
                    { 
                        bottom: 86,
                        transform: [
                            {
                                rotate: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '45deg'],
                                })
                            }
                        ]
                    }
                ]}
            >
                <TouchableOpacity 
                    onPress={toggleFabMenu}
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Menu color={colors.blue600} size={24} />
                </TouchableOpacity>
            </Animated.View>

            {/* Main FAB: Prompt for single vs multiple */}
            <TouchableOpacity onPress={() => setShowAddChoice(true)} style={AppStyles.fab}>
                <Plus color="white" size={24} />
            </TouchableOpacity>


            {/* Add choice modal */}
            <Modal
                transparent
                visible={showAddChoice}
                onRequestClose={() => setShowAddChoice(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowAddChoice(false)}
                    style={AppStyles.modalOverlay}
                >
                    <View style={[AppStyles.modalContainer, { paddingVertical: 16, paddingHorizontal: 16, maxWidth: 480, width: '90%' }]}>
                        <Text style={AppStyles.modalTitle}>Toevoegen</Text>
                        <Text style={{ color: colors.lightGray600, marginTop: 4, textAlign: 'center' }}>Kies wat je wilt doen</Text>
                        <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => { setShowAddChoice(false); setAddModalMode('single'); setShowAddObjectModal(true); }}
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 20,
                                    paddingHorizontal: 12,
                                    backgroundColor: 'white',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.lightGray300,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.08,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 2,
                                }}
                            >
                                <Plus color={colors.blue600} size={28} />
                                <Text style={[AppStyles.headerTitleSmall, { color: colors.lightGray900, fontWeight: '700', marginTop: 8, textAlign: 'center' }]}>Single object</Text>
                                <Text style={{ color: colors.lightGray600, marginTop: 4, fontSize: 12, textAlign: 'center' }}>Voeg één object toe</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => { setShowAddChoice(false); setAddModalMode('multiple'); setShowAddObjectModal(true); }}
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 20,
                                    paddingHorizontal: 12,
                                    backgroundColor: 'white',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.lightGray300,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.08,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 2,
                                }}
                            >
                                <Boxes color={colors.blue600} size={28} />
                                <Text style={[AppStyles.headerTitleSmall, { color: colors.lightGray900, fontWeight: '700', marginTop: 8, textAlign: 'center' }]}>Multiple objects</Text>
                                <Text style={{ color: colors.lightGray600, marginTop: 4, fontSize: 12, textAlign: 'center' }}>Voeg meerdere namen toe</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[AppStyles.modalActions, { marginTop: 16, justifyContent: 'flex-end' }]}>
                            <TouchableOpacity onPress={() => setShowAddChoice(false)} style={AppStyles.btnSecondary}>
                                <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            

            {showAddObjectModal && (
                <AddObjectModal
                    visible={showAddObjectModal}
                    mode={addModalMode}
                    onClose={() => setShowAddObjectModal(false)}
                    onSave={(payload) => {
                        const data = (payload && typeof payload === 'object' && !Array.isArray(payload))
                            ? payload
                            : (Array.isArray(payload) ? { names: payload } : { name: payload });
                        return wrappedOnAddObject(currentLevelPath, data);
                    }}
                    objectsHierarchy={objectsHierarchy}
                    excludeIds={currentLevelPath}
                    onAttachExisting={async (payload) => {
                        try {
                            const isObj = payload && typeof payload === 'object' && !Array.isArray(payload);
                            const ids = isObj ? payload.ids : payload;
                            const deferClose = isObj ? !!payload.deferClose : false;
                            const groupKey = isObj ? payload.groupKey || null : null;
                            // Reuse the same objects by linking them to the current parent (no duplication)
                            const parentId = currentLevelPath.length > 0 ? currentLevelPath[currentLevelPath.length - 1] : null;
                            console.log('[AttachExisting] selected ids', ids, 'parentId', parentId);
                            // Allow root-level linking (parentId null); only filter self-link if there is a parent
                            const filtered = (ids || []).filter((id) => (parentId == null ? true : id !== parentId));
                            if (filtered.length === 0) {
                                Alert.alert('Geen actie', 'Je kunt een object niet aan zichzelf koppelen. Kies een ander object.');
                                console.warn('[AttachExisting] nothing to link after filtering self');
                                return;
                            }
                            lastLoadWasAddRef.current = true;
                            const linkRes = await linkObjects({ parentId, childIds: filtered, groupKey });
                            lastLoadWasAddRef.current = false;
                            console.log('[AttachExisting] link result', linkRes);
                            if (!linkRes.success) {
                                if (linkRes.message === 'object_links_missing') {
                                    // Do not duplicate; inform user to set up linking table
                                    console.warn('[AttachExisting] object_links table missing - cannot link without duplication');
                                    throw new Error('Linking is not set up yet. Please run the SQL to create object_links.');
                                } else {
                                    throw new Error(linkRes.message || 'Linking failed');
                                }
                            }
                            if (onRefresh) onRefresh();
                            if (!deferClose) {
                                Alert.alert('Gelinkt', parentId == null ? 'Object succesvol aan de hoofdniveau gekoppeld.' : 'Object succesvol gekoppeld.');
                                setShowAddObjectModal(false);
                            }
                        } catch (e) {
                            lastLoadWasAddRef.current = false;
                            console.error('[AttachExisting] Failed', e);
                            Alert.alert('Fout', e.message || 'Koppelen mislukt');
                        }
                    }}
                />
            )}
            {showFilterModal && <FilterModal visible={showFilterModal} onClose={() => setShowFilterModal(false)} allUsers={allUsers} userToken={userToken} totalObjectCount={totalObjectCount} onSelectFilter={setFilterOption} />}
            
            <AddFormuleModal
                visible={showAddFormuleModal}
                onClose={() => {
                    const wasEditing = !!editingFormule;
                    setShowAddFormuleModal(false);
                    setEditingFormule(null);
                    // If user was editing and chose Annuleer, return to Formule picker
                    if (wasEditing) {
                        setTimeout(() => setShowFormulePickerModal(true), 0);
                    }
                }}
                onSave={handleFormuleSaved}
                editingFormule={editingFormule}
                onDelete={(deleted) => {
                    console.log('[HierarchicalObjectsScreen] onDelete callback called with:', deleted);
                    if (deleted.__deleted) {
                        console.log('[HierarchicalObjectsScreen] Processing delete for id:', deleted.id);
                        setFormules(prev => {
                            const filtered = prev.filter(f => f.id !== deleted.id);
                            console.log('[HierarchicalObjectsScreen] Formules before filter:', prev.length, 'after filter:', filtered.length);
                            return filtered;
                        });
                        // Refetch from backend to ensure sync (in case of race conditions)
                        (async () => {
                            try {
                                console.log('[HierarchicalObjectsScreen] Refetching Formules from API');
                                const fresh = await fetchFormulesApi();
                                if (Array.isArray(fresh)) {
                                    console.log('[HierarchicalObjectsScreen] Refetch successful, got', fresh.length, 'Formules');
                                    setFormules(fresh);
                                } else {
                                    console.log('[HierarchicalObjectsScreen] Refetch returned non-array:', fresh);
                                }
                            } catch (e) {
                                console.log('[HierarchicalObjectsScreen] Refetch after delete failed', e);
                            }
                        })();
                    } else {
                        console.log('[HierarchicalObjectsScreen] Delete callback called but __deleted flag is false');
                    }
                }}
            />
            <FormulePickerModal
                visible={showFormulePickerModal}
                onClose={() => setShowFormulePickerModal(false)}
                Formules={Formules}
                onSelectFormule={handleFormuleSelected}
                onEditFormule={(Formule) => {
                    setShowFormulePickerModal(false);
                    setEditingFormule(Formule);
                    setTimeout(() => setShowAddFormuleModal(true), 0);
                }}
                onAddFormule={() => {
                    setShowFormulePickerModal(false);
                    setTimeout(() => setShowAddFormuleModal(true), 0);
                }}
            />

        </View>
    );
};

export default HierarchicalObjectsScreen;
