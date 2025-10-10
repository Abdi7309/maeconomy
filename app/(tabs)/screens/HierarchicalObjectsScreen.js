import { Calculator, ChevronRight, Filter, LogOut, Menu, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { fetchFormules as fetchFormulesApi } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddFormuleModal from '../components/modals/AddFormuleModal';
import AddObjectModal from '../components/modals/AddObjectModal';
import FilterModal from '../components/modals/FilterModal';
import FormulePickerModal from '../components/modals/FormulePickerModal';
import { supabase } from '../config/config';

const PropertyButton = ({ onClick }) => (
    <TouchableOpacity onPress={onClick} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Eigenschappen</Text>
    </TouchableOpacity>
);

const HierarchicalObjectsScreen = ({ items, currentLevelPath, setCurrentPath, setCurrentScreen, setSelectedProperty, handleLogout, onRefresh, refreshing, allUsers, userToken, totalObjectCount, filterOption, setFilterOption, onAddObject, objectsHierarchy, onFormuleSaved }) => {
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [Formules, setFormules] = useState([]);
    const [showAddFormuleModal, setShowAddFormuleModal] = useState(false);
    const [showFormulePickerModal, setShowFormulePickerModal] = useState(false);
    const [editingFormule, setEditingFormule] = useState(null);
    const [fabMenuOpen, setFabMenuOpen] = useState(false);
    const [fabMenuAnimation] = useState(new Animated.Value(0));

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

    const getBreadcrumbs = () => {
        let breadcrumbs = [{ id: 'root', name: 'Objecten', path: [] }];
        let pathAccumulator = [];
        currentLevelPath.forEach((id) => {
            pathAccumulator.push(id);
            const item = findItemByPath(objectsHierarchy, pathAccumulator);
            if (item) {
                breadcrumbs.push({
                    id: item.id,
                    name: item.naam,
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
                        <LogOut color={colors.blue600} size={24} />
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
                                    setCurrentPath([...currentLevelPath, item.id]);
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
                                    <View style={{ width: 1, backgroundColor: colors.lightGray500, marginHorizontal: 10, alignSelf: 'stretch' }} />
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

            <TouchableOpacity onPress={() => setShowAddObjectModal(true)} style={AppStyles.fab}>
                <Plus color="white" size={24} />
            </TouchableOpacity>

            {showAddObjectModal && <AddObjectModal visible={showAddObjectModal} onClose={() => setShowAddObjectModal(false)} onSave={(name) => onAddObject(currentLevelPath, { name })} />}
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
