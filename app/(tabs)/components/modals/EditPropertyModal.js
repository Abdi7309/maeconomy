import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';
import { updateProperty } from '../../api';

const unitConversionTable = {
    m:    { m: 1, cm: 0.01, mm: 0.001 },
    cm:   { m: 100, cm: 1, mm: 0.1 },
    mm:   { m: 1000, cm: 10, mm: 1 },
    kg:   { kg: 1, g: 0.001 },
    g:    { kg: 1000, g: 1 },
    L:    { L: 1, mL: 0.001 },
    mL:   { L: 1000, mL: 1 }
};

const convertToUnit = (value, fromUnit, toUnit) => {
    if (!fromUnit || !toUnit || !unitConversionTable[toUnit] || !unitConversionTable[toUnit][fromUnit]) return value;
    return value * unitConversionTable[toUnit][fromUnit];
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
                val = eval(formula);
            } catch (e) {
                val = 'Error';
            }
        }
        if (prop.unit && outputUnit) {
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
        expression = expression.replace(regex, propertiesMap[key]);
    });
    try {
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
        return buildPropertiesMap(props, editedUnit || 'm');
    }, [existingPropertiesDraft, editedUnit]);

    const preview = useMemo(() => {
        if (!editedFormula || !/[+\-*/]/.test(editedFormula)) return { text: null, error: null };
        const { value, error } = evaluateFormula(editedFormula, mapForUnit);
        if (error) return { text: error, error: true };
        return { text: `${value}${editedUnit ? ` ${editedUnit}` : ''}`, error: false };
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
                waardeToSave = String(evalResult);
            }
        } else {
            const fromUnit = property?.eenheid || '';
            const toUnit = eenheidToSave;
            if (fromUnit && toUnit && fromUnit !== toUnit && !isNaN(Number(waardeToSave))) {
                waardeToSave = String(convertToUnit(Number(waardeToSave), fromUnit, toUnit));
            }
        }

        const success = await updateProperty(property.id, {
            name: editedName && editedName.trim() !== '' ? editedName : property.name,
            waarde: waardeToSave,
            formule: formuleToSave,
            eenheid: eenheidToSave,
        });
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
                        onChangeText={setEditedFormula}
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

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                        <TouchableOpacity onPress={handleSave}>
                            <Text>Opslaan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginLeft: 12 }} onPress={onClose}>
                            <Text>Annuleer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default EditPropertyModal; 