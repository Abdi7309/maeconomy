import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles from '../../AppStyles';

const FilterModal = ({ visible, onClose, allUsers, userToken, totalObjectCount, onSelectFilter }) => {
    const handleSelect = (option) => {
        onSelectFilter(option);
        onClose();
    };

    const currentUser = allUsers.find(u => u.id === userToken);
    const myObjectsCount = currentUser ? currentUser.object_count : 0;

    return (
        <Modal
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
            animationType="fade"
        >
            <TouchableOpacity style={AppStyles.modalBackdrop} activeOpacity={1} onPressOut={onClose}>
                <View style={[AppStyles.modalContent, {width: '80%'}]}>
                    <Text style={AppStyles.modalTitle}>Filter Objects</Text>
                    <ScrollView>
                        <TouchableOpacity style={AppStyles.filterOptionButton} onPress={() => handleSelect('all')}>
                            <Text style={AppStyles.filterOptionText}>{`All Objects (${totalObjectCount})`}</Text>
                        </TouchableOpacity>
                         <TouchableOpacity style={AppStyles.filterOptionButton} onPress={() => handleSelect(`owner:${userToken}`)}>
                            <Text style={AppStyles.filterOptionText}>{`My Objects (${myObjectsCount})`}</Text>
                        </TouchableOpacity>
                        {allUsers.filter(u => u.id !== userToken).map(user => (
                            <TouchableOpacity key={user.id} style={AppStyles.filterOptionButton} onPress={() => handleSelect(`owner:${user.id}`)}>
                                <Text style={AppStyles.filterOptionText}>{`Objects from ${user.username} (${user.object_count})`}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity
                        onPress={onClose}
                        style={[AppStyles.btnSecondary, {marginTop: 16}]}
                    >
                        <Text style={AppStyles.btnSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default FilterModal;
