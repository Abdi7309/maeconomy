import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../AppStyles';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import EditPropertyModal from '../components/modals/EditPropertyModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';

const buildPropertiesMap = (properties, outputUnit) => {
    const map = {};

    // Helper to get a property's calculated value
    function getCalculatedValue(prop, visited = {}) {
        // Prevent infinite recursion (circular reference)
        if (visited[prop.name]) return 0;
        visited[prop.name] = true;

        let val = prop.value;
        // If it's a formula, replace referenced properties with their calculated values
        if (typeof val === 'string' && /[+\-*/]/.test(val)) {
            let formula = val;
            properties.forEach(refProp => {
                if (refProp.name.trim() !== '') {
                    // Recursively get the calculated value for referenced property
                    const refValue = getCalculatedValue(refProp, { ...visited });
                    const regex = new RegExp(`\\b${refProp.name}\\b`, "gi");
                    formula = formula.replace(regex, refValue);
                }
            });
            try {
                // Reject if unknown identifiers remain
                if (/[^0-9+\-*/().\s]/.test(formula)) {
                    return 'Error';
                }
                val = eval(formula);
            } catch (e) {
                val = 'Error';
            }
        }
        // Convert to output unit if needed
        if (prop.unit && outputUnit) {
            val = convertToUnit(Number(val), prop.unit, outputUnit);
        }
        return val;
    }

    // Calculate and store all property values
    properties.forEach(prop => {
        if (prop.name.trim() !== '') {
            map[prop.name.toLowerCase()] = getCalculatedValue(prop);
        }
    });

    return map;
};

const evaluateFormula = (formula, propertiesMap) => {
    let expression = formula;
    Object.keys(propertiesMap).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, "gi");
        expression = expression.replace(regex, propertiesMap[key]);
    });

    try {
        // If after replacement there are any non-math characters, flag error
        if (/[^0-9+\-*/().\s]/.test(expression)) {
            return { value: null, error: 'Onbekende variabelen in formule' };
        }
        const result = eval(expression);
        if (typeof result === 'number' && !isNaN(result)) {
            return { value: result, error: null };
        }
        return { value: null, error: 'Formule kon niet worden berekend' };
    } catch (e) {
        return { value: null, error: 'Formule kon niet worden berekend' };
    }
};

const unitConversionTable = {
    // Length
    m:    { m: 1, cm: 0.01, mm: 0.001 },
    cm:   { m: 100, cm: 1, mm: 0.1 },
    mm:   { m: 1000, cm: 10, mm: 1 },
    // Mass
    kg:   { kg: 1, g: 0.001 },
    g:    { kg: 1000, g: 1 },
    // Volume
    L:    { L: 1, mL: 0.001 },
    mL:   { L: 1000, mL: 1 }
};

