import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';
import { deleteProperty, fetchFormules, updateProperty } from '../../api';

// Extended unit table (length, mass, volume, area, cubic)
const unitConversionTable = {
    // Length
    m:    { m: 1, cm: 0.01, mm: 0.001 },
    cm:   { m: 100, cm: 1, mm: 0.1 },
    mm:   { m: 1000, cm: 10, mm: 1 },
    // Mass
    kg:   { kg: 1, g: 0.001 },
    g:    { kg: 1000, g: 1 },
    // Volume (liquid metric)
    L:    { L: 1, mL: 0.001, 'm³': 0.001 }, // include m³ mapping (1 L = 0.001 m³)
    mL:   { L: 1000, mL: 1, 'm³': 0.000001 },
    'm³': { 'm³': 1, L: 0.001, mL: 0.000001 },
    // Area
    'm²': { 'm²': 1, 'cm²': 0.0001, 'mm²': 0.000001 },
    'cm²': { 'm²': 10000, 'cm²': 1, 'mm²': 0.01 },
    'mm²': { 'm²': 1000000, 'cm²': 100, 'mm²': 1 }
};

const sanitizeUnit = (u) => u
    ?.replace(/m\^2/i, 'm²')
    ?.replace(/m\^3/i, 'm³')
    ?.replace(/^l$/i, 'L')
    ?.replace(/^ml$/i, 'mL')
    ?.replace('²', '²')
    ?.replace('³', '³');

// Global precision control for numeric outputs
const DECIMAL_PLACES = 6;
const roundToDecimals = (value, decimals = DECIMAL_PLACES) => {
    if (typeof value !== 'number' || !isFinite(value)) return value;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};

