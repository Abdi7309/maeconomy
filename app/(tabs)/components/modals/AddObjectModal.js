import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const AddObjectModal = ({ visible, onClose, onSave }) => {
    const [name, setName] = useState('');

    const handleSave = () => {
        if (name.trim()) {
            onSave(name);
            setName('');
            onClose();
        } else {
            Alert.alert("Input required", "Please enter a name.");
        }
    };

    return (
        <Modal
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={AppStyles.modalBackdrop}
            >
                <View style={[AppStyles.modalContent, { backgroundColor: 'white' }]}>
                    <Text style={AppStyles.modalTitle}>Object Toevoegen</Text>
                    <View style={AppStyles.formGroup}>
                        <Text style={AppStyles.formLabel}>Naam</Text>
                        <TextInput
                            placeholder="Bijv. Kamer"
                            value={name}
                            onChangeText={setName}
                            style={AppStyles.formInput}
                            returnKeyType="done"
                        />
                    </View>
                    <View style={AppStyles.modalActions}>
                        <TouchableOpacity onPress={onClose} style={AppStyles.btnSecondary}>
                            <Text style={AppStyles.btnSecondaryText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}>
                            <Text style={AppStyles.btnPrimaryText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default AddObjectModal;
