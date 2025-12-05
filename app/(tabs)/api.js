import { Alert } from 'react-native';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// LET OP: pad zoals jij gebruikt
import { auth, db, storage } from './config/firebase';

// Kleine helper om van een naam een Firestore-vriendelijke ID te maken
const slugify = (str) =>
  (str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `obj_${Date.now()}`;

// ===== Auth (compatibele namen) =====

export const supabaseLogin = async (email, password) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: cred.user };
  } catch (error) {
    console.error('[supabaseLogin] Error:', error);
    return { success: false, message: error.message };
  }
};

export const supabaseRegister = async (email, password) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // profiel aanmaken in Firestore
    const profileRef = doc(db, 'profiles', cred.user.uid);
    await setDoc(profileRef, {
      email: cred.user.email,
      username: cred.user.email.split('@')[0],
      full_name: '',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return { success: true, user: cred.user };
  } catch (error) {
    console.error('[supabaseRegister] Error:', error);
    return { success: false, message: error.message };
  }
};

export const supabaseLogout = async () => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error('[supabaseLogout] Error:', error);
    return false;
  }
};

// ===== Users =====

export const fetchAllUsers = async () => {
  try {
    console.log('[fetchAllUsers] Fetching all user profiles.');

    const profilesRef = collection(db, 'profiles');
    const profilesSnap = await getDocs(profilesRef);

    const profiles = profilesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    console.log('[fetchAllUsers] Found profiles:', profiles.length);

    const usersWithCounts = await Promise.all(
      profiles.map(async (profile) => {
        const objectsRef = collection(db, 'objects');
        const qObj = query(objectsRef, where('user_id', '==', profile.id));
        const objectsSnap = await getDocs(qObj);

        return {
          id: profile.id,
          username: profile.username || 'Unknown',
          object_count: objectsSnap.size,
        };
      })
    );

    const totalObjectCount = usersWithCounts.reduce(
      (sum, u) => sum + u.object_count,
      0
    );

    return { users: usersWithCounts, totalObjectCount };
  } catch (error) {
    console.error('[fetchAllUsers] Error:', error);
    return null;
  }
};

// ===== Properties helpers =====

const fetchPropertiesForObject = async (objectId) => {
  try {
    const propsRef = collection(db, 'objects', objectId, 'eigenschappen');
    const snap = await getDocs(propsRef);

    return snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        ...data,
        files: data.files || data.property_files || [],
      };
    });
  } catch (error) {
    console.error('[fetchPropertiesForObject] Error:', error);
    return [];
  }
};

// ===== Objects & hierarchie =====

const fetchObjectChildren = async (parentId, profileMap = {}) => {
  try {
    const objectsRef = collection(db, 'objects');
    const qChildren = query(
      objectsRef,
      where('parent_id', '==', parentId),
      orderBy('naam')
    );
    const snap = await getDocs(qChildren);

    const children = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const childrenWithGrandchildren = await Promise.all(
      children.map(async (child) => {
        const [grandchildren, properties] = await Promise.all([
          fetchObjectChildren(child.id, profileMap),
          fetchPropertiesForObject(child.id),
        ]);

        const profile = profileMap[child.user_id];
        const ownerName = profile?.username || profile?.full_name || child.owner_name || 'Unknown';

        return {
          ...child,
          owner_name: ownerName,
          properties,
          children: grandchildren,
        };
      })
    );

    return childrenWithGrandchildren;
  } catch (error) {
    console.error('[fetchObjectChildren] Error:', error);
    return [];
  }
};

