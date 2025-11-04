import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, FileText, Paperclip, Plus, Tag, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fetchFormules as fetchFormulesApi } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddTemplateModal from '../components/modals/AddTemplateModal';
import EditPropertyModal from '../components/modals/EditPropertyModal';
import TemplatePickerModal from '../components/modals/TemplatePickerModal';
import ValueInputModal from '../components/modals/ValueInputModal';

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

const evaluateFormule = (Formule, properties) => {
    // Check if Formule is valid
    if (!Formule || typeof Formule !== 'string') {
        return { value: 0, error: 'Invalid formula' };
    }
    
    let expression = Formule;
    
    // Handle both array of properties and properties map
    if (Array.isArray(properties)) {
        // Replace property references with their values (including units)
        properties.forEach(prop => {
            if (prop.name && prop.name.trim() !== '') {
                const regex = new RegExp(`\\b${prop.name}\\b`, 'gi');
                if (expression.match(regex)) {
                    // Combine value and unit if both exist
                    let propValue = prop.value || '0';
                    if (prop.unit && prop.unit.trim() !== '') {
                        propValue = `${propValue}${prop.unit}`;
                    }
                    expression = expression.replace(regex, propValue);
                }
            }
        });
    } else if (properties && typeof properties === 'object') {
        // Handle properties map (legacy format)
        Object.keys(properties).forEach(key => {
            const regex = new RegExp(`\\b${key}\\b`, 'gi');
            expression = expression.replace(regex, properties[key]);
        });
    }

    // Handle inline numeric+unit tokens (e.g., 10cm, 1m, 25mm)
    // We'll normalize length units to meters (base) for calculation.
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (match, num, unit) => {
        const valueInMeters = convertToUnit(parseFloat(num), unit.toLowerCase(), 'm');
        return valueInMeters.toString();
    });

    // Handle weight units (normalize to kg)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(g|kg)\b/gi, (match, num, unit) => {
        const valueInKg = convertToUnit(parseFloat(num), unit.toLowerCase(), 'kg');
        return valueInKg.toString();
    });

    // Handle volume units (normalize to L)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mL|L)\b/gi, (match, num, unit) => {
        const valueInL = convertToUnit(parseFloat(num), unit.toLowerCase(), 'L');
        return valueInL.toString();
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
    const [selectedFormule, setSelectedFormule] = useState(null);
    const [Formules, setFormules] = useState([]); // For ValueInputModal only
    // Track which waarde input was last focused so we can insert a picked Formule
    const [lastFocusedValuePropertyId, setLastFocusedValuePropertyId] = useState(null);
    // ValueInputModal state
    const [showValueInputModal, setShowValueInputModal] = useState(false);
    const [valueInputPropertyId, setValueInputPropertyId] = useState(null);

    const webInputRef = useRef(null);

    const objectIdForProperties = props.currentPath[props.currentPath.length - 1];
    let item = props.findItemByPath(props.objectsHierarchy, props.currentPath);
    // Allow working on a temporary object before it exists in DB
    if (!item && typeof objectIdForProperties === 'string' && objectIdForProperties.startsWith('temp_')) {
        item = {
            id: objectIdForProperties,
            naam: props.fallbackTempItem?.naam || 'Nieuw object',
            properties: [],
            children: [],
        };
    }

    if (!item) return null;

    const allUnits = ['m', 'cm', 'mm', 'kg', 'g', 'L', 'mL'];

    // Consistent rounding with modal
    const DECIMAL_PLACES = 6;
    const roundToDecimals = (value, decimals = DECIMAL_PLACES) => {
        if (typeof value !== 'number' || !isFinite(value)) return value;
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    };



    // Fetch Formules for ValueInputModal
    useEffect(() => {
        (async () => {
            try {
                const FormulesData = await fetchFormulesApi();
                setFormules(Array.isArray(FormulesData) ? FormulesData : []);
            } catch (error) {
                console.error('Error fetching Formules for ValueInputModal:', error);
                setFormules([]);
            }
        })();
    }, []);

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



    const handleOpenValueInput = (propertyId) => {
        setValueInputPropertyId(propertyId);
        setShowValueInputModal(true);
    };

    const handleValueInputSet = (value, formule) => {
        if (valueInputPropertyId !== null) {
            if (formule && !formule.isManual) {
                // If a predefined formule was selected, evaluate it and store the result
                const evaluation = evaluateFormule(value, newPropertiesList);
                
                if (evaluation.error) {
                    // Show error message to user
                    Alert.alert('Formule Fout', evaluation.error);
                    return;
                } else {
                    // Store the calculated result and the formula expression
                    handlePropertyFieldChange(valueInputPropertyId, 'value', roundToDecimals(evaluation.value, 6).toString());
                    handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', value);
                    handlePropertyFieldChange(valueInputPropertyId, 'Formule_id', formule.id);
                    handlePropertyFieldChange(valueInputPropertyId, 'unit', ''); // Predefined formulas don't have units by default
                }
            } else if (formule && formule.isManual) {
                // Manual input with separate value and unit
                const selectedUnit = formule.unit || '';
                
                // Check if the input looks like a formula
                const hasFormulaPattern = /[+\-*/()]/.test(value) && !/^\d+\.?\d*$/.test(value.trim());
                
                if (hasFormulaPattern) {
                    // Try to evaluate the formula
                    const evaluation = evaluateFormule(value, newPropertiesList);
                    
                    if (evaluation.error) {
                        // Show error message to user
                        Alert.alert('Formule Fout', evaluation.error);
                        return;
                    } else {
                        // Convert the result to the selected unit if needed
                        let finalValue = evaluation.value;
                        if (selectedUnit && ['cm', 'mm', 'g', 'mL'].includes(selectedUnit)) {
                            // Convert from base unit (m, kg, L) to selected unit
                            const baseUnit = selectedUnit === 'cm' || selectedUnit === 'mm' ? 'm' : 
                                            selectedUnit === 'g' ? 'kg' : 'L';
                            finalValue = convertToUnit(evaluation.value, baseUnit, selectedUnit);
                        }
                        
                        // Store the calculated result and the formula expression
                        handlePropertyFieldChange(valueInputPropertyId, 'value', roundToDecimals(finalValue, 6).toString());
                        handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', value);
                        handlePropertyFieldChange(valueInputPropertyId, 'unit', selectedUnit);
                    }
                } else {
                    // Regular value with unit
                    handlePropertyFieldChange(valueInputPropertyId, 'value', value);
                    handlePropertyFieldChange(valueInputPropertyId, 'unit', selectedUnit);
                    handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', '');
                }
            } else {
                // Legacy: Parse combined value+unit (e.g., "10m" -> value="10", unit="m")
                const unitRegex = /(.*?)([a-zA-Z]+)$/;
                const match = value.match(unitRegex);
                
                if (match) {
                    const numericValue = match[1].trim();
                    const unit = match[2];
                    handlePropertyFieldChange(valueInputPropertyId, 'value', numericValue);
                    handlePropertyFieldChange(valueInputPropertyId, 'unit', unit);
                } else {
                    // No unit found, store as-is
                    handlePropertyFieldChange(valueInputPropertyId, 'value', value);
                    handlePropertyFieldChange(valueInputPropertyId, 'unit', '');
                }
                handlePropertyFieldChange(valueInputPropertyId, 'Formule_expression', '');
            }
        }
        setShowValueInputModal(false);
        setValueInputPropertyId(null);
    };

    const handleAddFormuleFromValueInput = () => {
        setShowValueInputModal(false);
        // Note: Formula creation is now handled from HierarchicalObjectsScreen
        console.log('Formula creation should be done from main objects screen');
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
        // Build properties to save (same logic as before)
        const propertiesToSave = newPropertiesList
            .filter(prop => prop.name.trim() !== '')
            .map(prop => {
                const isFormule = prop.Formule_expression && prop.Formule_expression.trim() !== '';
                let finalValue = prop.value;
                let rawFormule = '';

                if (isFormule) {
                    rawFormule = prop.Formule_expression;
                    finalValue = prop.value;
                } else {
                    finalValue = prop.value;
                }

                return {
                    ...prop,
                    waarde: String(roundToDecimals(finalValue || 0)),
                };
            });

        if (propertiesToSave.length === 0) {
            props.setCurrentScreen('properties');
            return;
        }

        // -- Optimistic UI update: inject temporary props immediately --
        const tempNow = Date.now();
        const tempProps = propertiesToSave.map((p, idx) => ({
            ...p,
            id: `temp_prop_${tempNow}_${idx}`,
        }));

        // Add to the live item.properties for immediate visibility
        if (item) {
            item.properties = Array.isArray(item.properties) ? [...item.properties, ...tempProps] : [...tempProps];
        }

        // Mirror into existingPropertiesDraft so PropertiesScreen shows them
        setExistingPropertiesDraft(prev => [
            ...prev,
            ...tempProps.map(tp => ({
                id: tp.id,
                name: tp.name,
                waarde: tp.waarde,
                Formule_id: tp.Formule_id || null,
                Formule_name: tp.Formule_name || '',
                Formule_expression: tp.Formule_expression || '',
                eenheid: tp.eenheid || ''
            }))
        ]);

        // Clear new form fields and navigate back instantly
        setNewPropertiesList([]);
        props.setCurrentScreen('properties');

        // Helper to avoid hanging saves
        const withTimeout = (promiseLike, ms = 20000, label = 'save-properties') => new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
            Promise.resolve(promiseLike).then(
                (val) => { clearTimeout(timeoutId); resolve(val); },
                (err) => { clearTimeout(timeoutId); reject(err); }
            );
        });

        // Perform actual save in background and reconcile results (or rollback on failure)
        try {
            const res = await withTimeout(props.onSave(objectIdForProperties, propertiesToSave), 20000, 'save-properties');

            // If backend returned ids for the saved properties, replace temp ids with real ids
            if (res && Array.isArray(res.ids) && res.ids.length) {
                const ids = res.ids;
                // Update item.properties
                if (item && Array.isArray(item.properties)) {
                    item.properties = item.properties.map((ip) => {
                        const matchIdx = tempProps.findIndex(tp => tp.id === ip.id);
                        if (matchIdx !== -1 && ids[matchIdx]) {
                            return { ...ip, id: ids[matchIdx] };
                        }
                        return ip;
                    });
                }
                // Update existingPropertiesDraft
                setExistingPropertiesDraft(prev => prev.map(p => {
                    const matchIdx = tempProps.findIndex(tp => tp.id === p.id);
                    if (matchIdx !== -1 && ids[matchIdx]) {
                        return { ...p, id: ids[matchIdx] };
                    }
                    return p;
                }));
            } else if (res === false || (res && res.success === false)) {
                throw new Error(res?.message || 'Opslaan mislukt');
            }
            // succes: nothing more to do (UI already updated)
        } catch (e) {
            // Rollback optimistic items on error
            if (item && Array.isArray(item.properties)) {
                item.properties = item.properties.filter(ip => !String(ip.id).startsWith('temp_prop_'));
            }
            setExistingPropertiesDraft(prev => prev.filter(p => !String(p.id).startsWith('temp_prop_')));
            Alert.alert('Fout', 'Opslaan van eigenschappen mislukt. Probeer opnieuw.');
            console.error('Save properties failed', e);
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
                                                {prop.Formule_expression && prop.Formule_expression.trim() !== '' && /[+\-*/()]/.test(prop.Formule_expression) && !/^\d+\.?\d*[a-zA-Z]*$/.test(prop.Formule_expression.trim()) && (
                                                    <>
                                                        <Text
                                                            style={{
                                                                color: colors.lightGray500,
                                                                fontSize: 13,
                                                                fontStyle: 'italic',
                                                            }}
                                                        >
                                                            {prop.Formule_expression}
                                                        </Text>
                                                        {(() => {
                                                            // Create combined properties list for formula evaluation
                                                            const allProperties = [
                                                                ...(item.properties || []).map(p => ({
                                                                    name: p.name,
                                                                    value: p.waarde,
                                                                    unit: p.eenheid || ''
                                                                })),
                                                                ...newPropertiesList.map(p => ({
                                                                    name: p.name,
                                                                    value: p.value,
                                                                    unit: p.unit || ''
                                                                }))
                                                            ];
                                                            const evaluation = evaluateFormule(prop.Formule_expression, allProperties);
                                                            if (evaluation.error) {
                                                                return (
                                                                    <Text style={{
                                                                        color: colors.red500,
                                                                        fontSize: 12,
                                                                        fontStyle: 'italic',
                                                                    }}>
                                                                        {evaluation.error}
                                                                    </Text>
                                                                );
                                                            } else {
                                                                return (
                                                                    <Text style={[AppStyles.propertyValue, { marginTop: 2 }]}>
                                                                        {(() => {
                                                                            if (prop.eenheid && ['cm', 'mm', 'g', 'mL'].includes(prop.eenheid)) {
                                                                                const convertedValue = convertToUnit(evaluation.value, 'm', prop.eenheid);
                                                                                return roundToDecimals(convertedValue, 6);
                                                                            }
                                                                            return roundToDecimals(evaluation.value, 6);
                                                                        })()}
                                                                        {prop.eenheid ? ` ${prop.eenheid}` : ''}
                                                                    </Text>
                                                                );
                                                            }
                                                        })()}
                                                    </>
                                                )}
                                                {(!prop.Formule_expression || prop.Formule_expression.trim() === '' || !/[+\-*/()]/.test(prop.Formule_expression) || /^\d+\.?\d*[a-zA-Z]*$/.test(prop.Formule_expression.trim())) && (
                                                    <Text style={[AppStyles.propertyValue, { marginTop: 4 }]}>
                                                        {prop.waarde}
                                                        {prop.eenheid ? ` ${prop.eenheid}` : ''}
                                                    </Text>
                                                )}
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
                                            <TouchableOpacity
                                                onPress={() => handleOpenValueInput(prop.id)}
                                                style={[AppStyles.formInput, { justifyContent: 'center' }]}
                                            >
                                                {prop.Formule_expression && prop.Formule_expression.trim() !== '' && /[+\-*/()]/.test(prop.Formule_expression) && !/^\d+\.?\d*[a-zA-Z]*$/.test(prop.Formule_expression.trim()) ? (
                                                    <View>
                                                        <Text style={{color: colors.lightGray500, fontSize: 13, fontStyle: 'italic'}}>
                                                            {prop.Formule_expression}
                                                        </Text>
                                                        <Text style={{color: colors.lightGray800, fontSize: 14, marginTop: 2}}>
                                                            = {roundToDecimals(parseFloat(prop.value) || 0, 6)}{prop.unit || ''}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text style={{ 
                                                        color: (prop.value || prop.unit) ? colors.lightGray800 : colors.lightGray400 
                                                    }}>
                                                        {prop.value ? (prop.value + (prop.unit || '')) : 'Tap om waarde in te voeren...'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
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
                                            <TouchableOpacity
                                                onPress={() => handleOpenValueInput(prop.id)}
                                                style={[AppStyles.formInput, { justifyContent: 'center' }]}
                                            >
                                                {prop.Formule_expression && prop.Formule_expression.trim() !== '' && /[+\-*/()]/.test(prop.Formule_expression) && !/^\d+\.?\d*[a-zA-Z]*$/.test(prop.Formule_expression.trim()) ? (
                                                    <View>
                                                        <Text style={{color: colors.lightGray500, fontSize: 13, fontStyle: 'italic'}}>
                                                            {prop.Formule_expression}
                                                        </Text>
                                                        <Text style={{color: colors.lightGray800, fontSize: 14, marginTop: 2}}>
                                                            {roundToDecimals(parseFloat(prop.value) || 0, 6)}{prop.unit || ''}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text style={{ 
                                                        color: (prop.value || prop.unit) ? colors.lightGray800 : colors.lightGray400 
                                                    }}>
                                                        {prop.value ? (prop.value + (prop.unit || '')) : 'Tap om waarde in te voeren...'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
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
                

                
                {/* Add Property FAB */}
                <TouchableOpacity onPress={addNewPropertyField} style={AppStyles.fab}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </KeyboardAvoidingView>

            {/* Modals */}
            <ValueInputModal
                visible={showValueInputModal}
                onClose={() => {
                    setShowValueInputModal(false);
                    setValueInputPropertyId(null);
                }}
                currentValue={valueInputPropertyId !== null ? 
                    (() => {
                        const prop = newPropertiesList.find(p => p.id === valueInputPropertyId);
                        if (!prop) return '';
                        // If it's a formula, show the formula expression (don't concatenate unit)
                        if (prop.Formule_expression && prop.Formule_expression.trim() !== '') {
                            return prop.Formule_expression;
                        }
                        // Otherwise show the regular value with unit
                        return (prop.value || '') + (prop.unit || '');
                    })() : ''
                }
                currentUnit={valueInputPropertyId !== null ? 
                    (() => {
                        const prop = newPropertiesList.find(p => p.id === valueInputPropertyId);
                        return prop?.unit || '';
                    })() : ''
                }
                onValueSet={handleValueInputSet}
                formules={Formules}
                onAddFormule={handleAddFormuleFromValueInput}
                propertyName={valueInputPropertyId !== null ? 
                    newPropertiesList.find(p => p.id === valueInputPropertyId)?.name || 'Eigenschap' : 'Eigenschap'
                }
            />
        </View>
    );
};

export default AddPropertyScreen;