const convertToUnit = (value, fromUnit, toUnit) => {
    const f = sanitizeUnit(fromUnit);
    const t = sanitizeUnit(toUnit);
    if (!f || !t || !unitConversionTable[t] || !unitConversionTable[t][f]) return value;
    const factor = unitConversionTable[t][f];
    return roundToDecimals(value * factor);
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
    // Check if Formule is valid
    if (!Formule || typeof Formule !== 'string') {
        return { value: 0, error: 'Invalid formula' };
    }
    
    let expression = Formule;
    // Replace property names with their numeric values from the map
    Object.keys(propertiesMap).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        expression = expression.replace(regex, propertiesMap[key]);
    });

    // Normalize length units to meters
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/gi, (match, num, unit) => {
        const valueInMeters = convertToUnit(parseFloat(num), unit.toLowerCase(), 'm');
        return valueInMeters.toString();
    });

    // Normalize mass units to kg
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(g|kg)\b/gi, (match, num, unit) => {
        const valueInKg = convertToUnit(parseFloat(num), unit.toLowerCase(), 'kg');
        return valueInKg.toString();
    });

    // Normalize volume units to liters (L)
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(mL|L)\b/gi, (match, num, unit) => {
        const valueInL = convertToUnit(parseFloat(num), unit, 'L');
        return valueInL.toString();
    });

    // Normalize area units to m²
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m²|cm²|mm²)\b/gi, (match, num, unit) => {
        const valueInM2 = convertToUnit(parseFloat(num), unit, 'm²');
        return valueInM2.toString();
    });

    // Normalize cubic units to m³
    expression = expression.replace(/(\d+(?:\.\d+)?)\s*(m³)\b/gi, (match, num, unit) => {
        const valueInM3 = convertToUnit(parseFloat(num), unit, 'm³');
        return valueInM3.toString();
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
    // Formula selection state
    const [editedFormuleId, setEditedFormuleId] = useState(property?.Formule_id ?? null);
    const [showFormulePicker, setShowFormulePicker] = useState(false);
    const [availableFormules, setAvailableFormules] = useState([]);
    const [loadingFormules, setLoadingFormules] = useState(false);

    const handleUnitChange = (newUnit) => {
        const currentUnit = editedUnit;
        const currentValue = parseFloat(editedValue.replace(',', '.'));
        if (!isNaN(currentValue) && currentUnit && newUnit && currentUnit !== newUnit) {
            // Convert only if both are recognized
            const convertedValue = convertToUnit(currentValue, currentUnit, newUnit);
            setEditedValue(String(convertedValue));
        }
        setEditedUnit(newUnit);
    };

    useEffect(() => {
        if (visible) {
            setEditedName(property?.name || '');
            setEditedValue(property?.waarde || '');
            setEditedFormule(property?.formule || property?.Formule_expression || '');
            setEditedUnit(property?.eenheid || '');
            setEditedFormuleId(property?.Formule_id ?? null);
        }
    }, [visible, property]);

    const loadFormules = async () => {
        try {
            setLoadingFormules(true);
            const list = await fetchFormules();
            setAvailableFormules(Array.isArray(list) ? list : []);
        } catch (e) {
            setAvailableFormules([]);
        } finally {
            setLoadingFormules(false);
        }
    };

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
        if (!editedFormule || !/[+\-*/]/.test(editedFormule)) return { text: null, error: null };
        const { value, error } = evaluateFormule(editedFormule, mapForUnit);
        if (error || value == null) return { text: error || 'Formule fout', error: true };
        const hasMulDiv = /[*/]/.test(editedFormule);
        let displayValue = value;
        let showUnit = false;
        const u = sanitizeUnit(editedUnit);
        const isLength = ['m','cm','mm'].includes(u);
        const isMass = ['kg','g'].includes(u);
        const isVolume = ['L','mL','m³'].includes(u);
        const isArea = ['m²','cm²','mm²'].includes(u);
        if (u) {
            if (!hasMulDiv && (isLength || isMass || isVolume)) {
                // Convert additive formulas for linear/mass/volume units
                const base = isLength ? 'm' : isMass ? 'kg' : (isVolume ? (u === 'm³' ? 'm³' : 'L') : u);
                displayValue = convertToUnit(value, base, u);
                showUnit = true;
            } else if (hasMulDiv && (isArea || (isVolume && u !== 'L'))) {
                // Convert multiplicative formulas to area/volume units if explicitly chosen (avoid showing 'L' for cubic unless chosen)
                const base = isArea ? 'm²' : 'm³';
                displayValue = convertToUnit(value, base, u);
                showUnit = true;
            }
        }
        const finalText = `${roundToDecimals(displayValue)}${showUnit ? ` ${u}` : ''}`;
        return { text: finalText, error: false };
    }, [editedFormule, mapForUnit, editedUnit]);

    const handleSave = async () => {
        if (!property?.id) { onClose(); return; }

        const isFormule = editedFormule && /[+\-*/]/.test(editedFormule);
        let waardeToSend = editedValue; // Default to manually entered value

        if (isFormule) {
            const { value: calculatedValue, error } = evaluateFormule(editedFormule, mapForUnit);
            if (!error && calculatedValue !== null) {
                const hasMulDiv = /[*/]/.test(editedFormule);
                const u = sanitizeUnit(editedUnit);
                const isLength = ['m','cm','mm'].includes(u);
                const isMass = ['kg','g'].includes(u);
                const isVolume = ['L','mL','m³'].includes(u);
                const isArea = ['m²','cm²','mm²'].includes(u);
                let base = 'm'; // default
                if (isMass) base = 'kg';
                else if (isVolume) base = u === 'm³' ? 'm³' : 'L';
                else if (isArea) base = 'm²';
                if (hasMulDiv) {
                    // Multiplicative: allow area/volume conversion only, skip linear/mass if chosen incorrectly
                    if (isArea || isVolume) {
                        waardeToSend = convertToUnit(calculatedValue, base, u);
                    } else {
                        waardeToSend = calculatedValue; // store base value
                    }
                } else {
                    // Additive/subtractive: allow length/mass/volume conversions
                    if (isLength || isMass || isVolume) {
                        waardeToSend = convertToUnit(calculatedValue, base, u);
                    } else {
                        waardeToSend = calculatedValue; // base or unchanged
                    }
                }
            } else {
                waardeToSend = editedValue; // fallback
            }
        }

        const payload = {
            name: editedName.trim() || property.name,
            waarde: String(roundToDecimals(waardeToSend)), // Ensure it's a rounded string
            Formule_id: editedFormuleId ?? null,
            eenheid: editedUnit || '',
        };

        const success = await updateProperty(property.id, payload);

        if (success) {
            onSaved({
                name: payload.name,
                waarde: payload.waarde,
                formule: isFormule ? editedFormule : '', // Pass back the formule expression for consistency
                eenheid: payload.eenheid,
                // Pass back other relevant fields from the original property if needed
                Formule_id: editedFormuleId ?? null,
                Formule_expression: isFormule ? editedFormule : '',
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
    // Include picker state so pressing the button reveals the formule UI even before typing/selecting
    const showFormuleField = hasExistingFormule || userIsTypingFormule || !!editedFormuleId || showFormulePicker;

    // Auto-load formulas when picker becomes visible and we have none yet
    useEffect(() => {
        if (showFormulePicker && !availableFormules.length && !loadingFormules) {
            loadFormules();
        }
    }, [showFormulePicker]);

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

                    {!showFormuleField && (
                        <View style={{ marginTop: 8, marginBottom: 4 }}>
                            <TouchableOpacity
                                onPress={async () => {
                                    setShowFormulePicker((v) => !v);
                                    if (!availableFormules.length) await loadFormules();
                                }}
                                style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.blue50, borderRadius: 6, borderWidth: 1, borderColor: colors.blue200 }}
                            >
                                <Text style={{ color: colors.blue700, fontWeight: '600' }}>Formule kiezen</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showFormuleField && (
                        <>
                            <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Formule</Text>
                            <TextInput
                                placeholder="Bijv. lengte * breedte"
                                value={editedFormule}
                                onChangeText={(text) => { setEditedFormule(text); }}
                                style={AppStyles.formInput}
                            />
                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <TouchableOpacity
                                    onPress={async () => {
                                        setShowFormulePicker((v) => !v);
                                        if (!availableFormules.length) await loadFormules();
                                    }}
                                    style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.blue50, borderRadius: 6, borderWidth: 1, borderColor: colors.blue200 }}
                                >
                                    <Text style={{ color: colors.blue700, fontWeight: '600' }}>Formule kiezen</Text>
                                </TouchableOpacity>
                                {(editedFormuleId || editedFormule) && (
                                    <TouchableOpacity
                                        onPress={() => { setEditedFormuleId(null); setEditedFormule(''); setShowFormulePicker(false); }}
                                        style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.lightGray100, borderRadius: 6, borderWidth: 1, borderColor: colors.lightGray300 }}
                                    >
                                        <Text style={{ color: colors.lightGray800, fontWeight: '600' }}>Loskoppelen</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {editedFormule && /[+\-*/]/.test(editedFormule) && (
                                preview.error ? (
                                    <Text style={{ color: colors.red600, marginTop: 6, fontSize: 14 }}>{preview.text}</Text>
                                ) : preview.text ? (
                                    <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>{preview.text}</Text>
                                ) : null
                            )}

                            {showFormulePicker && (
                                <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.lightGray300, borderRadius: 8, maxHeight: 220, overflow: 'hidden' }}>
                                    <View style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.lightGray50, borderBottomWidth: 1, borderBottomColor: colors.lightGray200 }}>
                                        <Text style={{ color: colors.lightGray800, fontWeight: '600' }}>Kies een formule</Text>
                                    </View>
                                    <View style={{ padding: 8 }}>
                                        {loadingFormules ? (
                                            <Text style={{ color: colors.lightGray700, paddingVertical: 8 }}>Laden…</Text>
                                        ) : (availableFormules.length === 0 ? (
                                            <View style={{ paddingVertical: 8 }}>
                                                <Text style={{ color: colors.lightGray700 }}>Geen formules</Text>
                                                <Text style={{ color: colors.lightGray500, marginTop: 2 }}>Voeg eerst een formule toe</Text>
                                            </View>
                                        ) : (
                                            availableFormules.map((f) => (
                                                <TouchableOpacity
                                                    key={f.id}
                                                    onPress={() => {
                                                        setEditedFormuleId(f.id);
                                                        setEditedFormule(f.formule || '');
                                                        setShowFormulePicker(false);
                                                    }}
                                                    style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: (editedFormuleId === f.id) ? colors.blue300 : 'transparent', backgroundColor: (editedFormuleId === f.id) ? colors.blue50 : colors.white, marginBottom: 6 }}
                                                >
                                                    <Text style={{ fontWeight: '600', color: colors.lightGray900 }}>{f.name || 'Naamloos'}</Text>
                                                    {f.formule ? (
                                                        <Text style={{ color: colors.lightGray700, marginTop: 2 }}>{f.formule}</Text>
                                                    ) : null}
                                                </TouchableOpacity>
                                            ))
                                        ))}
                                    </View>
                                </View>
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
                    <View style={styles.unitPickerContainer}>
                        {['Geen', 'm', 'cm', 'mm', 'm²', 'cm²', 'mm²', 'm³', 'kg', 'g', 'L', 'mL'].map((unit) => (
                            <TouchableOpacity
                                key={unit}
                                style={[
                                    styles.unitButton,
                                    (editedUnit === unit || (unit === 'Geen' && !editedUnit)) && styles.unitButtonSelected
                                ]}
                                onPress={() => handleUnitChange(unit === 'Geen' ? '' : unit)}
                            >
                                <Text style={[
                                    styles.unitButtonText,
                                    (editedUnit === unit || (unit === 'Geen' && !editedUnit)) && styles.unitButtonTextSelected
                                ]}>
                                    {unit}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

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

const styles = {
    unitPickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    unitButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.lightGray300,
        backgroundColor: colors.white,
        minWidth: 50,
        alignItems: 'center',
    },
    unitButtonSelected: {
        borderColor: colors.blue600,
        backgroundColor: colors.blue50,
    },
    unitButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.lightGray700,
    },
    unitButtonTextSelected: {
        color: colors.blue700,
        fontWeight: '600',
    },
};

export default EditPropertyModal; 