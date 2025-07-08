import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StatusBar, Linking, Modal, Image } from 'react-native';
import { ChevronLeft, Plus, Tag, Paperclip, File, FileImage, FileText, X } from 'lucide-react-native';
import AppStyles, { colors } from '../AppStyles';
import CONFIG from '../config/config';

const PropertiesScreen = ({ currentPath, objectsHierarchy, setCurrentScreen, onRefresh, refreshing }) => {
    
    // --- NEW: State for the image modal ---
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);

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
    
    const getFileIcon = (fileType) => {
        if (fileType) {
            if (fileType.startsWith('image/')) {
                return <FileImage size={24} color={colors.purple600} />;
            }
            if (fileType === 'application/pdf') {
                return <FileText size={24} color={colors.red600} />;
            }
        }
        return <File size={24} color={colors.lightGray600} />;
    };

    // --- NEW: Function to handle opening a file ---
    const handleOpenFile = (file) => {
        const apiUrl = CONFIG.API_BASE_URL;
        const baseApiUrl = apiUrl.substring(0, apiUrl.lastIndexOf('/'));
        const fileUrl = `${baseApiUrl}/${file.file_path}`;

        if (file.file_type && file.file_type.startsWith('image/')) {
            // If it's an image, open it in the modal
            setSelectedImageUrl(fileUrl);
            setModalVisible(true);
        } else {
            // For other files, open in a new tab/browser
            Linking.openURL(fileUrl);
        }
    };

    return (
        <View style={[AppStyles.screen, { flex: 1 }]}>
            {/* --- NEW: Image Viewer Modal --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={AppStyles.modalBackdrop}>
                    <Image
                        source={{ uri: selectedImageUrl }}
                        style={{ width: '90%', height: '80%', resizeMode: 'contain' }}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 }}
                        onPress={() => setModalVisible(false)}
                    >
                        <X size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </Modal>

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
            <ScrollView 
                // --- FIX: Added paddingBottom to prevent FAB from covering content ---
                contentContainerStyle={[AppStyles.contentPadding, { paddingBottom: 1 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
            >
                <View style={AppStyles.propertyList}>
                    {(item.properties && item.properties.length > 0) ? (
                        item.properties.map((prop) => (
                            <View key={prop.id} style={[AppStyles.propertyItem, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%'}}>
                                    <View style={AppStyles.propertyItemMain}>
                                        {renderIcon()}
                                        <Text style={AppStyles.propertyName}>{prop.name}</Text>
                                    </View>
                                    <Text style={AppStyles.propertyValue}>{prop.waarde}</Text>
                                </View>

                                {prop.files && prop.files.length > 0 && (
                                    <View style={{ marginTop: 12, width: '100%', borderTopWidth: 1, borderColor: colors.lightGray100, paddingTop: 12 }}>
                                        {prop.files.map((file, fileIndex) => (
                                            <TouchableOpacity
                                                key={fileIndex}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    padding: 12,
                                                    backgroundColor: colors.lightGray50,
                                                    borderRadius: 8,
                                                    borderWidth: 1,
                                                    borderColor: colors.lightGray200,
                                                    marginBottom: 8,
                                                }}
                                                onPress={() => handleOpenFile(file)} // --- Use new handler ---
                                            >
                                                {getFileIcon(file.file_type)}
                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <Text style={{ color: colors.lightGray800, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                                                        {file.file_name}
                                                    </Text>
                                                    <Text style={{ color: colors.lightGray500, fontSize: 12 }}>
                                                        {file.file_type || 'Bestand'}
                                                    </Text>
                                                </View>
                                                <Paperclip color={colors.blue600} size={18} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
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
