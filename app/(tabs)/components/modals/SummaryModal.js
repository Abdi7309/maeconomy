import { ArrowRight } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AppStyles, { colors } from '../../AppStyles';

const SummaryModal = (props) => {
    const {
        visible,
        onClose,
        summaryPropertyName,
        summaryMap,
        summaryRootTotal,
        summaryRootTotalHierarchy,
        summaryRootTotalFlow,
        leftListData,
        leftPage,
        leftPageSize,
        setLeftPage,
        localObjectsHierarchy,
        objectsHierarchy,
        selectedSummaryParentId,
        selectedParentStack = [],
        setSelectedSummaryParentId,
        setSelectedParentStack = () => {},
        setSelectedGroupKey = () => {},
        setSelectedGroupMembers = () => {},
        setPressedGroupKey,
        selectedGroupMembers,
        pressedGroupKey,
        expandedCrumbId,
        setExpandedCrumbId,
        expandedDescendants,
        handleBreadcrumbWheel,
        getGroupMemberNames,
        findNodeById,
        buildGroupedList,
        buildGroupedListSorted,
        rightPage,
        rightPageSize,
        setRightPage,
        setSelectedProperty,
        setCurrentScreen,
    } = props;

    const currentId = (Array.isArray(selectedParentStack) && selectedParentStack.length > 0)
        ? selectedParentStack[selectedParentStack.length - 1]
        : selectedSummaryParentId;
    const currentNode = findNodeById(currentId, localObjectsHierarchy || objectsHierarchy);
    const currentEntry = summaryMap && summaryMap[currentId];

    const breadcrumbScrollRef = useRef(null);
    const [breadcrumbContentWidth, setBreadcrumbContentWidth] = useState(0);
    const [breadcrumbViewWidth, setBreadcrumbViewWidth] = useState(0);
    const [breadcrumbScrollX, setBreadcrumbScrollX] = useState(0);

    const [viewMode, setViewMode] = useState('hierarchy'); // 'hierarchy' | 'flow'
    useEffect(() => {
        if (typeof setLeftPage === 'function') setLeftPage(1);
        if (typeof setRightPage === 'function') setRightPage(1);
        setSelectedSummaryParentId && setSelectedSummaryParentId(null);
        setSelectedParentStack && setSelectedParentStack([]);
        setSelectedGroupKey && setSelectedGroupKey(null);
        setSelectedGroupMembers && setSelectedGroupMembers([]);
        setPressedGroupKey && setPressedGroupKey(null);
        setExpandedCrumbId && setExpandedCrumbId(null);
    }, [viewMode]);

    const isAllowedFlowType = (t) => (t === 'raw_material' || t === 'intermediate' || t === 'component');

    const { leftHierarchyGrouped, leftHierarchyTotal } = useMemo(() => {
        const roots = localObjectsHierarchy || objectsHierarchy || [];
        const hier = (roots || []).filter((n) => !isAllowedFlowType(n?.material_flow_type));
        const grouped = buildGroupedList(hier);
        return { leftHierarchyGrouped: grouped, leftHierarchyTotal: grouped.length };
    }, [localObjectsHierarchy, objectsHierarchy, buildGroupedList]);

    const { leftFlowGrouped, leftFlowTotal } = useMemo(() => {
        const roots = localObjectsHierarchy || objectsHierarchy || [];
        const allowed = (roots || []).filter((n) => isAllowedFlowType(n?.material_flow_type));
        const builder = typeof buildGroupedListSorted === 'function' ? buildGroupedListSorted : buildGroupedList;
        const grouped = builder(allowed);
        return { leftFlowGrouped: grouped, leftFlowTotal: grouped.length };
    }, [localObjectsHierarchy, objectsHierarchy, buildGroupedList, buildGroupedListSorted]);

    return (
        <Modal transparent visible={visible} onRequestClose={() => {}}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={AppStyles.modalOverlay}>
                <View style={[AppStyles.modalContainer, { maxWidth: 900, width: '96%', padding: 12 }]}>
                    <Text style={AppStyles.modalTitle}>Samenvatting — {summaryPropertyName}</Text>
                    <Text style={{ color: colors.lightGray600, marginTop: 6 }}>Tijdelijke berekening (niet opgeslagen)</Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                            onPress={() => setViewMode('hierarchy')}
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: viewMode === 'hierarchy' ? colors.blue600 : colors.lightGray300,
                                backgroundColor: viewMode === 'hierarchy' ? colors.blue100 : colors.white,
                            }}
                        >
                            <Text style={{ color: viewMode === 'hierarchy' ? colors.blue700 : colors.lightGray700, fontWeight: '600' }}>Hierarchie</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setViewMode('flow')}
                            style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: viewMode === 'flow' ? colors.blue600 : colors.lightGray300,
                                backgroundColor: viewMode === 'flow' ? colors.blue100 : colors.white,
                            }}
                        >
                            <Text style={{ color: viewMode === 'flow' ? colors.blue700 : colors.lightGray700, fontWeight: '600' }}>Processtroom</Text>
                        </TouchableOpacity>
                    </View>

                    <View key={`mode-${viewMode}`} style={{ marginTop: 12, maxHeight: 520, flexDirection: 'row', gap: 12 }}>
                        <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: colors.lightGray200, paddingRight: 12 }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>
                                {viewMode === 'hierarchy' ? 'Top-level objecten' : 'Processtroom objecten'}
                            </Text>
                            {viewMode === 'hierarchy' ? (
                                Array.isArray(leftHierarchyGrouped) && leftHierarchyGrouped.length > 0 ? (
                                    <FlatList
                                        key={`left-${viewMode}`}
                                        data={leftHierarchyGrouped.slice(0, leftPage * leftPageSize)}
                                        keyExtractor={(item, idx) => {
                                            if (item.type === 'sep') return `sep-${item.id}`;
                                            if (item.type === 'group-member') return `grp-${item.group_key || 'nogroup'}-${item.item?.id || idx}-${item.idx ?? 0}`;
                                            return `solo-${item.item?.id || idx}`;
                                        }}
                                        renderItem={({ item }) => {
                                            if (item.type === 'sep') return <View key={item.id} style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }} />;
                                            const n = item.item;
                                            const entry = summaryMap && summaryMap[n.id];
                                            const propCount = (item.groupProps && item.groupProps.length) ? item.groupProps.length : (entry && entry.props ? Object.keys(entry.props).length : 0);
                                            if (item.type === 'group-member') {
                                                const anchor = item.anchorId || n.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={`parent-group-${n.id}`}
                                                        onPress={() => {
                                                            setSelectedSummaryParentId(anchor);
                                                            setSelectedParentStack([anchor]);
                                                            setSelectedGroupKey(item.group_key || null);
                                                            setPressedGroupKey(item.group_key || null);
                                                        }}
                                                        style={[AppStyles.card, AppStyles.cardGroupMember, { marginBottom: 6 }]}
                                                    >
                                                        <View style={AppStyles.cardFlex}>
                                                            <View style={AppStyles.cardContent}>
                                                                <Text style={AppStyles.cardTitle}>{n.naam}</Text>
                                                                <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            }
                                            return (
                                                <TouchableOpacity
                                                    key={`parent-solo-${n.id}`}
                                                    onPress={() => {
                                                        setSelectedSummaryParentId(n.id);
                                                        setSelectedParentStack([n.id]);
                                                        setSelectedGroupKey(null);
                                                        setSelectedGroupMembers([]);
                                                        setPressedGroupKey(null);
                                                    }}
                                                    style={[AppStyles.card, { marginBottom: 8 }]}
                                                >
                                                    <View style={AppStyles.cardFlex}>
                                                        <View style={AppStyles.cardContent}>
                                                            <Text style={AppStyles.cardTitle}>{n.naam}</Text>
                                                            <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        }}
                                        ListFooterComponent={() => (
                                            leftHierarchyTotal > (leftPage * leftPageSize) ? (
                                                <TouchableOpacity onPress={() => setLeftPage && setLeftPage((p) => (p || 1) + 1)} style={{ padding: 10, alignItems: 'center' }}>
                                                    <Text style={{ color: colors.blue600 }}>Load more</Text>
                                                </TouchableOpacity>
                                            ) : null
                                        )}
                                    />
                                ) : (
                                    <Text style={{ color: colors.lightGray600 }}>Geen objecten</Text>
                                )
                            ) : (
                                <FlatList
                                    key={`left-${viewMode}`}
                                    data={leftFlowGrouped.slice(0, leftPage * leftPageSize)}
                                    keyExtractor={(item, idx) => {
                                        if (item.type === 'sep') return `sep-${item.id}`;
                                        if (item.type === 'group-member') return `grp-${item.group_key || 'nogroup'}-${item.item?.id || idx}-${item.idx ?? 0}`;
                                        return `solo-${item.item?.id || idx}`;
                                    }}
                                    renderItem={({ item }) => {
                                        if (item.type === 'sep') return <View key={item.id} style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }} />;
                                        const n = item.item;
                                        const entry = summaryMap && summaryMap[n.id];
                                        const propCount = (item.groupProps && item.groupProps.length) ? item.groupProps.length : (entry && entry.props ? Object.keys(entry.props).length : 0);
                                        if (item.type === 'group-member') {
                                            const anchor = item.anchorId || n.id;
                                            return (
                                                <TouchableOpacity
                                                    key={`parent-group-${n.id}`}
                                                    onPress={() => {
                                                        setSelectedSummaryParentId(anchor);
                                                        setSelectedParentStack([anchor]);
                                                        setSelectedGroupKey(item.group_key || null);
                                                        setPressedGroupKey && setPressedGroupKey(item.group_key || null);
                                                    }}
                                                    style={[AppStyles.card, AppStyles.cardGroupMember, { marginBottom: 6 }]}
                                                >
                                                    <View style={AppStyles.cardFlex}>
                                                        <View style={AppStyles.cardContent}>
                                                            <Text style={AppStyles.cardTitle}>{n.naam}</Text>
                                                            <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        }
                                        return (
                                            <TouchableOpacity
                                                key={`parent-solo-${n.id}`}
                                                onPress={() => {
                                                    setSelectedSummaryParentId(n.id);
                                                    setSelectedParentStack([n.id]);
                                                    setSelectedGroupKey(null);
                                                    setSelectedGroupMembers([]);
                                                    setPressedGroupKey && setPressedGroupKey(null);
                                                }}
                                                style={[AppStyles.card, { marginBottom: 8 }]}
                                            >
                                                <View style={AppStyles.cardFlex}>
                                                    <View style={AppStyles.cardContent}>
                                                        <Text style={AppStyles.cardTitle}>{n.naam}</Text>
                                                        <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListFooterComponent={() => (
                                        leftFlowTotal > (leftPage * leftPageSize) ? (
                                            <TouchableOpacity onPress={() => setLeftPage && setLeftPage((p) => (p || 1) + 1)} style={{ padding: 10, alignItems: 'center' }}>
                                                <Text style={{ color: colors.blue600 }}>Load more</Text>
                                            </TouchableOpacity>
                                        ) : null
                                    )}
                                />
                            )}
                        </View>

                        <View style={{ flex: 1, paddingLeft: 12 }}>
                            {(!selectedSummaryParentId && selectedParentStack.length === 0) ? (
                                <View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1, borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 10, padding: 10, backgroundColor: '#fff' }}>
                                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Totaal (Hierarchie)</Text>
                                            {summaryRootTotalHierarchy && Object.keys(summaryRootTotalHierarchy).length > 0 ? (
                                                Object.keys(summaryRootTotalHierarchy).map((pn) => (
                                                    <Text key={`root-hier-${pn}`} style={{ color: colors.lightGray700 }}>{pn}: {summaryRootTotalHierarchy[pn]}</Text>
                                                ))
                                            ) : (
                                                <Text style={{ color: colors.lightGray600 }}>—</Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1, borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 10, padding: 10, backgroundColor: '#fff' }}>
                                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Totaal (Processtroom)</Text>
                                            {summaryRootTotalFlow && Object.keys(summaryRootTotalFlow).length > 0 ? (
                                                Object.keys(summaryRootTotalFlow).map((pn) => (
                                                    <Text key={`root-flow-${pn}`} style={{ color: colors.lightGray700 }}>{pn}: {summaryRootTotalFlow[pn]}</Text>
                                                ))
                                            ) : (
                                                <Text style={{ color: colors.lightGray600 }}>—</Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={{ marginTop: 12 }}>
                                        <Text style={{ color: colors.lightGray600 }}>Selecteer een top-level object aan de linkerkant om sub-items te bekijken.</Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedParentStack && setSelectedParentStack([]);
                                                setSelectedSummaryParentId && setSelectedSummaryParentId(null);
                                                setSelectedGroupKey && setSelectedGroupKey(null);
                                                setPressedGroupKey && setPressedGroupKey(null);
                                                setExpandedCrumbId && setExpandedCrumbId(null);
                                            }}
                                            style={AppStyles.btnPropertyText}
                                        >
                                            <Text style={AppStyles.btnPropertyTextOnly}>Toon totaal</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {(() => {
                                        const pathIds = (Array.isArray(selectedParentStack) && selectedParentStack.length > 0)
                                            ? selectedParentStack
                                            : (selectedSummaryParentId ? [selectedSummaryParentId] : []);
                                        const ancestors = (pathIds && pathIds.length > 1) ? pathIds.slice(0, -1) : [];
                                        const showRow = ancestors.length > 0 || (expandedDescendants && expandedDescendants.length > 0) || currentNode;
                                        if (!showRow) return null;

                                        const parts = [];
                                        ancestors.forEach((id) => {
                                            const node = findNodeById(id, localObjectsHierarchy || objectsHierarchy);
                                            parts.push({ type: 'ancestor', node });
                                        });
                                        if (currentNode) parts.push({ type: 'current', node: currentNode });
                                        if (expandedDescendants && expandedDescendants.length) {
                                            expandedDescendants.forEach((it) => parts.push({ type: 'descendant', node: it.node, path: it.path }));
                                        }

                                        return (
                                            <View style={{ marginTop: 0, marginBottom: 4, paddingVertical: 0 }}>
                                                <ScrollView
                                                    ref={breadcrumbScrollRef}
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    style={{ flexGrow: 1 }}
                                                    contentContainerStyle={{ alignItems: 'center', paddingVertical: 0, paddingRight: 12 }}
                                                    onContentSizeChange={(w) => setBreadcrumbContentWidth(w)}
                                                    onLayout={(e) => setBreadcrumbViewWidth(e.nativeEvent.layout.width)}
                                                    onScroll={({ nativeEvent }) => setBreadcrumbScrollX(nativeEvent.contentOffset?.x || 0)}
                                                    scrollEventThrottle={16}
                                                    {...(Platform.OS === 'web' ? { onWheel: handleBreadcrumbWheel } : {})}
                                                >
                                                    {parts.map((p, idx) => {
                                                        const isLast = idx === parts.length - 1;
                                                        const node = p.node;
                                                        if (!node) return null;

                                                        const isGrouped = node && node.group_key;
                                                        const parentContext = (pathIds && pathIds.length > 1) ? pathIds[pathIds.length - 2] : null;
                                                        const members = isGrouped ? (getGroupMemberNames(node.group_key, parentContext) || []) : [];
                                                        let label = node.naam || 'Onbekend';
                                                        if (isGrouped) {
                                                            if (members.length > 1) {
                                                                const first = members[0] || node.naam;
                                                                const second = members[1] || '';
                                                                const half = Math.ceil((second || '').length / 2) || 0;
                                                                const secondShort = second.slice(0, half);
                                                                label = `${first}+${secondShort}…`;
                                                            } else if (members.length === 1) {
                                                                label = members[0];
                                                            }
                                                        }

                                                        const isActive = isGrouped && pressedGroupKey && pressedGroupKey === node.group_key;

                                                        if (p.type === 'ancestor') {
                                                            return (
                                                                <View key={`part-ancestor-${node.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <TouchableOpacity onPress={() => {
                                                                        const ai = pathIds.findIndex((pid) => pid === node?.id);
                                                                        const next = pathIds.slice(0, (ai >= 0 ? ai : idx) + 1);
                                                                        setSelectedParentStack(next);
                                                                        const newCurrent = next[next.length - 1];
                                                                        setSelectedSummaryParentId(newCurrent);
                                                                        const parentNode = findNodeById(newCurrent, localObjectsHierarchy || objectsHierarchy);
                                                                        if (parentNode && parentNode.group_key) { setSelectedGroupKey(parentNode.group_key); setPressedGroupKey(parentNode.group_key); } else { setSelectedGroupKey(null); setPressedGroupKey(null); }
                                                                        setExpandedCrumbId(null);
                                                                    }} style={{ paddingVertical: 0, paddingHorizontal: 4 }}>
                                                                        <Text numberOfLines={1} ellipsizeMode={'tail'} style={{ fontWeight: '600', color: isActive ? colors.blue600 : colors.lightGray700 }}>{label}</Text>
                                                                    </TouchableOpacity>
                                                                    {!isLast && <ArrowRight color={colors.lightGray500} size={10} style={{ marginHorizontal: 2 }} />}
                                                                </View>
                                                            );
                                                        }

                                                        if (p.type === 'current') {
                                                            const isGroupedCurrent = isGrouped;
                                                            const isActiveCurrent = isGroupedCurrent && pressedGroupKey && pressedGroupKey === node.group_key;
                                                            return (
                                                                <View key={`part-current-${node.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <TouchableOpacity onPress={() => {
                                                                        if (isGroupedCurrent) { setSelectedGroupKey(node.group_key); setPressedGroupKey(node.group_key); }
                                                                        setExpandedCrumbId(null);
                                                                    }} style={{ paddingVertical: 0, paddingHorizontal: 4 }}>
                                                                        <Text numberOfLines={1} ellipsizeMode={'tail'} style={{ fontWeight: '700', color: isActiveCurrent ? colors.blue600 : colors.lightGray900 }}>{label}</Text>
                                                                    </TouchableOpacity>
                                                                    {!isLast && <ArrowRight color={colors.lightGray500} size={10} style={{ marginHorizontal: 2 }} />}
                                                                </View>
                                                            );
                                                        }

                                                        return (
                                                            <View key={`part-desc-${node.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                <TouchableOpacity onPress={() => {
                                                                    const crumbIndex = pathIds.findIndex(pid => pid === expandedCrumbId);
                                                                    const base = pathIds.slice(0, crumbIndex + 1);
                                                                    const nextStack = [...base, ...(p.path || [])];
                                                                    setSelectedParentStack(nextStack);
                                                                    setSelectedSummaryParentId(nextStack[nextStack.length - 1]);
                                                                    const targetNode = p.node;
                                                                    if (targetNode && targetNode.group_key) { setSelectedGroupKey(targetNode.group_key); setPressedGroupKey(targetNode.group_key); } else { setSelectedGroupKey(null); setPressedGroupKey(null); }
                                                                    setExpandedCrumbId(null);
                                                                }} style={{ paddingVertical: 0, paddingHorizontal: 4 }}>
                                                                    <Text numberOfLines={1} ellipsizeMode={'tail'} style={{ fontWeight: '600', color: (isGrouped && pressedGroupKey && pressedGroupKey === node.group_key) ? colors.blue600 : colors.lightGray700 }}>{label}</Text>
                                                                </TouchableOpacity>
                                                                {!isLast && <ArrowRight color={colors.lightGray500} size={10} style={{ marginHorizontal: 2 }} />}
                                                            </View>
                                                        );
                                                    })}
                                                </ScrollView>
                                                {breadcrumbContentWidth > breadcrumbViewWidth && (
                                                    <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.06)', marginTop: 4, overflow: 'hidden' }}>
                                                        {(() => {
                                                            const ratio = Math.min(1, (breadcrumbViewWidth || 1) / (breadcrumbContentWidth || 1));
                                                            const indicatorWidth = Math.max(24, Math.max(0, (breadcrumbViewWidth - 16)) * ratio);
                                                            const maxScroll = Math.max(1, (breadcrumbContentWidth - breadcrumbViewWidth));
                                                            const scrollFraction = Math.min(1, (breadcrumbScrollX || 0) / maxScroll);
                                                            const available = Math.max(0, (breadcrumbViewWidth - 16) - indicatorWidth);
                                                            const left = 8 + (available * scrollFraction);
                                                            return (
                                                                <View style={{ position: 'absolute', left, width: indicatorWidth, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.14)' }} />
                                                            );
                                                        })()}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })()}

                                    <View style={{
                                        borderRadius: 12,
                                        padding: 12,
                                        backgroundColor: '#fff',
                                        marginTop: 2,
                                        marginBottom: 8,
                                        borderWidth: 1,
                                        borderColor: colors.lightGray200,
                                        shadowColor: '#000',
                                        shadowOpacity: 0.06,
                                        shadowRadius: 8,
                                        shadowOffset: { width: 0, height: 4 },
                                        elevation: 4,
                                    }}>
                                        <Text style={{ fontWeight: '700', fontSize: 16 }}>{(selectedGroupMembers && selectedGroupMembers.length > 0) ? selectedGroupMembers.join(' + ') : (currentNode ? currentNode.naam : 'Geselecteerd')}</Text>
                                        <Text style={{ color: colors.lightGray600, marginTop: 4 }}>Aggregated eigenschappen</Text>
                                        <View style={{ marginTop: 10 }}>
                                            {currentEntry && currentEntry.props && Object.keys(currentEntry.props).length > 0 ? (
                                                Object.keys(currentEntry.props).map((pn) => (
                                                    <View key={`pdet-${pn}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                                                        <Text style={{ color: colors.lightGray700 }}>{pn}</Text>
                                                        <Text style={{ color: colors.lightGray900, fontWeight: '700' }}>
                                                            {currentEntry.props[pn].total}
                                                            <Text style={{ color: colors.lightGray600, fontWeight: '400' }}> ({currentEntry.props[pn].count})</Text>
                                                        </Text>
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={{ color: colors.lightGray600, marginTop: 4 }}>Geen eigenschappen</Text>
                                            )}
                                        </View>
                                    </View>

                                    {viewMode === 'hierarchy' ? (
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Sub-items</Text>
                                            {currentNode && Array.isArray(currentNode.children) && currentNode.children.length > 0 ? (
                                                <FlatList
                                                    data={buildGroupedList(currentNode.children).slice(0, rightPage * rightPageSize)}
                                                    keyExtractor={(item, idx) => item.type === 'sep' ? item.id : (item.item?.id || `${item.type}-${idx}`)}
                                                    renderItem={({ item }) => {
                                                        if (item.type === 'sep') return <View key={item.id} style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }} />;
                                                        const ch = item.item;
                                                        const chEntry = summaryMap && summaryMap[ch.id];
                                                        const propCount = (item.groupProps && item.groupProps.length) ? item.groupProps.length : (chEntry && chEntry.props ? Object.keys(chEntry.props).length : 0);
                                                        if (item.type === 'group-member') {
                                                            const anchor = item.anchorId || ch.id;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={`child-group-${ch.id}`}
                                                                    onPress={() => {
                                                                        setSelectedParentStack && setSelectedParentStack((prev) => [...(prev || []), anchor]);
                                                                        setSelectedSummaryParentId && setSelectedSummaryParentId(anchor);
                                                                        setSelectedGroupKey && setSelectedGroupKey(item.group_key || null);
                                                                        setPressedGroupKey && setPressedGroupKey(item.group_key || null);
                                                                    }}
                                                                    style={[AppStyles.card, AppStyles.cardGroupMember, { marginBottom: 6 }]}
                                                                >
                                                                    <View style={AppStyles.cardContent}>
                                                                        <Text style={AppStyles.cardTitle}>{ch.naam}</Text>
                                                                        <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            );
                                                        }
                                                        return (
                                                            <TouchableOpacity
                                                                key={`child-${ch.id}`}
                                                                onPress={() => {
                                                                    setSelectedParentStack && setSelectedParentStack((prev) => [...(prev || []), ch.id]);
                                                                    setSelectedSummaryParentId && setSelectedSummaryParentId(ch.id);
                                                                }}
                                                                style={[AppStyles.card, { marginBottom: 8 }]}
                                                            >
                                                                <View style={AppStyles.cardContent}>
                                                                    <Text style={AppStyles.cardTitle}>{ch.naam}</Text>
                                                                    <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        );
                                                    }}
                                                    ListFooterComponent={() => (
                                                        (buildGroupedList(currentNode.children).length > (rightPage * rightPageSize)) ? (
                                                            <TouchableOpacity onPress={() => setRightPage && setRightPage((p) => (p || 1) + 1)} style={{ padding: 10, alignItems: 'center' }}>
                                                                <Text style={{ color: colors.blue600 }}>Load more</Text>
                                                            </TouchableOpacity>
                                                        ) : null
                                                    )}
                                                />
                                            ) : (
                                                <Text style={{ color: colors.lightGray600 }}>Geen sub-items</Text>
                                            )}
                                        </View>
                                    ) : (
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Sub-items (Processtroom)</Text>
                                            {currentNode && Array.isArray(currentNode.children) && currentNode.children.length > 0 ? (
                                                <FlatList
                                                    data={buildGroupedList(
                                                        (currentNode.children || []).filter((ch) => {
                                                            const t = ch?.material_flow_type;
                                                            return isAllowedFlowType(t) || t === 'final_product' || t === 'default' || t == null;
                                                        })
                                                    ).slice(0, rightPage * rightPageSize)}
                                                    keyExtractor={(item, idx) => item.type === 'sep' ? item.id : (item.item?.id || `${item.type}-${idx}`)}
                                                    renderItem={({ item }) => {
                                                        if (item.type === 'sep') return <View key={item.id} style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }} />;
                                                        const ch = item.item;
                                                        const chEntry = summaryMap && summaryMap[ch.id];
                                                        const propCount = (item.groupProps && item.groupProps.length) ? item.groupProps.length : (chEntry && chEntry.props ? Object.keys(chEntry.props).length : 0);
                                                        if (item.type === 'group-member') {
                                                            const anchor = item.anchorId || ch.id;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={`child-group-${ch.id}`}
                                                                    onPress={() => {
                                                                        setSelectedParentStack && setSelectedParentStack((prev) => [...(prev || []), anchor]);
                                                                        setSelectedSummaryParentId && setSelectedSummaryParentId(anchor);
                                                                        setSelectedGroupKey && setSelectedGroupKey(item.group_key || null);
                                                                        setPressedGroupKey && setPressedGroupKey(item.group_key || null);
                                                                    }}
                                                                    style={[AppStyles.card, AppStyles.cardGroupMember, { marginBottom: 6 }]}
                                                                >
                                                                    <View style={AppStyles.cardContent}>
                                                                        <Text style={AppStyles.cardTitle}>{ch.naam}</Text>
                                                                        <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            );
                                                        }
                                                        return (
                                                            <TouchableOpacity
                                                                key={`child-${ch.id}`}
                                                                onPress={() => {
                                                                    setSelectedParentStack && setSelectedParentStack((prev) => [...(prev || []), ch.id]);
                                                                    setSelectedSummaryParentId && setSelectedSummaryParentId(ch.id);
                                                                }}
                                                                style={[AppStyles.card, { marginBottom: 8 }]}
                                                            >
                                                                <View style={AppStyles.cardContent}>
                                                                    <Text style={AppStyles.cardTitle}>{ch.naam}</Text>
                                                                    <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                                </View>
                                                            </TouchableOpacity>
                                                        );
                                                    }}
                                                    ListFooterComponent={() => (
                                                        (((currentNode.children || []).filter((ch) => {
                                                            const t = ch?.material_flow_type;
                                                            return isAllowedFlowType(t) || t === 'final_product' || t === 'default' || t == null;
                                                        }).length) > (rightPage * rightPageSize)) ? (
                                                            <TouchableOpacity onPress={() => setRightPage && setRightPage((p) => (p || 1) + 1)} style={{ padding: 10, alignItems: 'center' }}>
                                                                <Text style={{ color: colors.blue600 }}>Load more</Text>
                                                            </TouchableOpacity>
                                                        ) : null
                                                    )}
                                                />
                                            ) : (
                                                <Text style={{ color: colors.lightGray600 }}>Geen sub-items</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={[AppStyles.modalActions, { marginTop: 12, justifyContent: 'flex-end' }]}> 
                        <TouchableOpacity onPress={() => { onClose(); }} style={AppStyles.btnPrimary}>
                            <Text style={AppStyles.btnPrimaryText}>Sluiten</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

export default SummaryModal;