export const fetchAndSetAllObjects = async (filterOption = 'all') => {
  try {
    console.log('[fetchAndSetAllObjects] Filter:', filterOption);

    const objectsRef = collection(db, 'objects');
    let topQuery = query(
      objectsRef,
      where('parent_id', '==', null),
      orderBy('naam')
    );

    if (filterOption && filterOption !== 'all') {
      topQuery = query(
        objectsRef,
        where('parent_id', '==', null),
        where('user_id', '==', filterOption),
        orderBy('naam')
      );
    }

    const topSnap = await getDocs(topQuery);
    const topObjects = topSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    console.log(
      '[fetchAndSetAllObjects] Found',
      topObjects.length,
      'top-level objects'
    );

    // Profielen voor owners
    const profileMap = {};

    // Get all profiles
    try {
      const profilesRef = collection(db, 'profiles');
      const profilesSnap = await getDocs(profilesRef);
      profilesSnap.docs.forEach((d) => {
        profileMap[d.id] = d.data();
      });
    } catch (e) {
      console.warn('[fetchAndSetAllObjects] Error fetching profiles:', e);
    }

    const objectsWithChildren = await Promise.all(
      topObjects.map(async (obj) => {
        const [children, propsFromSub] = await Promise.all([
          fetchObjectChildren(obj.id, profileMap),
          fetchPropertiesForObject(obj.id),
        ]);

        const fallbackProps =
          obj.eigenschappen || obj.properties || [];

        const rawProps =
          propsFromSub.length > 0 ? propsFromSub : fallbackProps;

        const profile = profileMap[obj.user_id];
        const ownerName = profile?.username || profile?.full_name || obj.owner_name || 'Unknown';

        return {
          ...obj,
          owner_name: ownerName,
          user_id: obj.user_id, // Ensure user_id is present
          properties: rawProps.map((p) => ({
            ...p,
            files: p.files || p.property_files || [],
          })),
          children,
        };
      })
    );

    return objectsWithChildren;
  } catch (error) {
    console.error('[fetchAndSetAllObjects] Error:', error);
    Alert.alert('Error', 'Failed to load data.');
    return [];
  }
};

// Nieuwe objecten: document ID = (slug van) naam
export const handleAddObject = async (parentPath, newObjectData, userToken) => {
  try {
    const parentId =
      parentPath && parentPath.length > 0
        ? parentPath[parentPath.length - 1]
        : null;
    const { name, names, materialFlowType = 'default' } = newObjectData || {};

    let items = [];
    if (Array.isArray(names) && names.length > 0) {
      items = names.map((n) => (n || '').trim()).filter(Boolean);
    } else if (typeof name === 'string' && name.trim()) {
      items = [name.trim()];
    }

    if (!items.length) {
      Alert.alert('Input required', 'Please provide at least one name.');
      return { success: false };
    }

    const seen = new Set();
    const uniqueNames = items.filter((n) =>
      seen.has(n) ? false : (seen.add(n), true)
    );

    console.log(
      '[handleAddObject] Creating objects:',
      uniqueNames,
      'for user:',
      userToken
    );

    const groupKey =
      uniqueNames.length > 1
        ? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        : null;

    const objectsRef = collection(db, 'objects');
    const batch = writeBatch(db);
    const createdIds = [];

    for (const objectName of uniqueNames) {
      // Use auto-generated ID instead of name-based slug
      const newRef = doc(collection(db, 'objects'));
      
      const objectData = {
        naam: objectName,
        parent_id: parentId,
        user_id: userToken,
        material_flow_type: materialFlowType,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };
      if (groupKey) objectData.group_key = groupKey;

      batch.set(newRef, objectData);
      createdIds.push(newRef.id);
    }

    await batch.commit();
    console.log('[handleAddObject] Created objects:', createdIds);

    return {
      success: true,
      createdIds,
      message: `Created ${createdIds.length} object(s)`,
    };
  } catch (error) {
    console.error('[handleAddObject] Error:', error);
    Alert.alert('Error', error.message || 'Failed to create object.');
    return { success: false, message: error.message };
  }
};

// ===== Properties =====
// Alleen subcollectie, geen eigenschappen-array meer in object-doc

