import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Calculator, ChevronLeft, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchFormulas as fetchFormulasApi } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddFormulaModal from '../components/modals/AddFormulaModal';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import EditPropertyModal from '../components/modals/EditPropertyModal';
import FormulaPickerModal from '../components/modals/FormulaPickerModal';
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
    const [editedFormula, setEditedFormula] = useState('');
    const [existingPropertiesDraft, setExistingPropertiesDraft] = useState([]);
    const [editedUnit, setEditedUnit] = useState('');
    const [editedName, setEditedName] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalPropertyIndex, setModalPropertyIndex] = useState(null);
    const [formulas, setFormulas] = useState([]);
    const [selectedFormula, setSelectedFormula] = useState(null);
    const [showAddFormulaModal, setShowAddFormulaModal] = useState(false);
    const [showFormulaPickerModal, setShowFormulaPickerModal] = useState(false);

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

    // Fetch formulas on component mount
    useEffect(() => {
        (async () => {
            try {
                const formulasData = await fetchFormulasApi();
                setFormulas(Array.isArray(formulasData) ? formulasData : []);
            } catch (error) {
                console.error('Error fetching formulas (mount):', error);
                setFormulas([]);
            }
        })();
    }, []);

    useEffect(() => {
        if (showFormulaPickerModal) {
            (async () => {
                try {
                    const formulasData = await fetchFormulasApi();
                    setFormulas(Array.isArray(formulasData) ? formulasData : []);
                } catch (e) {
                    console.error('Error refreshing formulas on open:', e);
                }
            })();
        }
    }, [showFormulaPickerModal]);

    // Initialize or refresh the draft when item.properties changes
    useEffect(() => {
        const draft = (item.properties || []).map(p => ({
            id: p.id,
            name: p.name,
            waarde: p.waarde,
            formula_id: p.formula_id || null,
            formula_name: p.formula_name || '',
            formula_expression: p.formula_expression || '',
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
                formula_id: null,
                files: []
            };
            setNextNewPropertyId(prevId => prevId + 1);
            return [...prevList, newField];
        });
    };

    const handleFormulaSaved = (newFormula) => {
        setFormulas(prev => [...prev, newFormula]);
    };

    const handleFormulaSelected = (formula) => {
        // For now, we'll just alert with the formula details
        // In a real implementation, you might want to add it to a specific property
        Alert.alert(
            'Formule geselecteerd',
            `Naam: ${formula.name}\nFormule: ${formula.formula}\n\nJe kunt deze formule gebruiken door '${formula.formula}' te typen in het waarde veld.`,
            [{ text: 'OK' }]
        );
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
                const isFormula = prop.value && /[+\-*/]/.test(prop.value);
                let finalValue = prop.value;
                let rawFormula = '';

                if (isFormula) {
                    rawFormula = prop.value;
                    const propertiesMap = buildPropertiesMap(newPropertiesList, prop.unit || 'm');
                    const { value: calculatedValue, error } = evaluateFormula(prop.value, propertiesMap);

                    if (!error && calculatedValue !== null) {
                        // The result from evaluateFormula is in the base unit (m).
                        // Convert to the property's specific unit if it exists.
                        finalValue = convertToUnit(calculatedValue, 'm', prop.unit || 'm');
                    } else {
                        // On error, save the raw formula string as the value for debugging
                        finalValue = prop.value;
                    }
                }

                return {
                    ...prop,
                    waarde: String(roundToDecimals(finalValue)), // Ensure value is a rounded string
                    raw_formula: rawFormula,
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

    // Draft-parameterized variant for recomputation after modal save
    const buildExistingPropertiesMapFromDraft = (draft, outputUnit) => {
        const props = (draft || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    const innerMap = buildPropertiesMap(draft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || outputUnit);
                    const { value: innerVal, error: innerErr } = evaluateFormula(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        return buildPropertiesMap(props, outputUnit);
    };

    // (Removed old local fetchFormulas using wrong endpoint path)

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
                                                {prop.formula_expression && prop.formula_expression.trim() !== '' && (
                                                    <Text
                                                        style={{
                                                            color: colors.lightGray500,
                                                            fontSize: 13,
                                                            fontStyle: 'italic',
                                                        }}
                                                    >
                                                        Formule: {prop.formula_expression}
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
                                    // ... (delete logic remains the same)
                                    return;
                                }

                                // 1. Create a new baseline draft with the single edited property updated
                                const baselineDraft = originalDraft.map((p, i) => (
                                    i === idx ? { ...p, ...updated } : p
                                ));

                                // 2. Re-compute all properties that have a formula
                                const recomputedDraft = baselineDraft.map(p => {
                                    if (p.formula_expression && /[+\-*/]/.test(p.formula_expression)) {
                                        const outputUnit = p.eenheid || 'm';
                                        const map = buildExistingPropertiesMapFromDraft(baselineDraft, outputUnit);
                                        const { value, error } = evaluateFormula(p.formula_expression, map);

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
                                                raw_formula: newProp.formula_expression,
                                                formula_id: newProp.formula_id,
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
                
                {/* Formula Picker FAB (positioned just above Add Property FAB) */}
                <TouchableOpacity
                    onPress={() => setShowFormulaPickerModal(true)}
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
            <AddFormulaModal
                visible={showAddFormulaModal}
                onClose={() => setShowAddFormulaModal(false)}
                onSave={handleFormulaSaved}
            />
            <FormulaPickerModal
                visible={showFormulaPickerModal}
                onClose={() => setShowFormulaPickerModal(false)}
                formulas={formulas}
                onSelectFormula={handleFormulaSelected}
            />
        </View>
    );
};

export default AddPropertyScreen;
