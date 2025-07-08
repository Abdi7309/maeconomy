import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, StatusBar } from 'react-native';
import { ChevronLeft, Plus, X, Tag, Paperclip, FileText } from 'lucide-react-native';
import AppStyles, { colors } from '../AppStyles';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';
import * as DocumentPicker from 'expo-document-picker';
// The onSave prop from index.js will call addProperties from api.js
// so we don't need a direct import here.

const AddPropertyScreen = ({ currentPath, objectsHierarchy, fetchedTemplates, setCurrentScreen, onSave, onTemplateAdded, findItemByPath }) => {

    const objectIdForProperties = currentPath[currentPath.length - 1];
    const item = findItemByPath(objectsHierarchy, currentPath);
    
    const webInputRef = useRef(null);

    if (!item) return null;

    const [newPropertiesList, setNewPropertiesList] = useState([]);
    const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
    const [selectedTemplateForPropertyAdd, setSelectedTemplateForPropertyAdd] = useState(null);
    const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);

    const renderIcon = (customColor = colors.lightGray500) => {
        return <Tag color={customColor} size={20} />;
    };

    const addNewPropertyField = () => {
        setNewPropertiesList(prevList => {
            const newField = { id: nextNewPropertyId, name: '', value: '', file: null };
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
        if (newPropertiesList.length === 0) {
            addNewPropertyField();
        }
    }, [newPropertiesList]);

    const handleSelectFile = async (propertyId) => {
        if (Platform.OS === 'web') {
            webInputRef.current.setAttribute('data-property-id', propertyId);
            webInputRef.current.click();
        } else {
            try {
                const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
                if (!result.canceled) {
                    const file = result.assets[0];
                    updateFileForProperty(propertyId, file);
                }
            } catch (err) {
                Alert.alert('Error', 'An error occurred while picking the file.');
                console.error('Document Picker Error:', err);
            }
        }
    };

    const handleWebFileSelect = (event) => {
        if (event.target.files && event.target.files[0]) {
            const webFile = event.target.files[0];
            const propertyId = parseInt(webInputRef.current.getAttribute('data-property-id'), 10);
            
            const fileObject = {
                name: webFile.name,
                size: webFile.size,
                type: webFile.type,
                uri: URL.createObjectURL(webFile),
                _webFile: webFile
            };
            updateFileForProperty(propertyId, fileObject);
        }
    };
    
    const updateFileForProperty = (propertyId, fileObject) => {
        setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === propertyId ? { ...prop, file: fileObject } : prop
            )
        );
    };

    const removeFileFromProperty = (propertyId) => {
         setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === propertyId ? { ...prop, file: null } : prop
            )
        );
    };

    const handleSaveOnBack = async () => {
        const validPropertiesToSave = newPropertiesList.filter(prop =>
            prop.name.trim() !== ''
        );

        if (validPropertiesToSave.length === 0) {
            setCurrentScreen('properties');
            return;
        }

        // This calls the `handleAddProperties` function from your index.js
        const success = await onSave(objectIdForProperties, validPropertiesToSave);

        if (success) {
            // The refresh is handled by the parent (index.js)
            setCurrentScreen('properties');
        }
    };

    return (
        <View style={[AppStyles.screen, { backgroundColor: colors.white, flex: 1 }]}>
            {Platform.OS === 'web' && (
                <input
                    type="file"
                    ref={webInputRef}
                    style={{ display: 'none' }}
                    onChange={handleWebFileSelect}
                />
            )}
            <StatusBar barStyle="dark-content" />

            {showTemplatePickerModal && <TemplatePickerModal
                visible={showTemplatePickerModal}
                onClose={() => setShowTemplatePickerModal(false)}
                templates={fetchedTemplates}
                onSelect={(templateId) => {
                    setSelectedTemplateForPropertyAdd(templateId);
                    if (templateId && fetchedTemplates[templateId]) {
                        const templateProps = fetchedTemplates[templateId].properties.map((prop, index) => ({
                            id: index, name: prop.name, value: prop.value || '', file: null
                        }));
                        setNewPropertiesList(templateProps);
                        setNextNewPropertyId(templateProps.length);
                    } else {
                        setNewPropertiesList([]);
                        setNextNewPropertyId(0);
                    }
                    setShowTemplatePickerModal(false);
                }}
            />}

            {showAddTemplateModal && <AddTemplateModal
                visible={showAddTemplateModal}
                onClose={() => setShowAddTemplateModal(false)}
                onTemplateSaved={onTemplateAdded}
            />}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <TouchableOpacity onPress={() => setCurrentScreen('properties')} style={AppStyles.headerBackButton}>
                            <ChevronLeft color={colors.lightGray700} size={24} />
                        </TouchableOpacity>
                        <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                        <TouchableOpacity onPress={handleSaveOnBack} style={[AppStyles.headerBackButton, {marginRight: 0, marginLeft: 16}]}>
                            <Text style={{color: colors.blue600, fontWeight: '600'}}>Opslaan</Text>
                        </TouchableOpacity>
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
                            Nieuwe Eigenschappen
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

                        {Platform.OS === 'web' && (
                            <View style={[AppStyles.formRow, { marginBottom: 4 }]}>
                                <View style={[AppStyles.formGroupHalf, { marginRight: 8 }]}><Text style={AppStyles.formLabel}>Eigenschap Naam</Text></View>
                                <View style={[AppStyles.formGroupHalf, { marginLeft: 8 }]}><Text style={AppStyles.formLabel}>Waarde</Text></View>
                            </View>
                        )}

                        {newPropertiesList.map((prop, index) => (
                            <View key={prop.id} style={{ marginBottom: 16, borderTopWidth: index > 0 ? 1 : 0, borderColor: colors.lightGray100, paddingTop: index > 0 ? 16 : 0 }}>
                                
                                {Platform.OS === 'web' ? (
                                    <View>
                                        <View style={[AppStyles.formRow, { alignItems: 'center', marginBottom: 12 }]}>
                                            <View style={[AppStyles.formGroupHalf, { marginRight: 8, marginBottom: 0 }]}>
                                                <TextInput placeholder="Bijv. Gewicht" value={prop.name} onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)} style={AppStyles.formInput} />
                                            </View>
                                            <View style={[AppStyles.formGroupHalf, { marginLeft: 8, marginBottom: 0, flexDirection: 'row', alignItems: 'center' }]}>
                                                <TextInput placeholder="Bijv. 2kg" value={prop.value} onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)} style={[AppStyles.formInput, { flex: 1 }]} />
                                                <TouchableOpacity onPress={() => handleSelectFile(prop.id)} style={{ paddingLeft: 8, paddingVertical: 4 }}>
                                                    <Paperclip color={prop.file ? colors.blue600 : colors.lightGray500} size={22} />
                                                </TouchableOpacity>
                                                {(newPropertiesList.length > 1) && (<TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ paddingLeft: 4, paddingVertical: 4 }}><X color={colors.red600} size={20} /></TouchableOpacity>)}
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    <View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput placeholder="Bijv. Gewicht" value={prop.name} onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)} style={AppStyles.formInput} />
                                        </View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Waarde</Text>
                                            <TextInput placeholder="Bijv. 2kg" value={prop.value} onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)} style={AppStyles.formInput} />
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                            <TouchableOpacity onPress={() => handleSelectFile(prop.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: colors.lightGray100, borderRadius: 8, alignSelf: 'flex-start' }}>
                                                <Paperclip color={colors.blue600} size={18} />
                                                <Text style={{ marginLeft: 8, color: colors.lightGray700, fontWeight: '500' }}>{prop.file ? 'Bestand wijzigen' : 'Bestand bijvoegen'}</Text>
                                            </TouchableOpacity>
                                            {(newPropertiesList.length > 1) && (<TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 8 }}><X color={colors.red600} size={20} /></TouchableOpacity>)}
                                        </View>
                                    </View>
                                )}

                                {/* --- START OF UI IMPROVEMENT --- */}
                                {/* This replaces the simple "Geselecteerd: ..." text */}
                                {prop.file && (
                                    <View style={{marginTop: 12}}>
                                        <Text style={[AppStyles.formLabel, {marginBottom: 4}]}>Bijlage</Text>
                                        <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lightGray50, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.lightGray200}}>
                                            <FileText size={18} color={colors.lightGray600} />
                                            <Text style={{flex: 1, marginLeft: 12, color: colors.lightGray700}} numberOfLines={1}>{prop.file.name}</Text>
                                            <TouchableOpacity onPress={() => removeFileFromProperty(prop.id)} style={{padding: 4, marginLeft: 8}}><X size={16} color={colors.red500} /></TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                {/* --- END OF UI IMPROVEMENT --- */}
                            </View>
                        ))}
                        
                        <TouchableOpacity onPress={handleSaveOnBack} style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnFlexCenter, { marginTop: 16 }]}>
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

export default AddPropertyScreen;
