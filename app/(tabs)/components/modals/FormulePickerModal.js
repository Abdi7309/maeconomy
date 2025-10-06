import { Calculator } from 'lucide-react-native';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const FormulePickerModal = ({ visible, onClose, Formules = [], onSelectFormule, onEditFormule }) => {
    // Extra safety check to ensure Formules is always an array
    const FormulesList = Array.isArray(Formules) ? Formules : [];
    
    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={AppStyles.modalOverlay}>
                <View style={AppStyles.modalContainer}>
                    <View style={[AppStyles.modalHeader, { justifyContent:'center' }]}> 
                        <Text style={[AppStyles.modalTitle, { textAlign:'center', flex:1 }]}>Selecteer Formule</Text>
                    </View>

                    <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
                        {FormulesList.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Calculator size={48} color={colors.lightGray400} />
                                <Text style={[AppStyles.infoText, { marginTop: 12 }]}>
                                    Geen formules beschikbaar
                                </Text>
                                <Text style={[AppStyles.infoText, { marginTop: 4, fontSize: 14, color: colors.lightGray500 }]}>
                                    Maak eerst eigenschappen met formules aan
                                </Text>
                            </View>
                        ) : (
                            <View>
                                <Text style={[AppStyles.formLabel, { marginBottom: 12, fontSize: 16 }]}>
                                    Beschikbare Formules ({FormulesList.length})
                                </Text>
                                {FormulesList.map((Formule) => (
                                    <View
                                        key={Formule.id}
                                        style={[
                                            AppStyles.filterOption,
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 16,
                                                marginBottom: 8,
                                                backgroundColor: colors.white,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: colors.lightGray200,
                                            }
                                        ]}
                                    >
                                        <TouchableOpacity
                                            onPress={() => { onSelectFormule(Formule); onClose(); }}
                                            style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                                        >
                                            <Calculator size={20} color={colors.blue600} />
                                            <View style={{ marginLeft: 16, flex: 1 }}>
                                                <Text style={[AppStyles.propertyName, { fontSize: 16, fontWeight: '600', marginLeft: -3 }]}>
                                                    {Formule.name}
                                                </Text>
                                                <Text style={[AppStyles.infoText, { marginTop: 4, color: colors.lightGray600, fontSize: 14 }]}>
                                                    {Formule.Formule}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                        {onEditFormule && (
                                            <TouchableOpacity 
                                                onPress={() => onEditFormule(Formule)} 
                                                style={{ 
                                                    paddingHorizontal: 8, 
                                                    paddingVertical: 16,
                                                    borderLeftWidth: 1,
                                                    borderLeftColor: '#000000',
                                                    marginLeft: 8,
                                                    height: 50,
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Text style={{ color: '#000000', fontWeight: '600' }}>Bewerken</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                    <TouchableOpacity
                        style={[AppStyles.btnSecondary, { marginTop: 8 }]}
                        onPress={onClose}
                    >
                        <Text style={AppStyles.btnSecondaryText}>Sluiten</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

export default FormulePickerModal;