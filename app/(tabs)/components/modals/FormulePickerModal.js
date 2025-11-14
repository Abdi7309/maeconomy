import { Calculator, Plus, RefreshCw } from 'lucide-react-native';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const FormulePickerModal = ({
    visible,
    onClose,
    Formules = [],
    onSelectFormule,
    onEditFormule,
    onAddFormule,
    loading = false,
    error = null,
    onRetry
}) => {
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
                        <Text style={[AppStyles.modalTitle, { textAlign:'center', flex:1 }]}>Formules Beheren</Text>
                    </View>

                    <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>
                        {loading ? (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                                <Calculator size={42} color={colors.lightGray300} />
                                <Text style={{ marginTop: 14, color: colors.lightGray600, fontWeight: '600' }}>Formules laden...</Text>
                                <Text style={{ marginTop: 4, color: colors.lightGray500, fontSize: 13 }}>Even geduld als de server ontwaakt.</Text>
                            </View>
                        ) : error ? (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                                <Text style={{ color: colors.red600, fontWeight: '600', fontSize: 16 }}>Kon formules niet laden</Text>
                                <Text style={{ marginTop: 6, color: colors.lightGray600, fontSize: 13 }}>{error}</Text>
                                {onRetry && (
                                    <TouchableOpacity
                                        onPress={onRetry}
                                        style={{ flexDirection:'row', alignItems:'center', marginTop:16, backgroundColor: colors.blue600, paddingVertical:10, paddingHorizontal:16, borderRadius:8 }}
                                    >
                                        <RefreshCw color="white" size={16} />
                                        <Text style={{ color:'white', fontWeight:'600', marginLeft:8 }}>Opnieuw</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : FormulesList.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Calculator size={48} color={colors.lightGray400} />
                                <Text style={[AppStyles.infoText, { marginTop: 12 }]}>Geen formules beschikbaar</Text>
                                <Text style={[AppStyles.infoText, { marginTop: 4, fontSize: 14, color: colors.lightGray500 }]}>Voeg je eerste formule toe</Text>
                            </View>
                        ) : (
                            <View>
                                <Text style={[AppStyles.formLabel, { marginBottom: 12, fontSize: 16 }]}>
                                    Beschikbare Formules ({FormulesList.length})
                                </Text>
                                {FormulesList.map((Formule) => (
                                    <TouchableOpacity
                                        key={Formule.id}
                                        style={[
                                            AppStyles.filterOption,
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 16,
                                                marginBottom: 8,
                                                backgroundColor: colors.lightGray50,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: colors.lightGray200,
                                            }
                                        ]}
                                        onPress={() => {
                                            if (onSelectFormule) {
                                                onSelectFormule(Formule);
                                                onClose();
                                            }
                                        }}
                                    >
                                        <Calculator size={20} color={colors.blue600} />
                                        <View style={{ marginLeft: 16, flex: 1 }}>
                                            <Text style={[AppStyles.propertyName, { fontSize: 16, fontWeight: '600', marginLeft: -3 }]}>
                                                {Formule.name}
                                            </Text>
                                            <Text style={[AppStyles.infoText, { marginTop: 4, color: colors.lightGray600, fontSize: 14 }]}>
                                                {Formule.formule}
                                            </Text>
                                        </View>
                                        {onEditFormule && (
                                            <TouchableOpacity 
                                                onPress={() => onEditFormule(Formule)} 
                                                style={{ 
                                                    paddingHorizontal: 8, 
                                                    paddingVertical: 16,
                                                    borderLeftWidth: 1,
                                                    borderLeftColor: colors.lightGray300,
                                                    marginLeft: 8,
                                                    height: 50,
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <Text style={{ color: colors.blue600, fontWeight: '600' }}>Bewerken</Text>
                                            </TouchableOpacity>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                    
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                        {onAddFormule && (
                            <TouchableOpacity
                                style={[AppStyles.btnPrimary, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                                onPress={() => {
                                    onClose();
                                    onAddFormule();
                                }}
                            >
                                <Plus color="white" size={16} />
                                <Text style={[AppStyles.btnPrimaryText, { marginLeft: 8 }]}>Nieuwe Formule</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[AppStyles.btnSecondary, { flex: 1 }]}
                            onPress={onClose}
                        >
                            <Text style={AppStyles.btnSecondaryText}>Sluiten</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default FormulePickerModal;