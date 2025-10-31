import { ArrowRight, Boxes, Calculator, Filter, GitBranch, LogOut, Menu, Plus, Recycle, Square } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Modal, Platform, RefreshControl, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import HierarchicalObjectsSkeletonList from '../../../components/HierarchicalObjectsSkeletonList';
import { fetchFormules as fetchFormulesApi, linkObjects } from '../api';
import AppStyles, { colors } from '../AppStyles';
import AddFormuleModal from '../components/modals/AddFormuleModal';
import AddObjectModal from '../components/modals/AddObjectModal';
import FilterModal from '../components/modals/FilterModal';
import FormulePickerModal from '../components/modals/FormulePickerModal';
import { supabase } from '../config/config';

const PropertyButton = ({ onClick }) => (
    <TouchableOpacity onPress={onClick} style={{ paddingVertical: 6, paddingHorizontal: 8 }}>
        <Text style={{ color: colors.black, fontWeight: '600' }}>Eigenschappen</Text>
    </TouchableOpacity>
);

// Helper to get material flow context from database value
// Helper to get material flow context from database value
const getMaterialFlowContext = (materialFlowType) => {
    switch (materialFlowType) {
        case 'raw_material':
            return { type: 'raw_material', icon: Recycle, color: colors.blue600, label: 'Raw Material' };
        case 'intermediate':
            return { type: 'intermediate', icon: GitBranch, color: colors.purple600, label: 'Intermediate' };
        case 'component':
            return { type: 'component', icon: ArrowRight, color: colors.lightGray600, label: 'Component' };
        case 'final_product':
            return { type: 'final_product', icon: Plus, color: colors.blue700, label: 'Final Product' };
        case 'default':
        default:
            return { type: 'default', icon: Square, color: colors.lightGray500, label: 'Default' };
    }
};