export const addProperties = async (objectId, properties) => {
  try {
    console.log(
      '[addProperties] Adding',
      properties.length,
      'properties to object:',
      objectId
    );

    const objectRef = doc(db, 'objects', objectId);
    const objectSnap = await getDoc(objectRef);

    if (!objectSnap.exists()) {
      console.error('[addProperties] Object not found:', objectId);
      return false;
    }

    const batch = writeBatch(db);

    for (const prop of properties) {
      // Use Firestore auto-ID if prop.id is missing (never use name)
      const propId = prop.id || doc(collection(db, `objects/${objectId}/eigenschappen`)).id;

      // ---- FILE UPLOAD ----
      const files = [];
      if (prop.files && Array.isArray(prop.files)) {
        for (const file of prop.files) {
          try {
            const fileName = file.name || `file_${Date.now()}`;
            const fileRef = ref(
              storage,
              `properties/${objectId}/${propId}/${fileName}`
            );

            const response = await fetch(file.uri);
            const blob = await response.blob();

            await uploadBytes(fileRef, blob, { contentType: blob.type });
            const downloadUrl = await getDownloadURL(fileRef);

            files.push({
              name: fileName,
              url: downloadUrl,
              size: blob.size,
              type: blob.type,
              path: `properties/${objectId}/${propId}/${fileName}`,
            });
          } catch (err) {
            console.warn('[addProperties] File upload error:', err);
          }
        }
      }

      // ---- SUBCOLLECTION DOCUMENT ----
      const propRef = doc(
        db,
        `objects/${objectId}/eigenschappen/${propId}`
      );

      batch.set(propRef, {
        name: prop.name,
        waarde: prop.waarde ?? '',
        eenheid: prop.eenheid ?? '',
        formule: prop.formule ?? prop.Formule_expression ?? '',
        Formule_id: prop.Formule_id ?? null,
        files,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }

    // Alleen updated_at op het object zelf
    batch.update(objectRef, {
      updated_at: serverTimestamp(),
    });

    await batch.commit();

    console.log('[addProperties] Properties saved in subcollection only');
    return true;
  } catch (err) {
    console.error('[addProperties] Error:', err);
    return false;
  }
};

// Optioneel: als je later edit/delete wil doen op subcollectie
export const updateProperty = async (objectId, propertyId, payload) => {
  try {
    console.log(
      '[updateProperty] Updating property:',
      objectId,
      propertyId,
      payload
    );

    const propRef = doc(
      db,
      `objects/${objectId}/eigenschappen/${propertyId}`
    );
    const snap = await getDoc(propRef);
    if (!snap.exists()) {
      console.warn('[updateProperty] Property not found');
      return false;
    }

    const updates = {
      updated_at: serverTimestamp(),
    };

    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.waarde !== undefined) updates.waarde = payload.waarde;
    if (payload.eenheid !== undefined) updates.eenheid = payload.eenheid;
    if (payload.Formule_id !== undefined)
      updates.Formule_id = payload.Formule_id;
    if (payload.formule !== undefined) updates.formule = payload.formule;

    await updateDoc(propRef, updates);
    return true;
  } catch (error) {
    console.error('[updateProperty] Error:', error);
    return false;
  }
};

export const findPropertyIdByName = async (objectId, propertyName) => {
  try {
    const propsRef = collection(db, `objects/${objectId}/eigenschappen`);
    const q = query(propsRef, where('name', '==', propertyName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error('[findPropertyIdByName] Error:', error);
    return null;
  }
};

export const deleteProperty = async (objectId, propertyId) => {
  try {
    console.log('[deleteProperty] Deleting property:', objectId, propertyId);
    const propRef = doc(
      db,
      `objects/${objectId}/eigenschappen/${propertyId}`
    );
    // Use deleteDoc to actually remove from database
    await deleteDoc(propRef);
    console.log('[deleteProperty] Property successfully deleted from database');
    return true;
  } catch (error) {
    console.error('[deleteProperty] Error:', error);
    return false;
  }
};

// ===== Formules =====

export const fetchFormules = async () => {
  try {
    console.log('[fetchFormules] Fetching formulas.');

    const formulasRef = collection(db, 'formules');
    const snap = await getDocs(formulasRef);

    const formulas = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    console.log('[fetchFormules] Found', formulas.length, 'formulas');
    return formulas;
  } catch (error) {
    console.error('[fetchFormules] Error:', error);
    return [];
  }
};

export const fetchFormulesSafe = async () => {
  try {
    const list = await fetchFormules();
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error('[fetchFormulesSafe] Error:', error);
    return [];
  }
};

export const createFormule = async (name, expression) => {
  try {
    const formulasRef = collection(db, 'formules');
    const docRef = await addDoc(formulasRef, {
      name,
      formule: expression,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('[createFormule] Error:', error);
    return { success: false, message: error.message };
  }
};

export const fetchFormuleByExpression = async (expression) => {
  try {
    const formulasRef = collection(db, 'formules');
    const qForm = query(formulasRef, where('formule', '==', expression));
    const snap = await getDocs(qForm);

    if (snap.empty) return null;

    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch (error) {
    console.error('[fetchFormuleByExpression] Error:', error);
    return null;
  }
};