const convertToUnit = (value, fromUnit, toUnit) => {
    if (!fromUnit || !toUnit || !unitConversionTable[toUnit] || !unitConversionTable[toUnit][fromUnit]) return value;
    return value * unitConversionTable[toUnit][fromUnit];
};

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
    const [outputUnit, setOutputUnit] = useState('m'); // default to meters
    const [editingProperty, setEditingProperty] = useState(null);
    const [editedValue, setEditedValue] = useState('');
    const [editedFormula, setEditedFormula] = useState('');
    const [existingPropertiesDraft, setExistingPropertiesDraft] = useState([]);
    const [editedUnit, setEditedUnit] = useState('');
    const [editedName, setEditedName] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalPropertyIndex, setModalPropertyIndex] = useState(null);

    const allUnits = ['m', 'cm', 'mm', 'kg', 'g', 'L', 'mL'];

    // Initialize or refresh the draft when item.properties changes
    useEffect(() => {
        const draft = (item.properties || []).map(p => ({
            id: p.id,
            name: p.name,
            waarde: p.waarde,
            formule: p.formule || '',
            eenheid: p.eenheid || ''
        }));
        setExistingPropertiesDraft(draft);
    }, [item.properties]);

    const addNewPropertyField = () => {
        setNewPropertiesList(prevList => {
            const newField = {
                id: nextNewPropertyId,
                name: '',
                value: '',
                unit: '', 
                files: []
            };
            setNextNewPropertyId(prevId => prevId + 1);
            return [...prevList, newField];
        });
    };

    const addFileToProperty = (propertyId, fileObject) => {
        setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === propertyId
                    ? { ...prop, files: [...prop.files, fileObject] }
                    : prop
            )
        );
    };

    const removeFileFromProperty = (propertyId, fileIndexToRemove) => {
        setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === propertyId
                    ? { ...prop, files: prop.files.filter((_, index) => index !== fileIndexToRemove) }
                    : prop
            )
        );
    };

    const pickDocument = async (propertyId) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
            if (!result.canceled) {
                result.assets.forEach(file => {
                    addFileToProperty(propertyId, file);
                });
            }
        } catch (err) {
            Alert.alert('Error', 'An error occurred while picking files.');
            console.error('Document Picker Error:', err);
        }
    };

    const takePhoto = async (propertyId) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required to take photos.');
            return;
        }
        try {
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
            if (!result.canceled) {
                const asset = result.assets[0];
                const fileObject = {
                    name: asset.fileName || `photo_${Date.now()}.jpg`,
                    uri: asset.uri,
                    mimeType: asset.mimeType,
                    size: asset.fileSize,
                };
                addFileToProperty(propertyId, fileObject);
            }
        } catch (err) {
            Alert.alert('Error', 'An error occurred while opening the camera.');
            console.error('Image Picker Error:', err);
        }
    };

    const handleSelectFile = async (propertyId) => {
        if (Platform.OS === 'web') {
            webInputRef.current.setAttribute('data-property-id', propertyId);
            webInputRef.current.click();
        } else {
            Alert.alert(
                'Add Attachment',
                'Choose a source for your file:',
                [
                    { text: 'Take Photo...', onPress: () => takePhoto(propertyId) },
                    { text: 'Choose from Library...', onPress: () => pickDocument(propertyId) },
                    { text: 'Cancel', style: 'cancel' },
                ],
                { cancelable: true }
            );
        }
    };

    const handleWebFileSelect = (event) => {
        if (event.target.files && event.target.files.length > 0) {
            const propertyId = parseInt(webInputRef.current.getAttribute('data-property-id'), 10);

            for (const webFile of event.target.files) {
                const fileObject = {
                    name: webFile.name,
                    size: webFile.size,
                    type: webFile.type,
                    uri: URL.createObjectURL(webFile),
                    _webFile: webFile
                };
                addFileToProperty(propertyId, fileObject);
            }
        }
    };

    const removePropertyField = (idToRemove) => {
        setNewPropertiesList(prevList => prevList.filter(prop => prop.id !== idToRemove));
    };

    const handlePropertyFieldChange = (idToUpdate, field, value) => {
        setNewPropertiesList(prevList =>
            prevList.map(prop =>
                prop.id === idToUpdate
                    ? { ...prop, [field]: value }
                    : prop
            )
        );
    };

    const handleSaveOnBack = async () => {
        let propertiesMap = buildPropertiesMap(newPropertiesList);

        // auto-compute formulas
        const updatedList = newPropertiesList.map(prop => {
            if (prop.value && /[+\-*/]/.test(prop.value)) {
                const outputUnit = prop.unit;
                const propertiesMap = buildPropertiesMap(newPropertiesList, outputUnit);
                const { value: result, error } = evaluateFormula(prop.value, propertiesMap);
                let finalValue;
                if (error) {
                    finalValue = 'Error';
                } else {
                    finalValue = result;
                    if (outputUnit && result !== null) {
                        finalValue = convertToUnit(result, outputUnit, outputUnit);
                    }
                }
                return { 
                    ...prop, 
                    formule: prop.value,
                    value: String(finalValue)
                };
            }
            return { ...prop, formule: '', value: prop.value };
        });

        const validPropertiesToSave = updatedList.filter(prop =>
            prop.name.trim() !== ''
        );

        if (validPropertiesToSave.length === 0) {
            setCurrentScreen('properties');
            return;
        }

        const success = await onSave(objectIdForProperties, validPropertiesToSave);

        if (success) {
            setCurrentScreen('properties');
        }
    };

    useEffect(() => {
        if (newPropertiesList.length === 0 && selectedTemplateForPropertyAdd === null) {
            addNewPropertyField();
        }
    }, [newPropertiesList, selectedTemplateForPropertyAdd]);

    const handleClearTemplate = () => {
        setSelectedTemplateForPropertyAdd(null);
        setNewPropertiesList([]);
        setNextNewPropertyId(0); // Reset the ID counter
        setTimeout(() => {
            setNewPropertiesList([{
                id: 0,
                name: '',
                value: '',
                files: []
            }]);
            setNextNewPropertyId(1);
        }, 0);
    };

    // Helper to build a map from existing properties (for edit preview)
    const buildExistingPropertiesMap = (outputUnit) => {
        const props = (existingPropertiesDraft || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    // Evaluate nested formulas within the draft first
                    const innerMap = buildPropertiesMap(existingPropertiesDraft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || outputUnit);
                    const { value: innerVal, error: innerErr } = evaluateFormula(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        return buildPropertiesMap(props, outputUnit);
    };

    return (
        <View style={[AppStyles.screen, { backgroundColor: colors.white, flex: 1 }]}>
            {Platform.OS === 'web' && (
                <input
                    type="file"
                    ref={webInputRef}
                    style={{ display: 'none' }}
                    onChange={handleWebFileSelect}
                    multiple
                />
            )}
            <StatusBar barStyle="dark-content" />

            {showTemplatePickerModal && <TemplatePickerModal
                visible={showTemplatePickerModal}
                onClose={() => setShowTemplatePickerModal(false)}
                templates={fetchedTemplates}
                onSelect={(templateId) => {
                    if (templateId && fetchedTemplates[templateId]) {
                        const templateProps = fetchedTemplates[templateId].properties.map((prop, index) => ({
                            id: index,
                            name: prop.name,
                            value: prop.value || '',
                            unit: prop.unit || '', 
                            files: []
                        }));
                        setNewPropertiesList(templateProps);
                        setNextNewPropertyId(templateProps.length);
                        setSelectedTemplateForPropertyAdd(templateId);
                    } else {
                        handleClearTemplate();
                    }
                    setShowTemplatePickerModal(false);
                }}
                onAddNewTemplate={() => {
                    setShowTemplatePickerModal(false);
                    setShowAddTemplateModal(true);
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
                                    <View key={index} style={[AppStyles.propertyItem, { marginBottom: 12 }]}>
                                        <View style={{ width: '100%' }}>
                                            <View
                                            style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                            >
                                            {/* Left Side */}
                                            <View
                                                style={[
                                                AppStyles.propertyItemMain,
                                                { flexDirection: 'row', alignItems: 'center' },
                                                ]}
                                            >
                                                <Tag color={colors.lightGray500} size={20} />
                                                <Text style={[AppStyles.propertyName, { marginLeft: 8 }]}>{prop.name}</Text>
                                            </View>

                                            {/* Right Side */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                {prop.formule && prop.formule.trim() !== '' && (
                                                    <Text
                                                    style={{
                                                        color: colors.lightGray500,
                                                        fontSize: 13,
                                                        fontStyle: 'italic',
                                                    }}
                                                    >
                                                    Formule: {prop.formule}
                                                    </Text>
                                                )}
                                                <Text style={[AppStyles.propertyValue, { marginTop: 4 }]}>
                                                    {prop.waarde}
                                                    {prop.eenheid ? ` ${prop.eenheid}` : ''}
                                                </Text>
                                                </View>

                                                {/* Divider */}
                                                <View
                                                style={{
                                                    width: 1,
                                                    backgroundColor: colors.lightGray500,
                                                    marginHorizontal: 10,
                                                    alignSelf: 'stretch', 
                                                }}
                                                />

                                                {/* Bewerken */}
                                                <TouchableOpacity
                                                onPress={() => {
                                                    setModalPropertyIndex(index);
                                                    setShowEditModal(true);
                                                }}
                                                >
                                                <Text style={{ color: colors.primary, fontWeight: '600' }}>Bewerken</Text>
                                                </TouchableOpacity>
                                            </View>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={AppStyles.emptyState}>
                                    <Text style={AppStyles.emptyStateText}>Geen bestaande eigenschappen.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {showEditModal && modalPropertyIndex !== null && (
                        <EditPropertyModal
                            visible={showEditModal}
                            onClose={() => setShowEditModal(false)}
                            property={item.properties[modalPropertyIndex]}
                            existingPropertiesDraft={existingPropertiesDraft}
                            onSaved={(updated) => {
                                const idx = modalPropertyIndex;
                                if (item.properties && item.properties[idx]) {
                                    item.properties[idx] = { ...item.properties[idx], ...updated };
                                }
                                setExistingPropertiesDraft(prev => prev.map((p, i) => i === idx ? { ...p, name: updated.name, waarde: updated.waarde, formule: updated.formule, eenheid: updated.eenheid } : p));
                                setShowEditModal(false);
                                setModalPropertyIndex(null);
                            }}
                        />
                    )}
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

                        <View style={{flexDirection: 'row', alignItems: 'center', marginVertical: 16}}>
                            <View style={{flex: 1, height: 1, backgroundColor: colors.lightGray200}} />
                            <View>
                                <Text style={{width: 150, textAlign: 'center', color: colors.lightGray400}}>Handmatig Toevoegen</Text>
                            </View>
                            <View style={{flex: 1, height: 1, backgroundColor: colors.lightGray200}} />
                        </View>

                        {newPropertiesList.map((prop, index) => (
                            <View
                                key={prop.id}
                                style={{
                                    marginBottom: 16,
                                    borderTopWidth: index > 0 ? 1 : 0,
                                    borderColor: colors.lightGray100,
                                    paddingTop: index > 0 ? 40 : 0,
                                    position: 'relative',
                                }}
                            >
                                {(newPropertiesList.length > 1) && (
                                    <TouchableOpacity
                                        onPress={() => removePropertyField(prop.id)}
                                        style={{
                                            position: 'absolute',
                                            top: index === 0 ? -10 :30,
                                            right: -2, // Move left a bit for better alignment
                                            zIndex: 10,
                                            padding: 8,
                                        }}
                                    >
                                        <X color={colors.red600} size={20} />
                                    </TouchableOpacity>
                                )}
                                <View>
                                {Platform.OS === 'web' ? (
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={[AppStyles.formGroup, { flex: 1 }]}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
                                            />
                                        </View>
                                        <View style={[AppStyles.formGroup, { flex: 1 }]}>
                                            <Text style={AppStyles.formLabel}>Waarde</Text>
                                            <TextInput
                                                placeholder="Bijv. 2"
                                                value={prop.value}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)}
                                                style={AppStyles.formInput}
                                            />
                                            {/* Show calculated result below the input */}
                                            {prop.value && /[+\-*/]/.test(prop.value) && (() => {
                                                const outputUnit = prop.unit;
                                                const propertiesMap = buildPropertiesMap(newPropertiesList, outputUnit);
                                                const { value: result, error } = evaluateFormula(prop.value, propertiesMap);
                                                if (error) {
                                                    return (
                                                        <Text style={{ color: colors.red600, marginTop: 6, fontSize: 14 }}>
                                                            {error}
                                                        </Text>
                                                    );
                                                }
                                                if (result !== null) {
                                                    if (outputUnit) {
                                                        const convertedResult = convertToUnit(result, outputUnit, outputUnit);
                                                        return (
                                                            <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>
                                                                {convertedResult} {outputUnit}
                                                            </Text>
                                                        );
                                                    }
                                                    return (
                                                        <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>
                                                            {result}
                                                        </Text>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </View>
                                        <View style={[AppStyles.formGroup, { width: 80 }]}>
                                            <Text style={AppStyles.formLabel}>Eenheid</Text>
                                            <TextInput
                                                placeholder="kg/cm/ml"
                                                value={prop.unit}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'unit', text)}
                                                style={AppStyles.formInput}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Eigenschap Naam</Text>
                                            <TextInput
                                                placeholder="Bijv. Gewicht"
                                                value={prop.name}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'name', text)}
                                                style={AppStyles.formInput}
                                            />
                                        </View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Waarde</Text>
                                            <TextInput
                                                placeholder="Bijv. 2"
                                                value={prop.value}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'value', text)}
                                                style={AppStyles.formInput}
                                            />
                                            {/* Show calculated result below the input */}
                                            {prop.value && /[+\-*/]/.test(prop.value) && (() => {
                                                const outputUnit = prop.unit;
                                                const propertiesMap = buildPropertiesMap(newPropertiesList, outputUnit);
                                                const { value: result, error } = evaluateFormula(prop.value, propertiesMap);
                                                if (error) {
                                                    return (
                                                        <Text style={{ color: colors.red600, marginTop: 6, fontSize: 14 }}>
                                                            {error}
                                                        </Text>
                                                    );
                                                }
                                                if (result !== null) {
                                                    // If unit is set, show converted result with unit
                                                    if (outputUnit) {
                                                        const convertedResult = convertToUnit(result, outputUnit, outputUnit);
                                                        return (
                                                            <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>
                                                                {convertedResult} {outputUnit}
                                                            </Text>
                                                        );
                                                    }
                                                    // If no unit, show raw result
                                                    return (
                                                        <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>
                                                            {result}
                                                        </Text>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </View>
                                        <View style={AppStyles.formGroup}>
                                            <Text style={AppStyles.formLabel}>Eenheid</Text>
                                            <TextInput
                                                placeholder="kg/cm/ml"
                                                value={prop.unit}
                                                onChangeText={(text) => handlePropertyFieldChange(prop.id, 'unit', text)}
                                                style={AppStyles.formInput}
                                            />
                                        </View>
                                    </>
                                )}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                        <TouchableOpacity onPress={() => handleSelectFile(prop.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: colors.lightGray100, borderRadius: 8, alignSelf: 'flex-start' }}>
                                            <Paperclip color={colors.blue600} size={18} />
                                            <Text style={{ marginLeft: 8, color: colors.lightGray700, fontWeight: '500' }}>Bestand bijvoegen</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {prop.files && prop.files.length > 0 && (
                                    <View style={{marginTop: 12}}>
                                        <Text style={[AppStyles.formLabel, {marginBottom: 4}]}>Bijlagen</Text>
                                        {prop.files.map((file, fileIndex) => (
                                            <View key={fileIndex} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lightGray50, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.lightGray200, marginBottom: 8}}>
                                                <FileText size={18} color={colors.lightGray600} />
                                                <Text style={{flex: 1, marginLeft: 12, color: colors.lightGray700}} numberOfLines={1}>{file.name}</Text>
                                                <TouchableOpacity onPress={() => removeFileFromProperty(prop.id, fileIndex)} style={{padding: 4, marginLeft: 8}}>
                                                    <X size={16} color={colors.red500} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}
                        <TouchableOpacity onPress={handleSaveOnBack} style={[AppStyles.btnPrimary, AppStyles.btnFull, AppStyles.btnFlexCenter, { marginTop: 16 }]}>
                            <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
                <View style={{ flexDirection: 'row', position: 'absolute', bottom: 20, right: 20 }}>
                    <TouchableOpacity onPress={addNewPropertyField} style={AppStyles.fab}>
                        <Plus color="white" size={24} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

export default AddPropertyScreen;
