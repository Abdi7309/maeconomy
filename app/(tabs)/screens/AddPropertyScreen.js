import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, StatusBar } from 'react-native';
import { ChevronLeft, Plus, X, Tag } from 'lucide-react-native';
import AppStyles, { colors } from '../AppStyles';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';

const AddPropertyScreen = ({ currentPath, objectsHierarchy, fetchedTemplates, setCurrentScreen, onSave, onTemplateAdded, findItemByPath }) => {

    const objectIdForProperties = currentPath[currentPath.length - 1];
    const item = findItemByPath(objectsHierarchy, currentPath);

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
            const newField = { id: nextNewPropertyId, name: '', value: '' };
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

    // --- SOLUTION 2: Simplified useEffect ---
    // This ensures there's always at least one input field if the list becomes empty.
    useEffect(() => {
        if (newPropertiesList.length === 0) {
            addNewPropertyField();
        }
    }, [newPropertiesList]);

    const handleSaveOnBack = async () => {
        const partiallyFilled = newPropertiesList.find(prop =>
            (prop.name.trim() !== '' && prop.value.trim() === '') ||
            (prop.name.trim() === '' && prop.value.trim() !== '')
        );

        if (partiallyFilled) {
            Alert.alert('Incomplete Entry', 'Please provide both a name and a value for each property, or leave both fields empty to ignore.');
            return;
        }

        const validPropertiesToSave = newPropertiesList.filter(prop =>
            prop.name.trim() !== '' && prop.value.trim() !== ''
        );

        if (validPropertiesToSave.length > 0) {
            const success = await onSave(objectIdForProperties, validPropertiesToSave);
            if (!success) return; // Stop if saving failed
        }

        setCurrentScreen('properties');
    };

    return (
        <View style={[AppStyles.screen, { backgroundColor: colors.white }]}>
            <StatusBar barStyle="dark-content" />

            {showTemplatePickerModal && <TemplatePickerModal
                visible={showTemplatePickerModal}
                onClose={() => setShowTemplatePickerModal(false)}
                templates={fetchedTemplates}
                onSelect={(templateId) => {
                    setSelectedTemplateForPropertyAdd(templateId);
                    if (templateId && fetchedTemplates[templateId]) {
                        const templateProps = fetchedTemplates[templateId].properties.map((prop, index) => ({
                            id: index, name: prop.name, value: prop.value || ''
                        }));
                        setNewPropertiesList(templateProps);
                        setNextNewPropertyId(templateProps.length);
                    } else {
                        setNewPropertiesList([]); // This will trigger the useEffect to add one empty field
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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <TouchableOpacity onPress={handleSaveOnBack} style={AppStyles.headerBackButton}>
                            <ChevronLeft color={colors.lightGray700} size={24} />
                        </TouchableOpacity>
                        <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                        <View style={AppStyles.headerPlaceholder} />
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
                            Nieuwe Eigenschappen Toevoegen
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

                        {/* --- SOLUTION 1: Labels moved outside the map --- */}
                        <View style={[AppStyles.formRow, { marginBottom: 4 }]}>
                            <View style={[AppStyles.formGroupHalf, { marginRight: 8 }]}>
                                <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                            </View>
                            <View style={[AppStyles.formGroupHalf, { marginLeft: 8 }]}>
                                <Text style={AppStyles.formLabel}>Waarde</Text>
                            </View>
                        </View>

                        {newPropertiesList.map(prop => (
                            <View key={prop.id} style={{ marginBottom: 12 }}>
                                <View style={AppStyles.formRow}>
                                    <View style={[AppStyles.formGroupHalf, { marginRight: 8, marginBottom: 0 }]}>
                                        {/* Label is removed from here */}
                                        <TextInput
                                            placeholder="Bijv. Gewicht"
                                            value={prop.name}
                                            onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                            style={AppStyles.formInput}
                                            returnKeyType="next"
                                        />
                                    </View>
                                    <View style={[AppStyles.formGroupHalf, { marginLeft: 8, marginBottom: 0 }]}>
                                        {/* Label is removed from here */}
                                        <TextInput
                                            placeholder="Bijv. 2kg"
                                            value={prop.value}
                                            onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)}
                                            style={AppStyles.formInput}
                                            returnKeyType="done"
                                            onSubmitEditing={addNewPropertyField}
                                        />
                                    </View>
                                    {/* Conditionally show the remove button */}
                                    {(newPropertiesList.length > 1) && (
                                        <TouchableOpacity onPress={() => removePropertyField(prop.id)} style={{ padding: 4, alignSelf: 'center', marginLeft: 8 }}>
                                            <X color={colors.red600} size={20} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity onPress={handleSaveOnBack} style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnFlexCenter, { marginTop: 8 }]}>
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