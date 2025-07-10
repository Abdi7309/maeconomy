import { Plus } from 'lucide-react-native';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const TemplatePickerModal = ({ visible, onClose, templates, onSelect, onAddNewTemplate }) => {
    return (
        <Modal
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            animationType="fade"
        >
            <TouchableOpacity style={AppStyles.modalBackdrop} activeOpacity={1} onPressOut={onClose}>
                <View style={[AppStyles.modalContent, {width: '80%'}]}>
                    <Text style={AppStyles.modalTitle}>Kies een Sjabloon</Text>
                    <ScrollView>
                         <TouchableOpacity style={AppStyles.filterOptionButton} onPress={() => onSelect(null)}>
                            <Text style={AppStyles.filterOptionText}>Geen sjabloon</Text>
                        </TouchableOpacity>
                        {Object.entries(templates).map(([templateId, tpl]) => (
                            <TouchableOpacity key={templateId} style={AppStyles.filterOptionButton} onPress={() => onSelect(templateId)}>
                                <Text style={AppStyles.filterOptionText}>{tpl.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* --- START: Added Button --- */}
                    <View style={{borderTopWidth: 1, borderColor: colors.lightGray100, marginVertical: 8, marginHorizontal: -16}} />
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}
                        onPress={onAddNewTemplate}
                    >
                        <Plus color={colors.blue600} size={20} style={{ marginRight: 8 }} />
                        <Text style={{ color: colors.blue600, fontWeight: '600', fontSize: 15 }}>
                            Nieuw Sjabloon
                        </Text>
                    </TouchableOpacity>
                    {/* --- END: Added Button --- */}

                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default TemplatePickerModal;