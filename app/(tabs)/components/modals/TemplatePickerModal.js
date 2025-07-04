import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import AppStyles from '../../AppStyles';

const TemplatePickerModal = ({ visible, onClose, templates, onSelect }) => {
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
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default TemplatePickerModal;
