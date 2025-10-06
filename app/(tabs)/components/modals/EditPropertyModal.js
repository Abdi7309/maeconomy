import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';
import { deleteProperty, updateProperty } from '../../api';

const unitConversionTable = {
    m:    { m: 1, cm: 0.01, mm: 0.001 },
    cm:   { m: 100, cm: 1, mm: 0.1 },
    mm:   { m: 1000, cm: 10, mm: 1 },
    kg:   { kg: 1, g: 0.001 },
    g:    { kg: 1000, g: 1 },
    L:    { L: 1, mL: 0.001 },
    mL:   { L: 1000, mL: 1 }
};

// Global precision control for numeric outputs
const DECIMAL_PLACES = 6;
const roundToDecimals = (value, decimals = DECIMAL_PLACES) => {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};

const convertToUnit = (value, fromUnit, toUnit) => {
    if (!fromUnit || !toUnit || !unitConversionTable[toUnit] || !unitConversionTable[toUnit][fromUnit]) return value;
    const factor = unitConversionTable[toUnit][fromUnit];
    const converted = roundToDecimals(value * factor);
    return converted;
};

const buildPropertiesMap = (properties, outputUnit) => {
    const map = {};
    function getCalculatedValue(prop, visited = {}) {
        if (visited[prop.name]) return 0;
        visited[prop.name] = true;
        let val = prop.value;
        if (typeof val === 'string' && /[+\-*/]/.test(val)) {
            let Formule = val;
            properties.forEach(refProp => {
                if (refProp.name.trim() !== '') {
                    const refValue = getCalculatedValue(refProp, { ...visited });
                    const regex = new RegExp(`\\b${refProp.name}\\b`, 'gi');
                    Formule = Formule.replace(regex, refValue);
                }
            });
            try {
                if (/[^0-9+\-*/().\s]/.test(Formule)) {
                    return 'Error';
                }
                val = roundToDecimals(eval(Formule));
            } catch (e) {
                val = 'Error';
            }
        }
        if (prop.unit && outputUnit) {
            const beforeUnitVal = Number(val);
            val = convertToUnit(Number(val), prop.unit, outputUnit);
        }
        return val;
    }
    properties.forEach(prop => {
        if (prop.name.trim() !== '') {
            map[prop.name.toLowerCase()] = getCalculatedValue(prop);
        }
    });
    return map;
};

const evaluateFormule = (Formule, propertiesMap) => {
    let expression = Formule;
    // Replace property names with their numeric values from the map
    Object.keys(propertiesMap).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        expression = expression.replace(regex, propertiesMap[key]);
    });

    // Normalize all numbers with units (e.g., "10cm", "1.5m") to the base unit (meters)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (match, num, unit) => {
        const valueInMeters = convertToUnit(parseFloat(num), unit.toLowerCase(), 'm');
        return valueInMeters.toString();
    });

    try {
        // Check for any remaining non-numeric parts that aren't operators
        if (/[^0-9+\-*/().\s]/.test(expression)) {
            return { value: null, error: 'Onbekende variabelen in formule' };
        }
        // Use Function constructor for safer evaluation
        const result = new Function(`return ${expression}`)();
        if (typeof result === 'number' && !isNaN(result)) {
            // The result is now in meters, round it for consistency
            return { value: roundToDecimals(result), error: null };
        }
        return { value: null, error: 'Formule kon niet worden berekend' };
    } catch (e) {
        return { value: null, error: 'Formule kon niet worden berekend' };
    }
};

// Helper for illustrating floating-point vs rounded output in logs only
const formatNumberForLog = (n, decimals = 6) => {
    if (typeof n !== 'number' || isNaN(n)) return { raw: n, toFixed: null, rounded: null, trimmed: null };
    const fixed = n.toFixed(decimals);
    const rounded = Number(fixed);
    const trimmed = String(rounded).replace(/\.?0+$/, '');
    return { raw: n, toFixed: fixed, rounded, trimmed };
};

