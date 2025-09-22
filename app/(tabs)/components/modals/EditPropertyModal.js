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
            let formula = val;
            properties.forEach(refProp => {
                if (refProp.name.trim() !== '') {
                    const refValue = getCalculatedValue(refProp, { ...visited });
                    const regex = new RegExp(`\\b${refProp.name}\\b`, 'gi');
                    formula = formula.replace(regex, refValue);
                }
            });
            try {
                if (/[^0-9+\-*/().\s]/.test(formula)) {
                    return 'Error';
                }
                val = roundToDecimals(eval(formula));
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

const evaluateFormula = (formula, propertiesMap) => {
    let expression = formula;
    Object.keys(propertiesMap).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        const before = expression;
        expression = expression.replace(regex, propertiesMap[key]);
        if (before !== expression) {
            console.log('[EditPropertyModal] evaluateFormula replace', { key, value: propertiesMap[key], before, after: expression });
        }
    });
    try {
        if (/[^0-9+\-*/().\s]/.test(expression)) {
            return { value: null, error: 'Onbekende variabelen in formule' };
        }
        const result = roundToDecimals(eval(expression));
        if (typeof result === 'number' && !isNaN(result)) {
            return { value: result, error: null };
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
    const [editedName, setEditedName] = useState(property?.name || '');
    const [editedValue, setEditedValue] = useState(property?.waarde || '');
    const [editedFormula, setEditedFormula] = useState(property?.formule || '');
    const [editedUnit, setEditedUnit] = useState(property?.eenheid || '');

    useEffect(() => {
        if (visible) {
            setEditedName(property?.name || '');
            setEditedValue(property?.waarde || '');
            setEditedFormula(property?.formule || '');
            setEditedUnit(property?.eenheid || '');
        }
    }, [visible, property]);

    const mapForUnit = useMemo(() => {
        const props = (existingPropertiesDraft || []).map(p => ({
            name: p.name,
            value: p.formule && /[+\-*/]/.test(p.formule)
                ? (() => {
                    const innerMap = buildPropertiesMap(existingPropertiesDraft.map(x => ({ name: x.name, value: x.waarde, unit: x.eenheid || '' })), p.eenheid || editedUnit || 'm');
                    const { value: innerVal, error: innerErr } = evaluateFormula(p.formule, innerMap);
                    return innerErr ? 'Error' : String(innerVal);
                })()
                : p.waarde,
            unit: p.eenheid || ''
        }));
        const result = buildPropertiesMap(props, editedUnit || 'm');
        return result;
    }, [existingPropertiesDraft, editedUnit]);

    const preview = useMemo(() => {
        if (!editedFormula || !/[+\-*/]/.test(editedFormula)) {
            return { text: null, error: null };
        }
        const { value, error } = evaluateFormula(editedFormula, mapForUnit);
        const numericLog = formatNumberForLog(value, 6);
        console.log('[EditPropertyModal] preview evaluation', { editedFormula, rawResult: value, ...numericLog, error });
        if (error) return { text: error, error: true };
        const roundedForPreview = roundToDecimals(value);
        const finalText = `${roundedForPreview}${editedUnit ? ` ${editedUnit}` : ''}`;
        console.log('[EditPropertyModal] preview final', { finalText });
        return { text: finalText, error: false };
    }, [editedFormula, mapForUnit, editedUnit]);

    const handleSave = async () => {
        if (!property?.id) { onClose(); return; }
        let waardeToSave = editedValue && editedValue.trim() !== '' ? editedValue : (property?.waarde || '');
        let formuleToSave = editedFormula || '';
        const eenheidToSave = editedUnit || '';

        if (editedFormula && /[+\-*/]/.test(editedFormula)) {
            const { value: evalResult, error } = evaluateFormula(editedFormula, mapForUnit);
            if (error) {
                waardeToSave = 'Error';
            } else {
                waardeToSave = String(roundToDecimals(evalResult));
            }
            // keep logs minimal — no save-time logs
        } else {
            const fromUnit = property?.eenheid || '';
            const toUnit = eenheidToSave;
            if (fromUnit && toUnit && fromUnit !== toUnit && !isNaN(Number(waardeToSave))) {
                waardeToSave = String(roundToDecimals(convertToUnit(Number(waardeToSave), fromUnit, toUnit)));
            }
        }

        const payload = {
            name: editedName && editedName.trim() !== '' ? editedName : property.name,
            waarde: waardeToSave,
            formule: formuleToSave,
            eenheid: eenheidToSave,
        };
        const success = await updateProperty(property.id, payload);
        if (success) {
            onSaved({
                name: editedName && editedName.trim() !== '' ? editedName : property.name,
                waarde: waardeToSave,
                formule: formuleToSave,
                eenheid: eenheidToSave,
            });
            onClose();
        }
    };

    const handleDelete = async () => {
        if (!property?.id) { onClose(); return; }
        const success = await deleteProperty(property.id);
        if (success) {
            onSaved({ __deleted: true, id: property.id });
            onClose();
        }
    };

    if (!visible) return null;

    return (
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

                    <Text style={[AppStyles.formLabel, { marginTop: 12 }]}>Formule</Text>
                    <TextInput
                        placeholder="Bijv. lengte * breedte"
                        value={editedFormula}
                        onChangeText={(text) => { setEditedFormula(text); }}
                        style={AppStyles.formInput}
                    />
                    {editedFormula && /[+\-*/]/.test(editedFormula) && (
                        preview.error ? (
                            <Text style={{ color: colors.red600, marginTop: 6, fontSize: 14 }}>{preview.text}</Text>
                        ) : preview.text ? (
                            <Text style={{ color: colors.blue600, marginTop: 6, fontSize: 16 }}>{preview.text}</Text>
                        ) : null
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
    );
};

export default EditPropertyModal; 