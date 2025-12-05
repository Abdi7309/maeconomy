import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

// Flatten objects tree to selectable rows with path labels, keep group_key
const flatten = (nodes, prefix = []) => {
  const out = [];
  (nodes || []).forEach((n) => {
    const path = [...prefix, n.naam];
    out.push({ id: n.id, name: n.naam, label: path.join(' / '), group_key: n.group_key || null });
    if (Array.isArray(n.children) && n.children.length) {
      out.push(...flatten(n.children, path));
    }
  });
  return out;
};

const Row = ({ item, selected, onToggle }) => (
  <TouchableOpacity
    onPress={() => onToggle(item.id)}
    style={{
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: selected ? colors.blue100 : colors.white,
      borderWidth: 1,
      borderColor: selected ? colors.blue600 : colors.lightGray300,
      marginBottom: 8,
    }}
  >
    <Text style={{ color: colors.lightGray900 }}>{item.label}</Text>
  </TouchableOpacity>
);

const AttachExistingObjectsModal = ({ visible, onClose, objectsHierarchy, excludeIds = [], onAttach, singleSelection = false }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({}); // id -> true

  const all = useMemo(() => flatten(objectsHierarchy), [objectsHierarchy]);
  // Dedupe by object id so the same object doesn't appear multiple times due to links/placements
  const uniqueAll = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const row of all) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        out.push(row);
      }
    }
    return out;
  }, [all]);

  // Build rows with group headers when multiple items share a group_key
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Filter out excluded
  const items = uniqueAll.filter((x) => !excludeIds.includes(x.id));
    // Group by group_key
    const byGroup = items.reduce((acc, it) => {
      const key = it.group_key || `__solo__${it.id}`;
      if (!acc[key]) acc[key] = { key: it.group_key, items: [] };
      acc[key].items.push(it);
      return acc;
    }, {});

    const result = [];
    Object.values(byGroup).forEach((group) => {
      if (group.key && group.items.length > 1) {
        // Grouped: header (non-selectable) + each member selectable
        const headerTitle = group.items.map((m) => m.name).join(' + ');
        // Filter: include header if any member matches query
        const matchingMembers = group.items.filter((m) => (q ? (m.label.toLowerCase().includes(q) || headerTitle.toLowerCase().includes(q)) : true));
        if (matchingMembers.length > 0) {
          result.push({ type: 'header', id: `hdr-${group.key}`, title: headerTitle });
          matchingMembers.forEach((m) => result.push({ type: 'item', ...m }));
        }
      } else {
        // Not grouped or single-member group: as individual item
        group.items.forEach((m) => {
          if (!q || m.label.toLowerCase().includes(q)) {
            result.push({ type: 'item', ...m });
          }
        });
      }
    });
    return result;
  }, [uniqueAll, excludeIds, query]);

  const toggle = (id) => {
    if (singleSelection) {
      setSelected((prev) => {
        const isSelected = !!prev[id];
        return isSelected ? {} : { [id]: true };
      });
    } else {
      setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  const submit = () => {
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) return onClose();
    onAttach(ids);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={AppStyles.modalBackdrop}>
        <View style={AppStyles.modalContainer}>
          <Text style={AppStyles.modalTitle}>Bestaande objecten toevoegen</Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Zoek…"
            style={[AppStyles.formInput, { marginBottom: 10 }]}
          />

          <ScrollView style={{ maxHeight: 360 }}>
            {rows.length === 0 ? (
              <Text style={{ color: colors.lightGray600 }}>Geen resultaten</Text>
            ) : (
              rows.slice(0, 500).map((entry) => {
                if (entry.type === 'header') {
                  return (
                    <View key={entry.id} style={{
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      marginTop: 6,
                      marginBottom: 2,
                      backgroundColor: colors.lightGray100,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.lightGray200,
                    }}>
                      <Text style={{ color: colors.lightGray700, fontWeight: '600' }}>{entry.title}</Text>
                    </View>
                  );
                }
                return (
                  <Row key={entry.id} item={entry} selected={!!selected[entry.id]} onToggle={toggle} />
                );
              })
            )}
          </ScrollView>

          <View style={AppStyles.modalActions}>
            <TouchableOpacity onPress={onClose} style={AppStyles.btnSecondary}>
              <Text style={AppStyles.btnSecondaryText}>Annuleer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} style={[AppStyles.btnPrimary, AppStyles.btnPrimaryModal]}>
              <Text style={AppStyles.btnPrimaryText}>Toevoegen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AttachExistingObjectsModal;
