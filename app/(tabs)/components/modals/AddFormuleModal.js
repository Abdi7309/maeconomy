import { useEffect, useState } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles from '../../AppStyles';
import { createFormule, deleteFormule, updateFormule } from '../../api';

const AddFormuleModal = ({ visible, onClose, onSave, editingFormule = null, onDelete }) => {
    const isEditing = !!editingFormule;
    const [FormuleName, setFormuleName] = useState(editingFormule?.name || '');
    const [FormuleExpression, setFormuleExpression] = useState(editingFormule?.formule || '');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (visible) {
            setFormuleName(editingFormule?.name || '');
            setFormuleExpression(editingFormule?.formule || '');
        }
    }, [visible, editingFormule]);

    const handleSave = async () => {
        try {
            let result;
            if (isEditing) {
                result = await updateFormule(editingFormule.id, FormuleName, FormuleExpression);
            } else {
                result = await createFormule(FormuleName, FormuleExpression);
            }
            if (result && (result.id || result.success)) {
                const id = result.id || editingFormule.id;
                onSave({ id, name: FormuleName, formule: FormuleExpression, __edited: isEditing });
                setFormuleName('');
                setFormuleExpression('');
                
                // Show special message for updates with recalculated properties
                if (isEditing && result.affected_properties > 0) {
                    Alert.alert(
                        'Formule Bijgewerkt!', 
                        `✅ ${result.recalculated} eigenschappen automatisch herberekend\n❌ ${result.failed} mislukt\n\nDe app wordt nu vernieuwd.`,
                        [{ 
                            text: 'OK', 
                            onPress: () => {
                                // Trigger a page refresh by calling onSave again with refresh flag
                                if (onSave) onSave({ __refresh: true });
                            }
                        }]
                    );
                } else {
                    Alert.alert('Succes', isEditing ? 'Formule bijgewerkt.' : 'Formule aangemaakt.');
                }
                
                onClose();
            } else {
                console.error('Error saving Formule:', result.message);
                Alert.alert('Fout', result.message || 'Opslaan mislukt.');
            }
        } catch (error) {
            console.error('Error saving Formule:', error);
            Alert.alert('Fout', 'Onbekende fout bij opslaan.');
        }
    };

    const handleDelete = async () => {
        console.log('[AddFormuleModal] Delete button pressed');
        console.log('[AddFormuleModal] isEditing:', isEditing);
        console.log('[AddFormuleModal] editingFormule:', editingFormule);
        
        if (!isEditing) {
            console.log('[AddFormuleModal] Not in editing mode, returning');
            return;
        }
        if (!editingFormule?.id) {
            console.log('[AddFormuleModal] No Formule ID found');
            Alert.alert('Fout', 'Geen formule ID gevonden.');
            return;
        }
        
        console.log('[AddFormuleModal] Showing confirmation dialog');
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        console.log('[Delete] User confirmed delete, starting delete for Formule ID:', editingFormule.id);
        console.log('[Delete] About to call deleteFormule...');
        setShowDeleteConfirm(false);
        
        try {
            const res = await deleteFormule(editingFormule.id);
            console.log('[Delete] API Response:', res);
            
            if (res && res.success === true) {
                console.log('[Delete] Success - calling onDelete callback');
                onDelete && onDelete({ id: editingFormule.id, __deleted: true });
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
        console.log('[AddFormuleModal] User cancelled delete');
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
                    placeholder="Formule Name"
                    value={FormuleName}
                    onChangeText={setFormuleName}
                    style={AppStyles.formInput}
                />
                
                <TextInput
                    placeholder="Formule Expression"
                    value={FormuleExpression}
                    onChangeText={setFormuleExpression}
                    style={[AppStyles.formInput, { marginTop: 20 }]}
                    multiline
                />
                
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:24, gap:12, flexWrap:'wrap' }}>
                    {isEditing && (
                        <TouchableOpacity onPress={handleDelete} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal, { backgroundColor:'#DC2626' }]}> 
                            <Text style={AppStyles.btnPrimaryText}>Verwijder</Text>
                        </TouchableOpacity>
                    )}
                    <View style={{ flexDirection:'row', gap:12 }}>
                        <TouchableOpacity onPress={onClose} style={[AppStyles.btnSecondary, { minWidth:110 }]}> 
                            <Text style={AppStyles.btnSecondaryText}>Annuleer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}> 
                            <Text style={AppStyles.btnPrimaryText}>Opslaan</Text>
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
                            style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal, {
                                flex: 1,
                                backgroundColor: '#DC2626'
                            }]}
                        >
                            <Text style={AppStyles.btnPrimaryText}>
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

export default AddFormuleModal;