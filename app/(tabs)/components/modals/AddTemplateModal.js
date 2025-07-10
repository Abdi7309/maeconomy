import { X, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';
import CONFIG from '../../config/config';

const API_BASE_URL = CONFIG.API_BASE_URL;

const AddTemplateModal = ({ visible, onClose, onTemplateSaved }) => {
    const [templateName, setTemplateName] = useState('');
    const [templateProperties, setTemplateProperties] = useState([{ name: '', value: '' }]);
    const [error, setError] = useState('');

    const handlePropertyChange = (idx, field, value) => {
        const updated = [...templateProperties];
        updated[idx][field] = value;
        setTemplateProperties(updated);
    };

    const handleRemoveProperty = (idx) => {
        if (templateProperties.length === 1) {
            setTemplateProperties([{ name: '', value: '' }]);
            return;
        }
        setTemplateProperties(templateProperties.filter((_, i) => i !== idx));
    };

    const handleAddProperty = () => {
        setTemplateProperties([...templateProperties, { name: '', value: '' }]);
    };

    const handleSave = async () => {
        setError('');
        if (!templateName.trim()) {
            setError('Geef het sjabloon een naam.');
            return;
        }
        const validProps = templateProperties.filter(p => p.name.trim() !== '');
        if (validProps.length === 0) {
            setError('Voeg minimaal één eigenschap toe.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}?entity=templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: templateName.trim(),
                    properties: validProps.map(p => ({
                        property_name: p.name.trim(),
                        property_value: p.value.trim()
                    })),
                }),
            });

            const result = await response.json();
            if (response.ok) {
                Alert.alert('Success', result.message || 'Sjabloon succesvol opgeslagen.');
                onTemplateSaved();
                onClose();
            } else {
                setError(result.message || 'Opslaan mislukt.');
            }
        } catch (e) {
            setError('Netwerkfout bij opslaan.');
        }
    };

    return (
        <Modal transparent visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={AppStyles.modalBackdrop}>
                <View style={[AppStyles.modalContent, { maxWidth: '90%', width: '90%' }]}>
                    <Text style={AppStyles.modalTitle}>Nieuw Sjabloon Toevoegen</Text>
                    <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.6 }} keyboardShouldPersistTaps="handled">
                        <View style={AppStyles.formGroup}>
                            <Text style={AppStyles.formLabel}>Sjabloonnaam</Text>
                            <TextInput placeholder="Bijv. Standaard woning" value={templateName} onChangeText={setTemplateName} style={AppStyles.formInput} />
                        </View>
                        <Text style={[AppStyles.formLabel, { marginTop: 16, marginBottom: 8 }]}>Sjablooneigenschappen</Text>
                        
                        {templateProperties.map((prop, idx) => (
                            // --- START: Platform-specific layout for properties ---
                            Platform.OS === 'web' ? (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <TextInput style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]} placeholder="Naam" value={prop.name} onChangeText={(text) => handlePropertyChange(idx, 'name', text)} />
                                    <TextInput style={[AppStyles.formInput, { flex: 1, marginRight: 8 }]} placeholder="Waarde (optioneel)" value={prop.value} onChangeText={(text) => handlePropertyChange(idx, 'value', text)} />
                                    {(templateProperties.length > 1 || prop.name || prop.value) && (
                                        <TouchableOpacity onPress={() => handleRemoveProperty(idx)} style={{ padding: 4 }}>
                                            <X color={colors.red500} size={20} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                <View key={idx} style={{ borderWidth: 1, borderColor: colors.lightGray100, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                                        <Text style={[AppStyles.formLabel, {color: colors.lightGray500}]}>Eigenschap #{idx + 1}</Text>
                                        {(templateProperties.length > 1 || prop.name || prop.value) && (
                                            <TouchableOpacity onPress={() => handleRemoveProperty(idx)} style={{ padding: 4 }}>
                                                <X color={colors.red500} size={20} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={[AppStyles.formGroup, {marginBottom: 8}]}>
                                        <Text style={AppStyles.formLabel}>Naam</Text>
                                        <TextInput style={AppStyles.formInput} placeholder="Eigenschap naam" value={prop.name} onChangeText={(text) => handlePropertyChange(idx, 'name', text)} />
                                    </View>
                                    <View style={[AppStyles.formGroup, {marginBottom: 0}]}>
                                        <Text style={AppStyles.formLabel}>Standaard Waarde</Text>
                                        <TextInput style={AppStyles.formInput} placeholder="Optioneel" value={prop.value} onChangeText={(text) => handlePropertyChange(idx, 'value', text)} />
                                    </View>
                                </View>
                            )
                            // --- END: Platform-specific layout ---
                        ))}

                        {/* --- START: Redesigned Add Button --- */}
                        <TouchableOpacity
                            onPress={handleAddProperty}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 12,
                                backgroundColor: colors.lightGray50,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: colors.lightGray200,
                                borderStyle: 'dashed',
                                marginTop: 8,
                                marginBottom: 20
                            }}
                        >
                            <Plus color={colors.lightGray500} size={18} style={{ marginRight: 8 }} />
                            <Text style={{ color: colors.lightGray700, fontWeight: '600' }}>
                                Nog een Eigenschap Toevoegen
                            </Text>
                        </TouchableOpacity>
                        {/* --- END: Redesigned Add Button --- */}
                        
                        {error ? <Text style={{ color: colors.red500, marginBottom: 8, textAlign: 'center' }}>{error}</Text> : null}
                        <View style={AppStyles.modalActions}>
                            <TouchableOpacity style={[AppStyles.btnSecondary, AppStyles.btnPrimaryModal]} onPress={onClose}>
                                <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]} onPress={handleSave}>
                                <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default AddTemplateModal;