const HierarchicalObjectsScreen = ({ items, currentLevelPath, setCurrentPath, setCurrentScreen, setSelectedProperty, handleLogout, onRefresh, refreshing, allUsers, userToken, totalObjectCount, filterOption, setFilterOption, onAddObject, objectsHierarchy, onFormuleSaved, isLoading }) => {
    const [showAddObjectModal, setShowAddObjectModal] = useState(false);
    const [addModalMode, setAddModalMode] = useState('single'); // 'single' | 'multiple'
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [Formules, setFormules] = useState([]);
    const [showAddFormuleModal, setShowAddFormuleModal] = useState(false);
    const [showFormulePickerModal, setShowFormulePickerModal] = useState(false);
    const [editingFormule, setEditingFormule] = useState(null);
    const [fabMenuOpen, setFabMenuOpen] = useState(false);
    const [showAddChoice, setShowAddChoice] = useState(false);
    const [fabMenuAnimation] = useState(new Animated.Value(0));
    // Summary modal state (temporary, not persisted)
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryMap, setSummaryMap] = useState({}); // id -> { total, own, childrenSum, name }
    const [summaryRootTotal, setSummaryRootTotal] = useState(null);
    const [summaryPropertyName, setSummaryPropertyName] = useState('Oppervlakte');
    const [selectedSummaryParentId, setSelectedSummaryParentId] = useState(null); // selected top-level parent in modal
    const [selectedParentStack, setSelectedParentStack] = useState([]); // stack of parent ids for drill-down
    const [selectedGroupKey, setSelectedGroupKey] = useState(null);
    const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
    // Pagination / virtualization settings for modal lists
    const [leftPageSize] = useState(30);
    const [leftPage, setLeftPage] = useState(1);
    const [rightPageSize] = useState(30);
    const [rightPage, setRightPage] = useState(1);
    // Local state for instant UI update
    const [localItems, setLocalItems] = useState(items || []);
    // Keep localItems in sync with items prop (database objects)
    useEffect(() => {
        // If there are temporary objects, swap them with matching database objects
        setLocalItems((prevLocal) => {
            if (!items || items.length === 0) return [];
            // Find temp objects by __instanceKey
            const tempObjects = prevLocal.filter(obj => typeof obj.id === 'string' && obj.id.startsWith('temp_'));
            if (tempObjects.length === 0) return items;
            // For each temp object, try to find a matching db object by name and groupKey
            let merged = [...items];
            tempObjects.forEach(tempObj => {
                const matchIdx = merged.findIndex(dbObj =>
                    dbObj.naam === tempObj.naam &&
                    (dbObj.group_key || null) === (tempObj.group_key || null)
                );
                if (matchIdx === -1) {
                    // If not found, keep temp object at the top
                    merged = [tempObj, ...merged];
                }
            });
            // Remove duplicate temp objects if db version exists
            merged = merged.filter((obj, idx, arr) => {
                if (typeof obj.id === 'string' && obj.id.startsWith('temp_')) {
                    // If a db version exists, skip temp
                    return arr.findIndex(o => o.naam === obj.naam && (o.group_key || null) === (obj.group_key || null) && !(typeof o.id === 'string' && o.id.startsWith('temp_'))) === -1;
                }
                return true;
            });
            return merged;
        });
    }, [items]);
    const [localObjectsHierarchy, setLocalObjectsHierarchy] = useState(objectsHierarchy || []);
    // Keep localObjectsHierarchy in sync with prop updates
    useEffect(() => {
        setLocalObjectsHierarchy(objectsHierarchy || []);
    }, [objectsHierarchy]);

    // Build grouped left-column data (preserve order, create separators for grouped items)
    const buildGroupedList = (items) => {
        if (!Array.isArray(items)) return [];
        const acc = {};
        const order = [];
        items.forEach((it) => {
            const key = it.group_key ? `grp:${it.group_key}` : `solo:${it.id}`;
            if (!acc[key]) {
                acc[key] = { group_key: it.group_key || null, items: [] };
                order.push(key);
            }
            acc[key].items.push(it);
        });
        const out = [];
        order.forEach((k) => {
            const group = acc[k];
            const isGrouped = !!group.group_key && group.items.length > 1;
            if (isGrouped) {
                // compute union of property names across group (include aggregated summaryMap props)
                const propSet = new Set();
                group.items.forEach((it) => {
                    const props = it.properties || it.eigenschappen || [];
                    props.forEach((p) => {
                        const pname = p.name || p.property_name || p.propertyName || p.naam || p.label || p.key;
                        if (pname) propSet.add(String(pname));
                    });
                    // include keys from summaryMap aggregation if available
                    const s = summaryMap && summaryMap[it.id] && summaryMap[it.id].props ? summaryMap[it.id].props : null;
                    if (s) Object.keys(s).forEach((k) => propSet.add(String(k)));
                });
                const groupProps = Array.from(propSet);
                const anchorId = group.items[0]?.id;
                out.push({ type: 'sep', id: `sep-top-${group.group_key}` });
                group.items.forEach((it, idx) => out.push({ type: 'group-member', item: it, group_key: group.group_key, idx, groupProps, anchorId }));
                out.push({ type: 'sep', id: `sep-bottom-${group.group_key}` });
            } else {
                const solo = group.items[0];
                const soloProps = (solo.properties || solo.eigenschappen || []).map(p => p.name || p.property_name || p.propertyName || p.naam || p.label || p.key).filter(Boolean);
                // include aggregated keys as well
                const s = summaryMap && summaryMap[solo.id] && summaryMap[solo.id].props ? Object.keys(summaryMap[solo.id].props) : [];
                const combinedSolo = Array.from(new Set([...soloProps, ...s]));
                out.push({ type: 'solo', item: solo, soloProps: combinedSolo, anchorId: solo.id });
            }
        });
        return out;
    };

    const leftListData = useMemo(() => buildGroupedList(localObjectsHierarchy), [localObjectsHierarchy, summaryMap]);
    // Track how user navigated into the current level to influence breadcrumb labels
    const selectionContextRef = useRef({ pathKey: '', preferSoloLabel: false });
    // Ref for the breadcrumb ScrollView so we can auto-scroll to show the current crumb
    const breadcrumbScrollRef = useRef(null);
    const [breadcrumbContentWidth, setBreadcrumbContentWidth] = useState(0);
    const [breadcrumbViewWidth, setBreadcrumbViewWidth] = useState(0);
    const [breadcrumbScrollX, setBreadcrumbScrollX] = useState(0);
    const handleBreadcrumbWheel = (e) => {
        // Only on web
        if (Platform.OS !== 'web') return;
        try {
            const deltaY = e.deltaY || e.nativeEvent?.deltaY || 0;
            const multiplier = 1; // tune scroll speed
            const target = Math.max(0, breadcrumbScrollX + deltaY * multiplier);
            if (breadcrumbScrollRef && breadcrumbScrollRef.current && typeof breadcrumbScrollRef.current.scrollTo === 'function') {
                breadcrumbScrollRef.current.scrollTo({ x: target, animated: true });
            }
            // prevent default vertical scrolling on the page when over breadcrumb area
            if (e.preventDefault) e.preventDefault();
        } catch (err) {
            // ignore
        }
    };
    // Animated progress bar for object creation
    const [showAddLoading, setShowAddLoading] = useState(false);
    const [addProgress, setAddProgress] = useState(0);
    const [isAttachingExisting, setIsAttachingExisting] = useState(false);
    const lastLoadWasAddRef = useRef(false);
    const progressIntervalRef = useRef(null);
    const wrappedOnAddObject = async (...args) => {
        lastLoadWasAddRef.current = true;
        setShowAddLoading(true);
        setAddProgress(0);
        // Simulate progress bar animation
        progressIntervalRef.current = setInterval(() => {
            setAddProgress((prev) => {
                if (prev < 90) {
                    return prev + 5;
                } else {
                    return prev;
                }
            });
        }, 80);
        // INSTANT UI UPDATE: Add object to local state
        const [currentPath, data] = args;
        let newObjects = [];
        if (data) {
            // Always generate a group_key for multiple objects if not present
            let groupKey = data.groupKey;
            if (data.names && !groupKey) {
                groupKey = `g_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            }
            if (data.names) {
                newObjects = data.names.map((name, idx) => ({
                    id: `temp_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${idx}`,
                    naam: name,
                    material_flow_type: data.materialFlowType || 'default',
                    group_key: groupKey || null,
                    properties: [],
                    children: [],
                    owner_name: 'Jij',
                    created_at: new Date().toISOString(),
                    __instanceKey: `temp_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${idx}`
                }));
            } else if (data.name) {
                newObjects = [{
                    id: `temp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
                    naam: data.name,
                    material_flow_type: data.materialFlowType || 'default',
                    group_key: groupKey || null,
                    properties: [],
                    children: [],
                    owner_name: 'Jij',
                    created_at: new Date().toISOString(),
                    __instanceKey: `temp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
                }];
            }
        }
        // Add to localItems
        setLocalItems((prev) => [...newObjects, ...prev]);
        // ASYNC DB SAVE
        try {
            await onAddObject(...args);
            // After successful save, refresh from database
            if (onRefresh) {
                await onRefresh();
                // Do not setLocalItems here; let useEffect handle merging
            }
        } catch (e) {
            Alert.alert('Fout', 'Opslaan naar database mislukt. Probeer opnieuw.');
        }
        // Complete progress
        setAddProgress(100);
        setTimeout(() => {
            setShowAddLoading(false);
            setAddProgress(0);
            lastLoadWasAddRef.current = false;
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
        }, 350);
    };
    // Skeleton loader logic: show skeleton when isLoading is true and not adding object
    const showSkeleton = isLoading && !lastLoadWasAddRef.current;
    // Don't show skeleton when attaching existing objects
    const showSkeletonFixed = showSkeleton && !isAttachingExisting;

    // Fetch Formules on component mount and set up real-time subscriptions
    useEffect(() => {
        (async () => {
            try {
                const FormulesData = await fetchFormulesApi();
                setFormules(Array.isArray(FormulesData) ? FormulesData : []);
            } catch (error) {
                console.error('Error fetching Formules (mount):', error);
                setFormules([]);
            }
        })();

        // Set up real-time subscriptions
        const objectsSubscription = supabase
            .channel('objects-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'objects' },
                (payload) => {
                    console.log('Object change detected:', payload)
                    if (onRefresh) {
                        onRefresh() // Trigger a refresh of the objects
                    }
                }
            )
            .subscribe()

        const formulesSubscription = supabase
            .channel('formules-channel')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'formules' },
                async (payload) => {
                    console.log('Formula change detected:', payload)
                    // Refresh formulas list
                    try {
                        const FormulesData = await fetchFormulesApi();
                        setFormules(Array.isArray(FormulesData) ? FormulesData : []);
                    } catch (error) {
                        console.error('Error refreshing formulas:', error);
                    }
                }
            )
            .subscribe()

        // Cleanup subscriptions
        return () => {
            objectsSubscription.unsubscribe()
            formulesSubscription.unsubscribe()
        }
    }, [onRefresh]);

    useEffect(() => {
        if (showFormulePickerModal) {
            (async () => {
                try {
                    const FormulesData = await fetchFormulesApi();
                    setFormules(Array.isArray(FormulesData) ? FormulesData : []);
                } catch (e) {
                    console.error('Error refreshing Formules on open:', e);
                }
            })();
        }
    }, [showFormulePickerModal]);

    const handleFormuleSaved = (newFormule) => {
        // Use the global formule handler if provided, otherwise use local logic
        if (onFormuleSaved) {
            onFormuleSaved(newFormule);
        } else {
            // Fallback to local logic if no global handler
            if (newFormule && newFormule.__refresh) {
                if (onRefresh) {
                    onRefresh();
                }
                return;
            }
            
            if (newFormule && newFormule.__edited) {
                setTimeout(() => {
                    if (onRefresh) {
                        onRefresh();
                    }
                }, 1000);
            }
        }
        
        // Always update local formules list
        setFormules(prev => [...prev, newFormule]);
    };

    const handleFormuleSelected = (Formule) => {
        // For now, just close the modal - could be extended to do something with the selected formula
        console.log('Formula selected:', Formule);
    };

    const toggleFabMenu = () => {
        const toValue = fabMenuOpen ? 0 : 1;
        setFabMenuOpen(!fabMenuOpen);
        
        Animated.spring(fabMenuAnimation, {
            toValue,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
        }).start();
    };

    const closeFabMenu = () => {
        setFabMenuOpen(false);
        Animated.spring(fabMenuAnimation, {
            toValue: 0,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
        }).start();
    };

    const findItemByPath = (data, path) => {
        let currentItems = data;
        let foundItem = null;
        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];
            if (!Array.isArray(currentItems)) return null;
            const item = currentItems.find(item => item.id === idToFind);
            if (!item) {
                foundItem = null;
                break;
            }
            foundItem = item;
            currentItems = Array.isArray(item.children) ? item.children : [];
        }
        return foundItem;
    };

    // Helpers to compute grouped breadcrumb labels
    const getChildrenAtPath = (path) => {
        let currentItems = objectsHierarchy;
        if (!Array.isArray(path) || path.length === 0) return currentItems;
        for (let i = 0; i < path.length; i++) {
            const idToFind = path[i];
            if (!Array.isArray(currentItems)) return [];
            const item = currentItems.find((it) => it.id === idToFind);
            if (!item) return [];
            currentItems = Array.isArray(item.children) ? item.children : [];
        }
        return currentItems;
    };

    const getGroupLabelForPath = (path) => {
        if (!path || path.length === 0) return 'Objecten';
        const pathKey = path.join('/');
        const parentPath = path.slice(0, -1);
        const lastId = path[path.length - 1];
        const siblings = getChildrenAtPath(parentPath);
        const child = (siblings || []).find((c) => c.id === lastId) || findItemByPath(objectsHierarchy, path);
        if (!child) return 'Onbekend';
        // If user came here via a solo (linked) click, prefer the single name over grouped label
        if (selectionContextRef.current.pathKey === pathKey && selectionContextRef.current.preferSoloLabel) {
            return child.naam;
        }
        if (child.group_key) {
            const members = (siblings || []).filter((c) => c.group_key === child.group_key);
            if (members.length > 1) {
                return members.map((m) => m.naam).join(' + ');
            }
        }
        return child.naam;
    };

    const getBreadcrumbs = () => {
        let breadcrumbs = [{ id: 'root', name: 'Objecten', path: [] }];
        let pathAccumulator = [];
        currentLevelPath.forEach((id) => {
            pathAccumulator.push(id);
            const item = findItemByPath(objectsHierarchy, pathAccumulator);
            if (item) {
                breadcrumbs.push({
                    id: item.id,
                    name: getGroupLabelForPath(pathAccumulator),
                    path: [...pathAccumulator]
                });
            }
        });
        return breadcrumbs;
    };
    const breadcrumbs = getBreadcrumbs();

    // Auto-scroll the breadcrumb row so the active (last) crumb is visible when currentLevelPath changes
    useEffect(() => {
        if (!breadcrumbScrollRef || !breadcrumbScrollRef.current) return;
        // slight timeout to allow layout/render to complete
        setTimeout(() => {
            try {
                // If we have measurements, compute an exact scroll target so the last crumb is visible
                const extraRightPadding = 80; // space to leave for header buttons (px)
                if (breadcrumbContentWidth > 0 && breadcrumbViewWidth > 0 && breadcrumbContentWidth > breadcrumbViewWidth) {
                    const targetX = Math.max(0, breadcrumbContentWidth - breadcrumbViewWidth + extraRightPadding);
                    if (typeof breadcrumbScrollRef.current.scrollTo === 'function') {
                        breadcrumbScrollRef.current.scrollTo({ x: targetX, animated: true });
                        return;
                    }
                }
                // Fallback: scrollToEnd if measurements unavailable
                if (typeof breadcrumbScrollRef.current.scrollToEnd === 'function') {
                    breadcrumbScrollRef.current.scrollToEnd({ animated: true });
                }
            } catch (e) {
                // ignore platform-specific errors
            }
        }, 80);
    }, [currentLevelPath && currentLevelPath.join('/'), breadcrumbContentWidth, breadcrumbViewWidth]);

    // --- SUMMARY COMPUTATION HELPERS ---
    // Parse numeric value from property.value/waarde which may include units or commas
    const _parseNumeric = (val) => {
        if (val == null) return 0;
        try {
            const s = String(val).trim();
            // Replace comma decimal with dot and strip non-numeric chars except dot and minus
            const normalized = s.replace(',', '.').replace(/[^0-9.\-]+/g, ' ');
            // Extract numbers (some fields may contain ranges or multiple numbers); sum them
            const matches = normalized.match(/-?\d+(?:\.\d+)?/g);
            if (!matches) return 0;
            return matches.map((m) => parseFloat(m)).reduce((a, b) => a + b, 0);
        } catch (e) {
            return 0;
        }
    };

    // Get own property total and count for a node for a given property name (case-insensitive, partial match)
    const _getOwnPropertyTotal = (node, propName) => {
        if (!node || !Array.isArray(node.properties)) return { total: 0, count: 0 };
        const needle = (propName || '').toLowerCase();
        let total = 0;
        let count = 0;
        (node.properties || []).forEach((p) => {
            if (!p) return;
            const pname = ((p.name || p.property_name || '') + '').toLowerCase();
            if (needle === '' || pname.includes(needle)) {
                // value may be in p.waarde (Dutch) or p.value
                const val = (p.waarde != null ? p.waarde : (p.value != null ? p.value : p.waarde));
                total += Number.isFinite(val) ? Number(val) : _parseNumeric(val);
                count += 1;
            }
        });
        return { total, count };
    };

    // Compute aggregated totals for all property names across the tree
    const computeAllProperties = (nodes) => {
        const map = {}; // id -> { name, props: { propName: { total, count } } }
        const rootTotals = {}; // propName -> total

        const walk = (node) => {
            const ownProps = {};
            // accept different shapes: properties or eigenschappen
            const propsArr = Array.isArray(node.properties) ? node.properties : (Array.isArray(node.eigenschappen) ? node.eigenschappen : []);
            if (Array.isArray(propsArr)) {
                (propsArr || []).forEach((p) => {
                    if (!p) return;
                    const pname = (p.name || p.property_name || p.propertyName || p.naam || '').toString().trim();
                    if (!pname) return;
                    const val = (p.waarde != null ? p.waarde : (p.value != null ? p.value : p.waarde));
                    const num = Number.isFinite(val) ? Number(val) : _parseNumeric(val);
                    if (!ownProps[pname]) ownProps[pname] = { total: 0, count: 0 };
                    ownProps[pname].total += num;
                    ownProps[pname].count += 1;
                });
            }

            // Start aggregated with ownProps
            const aggregated = { ...ownProps };

            // Recurse children and add their aggregated props
            if (Array.isArray(node.children) && node.children.length > 0) {
                node.children.forEach((ch) => {
                    const childAgg = walk(ch);
                    Object.keys(childAgg).forEach((pname) => {
                        const c = childAgg[pname];
                        if (!aggregated[pname]) aggregated[pname] = { total: 0, count: 0 };
                        aggregated[pname].total += c.total;
                        aggregated[pname].count += c.count;
                    });
                });
            }

            // Store per-node aggregated result
            map[node.id] = { name: node.naam, props: aggregated };

            return aggregated;
        };

        (nodes || []).forEach((n) => {
            const agg = walk(n);
            // accumulate into rootTotals
            Object.keys(agg).forEach((pname) => {
                rootTotals[pname] = (rootTotals[pname] || 0) + agg[pname].total;
            });
        });

        return { map, rootTotals };
    };

    const openSummaryAll = () => {
        try {
            const source = (localObjectsHierarchy && localObjectsHierarchy.length) ? localObjectsHierarchy : (objectsHierarchy || []);
            const { map, rootTotals } = computeAllProperties(source);
            setSummaryMap(map);
            setSummaryRootTotal(rootTotals);
            setSummaryPropertyName('All properties');
            setSelectedSummaryParentId(null);
            setSelectedGroupKey(null);
            setSelectedGroupMembers([]);
            setPressedGroupKey(null);
            setShowSummaryModal(true);
        } catch (e) {
            console.error('[Summary] compute failed', e);
            setSummaryMap({});
            setSummaryRootTotal(null);
            setSummaryPropertyName('All properties');
            setSelectedSummaryParentId(null);
            setSelectedGroupKey(null);
            setSelectedGroupMembers([]);
            setPressedGroupKey(null);
            setShowSummaryModal(true);
        }
    };

    const closeSummaryModal = () => {
        setShowSummaryModal(false);
        setSelectedSummaryParentId(null);
        setSelectedParentStack([]);
        setSelectedGroupKey(null);
        setSelectedGroupMembers([]);
        setPressedGroupKey(null);
    };

    // Helper: find group member names for a given group_key within a context (prefer siblings under parentId)
    const getGroupMemberNames = (groupKey, parentId = null) => {
        if (!groupKey) return [];
        // Try siblings under provided parentId first
        try {
            if (parentId) {
                const parent = findNodeById(parentId, localObjectsHierarchy || objectsHierarchy);
                if (parent && Array.isArray(parent.children)) {
                    const members = parent.children.filter(it => it && it.group_key && it.group_key === groupKey);
                    if (members && members.length > 0) return members.map(m => m.naam);
                }
            }
        } catch (e) {
            // ignore
        }
        // Fallback: check top-level
        const top = (localObjectsHierarchy || []).filter(it => it && it.group_key && it.group_key === groupKey);
        if (top && top.length > 0) return top.map(m => m.naam);

        // Last-resort: search entire tree
        const results = [];
        const walk = (arr) => {
            if (!Array.isArray(arr)) return;
            arr.forEach((n) => {
                if (!n) return;
                if (n.group_key === groupKey) results.push(n.naam);
                if (Array.isArray(n.children) && n.children.length) walk(n.children);
            });
        };
        walk(localObjectsHierarchy || objectsHierarchy || []);
        return results;
    };

    // Keep selectedGroupMembers in sync with selectedGroupKey and the current parent stack
    useEffect(() => {
        if (!selectedGroupKey) {
            setSelectedGroupMembers([]);
            return;
        }
        // selectedParentStack holds the path of selected nodes; the parent context for siblings
        // is the element before the current node in the stack. If stack length === 1, we're
        // at top-level and parentContext should be null.
        let parentContext = null;
        if (Array.isArray(selectedParentStack) && selectedParentStack.length > 1) {
            parentContext = selectedParentStack[selectedParentStack.length - 2];
        }
        const names = getGroupMemberNames(selectedGroupKey, parentContext);
        setSelectedGroupMembers(names);
    }, [selectedGroupKey, selectedParentStack, localObjectsHierarchy]);

    // State to track which breadcrumb (crumb id) is expanded to show full descendant jump list
    const [expandedCrumbId, setExpandedCrumbId] = useState(null);

    // Cached flattened descendants for the expanded crumb to avoid timing issues in render
    const [expandedDescendants, setExpandedDescendants] = useState([]);
    // Which group's preview was pressed (only show previews for this group)
    const [pressedGroupKey, setPressedGroupKey] = useState(null);

    // Flatten descendants of a node (depth-first) returning items with path from the node
    const flattenDescendants = (rootNode, limit = 500) => {
        const out = [];
        if (!rootNode || !Array.isArray(rootNode.children)) return out;
        const walk = (node, path) => {
            if (!node || !Array.isArray(node.children)) return;
            for (let i = 0; i < node.children.length; i++) {
                const ch = node.children[i];
                const p = [...path, ch.id];
                out.push({ node: ch, path: p });
                if (out.length >= limit) return;
                walk(ch, p);
                if (out.length >= limit) return;
            }
        };
        walk(rootNode, []);
        return out;
    };

    // Compute flattened descendants when expandedCrumbId changes (avoid render-time race conditions)
    useEffect(() => {
        if (!expandedCrumbId) {
            setExpandedDescendants([]);
            return;
        }
        // Try to find node in full hierarchy (prefer objectsHierarchy then localObjectsHierarchy)
        const root = findNodeById(expandedCrumbId, (objectsHierarchy && objectsHierarchy.length) ? objectsHierarchy : (localObjectsHierarchy || []));
        if (!root) {
            setExpandedDescendants([]);
            return;
        }
        const list = flattenDescendants(root, 500);
        setExpandedDescendants(list);
    }, [expandedCrumbId, localObjectsHierarchy, objectsHierarchy]);

    // Always show descendants for the current selected node (currentId). When navigation changes,
    // update expandedCrumbId so the descendant row shows the current node's descendants.
    useEffect(() => {
        const currentId = (Array.isArray(selectedParentStack) && selectedParentStack.length > 0)
            ? selectedParentStack[selectedParentStack.length - 1]
            : selectedSummaryParentId;
        setExpandedCrumbId(currentId || null);
    }, [selectedParentStack, selectedSummaryParentId]);

    // Find node by id inside the hierarchy (search localObjectsHierarchy first)
    const findNodeById = (id, nodes) => {
        const source = Array.isArray(nodes) ? nodes : (localObjectsHierarchy && localObjectsHierarchy.length ? localObjectsHierarchy : (objectsHierarchy || []));
        const walk = (arr) => {
            if (!Array.isArray(arr)) return null;
            for (let i = 0; i < arr.length; i++) {
                const n = arr[i];
                if (!n) continue;
                if (n.id === id) return n;
                if (Array.isArray(n.children) && n.children.length) {
                    const found = walk(n.children);
                    if (found) return found;
                }
            }
            return null;
        };
        return walk(source);
    };

    // Collect all descendants for a given node (breadth-first or depth-first) with depth
    const getAllDescendants = (node) => {
        const out = [];
        const walk = (n, depth) => {
            if (!n || !Array.isArray(n.children) || n.children.length === 0) return;
            n.children.forEach((ch) => {
                out.push({ node: ch, depth });
                walk(ch, depth + 1);
            });
        };
        walk(node, 1);
        return out;
    };

    // Build a parent-first ordered list from the tree, include depth for indentation
    const buildOrderedSummaryList = (nodes, map, depth = 0, out = []) => {
        if (!Array.isArray(nodes) || nodes.length === 0) return out;
        nodes.forEach((n) => {
            if (n && n.id && map && map[n.id]) {
                out.push({ id: n.id, depth, ...map[n.id] });
            }
            if (Array.isArray(n.children) && n.children.length > 0) {
                buildOrderedSummaryList(n.children, map, depth + 1, out);
            }
        });
        return out;
    };

    return (
        <View style={AppStyles.screen}>
            <StatusBar barStyle="dark-content" />
            {/* Animated progress bar at top for object creation */}
            {showAddLoading && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, height: 4, backgroundColor: colors.lightGray300, borderRadius: 2, opacity: 0.8 }}>
                    <View style={{ height: 4, backgroundColor: colors.blue600, borderRadius: 2, width: `${addProgress}%`, transition: 'width 0.2s linear' }} />
                </View>
            )}
            <View style={AppStyles.header}>
                <View style={AppStyles.headerFlex}>
                    <ScrollView
                        ref={breadcrumbScrollRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ flexGrow: 1 }}
                        contentContainerStyle={{ paddingRight: 20 }} // leave space so last crumb isn't covered by buttons
                        onContentSizeChange={(w, h) => setBreadcrumbContentWidth(w)}
                        onLayout={(e) => setBreadcrumbViewWidth(e.nativeEvent.layout.width)}
                        onScroll={({ nativeEvent }) => {
                            setBreadcrumbScrollX(nativeEvent.contentOffset?.x || 0);
                        }}
                        scrollEventThrottle={16}
                        {...(Platform.OS === 'web' ? { onWheel: handleBreadcrumbWheel } : {})}
                    >
                        {breadcrumbs.map((crumb, index) => {
                            // ...existing code...
                            const actualItem = crumb.name !== 'Objecten' ? findItemByPath(objectsHierarchy, crumb.path) : null;
                            const flowContext = actualItem ? getMaterialFlowContext(actualItem.material_flow_type || 'default') : null;
                            const showIcon = flowContext && flowContext.icon;
                            return (
                                <View key={crumb.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {index > 0 && (
                                        <ArrowRight 
                                            color={flowContext ? flowContext.color : colors.lightGray700} 
                                            size={16} 
                                            style={{ marginHorizontal: 4 }} 
                                        />
                                    )}
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (index !== breadcrumbs.length - 1) {
                                                setCurrentPath(crumb.path);
                                            }
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                    >
                                        {showIcon && (
                                            <flowContext.icon 
                                                color={flowContext.color} 
                                                size={14} 
                                                style={{ marginRight: 4 }} 
                                            />
                                        )}
                                        <Text style={[
                                            AppStyles.headerTitleSmall, 
                                            { color: flowContext ? flowContext.color : colors.lightGray900 }, 
                                            index === breadcrumbs.length - 1 && { fontWeight: 'bold' }
                                        ]}>
                                            {crumb.name}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                    {/* Breadcrumb scrollbar: show when content overflows */}
                    {breadcrumbContentWidth > breadcrumbViewWidth && (
                        <View style={{ position: 'absolute', left: 8, right: 8 + 48 /* space for buttons */, bottom: -6, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden', pointerEvents: 'none' }}>
                            {(() => {
                                const ratio = Math.min(1, breadcrumbViewWidth / breadcrumbContentWidth || 1);
                                const indicatorWidth = Math.max(24, (breadcrumbViewWidth - 16) * ratio);
                                const maxScroll = Math.max(1, breadcrumbContentWidth - breadcrumbViewWidth);
                                const scrollFraction = Math.min(1, breadcrumbScrollX / maxScroll || 0);
                                const available = (breadcrumbViewWidth - 16) - indicatorWidth;
                                const left = 8 + (available * scrollFraction);
                                return (
                                    <View style={{ position: 'absolute', left: left, width: indicatorWidth, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.14)' }} />
                                );
                            })()}
                        </View>
                    )}
                    <TouchableOpacity 
                        onPress={() => {
                            console.log('[LogoutButton] Logout button pressed in HierarchicalObjectsScreen');
                            handleLogout();
                        }} 
                        style={{ padding: 8, marginLeft: 16, backgroundColor: 'transparent', borderRadius: 6 }}
                        activeOpacity={0.7}
                    >
                        <LogOut color={colors.blue600} size={24} />
                    </TouchableOpacity>
                    {/* Summary button (temporary, aggregates all properties) */}
                    <TouchableOpacity
                        onPress={() => openSummaryAll()}
                        style={{ padding: 8, marginLeft: 8, backgroundColor: 'transparent', borderRadius: 6 }}
                        activeOpacity={0.7}
                    >
                        <Calculator color={colors.blue600} size={22} />
                    </TouchableOpacity>
                </View>
            </View>
            <ScrollView
                style={AppStyles.contentPadding}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.blue600]} tintColor={colors.blue600} />}
            >
                <View style={AppStyles.cardList}>
                    {/* Loading bar is now fixed at top, not inside scrollable area */}
                    {showSkeletonFixed ? (
                        Platform.OS === 'web' ? (
                            <HierarchicalObjectsSkeletonList />
                        ) : (
                            <View style={{ paddingVertical: 32, alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={colors.blue600} />
                                <Text style={{ marginTop: 12, color: colors.lightGray600 }}>Loading…</Text>
                            </View>
                        )
                    ) : localItems.length > 0 ? (
                        // ...existing code for rendering object cards...
                        (Object.values(
                            (localItems || []).reduce((acc, it) => {
                                const ik = it.__instanceKey || '';
                                const key = it.group_key ? `grp:${it.group_key}` : `solo:${ik || it.id}`;
                                if (!acc[key]) acc[key] = { group_key: it.group_key || null, items: [] };
                                acc[key].items.push(it);
                                return acc;
                            }, {})
                        )
                            .map((group) => {
                                const times = group.items
                                    .map((it) => new Date(it.created_at || it.updated_at || Date.now()).getTime())
                                    .filter((t) => Number.isFinite(t));
                                const sortKey = times.length ? Math.min(...times) : Number.MAX_SAFE_INTEGER;
                                return { ...group, sortKey };
                            })
                            .sort((a, b) => a.sortKey - b.sortKey)
                        ).flatMap((group) => {
                            // ...existing code for rendering each group/card...
                            const anchorId = group.items[0]?.id;
                            const pathKey = (currentLevelPath && currentLevelPath.length) ? currentLevelPath.join('/') : 'root';
                            const isGrouped = !!group.group_key && group.items.length > 1;
                            if (isGrouped) {
                                // ...existing code for grouped cards...
                                const anchor = group.items[0];
                                const anchorTotalProperties = (anchor.properties || []).length;
                                const anchorTotalChildren = (anchor.children || []).length;
                                const anchorOwner = anchor.owner_name || 'Unknown';
                                return [
                                    (
                                        <View
                                            key={`${pathKey}-group-sep-top-${group.group_key}`}
                                            style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }}
                                        />
                                    ),
                                    ...group.items.map((it, idx) => {
                                        const title = it.naam;
                                        const totalProperties = anchorTotalProperties;
                                        const totalChildren = anchorTotalChildren;
                                        const owner = anchorOwner;
                                        const flowContext = getMaterialFlowContext(it.material_flow_type || 'default');
                                        const FlowIcon = flowContext.icon;
                                        return (
                                            <TouchableOpacity
                                                key={`${pathKey}-group-${group.group_key}-${it.__instanceKey || it.id}-${idx}`}
                                                style={[AppStyles.card, AppStyles.cardGroupMember]}
                                                onPress={() => {
                                                    const nextPath = [...currentLevelPath, anchorId];
                                                    selectionContextRef.current = { pathKey: nextPath.join('/'), preferSoloLabel: false };
                                                    setCurrentPath(nextPath);
                                                }}
                                            >
                                                <View style={AppStyles.cardFlex}>
                                                    {/* Material Flow Indicator */}
                                                    {FlowIcon && (
                                                        <View style={{ alignItems: 'center', marginRight: 12, minWidth: 40 }}>
                                                            <FlowIcon color={flowContext.color} size={24} />
                                                            {flowContext.label && (
                                                                <Text style={{ 
                                                                    fontSize: 10, 
                                                                    color: flowContext.color, 
                                                                    fontWeight: '600',
                                                                    textAlign: 'center',
                                                                    marginTop: 2
                                                                }}>
                                                                    {flowContext.label}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    )}
                                                    <View style={AppStyles.cardContent}>
                                                        <Text style={AppStyles.cardTitle}>{title}</Text>
                                                        <Text style={AppStyles.cardSubtitle}>Maker: {owner}</Text>
                                                        <Text style={AppStyles.cardSubtitle}>
                                                            {totalProperties} eigenschap{totalProperties !== 1 ? 'pen' : ''}
                                                            {totalChildren > 0 ? ` - ${totalChildren} sub-item(s)` : ''}
                                                        </Text>
                                                    </View>
                                                    <View style={{ width: 1, backgroundColor: colors.lightGray500, marginHorizontal: 10, alignSelf: 'stretch' }} />
                                                    <PropertyButton onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedProperty(anchorId);
                                                        setCurrentScreen('properties');
                                                    }} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }),
                                    (
                                        <View
                                            key={`${pathKey}-group-sep-bottom-${group.group_key}`}
                                            style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }}
                                        />
                                    )
                                ];
                            }
                            // ...existing code for solo cards...
                            const primary = group.items[0];
                            const title = primary.naam;
                            const totalProperties = (primary.properties || []).length;
                            const totalChildren = (primary.children || []).length;
                            const owner = primary.owner_name || 'Unknown';
                            const flowContext = getMaterialFlowContext(primary.material_flow_type || 'default');
                            const FlowIcon = flowContext.icon;
                            return [
                                (
                                    <TouchableOpacity
                                        key={`${pathKey}-solo-${primary.__instanceKey || primary.id}`}
                                        style={AppStyles.card}
                                        onPress={() => {
                                            const nextPath = [...currentLevelPath, primary.id];
                                            selectionContextRef.current = { pathKey: nextPath.join('/'), preferSoloLabel: true };
                                            setCurrentPath(nextPath);
                                        }}
                                    >
                                        <View style={AppStyles.cardFlex}>
                                            {/* Material Flow Indicator */}
                                            {FlowIcon && (
                                                <View style={{ alignItems: 'center', marginRight: 12, minWidth: 40 }}>
                                                    <FlowIcon color={flowContext.color} size={24} />
                                                    {flowContext.label && (
                                                        <Text style={{ 
                                                            fontSize: 10, 
                                                            color: flowContext.color, 
                                                            fontWeight: '600',
                                                            textAlign: 'center',
                                                            marginTop: 2
                                                        }}>
                                                            {flowContext.label}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                            <View style={AppStyles.cardContent}>
                                                <Text style={AppStyles.cardTitle}>{title}</Text>
                                                <Text style={AppStyles.cardSubtitle}>Maker: {owner}</Text>
                                                <Text style={AppStyles.cardSubtitle}>
                                                    {totalProperties} eigenschap{totalProperties !== 1 ? 'pen' : ''}
                                                    {totalChildren > 0 ? ` - ${totalChildren} sub-item(s)` : ''}
                                                </Text>
                                            </View>
                                            <View style={{ width: 1, backgroundColor: colors.lightGray500, marginHorizontal: 10, alignSelf: 'stretch' }} />
                                            <PropertyButton onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedProperty(primary.id);
                                                setCurrentScreen('properties');
                                            }} />
                                        </View>
                                    </TouchableOpacity>
                                ),
                            ];
                        })
                    ) : (
                        <View style={AppStyles.emptyState}>
                            <Text style={AppStyles.emptyStateText}>No items found for this filter.</Text>
                            <Text style={AppStyles.emptyStateSubtext}>
                                Try a different filter or add a new item.
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>
            
            {/* FAB Menu Overlay */}
            {fabMenuOpen && (
                <TouchableOpacity 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.3)',
                    }}
                    onPress={closeFabMenu}
                    activeOpacity={1}
                />
            )}
            
            {/* Filter Button */}
            <Animated.View
                style={[
                    AppStyles.filterFab,
                    { 
                        bottom: 200,
                        transform: [
                            {
                                translateY: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [171, 0],
                                })
                            },
                            {
                                scale: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                })
                            }
                        ],
                        opacity: fabMenuAnimation
                    }
                ]}
                pointerEvents={fabMenuOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity 
                    onPress={() => {
                        closeFabMenu();
                        setShowFilterModal(true);
                    }} 
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Filter color={colors.blue600} size={24} />
                </TouchableOpacity>
            </Animated.View>
            
            {/* Formula Button */}
            <Animated.View
                style={[
                    AppStyles.filterFab,
                    { 
                        bottom: 143,
                        transform: [
                            {
                                translateY: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [114, 0],
                                })
                            },
                            {
                                scale: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 1],
                                })
                            }
                        ],
                        opacity: fabMenuAnimation
                    }
                ]}
                pointerEvents={fabMenuOpen ? 'auto' : 'none'}
            >
                <TouchableOpacity 
                    onPress={() => {
                        closeFabMenu();
                        setShowFormulePickerModal(true);
                    }} 
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Calculator color={colors.blue600} size={24} />
                </TouchableOpacity>
            </Animated.View>

            {/* Main Menu FAB */}
            <Animated.View
                style={[
                    AppStyles.filterFab,
                    { 
                        bottom: 86,
                        transform: [
                            {
                                rotate: fabMenuAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: ['0deg', '45deg'],
                                })
                            }
                        ]
                    }
                ]}
            >
                <TouchableOpacity 
                    onPress={toggleFabMenu}
                    style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                    <Menu color={colors.blue600} size={24} />
                </TouchableOpacity>
            </Animated.View>

            {/* Main FAB: Prompt for single vs multiple */}
            <TouchableOpacity onPress={() => setShowAddChoice(true)} style={AppStyles.fab}>
                <Plus color="white" size={24} />
            </TouchableOpacity>


            {/* Add choice modal */}
            <Modal
                transparent
                visible={showAddChoice}
                onRequestClose={() => setShowAddChoice(false)}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowAddChoice(false)}
                    style={AppStyles.modalOverlay}
                >
                    <View style={[AppStyles.modalContainer, { paddingVertical: 16, paddingHorizontal: 16, maxWidth: 480, width: '90%' }]}>
                        <Text style={AppStyles.modalTitle}>Toevoegen</Text>
                        <Text style={{ color: colors.lightGray600, marginTop: 4, textAlign: 'center' }}>Kies wat je wilt doen</Text>
                        <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => { setShowAddChoice(false); setAddModalMode('single'); setShowAddObjectModal(true); }}
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 20,
                                    paddingHorizontal: 12,
                                    backgroundColor: 'white',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.lightGray300,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.08,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 2,
                                }}
                            >
                                <Plus color={colors.blue600} size={28} />
                                <Text style={[AppStyles.headerTitleSmall, { color: colors.lightGray900, fontWeight: '700', marginTop: 8, textAlign: 'center' }]}>Single object</Text>
                                <Text style={{ color: colors.lightGray600, marginTop: 4, fontSize: 12, textAlign: 'center' }}>Voeg één object toe</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => { setShowAddChoice(false); setAddModalMode('multiple'); setShowAddObjectModal(true); }}
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingVertical: 20,
                                    paddingHorizontal: 12,
                                    backgroundColor: 'white',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: colors.lightGray300,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.08,
                                    shadowRadius: 6,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 2,
                                }}
                            >
                                <Boxes color={colors.blue600} size={28} />
                                <Text style={[AppStyles.headerTitleSmall, { color: colors.lightGray900, fontWeight: '700', marginTop: 8, textAlign: 'center' }]}>Multiple objects</Text>
                                <Text style={{ color: colors.lightGray600, marginTop: 4, fontSize: 12, textAlign: 'center' }}>Voeg meerdere namen toe</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[AppStyles.modalActions, { marginTop: 16, justifyContent: 'flex-end' }]}>
                            <TouchableOpacity onPress={() => setShowAddChoice(false)} style={AppStyles.btnSecondary}>
                                <Text style={AppStyles.btnSecondaryText}>Annuleren</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            

            {showAddObjectModal && (
                <AddObjectModal
                    visible={showAddObjectModal}
                    mode={addModalMode}
                    onClose={() => setShowAddObjectModal(false)}
                    onSave={(payload) => {
                        setShowAddObjectModal(false); // Close instantly
                        const data = (payload && typeof payload === 'object' && !Array.isArray(payload))
                            ? payload
                            : (Array.isArray(payload) ? { names: payload } : { name: payload });
                        wrappedOnAddObject(currentLevelPath, data);
                    }}
                    objectsHierarchy={objectsHierarchy}
                    excludeIds={currentLevelPath}
                    onAttachExisting={async (payload) => {
                        // Start attaching progress
                        setIsAttachingExisting(true);
                        lastLoadWasAddRef.current = true;
                        setShowAddLoading(true);
                        setAddProgress(0);
                        progressIntervalRef.current = setInterval(() => {
                            setAddProgress((prev) => (prev < 90 ? prev + 5 : prev));
                        }, 80);
                        try {
                            const isObj = payload && typeof payload === 'object' && !Array.isArray(payload);
                            const ids = isObj ? payload.ids : payload;
                            const deferClose = isObj ? !!payload.deferClose : false;
                            const groupKey = isObj ? payload.groupKey || null : null;
                            // Reuse the same objects by linking them to the current parent (no duplication)
                            const parentId = currentLevelPath.length > 0 ? currentLevelPath[currentLevelPath.length - 1] : null;
                            console.log('[AttachExisting] selected ids', ids, 'parentId', parentId);
                            // Allow root-level linking (parentId null); only filter self-link if there is a parent
                            const filtered = (ids || []).filter((id) => (parentId == null ? true : id !== parentId));
                            if (filtered.length === 0) {
                                Alert.alert('Geen actie', 'Je kunt een object niet aan zichzelf koppelen. Kies een ander object.');
                                console.warn('[AttachExisting] nothing to link after filtering self');
                                return;
                            }
                            const linkRes = await linkObjects({ parentId, childIds: filtered, groupKey });
                            console.log('[AttachExisting] link result', linkRes);
                            if (!linkRes.success) {
                                if (linkRes.message === 'object_links_missing') {
                                    // Do not duplicate; inform user to set up linking table
                                    console.warn('[AttachExisting] object_links table missing - cannot link without duplication');
                                    throw new Error('Linking is not set up yet. Please run the SQL to create object_links.');
                                } else {
                                    throw new Error(linkRes.message || 'Linking failed');
                                }
                            }
                            if (onRefresh) await onRefresh();
                            if (!deferClose) {
                                Alert.alert('Gelinkt', parentId == null ? 'Object succesvol aan de hoofdniveau gekoppeld.' : 'Object succesvol gekoppeld.');
                                setShowAddObjectModal(false);
                            }
                        } catch (e) {
                            console.error('[AttachExisting] Failed', e);
                            Alert.alert('Fout', e.message || 'Koppelen mislukt');
                        } finally {
                            // Stop attaching progress
                            lastLoadWasAddRef.current = false;
                            setIsAttachingExisting(false);
                            setAddProgress(100);
                            setTimeout(() => {
                                setShowAddLoading(false);
                                setAddProgress(0);
                                if (progressIntervalRef.current) {
                                    clearInterval(progressIntervalRef.current);
                                    progressIntervalRef.current = null;
                                }
                            }, 350);
                        }
                    }}
                />
            )}
            {showFilterModal && <FilterModal visible={showFilterModal} onClose={() => setShowFilterModal(false)} allUsers={allUsers} userToken={userToken} totalObjectCount={totalObjectCount} onSelectFilter={setFilterOption} />}
            
            <AddFormuleModal
                visible={showAddFormuleModal}
                onClose={() => {
                    const wasEditing = !!editingFormule;
                    setShowAddFormuleModal(false);
                    setEditingFormule(null);
                    // If user was editing and chose Annuleer, return to Formule picker
                    if (wasEditing) {
                        setTimeout(() => setShowFormulePickerModal(true), 0);
                    }
                }}
                onSave={handleFormuleSaved}
                editingFormule={editingFormule}
                onDelete={(deleted) => {
                    console.log('[HierarchicalObjectsScreen] onDelete callback called with:', deleted);
                    if (deleted.__deleted) {
                        console.log('[HierarchicalObjectsScreen] Processing delete for id:', deleted.id);
                        setFormules(prev => {
                            const filtered = prev.filter(f => f.id !== deleted.id);
                            console.log('[HierarchicalObjectsScreen] Formules before filter:', prev.length, 'after filter:', filtered.length);
                            return filtered;
                        });
                        // Refetch from backend to ensure sync (in case of race conditions)
                        (async () => {
                            try {
                                console.log('[HierarchicalObjectsScreen] Refetching Formules from API');
                                const fresh = await fetchFormulesApi();
                                if (Array.isArray(fresh)) {
                                    console.log('[HierarchicalObjectsScreen] Refetch successful, got', fresh.length, 'Formules');
                                    setFormules(fresh);
                                } else {
                                    console.log('[HierarchicalObjectsScreen] Refetch returned non-array:', fresh);
                                }
                            } catch (e) {
                                console.log('[HierarchicalObjectsScreen] Refetch after delete failed', e);
                            }
                        })();
                    } else {
                        console.log('[HierarchicalObjectsScreen] Delete callback called but __deleted flag is false');
                    }
                }}
            />
            <FormulePickerModal
                visible={showFormulePickerModal}
                onClose={() => setShowFormulePickerModal(false)}
                Formules={Formules}
                onSelectFormule={handleFormuleSelected}
                onEditFormule={(Formule) => {
                    setShowFormulePickerModal(false);
                    setEditingFormule(Formule);
                    setTimeout(() => setShowAddFormuleModal(true), 0);
                }}
                onAddFormule={() => {
                    setShowFormulePickerModal(false);
                    setTimeout(() => setShowAddFormuleModal(true), 0);
                }}
            />

            {/* Summary Modal (temporary, not persisted) */}
            <Modal
                transparent
                visible={showSummaryModal}
                // Do not auto-close on hardware back; only close when user presses the explicit 'Sluiten' button
                onRequestClose={() => {}}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    // Prevent closing when tapping overlay; only close via 'Sluiten' buttons inside modal
                    onPress={() => {}}
                    style={AppStyles.modalOverlay}
                >
                    <View style={[AppStyles.modalContainer, { maxWidth: 900, width: '96%', padding: 12 }]}> 
                        <Text style={AppStyles.modalTitle}>Samenvatting — {summaryPropertyName}</Text>
                        <Text style={{ color: colors.lightGray600, marginTop: 6 }}>Tijdelijke berekening (niet opgeslagen)</Text>
                        <View style={{ marginTop: 12, maxHeight: 520, flexDirection: 'row', gap: 12 }}>
                            {/* Left column: top-level parents list */}
                            <View style={{ width: '40%', borderRightWidth: 1, borderRightColor: colors.lightGray200, paddingRight: 12 }}>
                                <Text style={{ fontWeight: '700', marginBottom: 8 }}>Top-level objecten</Text>
                                {Array.isArray(localObjectsHierarchy) && localObjectsHierarchy.length > 0 ? (
                                    <FlatList
                                        data={leftListData.slice(0, leftPage * leftPageSize)}
                                        keyExtractor={(item, idx) => item.type === 'sep' ? item.id : (item.item?.id || `${item.type}-${idx}`)}
                                        renderItem={({ item }) => {
                                            if (item.type === 'sep') {
                                                return <View key={item.id} style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }} />;
                                            }
                                                if (item.type === 'group-member') {
                                                    const n = item.item;
                                                    const entry = summaryMap && summaryMap[n.id];
                                                    const propCount = (item.groupProps && item.groupProps.length) ? item.groupProps.length : (entry && entry.props ? Object.keys(entry.props).length : 0);
                                                    const anchor = item.anchorId || n.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={`parent-group-${n.id}`}
                                                            onPress={() => {
                                                                // When a grouped parent is pressed, select the group's anchor and set the group key; member names are computed by effect
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
                                            // solo
                                            const n = item.item;
                                            const entry = summaryMap && summaryMap[n.id];
                                            const propCount = (item.soloProps && item.soloProps.length) ? item.soloProps.length : (entry && entry.props ? Object.keys(entry.props).length : 0);
                                            return (
                                                <TouchableOpacity
                                                    key={`parent-solo-${n.id}`}
                                                    onPress={() => { setSelectedSummaryParentId(n.id); setSelectedParentStack([n.id]); setSelectedGroupKey(null); setSelectedGroupMembers([]); setPressedGroupKey(null); }}
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
                                            leftListData.length > leftPage * leftPageSize ? (
                                                <TouchableOpacity onPress={() => setLeftPage((p) => p + 1)} style={{ padding: 10, alignItems: 'center' }}>
                                                    <Text style={{ color: colors.blue600 }}>Load more</Text>
                                                </TouchableOpacity>
                                            ) : null
                                        )}
                                    />
                                ) : (
                                    <Text style={{ color: colors.lightGray600 }}>Geen objecten</Text>
                                )}
                            </View>

                            {/* Right column: drill-down view */}
                            <View style={{ flex: 1, paddingLeft: 12 }}>
                                {(!selectedSummaryParentId && selectedParentStack.length === 0) ? (
                                    // Root view: show root totals and top-level overview
                                    <ScrollView>
                                        <View style={{ borderWidth: 1, borderColor: colors.lightGray200, borderRadius: 10, padding: 10, backgroundColor: '#fff' }}>
                                            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Totaal (root):</Text>
                                            {summaryRootTotal && Object.keys(summaryRootTotal).length > 0 ? (
                                                Object.keys(summaryRootTotal).map((pn) => (
                                                    <Text key={`root-${pn}`} style={{ color: colors.lightGray700 }}>{pn}: {summaryRootTotal[pn]}</Text>
                                                ))
                                            ) : (
                                                <Text style={{ color: colors.lightGray600 }}>—</Text>
                                            )}
                                        </View>

                                        <View style={{ marginTop: 12 }}>
                                            <Text style={{ color: colors.lightGray600 }}>Selecteer een top-level object aan de linkerkant om sub-items te bekijken.</Text>
                                        </View>
                                    </ScrollView>
                                ) : (
                                    // Drill-down view: show breadcrumb and immediate children vertically
                                    (() => {
                                        const currentId = selectedParentStack[selectedParentStack.length - 1] || selectedSummaryParentId;
                                        const currentNode = findNodeById(currentId, localObjectsHierarchy || objectsHierarchy);
                                        const currentEntry = summaryMap && summaryMap[currentId];
                                        return (
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                            {/* Back button removed per request */}
                                                            <View style={{ marginLeft: 8, flex: 1, minWidth: 0 }}>
                                                                {/* Descendants row only (breadcrumb chips removed) */}
                                                                {(() => {
                                                                    const pathIds = (Array.isArray(selectedParentStack) && selectedParentStack.length > 0)
                                                                        ? selectedParentStack
                                                                        : (selectedSummaryParentId ? [selectedSummaryParentId] : []);
                                                                    // Ancestors = all pathIds except the current node
                                                                    const ancestors = (pathIds && pathIds.length > 1) ? pathIds.slice(0, -1) : [];
                                                                    if ((!expandedCrumbId || !expandedDescendants || expandedDescendants.length === 0) && ancestors.length === 0) {
                                                                        // nothing to render
                                                                        return null;
                                                                    }

                                                                    return (
                                                                        <>
                                                                            {/* Ancestors row (non-interactive chips showing objects that came before) */}
                                                                            {/* Single combined row: ancestors, current preview, then descendants */}
                                                                            <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }} onWheel={Platform.OS === 'web' ? handleBreadcrumbWheel : undefined}>
                                                                                {(() => {
                                                                                    const parts = [];
                                                                                    // push ancestors
                                                                                    ancestors.forEach((id) => {
                                                                                        const node = findNodeById(id, localObjectsHierarchy || objectsHierarchy);
                                                                                        parts.push({ type: 'ancestor', node });
                                                                                    });
                                                                                    // push current
                                                                                    if (currentNode) parts.push({ type: 'current', node: currentNode });
                                                                                    // push descendants
                                                                                    if (expandedDescendants && expandedDescendants.length) {
                                                                                        expandedDescendants.forEach((it) => parts.push({ type: 'descendant', node: it.node, path: it.path }));
                                                                                    }
                                                                                    return parts.map((p, idx) => {
                                                                                        const isLast = idx === parts.length - 1;
                                                                                        if (p.type === 'ancestor') {
                                                                                            const ai = pathIds.findIndex((pid) => pid === p.node?.id);
                                                                                            const node = p.node;
                                                                                            const isGrouped = node && node.group_key;
                                                                                            const isActive = isGrouped && pressedGroupKey && pressedGroupKey === node.group_key;
                                                                                            // preview text for grouped nodes
                                                                                            let label = node ? node.naam : 'Onbekend';
                                                                                            if (isGrouped) {
                                                                                                const parentContext = (pathIds && pathIds.length > 1) ? pathIds[pathIds.length - 2] : null;
                                                                                                const members = getGroupMemberNames(node.group_key, parentContext) || [];
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
                                                                                            return (
                                                                                                <TouchableOpacity key={`part-ancestor-${node?.id || idx}`} onPress={() => {
                                                                                                    const next = pathIds.slice(0, (ai >= 0 ? ai : idx) + 1);
                                                                                                    setSelectedParentStack(next);
                                                                                                    const newCurrent = next[next.length - 1];
                                                                                                    setSelectedSummaryParentId(newCurrent);
                                                                                                    const parentNode = findNodeById(newCurrent, localObjectsHierarchy || objectsHierarchy);
                                                                                                    if (parentNode && parentNode.group_key) {
                                                                                                        setSelectedGroupKey(parentNode.group_key);
                                                                                                        setPressedGroupKey(parentNode.group_key);
                                                                                                    } else {
                                                                                                        setSelectedGroupKey(null);
                                                                                                        setPressedGroupKey(null);
                                                                                                    }
                                                                                                    setExpandedCrumbId(null);
                                                                                                }} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                                                    <View style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                                                                                                        <Text numberOfLines={1} ellipsizeMode={'tail'} style={{ fontWeight: '600', color: isActive ? colors.blue600 : colors.lightGray700 }}>{label}</Text>
                                                                                                    </View>
                                                                                                    {!isLast && (
                                                                                                        <ArrowRight color={colors.lightGray500} size={12} style={{ marginHorizontal: 6 }} />
                                                                                                    )}
                                                                                                </TouchableOpacity>
                                                                                            );
                                                                                        }
                                                                                        if (p.type === 'current') {
                                                                                            // compute preview text similar to before
                            const node = p.node;
                            let previewText = node ? node.naam : 'Onbekend';
                            const isGroupedCurrent = node && node.group_key;
                            if (isGroupedCurrent) {
                                const parentContext = (pathIds && pathIds.length > 1) ? pathIds[pathIds.length - 2] : null;
                                const members = getGroupMemberNames(node.group_key, parentContext) || [];
                                if (members.length > 1) {
                                    const first = members[0] || node.naam;
                                    const second = members[1] || '';
                                    const half = Math.ceil((second || '').length / 2) || 0;
                                    const secondShort = second.slice(0, half);
                                    previewText = `${first}+${secondShort}…`;
                                } else if (members.length === 1) {
                                    previewText = members[0];
                                }
                            }
                            const isActiveCurrent = isGroupedCurrent && pressedGroupKey && pressedGroupKey === node.group_key;
                            return (
                                <View key={`part-current-${node?.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity onPress={() => {
                                        // Activate group preview for current node (do not change selection)
                                        if (isGroupedCurrent) {
                                            setSelectedGroupKey(node.group_key);
                                            setPressedGroupKey(node.group_key);
                                        }
                                        // collapse descendants view
                                        setExpandedCrumbId(null);
                                    }} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                                        <Text numberOfLines={1} ellipsizeMode={'tail'} style={{ fontWeight: '700', color: isActiveCurrent ? colors.blue600 : colors.lightGray900 }}>{previewText}</Text>
                                    </TouchableOpacity>
                                    {!isLast && (
                                        <ArrowRight color={colors.lightGray500} size={12} style={{ marginHorizontal: 6 }} />
                                    )}
                                </View>
                            );
                                                                                        }
                                                                                        // descendant
                                                                                        const dnode = p.node;
                                                                                        const isGroupedDesc = dnode && dnode.group_key;
                                                                                        const isActiveDesc = isGroupedDesc && pressedGroupKey && pressedGroupKey === dnode.group_key;
                                                                                        let dlabel = dnode ? dnode.naam : 'Onbekend';
                                                                                        if (isGroupedDesc) {
                                                                                            const parentContext = (pathIds && pathIds.length > 1) ? pathIds[pathIds.length - 2] : null;
                                                                                            const members = getGroupMemberNames(dnode.group_key, parentContext) || [];
                                                                                            if (members.length > 1) {
                                                                                                const first = members[0] || dnode.naam;
                                                                                                const second = members[1] || '';
                                                                                                const half = Math.ceil((second || '').length / 2) || 0;
                                                                                                const secondShort = second.slice(0, half);
                                                                                                dlabel = `${first}+${secondShort}…`;
                                                                                            } else if (members.length === 1) {
                                                                                                dlabel = members[0];
                                                                                            }
                                                                                        }
                                                                                        return (
                                                                                            <View key={`part-desc-${dnode?.id || idx}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                                                <TouchableOpacity onPress={() => {
                                                                                                    const crumbIndex = pathIds.findIndex(pid => pid === expandedCrumbId);
                                                                                                    const base = pathIds.slice(0, crumbIndex + 1);
                                                                                                    const nextStack = [...base, ...p.path];
                                                                                                    setSelectedParentStack(nextStack);
                                                                                                    setSelectedSummaryParentId(nextStack[nextStack.length - 1]);
                                                                                                    const targetNode = p.node;
                                                                                                    if (targetNode && targetNode.group_key) { setSelectedGroupKey(targetNode.group_key); setPressedGroupKey(targetNode.group_key); } else { setSelectedGroupKey(null); setPressedGroupKey(null); }
                                                                                                    setExpandedCrumbId(null);
                                                                                                }} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
                                                                                                    <Text numberOfLines={1} ellipsizeMode={'tail'} style={{ fontWeight: '600', color: isActiveDesc ? colors.blue600 : colors.lightGray700 }}>{dlabel}</Text>
                                                                                                </TouchableOpacity>
                                                                                                {!isLast && (
                                                                                                    <ArrowRight color={colors.lightGray500} size={12} style={{ marginHorizontal: 6 }} />
                                                                                                )}
                                                                                            </View>
                                                                                        );
                                                                                    });
                                                                                })()}
                                                                            </ScrollView>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </View>
                                                        </View>
                                                </View>

                                                <View style={{ borderRadius: 12, padding: 12, backgroundColor: '#fff', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}>
                                                    <Text style={{ fontWeight: '700', fontSize: 16 }}>{(selectedGroupMembers && selectedGroupMembers.length > 0) ? selectedGroupMembers.join(' + ') : (currentNode ? currentNode.naam : 'Geselecteerd')}</Text>
                                                    <Text style={{ color: colors.lightGray600, marginTop: 4 }}>Aggregated eigenschappen</Text>
                                                    <View style={{ marginTop: 10 }}>
                                                        {currentEntry && currentEntry.props && Object.keys(currentEntry.props).length > 0 ? (
                                                            Object.keys(currentEntry.props).map((pn) => (
                                                                <View key={`pdet-${pn}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                                                                    <Text style={{ color: colors.lightGray700 }}>{pn}</Text>
                                                                    <Text style={{ color: colors.lightGray900, fontWeight: '700' }}>{currentEntry.props[pn].total} <Text style={{ color: colors.lightGray600, fontWeight: '400' }}>({currentEntry.props[pn].count})</Text></Text>
                                                                </View>
                                                            ))
                                                        ) : (
                                                            <Text style={{ color: colors.lightGray600, marginTop: 6 }}>Geen eigenschappen</Text>
                                                        )}
                                                    </View>
                                                </View>

                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: '700', marginBottom: 8 }}>Sub-items</Text>
                                                    {currentNode && Array.isArray(currentNode.children) && currentNode.children.length > 0 ? (
                                                        <FlatList
                                                            style={{ flex: 1 }}
                                                            contentContainerStyle={{ paddingBottom: 12 }}
                                                            data={buildGroupedList(currentNode.children).slice(0, rightPage * rightPageSize)}
                                                            keyExtractor={(item, idx) => item.type === 'sep' ? item.id : (item.item?.id || `${item.type}-${idx}`)}
                                                            renderItem={({ item }) => {
                                                                if (item.type === 'sep') return <View key={item.id} style={{ height: 1, backgroundColor: colors.lightGray200, marginVertical: 6 }} />;
                                                                if (item.type === 'group-member') {
                                                                    const ch = item.item;
                                                                    const chEntry = summaryMap && summaryMap[ch.id];
                                                                    const propCount = (item.groupProps && item.groupProps.length) ? item.groupProps.length : (chEntry && chEntry.props ? Object.keys(chEntry.props).length : 0);
                                                                        return (
                                                                        <TouchableOpacity key={`child-${ch.id}`} onPress={() => {
                                                                            const anchor = item.anchorId || ch.id;
                                                                            // When pressing a grouped child, select the group's anchor and set the group key; member names are computed by effect
                                                                            setSelectedParentStack((prev) => [...(prev || []), anchor]);
                                                                            setSelectedSummaryParentId(anchor);
                                                                            setSelectedGroupKey(item.group_key || null);
                                                                            setPressedGroupKey(item.group_key || null);
                                                                        }} style={[AppStyles.card, AppStyles.cardGroupMember, { marginBottom: 6, flexDirection: 'row', alignItems: 'center' }]}>
                                                                            {/* left accent */}
                                                                            {/* left accent removed */}
                                                                            <View style={{ flex: 1 }}>
                                                                                <View style={AppStyles.cardFlex}>
                                                                                    <View style={AppStyles.cardContent}>
                                                                                        <Text style={AppStyles.cardTitle}>{ch.naam}</Text>
                                                                                        <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                                                    </View>
                                                                                </View>
                                                                            </View>
                                                                            
                                                                        </TouchableOpacity>
                                                                    );
                                                                }
                                                                // solo child
                                                                const ch = item.item;
                                                                const chEntry = summaryMap && summaryMap[ch.id];
                                                                const propCount = (item.soloProps && item.soloProps.length) ? item.soloProps.length : (chEntry && chEntry.props ? Object.keys(chEntry.props).length : 0);
                                                                return (
                                                                    <TouchableOpacity key={`child-${ch.id}`} onPress={() => {
                                                                        // Navigating into a solo child: clear any active group selection so header shows the solo name
                                                                        setSelectedGroupKey(null);
                                                                        setSelectedGroupMembers([]);
                                                                        setPressedGroupKey(null);
                                                                        setSelectedParentStack((prev) => [...(prev || []), ch.id]);
                                                                        setSelectedSummaryParentId(ch.id);
                                                                    }} style={[AppStyles.card, { marginBottom: 8 }]}> 
                                                                        <View style={AppStyles.cardFlex}>
                                                                            <View style={AppStyles.cardContent}>
                                                                                <Text style={AppStyles.cardTitle}>{ch.naam}</Text>
                                                                                <Text style={AppStyles.cardSubtitle}>{propCount} eigenschappen</Text>
                                                                            </View>
                                                                            {/* divider removed */}
                                                                        </View>
                                                                    </TouchableOpacity>
                                                                );
                                                            }}
                                                            ListFooterComponent={() => (
                                                                currentNode.children.length > rightPage * rightPageSize ? (
                                                                    <TouchableOpacity onPress={() => setRightPage((p) => p + 1)} style={{ padding: 10, alignItems: 'center' }}>
                                                                        <Text style={{ color: colors.blue600 }}>Load more</Text>
                                                                    </TouchableOpacity>
                                                                ) : null
                                                            )}
                                                        />
                                                    ) : (
                                                        <Text style={{ color: colors.lightGray600 }}>Geen sub-items</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })()
                                )}
                            </View>
                        </View>
                        <View style={[AppStyles.modalActions, { marginTop: 12, justifyContent: 'flex-end' }]}> 
                            <TouchableOpacity onPress={() => { closeSummaryModal(); }} style={AppStyles.btnPrimary}>
                                <Text style={AppStyles.btnPrimaryText}>Sluiten</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

        </View>
    );
};

export default HierarchicalObjectsScreen;
