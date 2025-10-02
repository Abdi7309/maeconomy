import { useEffect, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles from '../../AppStyles';
import { createFormula, deleteFormula, updateFormula } from '../../api';

const AddFormulaModal = ({ visible, onClose, onSave, editingFormula = null, onDelete }) => {
    const isEditing = !!editingFormula;
    const [formulaName, setFormulaName] = useState(editingFormula?.name || '');
    const [formulaExpression, setFormulaExpression] = useState(editingFormula?.formula || '');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (visible) {
            setFormulaName(editingFormula?.name || '');
            setFormulaExpression(editingFormula?.formula || '');
        }
    }, [visible, editingFormula]);

    const handleSave = async () => {
        try {
            let result;
            if (isEditing) {
                result = await updateFormula(editingFormula.id, formulaName, formulaExpression);
            } else {
                result = await createFormula(formulaName, formulaExpression);
            }
            if (result && (result.id || result.success)) {
                const id = result.id || editingFormula.id;
                onSave({ id, name: formulaName, formula: formulaExpression, __edited: isEditing });
                setFormulaName('');
                setFormulaExpression('');
                Alert.alert('Succes', isEditing ? 'Formule bijgewerkt.' : 'Formule aangemaakt.');
                onClose();
            } else {
                console.error('Error saving formula:', result.message);
                Alert.alert('Fout', result.message || 'Opslaan mislukt.');
            }
        } catch (error) {
            console.error('Error saving formula:', error);
            Alert.alert('Fout', 'Onbekende fout bij opslaan.');
        }
    };

    const handleDelete = async () => {
        console.log('[AddFormulaModal] Delete button pressed');
        console.log('[AddFormulaModal] isEditing:', isEditing);
        console.log('[AddFormulaModal] editingFormula:', editingFormula);
        
        if (!isEditing) {
            console.log('[AddFormulaModal] Not in editing mode, returning');
            return;
        }
        if (!editingFormula?.id) {
            console.log('[AddFormulaModal] No formula ID found');
            Alert.alert('Fout', 'Geen formule ID gevonden.');
            return;
        }
        
        console.log('[AddFormulaModal] Showing confirmation dialog');
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        console.log('[Delete] User confirmed delete, starting delete for formula ID:', editingFormula.id);
        console.log('[Delete] About to call deleteFormula...');
        setShowDeleteConfirm(false);
        
        try {
            const res = await deleteFormula(editingFormula.id);
            console.log('[Delete] API Response:', res);
            
            if (res && res.success === true) {
                console.log('[Delete] Success - calling onDelete callback');
                onDelete && onDelete({ id: editingFormula.id, __deleted: true });
                Alert.alert('Succes', 'Formule verwijderd.');
                onClose();
            } else {
                console.error('[Delete] Failed:', res);
                Alert.alert('Fout', res?.message || 'Kon formule niet verwijderen.');
            }
        } catch (error) {
            console.error('[Delete] Exception:', error);
            Alert.alert('Fout', 'Netwerkfout bij verwijderen.');
        }
    };

    const handleCancelDelete = () => {
        console.log('[AddFormulaModal] User cancelled delete');
        setShowDeleteConfirm(false);
    };

    return (
        <>
        <Modal visible={visible} animationType="fade" transparent>
            <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'center', alignItems:'center', padding:16 }}>
            <View style={[AppStyles.modalContainer, { alignSelf:'center' }] }>
                <Text style={[AppStyles.modalTitle, { textAlign: 'center', alignSelf: 'center', width: '100%' }]}>
                    {isEditing ? 'Formule Bewerken' : 'Nieuwe Formule'}
                </Text>
                
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
                
                <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:24, gap:12, flexWrap:'wrap' }}>
                    <TouchableOpacity onPress={onClose} style={[AppStyles.btnSecondary, { minWidth:110 }]}> 
                        <Text style={AppStyles.btnSecondaryText}>Annuleer</Text>
                    </TouchableOpacity>
                    {isEditing && (
                        <TouchableOpacity onPress={handleDelete} style={[AppStyles.btnSecondary, { borderColor:'#DC2626', backgroundColor:'#FEE2E2' }]}> 
                            <Text style={[AppStyles.btnSecondaryText, { color:'#B91C1C', fontWeight:'600' }]}>Verwijder</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleSave} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}> 
                        <Text style={AppStyles.btnPrimaryText}>{isEditing ? 'Update' : 'Opslaan'}</Text>
                    </TouchableOpacity>
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
                        Weet je zeker dat je deze formule wilt verwijderen?
                    </Text>
                    
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: 12
                    }}>
                        <TouchableOpacity
                            onPress={handleCancelDelete}
                            style={[AppStyles.btnSecondary, { flex: 1 }]}
                        >
                            <Text style={AppStyles.btnSecondaryText}>Annuleer</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            onPress={handleConfirmDelete}
                            style={[AppStyles.btnSecondary, {
                                flex: 1,
                                borderColor: '#DC2626',
                                backgroundColor: '#FEE2E2'
                            }]}
                        >
                            <Text style={[AppStyles.btnSecondaryText, {
                                color: '#B91C1C',
                                fontWeight: '600'
                            }]}>
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

export default AddFormulaModal;