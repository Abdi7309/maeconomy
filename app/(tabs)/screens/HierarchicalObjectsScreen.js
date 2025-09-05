import { ChevronRight, Filter, LogOut, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../AppStyles';
import AddObjectModal from '../components/modals/AddObjectModal';
import FilterModal from '../components/modals/FilterModal';

const PropertyButton = ({ onClick }) => (
    <TouchableOpacity onPress={onClick} style={AppStyles.btnPropertyChevron}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={AppStyles.btnPropertyChevronText}>Eigenschappen</Text>
            <ChevronRight color={colors.lightGray400} size={16} />
        </View>
    </TouchableOpacity>
);

const HierarchicalObjectsScreen = ({ items, currentLevelPath, setCurrentPath, setCurrentScreen, setSelectedProperty, handleLogout, onRefresh, refreshing, allUsers, userToken, totalObjectCount, filterOption, setFilterOption, onAddObject, objectsHierarchy }) => {
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

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

            {showAddObjectModal && <AddObjectModal visible={showAddObjectModal} onClose={() => setShowAddObjectModal(false)} onSave={(name) => onAddObject(currentLevelPath, { name })} />}
            {showFilterModal && <FilterModal visible={showFilterModal} onClose={() => setShowFilterModal(false)} allUsers={allUsers} userToken={userToken} totalObjectCount={totalObjectCount} onSelectFilter={setFilterOption} />}

        </View>
    );
};

export default HierarchicalObjectsScreen;
