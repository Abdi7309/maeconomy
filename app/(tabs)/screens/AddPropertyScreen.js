import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Calculator, ChevronLeft, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchFormules as fetchFormulesApi } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddFormuleModal from '../components/modals/AddFormuleModal';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import EditPropertyModal from '../components/modals/EditPropertyModal';
import FormulePickerModal from '../components/modals/FormulePickerModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';

const buildPropertiesMap = (properties, outputUnit) => {
    const map = {};

    // Helper to get a property's calculated value
    function getCalculatedValue(prop, visited = {}) {
        // Prevent infinite recursion (circular reference)
        if (visited[prop.name]) return 0;
        visited[prop.name] = true;

        let val = prop.value;
        // If it's a Formule, replace referenced properties with their calculated values
        if (typeof val === 'string' && /[+\-*/]/.test(val)) {
            let Formule = val;
            properties.forEach(refProp => {
                if (refProp.name.trim() !== '') {
                    // Recursively get the calculated value for referenced property
                    const refValue = getCalculatedValue(refProp, { ...visited });
                    const regex = new RegExp(`\\b${refProp.name}\\b`, "gi");
                    Formule = Formule.replace(regex, refValue);
                }
            });
            try {
                // Reject if unknown identifiers remain
                if (/[^0-9+\-*/().\s]/.test(Formule)) {
                    return 'Error';
                }
                val = eval(Formule);
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

const evaluateFormule = (Formule, propertiesMap) => {
    let expression = Formule;
    // Replace property references first
    Object.keys(propertiesMap).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        expression = expression.replace(regex, propertiesMap[key]);
    });

    // Handle inline numeric+unit tokens (e.g., 10cm, 1m, 25mm)
    // We'll normalize length units to meters (base) for calculation.
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (match, num, unit) => {
        const valueInMeters = convertToUnit(parseFloat(num), unit.toLowerCase(), 'm');
        return valueInMeters.toString();
    });

    try {
        if (/[^0-9+\-*/().\s]/.test(expression)) {
            return { value: null, error: 'Onbekende variabelen in formule' };
        }
        // Use Function constructor for safer evaluation
        const result = new Function(`return ${expression}`)();
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

const AddPropertyScreen = ({ ...props }) => {
    const [newPropertiesList, setNewPropertiesList] = useState([]);
    const [nextNewPropertyId, setNextNewPropertyId] = useState(0);
    const [selectedTemplateForPropertyAdd, setSelectedTemplateForPropertyAdd] = useState(null);
    const [showTemplatePickerModal, setShowTemplatePickerModal] = useState(false);
    const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);
    const [outputUnit, setOutputUnit] = useState('m'); // default to meters
    const [editingProperty, setEditingProperty] = useState(null);
    const [editedValue, setEditedValue] = useState('');
    const [editedFormule, setEditedFormule] = useState('');
    const [existingPropertiesDraft, setExistingPropertiesDraft] = useState([]);
    const [editedUnit, setEditedUnit] = useState('');
    const [editedName, setEditedName] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalPropertyIndex, setModalPropertyIndex] = useState(null);
    const [Formules, setFormules] = useState([]);
    const [selectedFormule, setSelectedFormule] = useState(null);
    const [showAddFormuleModal, setShowAddFormuleModal] = useState(false);
    const [showFormulePickerModal, setShowFormulePickerModal] = useState(false);
    const [editingFormule, setEditingFormule] = useState(null);
    // Track which waarde input was last focused so we can insert a picked Formule
    const [lastFocusedValuePropertyId, setLastFocusedValuePropertyId] = useState(null);

    const webInputRef = useRef(null);

    const objectIdForProperties = props.currentPath[props.currentPath.length - 1];
    const item = props.findItemByPath(props.objectsHierarchy, props.currentPath);

    if (!item) return null;

    const allUnits = ['m', 'cm', 'mm', 'kg', 'g', 'L', 'mL'];

    // Consistent rounding with modal
    const DECIMAL_PLACES = 6;
    const roundToDecimals = (value, decimals = DECIMAL_PLACES) => {
        if (typeof value !== 'number' || !isFinite(value)) return value;
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    };

    // Fetch Formules on component mount
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
    }, []);

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

    // Initialize or refresh the draft when item.properties changes
    useEffect(() => {
        const draft = (item.properties || []).map(p => ({
            id: p.id,
            name: p.name,
            waarde: p.waarde,
            Formule_id: p.Formule_id || null,
            Formule_name: p.Formule_name || '',
            Formule_expression: p.Formule_expression || '',
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
                Formule_id: null,
                files: []
            };
            setNextNewPropertyId(prevId => prevId + 1);
            return [...prevList, newField];
        });
    };

    const handleFormuleSaved = (newFormule) => {
        setFormules(prev => [...prev, newFormule]);
    };

    const handleFormuleSelected = (Formule) => {
        // Always create a NEW property row for the selected Formule instead of replacing an existing one
        setNewPropertiesList(prevList => [
            ...prevList,
            {
                id: nextNewPropertyId,
                name: Formule.name,
                value: Formule.Formule,
                unit: '',
                Formule_id: Formule.id,
                files: []
            }
        ]);
        setNextNewPropertyId(prev => prev + 1);
        // Optionally we could set focus tracking to this new one (not strictly needed for now)
        setLastFocusedValuePropertyId(nextNewPropertyId);
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
        const propertiesToSave = newPropertiesList
            .filter(prop => prop.name.trim() !== '')
            .map(prop => {
                const isFormule = prop.value && /[+\-*/]/.test(prop.value);
                let finalValue = prop.value;
                let rawFormule = '';

                if (isFormule) {
                    rawFormule = prop.value;
                    const propertiesMap = buildPropertiesMap(newPropertiesList, prop.unit || 'm');
                    const { value: calculatedValue, error } = evaluateFormule(prop.value, propertiesMap);

                    if (!error && calculatedValue !== null) {
                        // The result from evaluateFormule is in the base unit (m).
                        // Convert to the property's specific unit if it exists.
                        finalValue = convertToUnit(calculatedValue, 'm', prop.unit || 'm');
                    } else {
                        // On error, save the raw Formule string as the value for debugging
                        finalValue = prop.value;
                    }
                }

                return {
                    ...prop,
                    waarde: String(roundToDecimals(finalValue)), // Ensure value is a rounded string
                    raw_Formule: rawFormule,
                };
            });

        if (propertiesToSave.length === 0) {
            props.setCurrentScreen('properties');
            return;
        }

        const success = await props.onSave(objectIdForProperties, propertiesToSave);

        if (success) {
            props.setCurrentScreen('properties');
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
                    // Evaluate nested Formules within the draft first
                    const innerMap = buildPropertiesMap(existingPropertiesDraft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || outputUnit);
                    const { value: innerVal, error: innerErr } = evaluateFormule(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        return buildPropertiesMap(props, outputUnit);
    };

    // Draft-parameterized variant for recomputation after modal save
    const buildExistingPropertiesMapFromDraft = (draft, outputUnit) => {
        const props = (draft || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    const innerMap = buildPropertiesMap(draft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || outputUnit);
                    const { value: innerVal, error: innerErr } = evaluateFormule(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        return buildPropertiesMap(props, outputUnit);
    };

    // (Removed old local fetchFormules using wrong endpoint path)

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
                templates={props.fetchedTemplates}
                onSelect={(templateId) => {
                    if (templateId && props.fetchedTemplates[templateId]) {
                        const templateProps = props.fetchedTemplates[templateId].properties.map((prop, index) => ({
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
                onTemplateSaved={props.onTemplateAdded}
            />}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={AppStyles.header}>
                    <View style={AppStyles.headerFlex}>
                        <TouchableOpacity onPress={() => props.setCurrentScreen('properties')} style={AppStyles.headerBackButton}>
                            <ChevronLeft color={colors.lightGray700} size={24} />
                        </TouchableOpacity>
                        <Text style={AppStyles.headerTitleLg}>Eigenschap Toevoegen</Text>
                    </View>
                </View>
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[AppStyles.contentPadding, { paddingBottom: 70 }]} 
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
                                                {prop.Formule_expression && prop.Formule_expression.trim() !== '' && (
                                                    <Text
                                                        style={{
                                                            color: colors.lightGray500,
                                                            fontSize: 13,
                                                            fontStyle: 'italic',
                                                        }}
                                                    >
                                                        Formule: {prop.Formule_expression}
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
                            onSaved={async (updated) => {
                                const idx = modalPropertyIndex;
                                const originalDraft = [...existingPropertiesDraft]; // Capture state before changes

                                if (updated && updated.__deleted) {
                                    // Immediate UI removal of the deleted property
                                    const deletedId = updated.id;
                                    // Remove from existing draft list
                                    const newDraft = originalDraft.filter(p => p.id !== deletedId);
                                    setExistingPropertiesDraft(newDraft);
                                    // Also remove from the live item.properties array clone (since item comes from hierarchy prop)
                                    if (item && Array.isArray(item.properties)) {
                                        item.properties = item.properties.filter(p => p.id !== deletedId);
                                    }
                                    // Close modal and clear selection
                                    setShowEditModal(false);
                                    setModalPropertyIndex(null);
                                    // Feedback message
                                    Alert.alert('Verwijderd', 'Eigenschap is succesvol verwijderd.');
                                    return;
                                }

                                // 1. Create a new baseline draft with the single edited property updated
                                const baselineDraft = originalDraft.map((p, i) => (
                                    i === idx ? { ...p, ...updated } : p
                                ));

                                // 2. Re-compute all properties that have a Formule
                                const recomputedDraft = baselineDraft.map(p => {
                                    if (p.Formule_expression && /[+\-*/]/.test(p.Formule_expression)) {
                                        const outputUnit = p.eenheid || 'm';
                                        const map = buildExistingPropertiesMapFromDraft(baselineDraft, outputUnit);
                                        const { value, error } = evaluateFormule(p.Formule_expression, map);

                                        if (error || value === null) {
                                            return { ...p, waarde: 'Error' };
                                        }
                                        
                                        const finalValue = convertToUnit(value, 'm', outputUnit);
                                        const rounded = roundToDecimals(finalValue);
                                        return { ...p, waarde: String(rounded) };
                                    }
                                    return p;
                                });

                                // 3. Identify and save all properties whose values have changed
                                const updatePromises = [];
                                recomputedDraft.forEach((newProp, index) => {
                                    const oldProp = originalDraft[index];
                                    // Find properties where the value has changed due to recalculation
                                    if (oldProp && newProp.waarde !== oldProp.waarde && newProp.id) {
                                        console.log(`Value for '${newProp.name}' changed from ${oldProp.waarde} to ${newProp.waarde}. Queueing for save.`);
                                        // The property that was manually edited is already saved by the modal.
                                        // This condition saves all *other* dependent properties.
                                        if (index !== idx) {
                                            updatePromises.push(props.onUpdate(newProp.id, {
                                                name: newProp.name,
                                                waarde: newProp.waarde,
                                                raw_Formule: newProp.Formule_expression,
                                                Formule_id: newProp.Formule_id,
                                                eenheid: newProp.eenheid,
                                            }));
                                        }
                                    }
                                });

                                // Execute all pending save operations
                                if (updatePromises.length > 0) {
                                    await Promise.all(updatePromises);
                                    // Optionally, show a single confirmation after all saves are done
                                    Alert.alert('Success', `${updatePromises.length} afhankelijke eigenschap(pen) zijn bijgewerkt.`);
                                }

                                // 4. Update the UI state with the final, recomputed values
                                if (item.properties && Array.isArray(item.properties)) {
                                    item.properties = recomputedDraft;
                                }
                                setExistingPropertiesDraft(recomputedDraft);

                                // 5. Close the modal
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
                                    {selectedTemplateForPropertyAdd ? props.fetchedTemplates[selectedTemplateForPropertyAdd]?.name : 'Kies een sjabloon...'}
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
                                                onFocus={() => setLastFocusedValuePropertyId(prop.id)}
                                                style={AppStyles.formInput}
                                            />
                                            {/* Show calculated result below the input */}
                                            {prop.value && /[+\-*/]/.test(prop.value) && (() => {
                                                const outputUnit = prop.unit;
                                                const propertiesMap = buildPropertiesMap(newPropertiesList, outputUnit);
                                                const { value: result, error } = evaluateFormule(prop.value, propertiesMap);
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
                                                onFocus={() => setLastFocusedValuePropertyId(prop.id)}
                                                style={AppStyles.formInput}
                                            />
                                            {/* Show calculated result below the input */}
                                            {prop.value && /[+\-*/]/.test(prop.value) && (() => {
                                                const outputUnit = prop.unit;
                                                const propertiesMap = buildPropertiesMap(newPropertiesList, outputUnit);
                                                const { value: result, error } = evaluateFormule(prop.value, propertiesMap);
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
                
                {/* Formule Picker FAB (positioned just above Add Property FAB) */}
                <TouchableOpacity
                    onPress={() => setShowFormulePickerModal(true)}
                    /* Main FAB: bottom ~20 (1.25*16), height ~56 (3.5*16). Desired gap = 16. 20 + 56 + 16 = 92 */
                    style={[AppStyles.filterFab, { bottom: 92 }]} // precise 16px gap above main FAB
                >
                    <Calculator color={colors.blue600} size={24} />
                </TouchableOpacity>
                
                {/* Add Property FAB */}
                <TouchableOpacity onPress={addNewPropertyField} style={AppStyles.fab}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </KeyboardAvoidingView>

            {/* Modals */}
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
                    console.log('[AddPropertyScreen] onDelete callback called with:', deleted);
                    if (deleted.__deleted) {
                        console.log('[AddPropertyScreen] Processing delete for id:', deleted.id);
                        setFormules(prev => {
                            const filtered = prev.filter(f => f.id !== deleted.id);
                            console.log('[AddPropertyScreen] Formules before filter:', prev.length, 'after filter:', filtered.length);
                            return filtered;
                        });
                        // Refetch from backend to ensure sync (in case of race conditions)
                        (async () => {
                            try {
                                console.log('[AddPropertyScreen] Refetching Formules from API');
                                const fresh = await fetchFormulesApi();
                                if (Array.isArray(fresh)) {
                                    console.log('[AddPropertyScreen] Refetch successful, got', fresh.length, 'Formules');
                                    setFormules(fresh);
                                } else {
                                    console.log('[AddPropertyScreen] Refetch returned non-array:', fresh);
                                }
                            } catch (e) {
                                console.log('[AddPropertyScreen] Refetch after delete failed', e);
                            }
                        })();
                    } else {
                        console.log('[AddPropertyScreen] Delete callback called but __deleted flag is false');
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
            />
        </View>
    );
};

export default AddPropertyScreen;