const EditPropertyModal = ({ visible, onClose, property, existingPropertiesDraft, onSaved }) => {
    const initialFormule = property?.formule || property?.Formule_expression || '';
    const [editedName, setEditedName] = useState(property?.name || '');
    const [editedValue, setEditedValue] = useState(property?.waarde || '');
    const [editedFormule, setEditedFormule] = useState(initialFormule);
    const [editedUnit, setEditedUnit] = useState(property?.eenheid || '');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (visible) {
            setEditedName(property?.name || '');
            setEditedValue(property?.waarde || '');
            setEditedFormule(property?.formule || property?.Formule_expression || '');
            setEditedUnit(property?.eenheid || '');
        }
    }, [visible, property]);

    const mapForUnit = useMemo(() => {
        const props = (existingPropertiesDraft || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    const innerMap = buildPropertiesMap(existingPropertiesDraft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || editedUnit || 'm');
                    const { value: innerVal, error: innerErr } = evaluateFormule(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        const result = buildPropertiesMap(props, editedUnit || 'm');
        return result;
    }, [existingPropertiesDraft, editedUnit]);

    const preview = useMemo(() => {
        if (!editedFormule || !/[+\-*/]/.test(editedFormule)) {
            return { text: null, error: null };
        }
        const { value, error } = evaluateFormule(editedFormule, mapForUnit);
        const numericLog = formatNumberForLog(value, 6);
        console.log('[EditPropertyModal] preview evaluation', { editedFormule, rawResult: value, ...numericLog, error });
        if (error) return { text: error, error: true };
        const roundedForPreview = roundToDecimals(value);
        const finalText = `${roundedForPreview}${editedUnit ? ` ${editedUnit}` : ''}`;
        console.log('[EditPropertyModal] preview final', { finalText });
        return { text: finalText, error: false };
    }, [editedFormule, mapForUnit, editedUnit]);

    const handleSave = async () => {
        if (!property?.id) { onClose(); return; }

        const isFormule = editedFormule && /[+\-*/]/.test(editedFormule);
        let waardeToSend = editedValue; // Default to manually entered value

        if (isFormule) {
            // Use the already calculated preview value, which is correct.
            const { value: calculatedValue, error } = evaluateFormule(editedFormule, mapForUnit);
            if (!error && calculatedValue !== null) {
                // The result from evaluateFormule is in the base unit (m).
                // If a different unit is selected for the property, convert the final result.
                waardeToSend = convertToUnit(calculatedValue, 'm', editedUnit || 'm');
            } else {
                // If there's an error, we can choose to block saving or save the error state.
                // For now, we'll just use the last known good value or the input.
                waardeToSend = editedValue;
            }
        }

        const payload = {
            name: editedName.trim() || property.name,
            waarde: String(roundToDecimals(waardeToSend)), // Ensure it's a rounded string
            raw_Formule: isFormule ? editedFormule : '',
            Formule_id: property?.Formule_id || null,
            eenheid: editedUnit || '',
        };

        const success = await updateProperty(property.id, payload);

        if (success) {
            onSaved({
                name: payload.name,
                waarde: payload.waarde,
                formule: payload.raw_Formule, // Pass back the raw Formule for consistency
                eenheid: payload.eenheid,
                // Pass back other relevant fields from the original property if needed
                Formule_id: property.Formule_id,
                Formule_expression: payload.raw_Formule,
            });
            onClose();
        }
    };

    const handleDelete = () => {
        if (!property?.id) { onClose(); return; }
        console.log('[EditPropertyModal] Delete button pressed for property:', property.name, 'ID:', property.id);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        console.log('[EditPropertyModal] User confirmed delete, starting delete for property ID:', property.id);
        setShowDeleteConfirm(false);
        
        try {
            const success = await deleteProperty(property.id);
            console.log('[EditPropertyModal] Delete API response:', success);
            
            if (success) {
                console.log('[EditPropertyModal] Success - calling onSaved callback');
                onSaved({ __deleted: true, id: property.id });
                onClose();
            }
        } catch (error) {
            console.error('[EditPropertyModal] Exception during delete:', error);
        }
    };

    const handleCancelDelete = () => {
        console.log('[EditPropertyModal] User cancelled delete');
        setShowDeleteConfirm(false);
    };

    if (!visible) return null;

    const existingExpression = property?.formule || property?.Formule_expression || '';
    const hasExistingFormule = !!(existingExpression && /[+\-*/]/.test(existingExpression));
    const userIsTypingFormule = editedFormule && /[+\-*/]/.test(editedFormule);
    const showFormuleField = hasExistingFormule || userIsTypingFormule;

    return (
        <>
        <Modal transparent animationType={Platform.OS === 'ios' ? 'slide' : 'fade'} visible={visible} onRequestClose={onClose}>
            <View style={[AppStyles.modalOverlay, { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                <View style={[AppStyles.card, { width: '90%', maxWidth: 520, padding: 16 }]}> 
                    <Text style={[AppStyles.headerTitleLg, { marginBottom: 12 }]}>Eigenschap bewerken</Text>

                    <Text style={AppStyles.formLabel}>Naam</Text>
                    <TextInput
                        placeholder="Bijv. Lengte"
                        value={editedName}
                        onChangeText={setEditedName}
                        style={AppStyles.formInput}
                    />

                    {showFormuleField && (
                        <>
                            <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Formule</Text>
                            <TextInput
                                placeholder="Bijv. lengte * breedte"
                                value={editedFormule}
                                onChangeText={(text) => { setEditedFormule(text); }}
                                style={AppStyles.formInput}
                            />
                            {editedFormule && /[+\-*/]/.test(editedFormule) && (
                                preview.error ? (
                                    <Text style={{ color: colors.red600, marginTop: 6, fontSize: 14 }}>{preview.text}</Text>
                                ) : preview.text ? (
                                    <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>{preview.text}</Text>
                                ) : null
                            )}
                        </>
                    )}

                    <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Waarde</Text>
                    <TextInput
                        placeholder="Bijv. 20"
                        value={editedValue}
                        onChangeText={setEditedValue}
                        style={AppStyles.formInput}
                    />

                    <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Eenheid</Text>
                    <TextInput
                        placeholder="m/cm/mm/kg/g/L/mL"
                        value={editedUnit}
                        onChangeText={setEditedUnit}
                        style={AppStyles.formInput}
                    />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                        <TouchableOpacity onPress={handleDelete} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.red600, borderRadius: 8 }}>
                            <Text style={{ color: colors.white, fontWeight: '600' }}>Verwijder</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.lightGray200, borderRadius: 8, marginRight: 8 }}>
                                <Text style={{ color: colors.lightGray800, fontWeight: '600' }}>Annuleer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSave} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.blue600, borderRadius: 8 }}>
                                <Text style={{ color: colors.white, fontWeight: '600' }}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>

        {/* Custom Delete Confirmation Modal */}
        <Modal
            visible={showDeleteConfirm}
            transparent={true}
            animationType="fade"
            onRequestClose={handleCancelDelete}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20
            }}>
                <View style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    padding: 24,
                    minWidth: 300,
                    maxWidth: 400
                }}>
                    <Text style={{
                        fontSize: 18,
                        fontWeight: '600',
                        textAlign: 'center',
                        marginBottom: 16,
                        color: '#1F2937'
                    }}>
                        Bevestig
                    </Text>
                    
                    <Text style={{
                        fontSize: 16,
                        textAlign: 'center',
                        marginBottom: 24,
                        color: '#4B5563',
                        lineHeight: 24
                    }}>
                        Weet je zeker dat je deze eigenschap wilt verwijderen?
                    </Text>
                    
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: 12
                    }}>
                        <TouchableOpacity
                            onPress={handleCancelDelete}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                backgroundColor: colors.lightGray200,
                                borderRadius: 8
                            }}
                        >
                            <Text style={{
                                color: colors.lightGray800,
                                fontWeight: '600',
                                textAlign: 'center'
                            }}>Annuleer</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            onPress={handleConfirmDelete}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                backgroundColor: colors.red600,
                                borderRadius: 8
                            }}
                        >
                            <Text style={{
                                color: colors.white,
                                fontWeight: '600',
                                textAlign: 'center'
                            }}>
                                Verwijder
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
        </>
    );
};

export default EditPropertyModal; 