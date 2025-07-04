import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { ChevronLeft, Plus, Tag } from 'lucide-react-native';
import AppStyles, { colors } from '../AppStyles';

const PropertiesScreen = ({ currentPath, objectsHierarchy, setCurrentScreen, onRefresh, refreshing }) => {
    
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

    const item = findItemByPath(objectsHierarchy, currentPath);

    if (!item) {
        return <View style={[AppStyles.screen, { justifyContent: 'center', alignItems: 'center' }]}><Text style={AppStyles.emptyStateText}>Item not found...</Text></View>;
    }

    const renderIcon = (customColor = colors.lightGray500) => {
        return <Tag color={customColor} size={20} />;
    };

    return (
        <View style={[AppStyles.screen, { flex: 1 }]}>
            <StatusBar barStyle="dark-content" />
            <View style={AppStyles.header}>
                <View style={AppStyles.headerFlex}>
                    <TouchableOpacity onPress={() => setCurrentScreen('objects')} style={AppStyles.headerBackButton}>
                        <ChevronLeft color={colors.lightGray700} size={24} />
                    </TouchableOpacity>
                    <Text style={AppStyles.headerTitleLg}>Eigenschappen</Text>
                    <View style={AppStyles.headerPlaceholder} />
                </View>
            </View>
            <View style={{ backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
                <Text style={AppStyles.detailName}>{item.naam}</Text>
                <Text style={AppStyles.detailSubtitle}>{(item.properties || []).length} eigenschap{(item.properties || []).length !== 1 ? 'pen' : ''}</Text>
            </View>
            <ScrollView style={AppStyles.contentPadding} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}>
                <View style={AppStyles.propertyList}>
                    {(item.properties && item.properties.length > 0) ? (
                        item.properties.map((prop, index) => (
                            <View key={index} style={AppStyles.propertyItem}>
                                <View style={AppStyles.propertyItemMain}>{renderIcon()}<Text style={AppStyles.propertyName}>{prop.name}</Text></View>
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

export default PropertiesScreen;

