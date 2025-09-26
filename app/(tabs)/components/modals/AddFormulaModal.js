import { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles from '../../AppStyles';
import { createFormula } from '../../api';

const AddFormulaModal = ({ visible, onClose, onSave }) => {
    const [formulaName, setFormulaName] = useState('');
    const [formulaExpression, setFormulaExpression] = useState('');

    const handleSave = async () => {
        try {
            const result = await createFormula(formulaName, formulaExpression);
            if (result.id) {
                onSave({ id: result.id, name: formulaName, formula: formulaExpression });
                setFormulaName('');
                setFormulaExpression('');
                onClose();
            } else {
                console.error('Error saving formula:', result.message);
            }
        } catch (error) {
            console.error('Error saving formula:', error);
        }
    };

    return (
        <Modal visible={visible} animationType="slide">
            <View style={AppStyles.modalContainer}>
                <Text style={AppStyles.modalTitle}>Add New Formula</Text>
                
                <TextInput
                    placeholder="Formula Name"
                    value={formulaName}
                    onChangeText={setFormulaName}
                    style={AppStyles.formInput}
                />
                
                <TextInput
                    placeholder="Formula Expression"
                    value={formulaExpression}
                    onChangeText={setFormulaExpression}
                    style={AppStyles.formInput}
                    multiline
                />
                
                <View style={AppStyles.modalButtons}>
                    <TouchableOpacity onPress={onClose}>
                        <Text>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSave}>
                        <Text>Save</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default AddFormulaModal;