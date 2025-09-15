import { Alert, Platform } from 'react-native';
import CONFIG from './config/config';

// --- All other functions (fetchAllUsers, handleLogin, etc.) remain unchanged ---

export const fetchAllUsers = async () => {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}?entity=users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch users and counts:', error);
        return null;
    }
};

export const handleLogin = async (username, password) => {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}?entity=users&action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return await response.json();
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'An error occurred during login.' };
    }
};

export const handleRegister = async (username, password) => {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}?entity=users&action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        return await response.json();
    } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'An error occurred during registration.' };
    }
};

export const fetchAndSetAllObjects = async (filterOption) => {
    try {
        const topLevelResponse = await fetch(`${CONFIG.API_BASE_URL}?entity=objects&filter_user_id=${filterOption}`);
        if (!topLevelResponse.ok) {
            throw new Error(`HTTP error! status: ${topLevelResponse.status} for top-level objects`);
        }
        const topLevelObjects = await topLevelResponse.json();

        const hydrationResults = await Promise.allSettled(topLevelObjects.map(async (obj) => {
            try {
                const fullObjectResponse = await fetch(`${CONFIG.API_BASE_URL}?entity=objects&id=${obj.id}`);
                if (!fullObjectResponse.ok) {
                    console.warn(`Failed to fetch full hierarchy for object ID ${obj.id}. Status: ${fullObjectResponse.status}`);
                    return null;
                }
                const data = await fullObjectResponse.json();
                return { ...data, properties: data.properties || [], children: data.children || [] };
            } catch (innerError) {
                console.error(`Error fetching full hierarchy for object ID ${obj.id}:`, innerError);
                return null;
            }
        }));

        return hydrationResults
            .filter(result => result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value);

    } catch (error) {
        console.error('Failed to fetch and set all objects (overall error):', error);
        Alert.alert('Error', 'Failed to load data.');
        return null;
    }
};

export const fetchTemplates = async () => {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}?entity=templates`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const templatesData = await response.json();

        const formattedTemplates = {};
        await Promise.all(templatesData.map(async (template) => {
            try {
                const propertiesResponse = await fetch(`${CONFIG.API_BASE_URL}?entity=templates&id=${template.id}`);
                if (!propertiesResponse.ok) return;
                const templateWithProperties = await propertiesResponse.json();
                formattedTemplates[String(template.id)] = {
                    name: template.name,
                    properties: (templateWithProperties.properties || []).map(prop => ({
                        ...prop,
                        name: prop.property_name,
                        value: prop.property_value || ''
                    }))
                };
            } catch (innerError) {
                console.error(`Error fetching properties for template ID ${template.id}:`, innerError);
            }
        }));
        return formattedTemplates;
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        return null;
    }
};

export const handleAddObject = async (parentPath, newObjectData, userToken) => {
    const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;
    const { name } = newObjectData;

    try {
        const apiResponse = await fetch(`${CONFIG.API_BASE_URL}?entity=objects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                parent_id: parentId,
                user_id: userToken,
            }),
        });

        const resultJson = await apiResponse.json();

        if (!apiResponse.ok) {
            Alert.alert('Error', resultJson.message || 'Failed to add object.');
            return false;
        }
        
        Alert.alert('Success', resultJson.message);
        return true;

    } catch (error) {
        console.error('Error in handleAddObject:', error);
        Alert.alert('Error', 'An unexpected error occurred while adding the item.');
        return false;
    }
};

/**
 * Adds multiple properties, each potentially with multiple files.
 * @param {string} objectId - The ID of the object to add properties to.
 * @param {Array} properties - An array of property objects from the state.
 * @returns {Promise<boolean>}
 */
export const addProperties = async (objectId, properties) => {
    try {
        // Use Promise.all to wait for all individual property requests to complete.
        await Promise.all(properties.map(async (prop) => {
            const formData = new FormData();
            formData.append('object_id', objectId);
            formData.append('name', prop.name.trim());
            formData.append('waarde', prop.value.trim());
            formData.append('formule', prop.formule ? prop.formule : '');
            formData.append('eenheid', prop.unit ? prop.unit : '');

            // Check if there's a files array and it's not empty.
            if (prop.files && prop.files.length > 0) {
                // Loop through the files array for this property.
                prop.files.forEach(file => {
                    // Append each file using 'files[]' as the key.
                    // This is crucial for the PHP backend to recognize it as an array.
                    if (Platform.OS === 'web') {
                        // On web, we have the original File object stored in _webFile
                        formData.append('files[]', file._webFile, file.name);
                    } else {
                        // On native, we use the { uri, type, name } structure
                        formData.append('files[]', {
                            uri: file.uri,
                            type: file.mimeType,
                            name: file.name,
                        });
                    }
                });
            }

            // Send one request per property.
            const response = await fetch(`${CONFIG.API_BASE_URL}?entity=properties`, {
                method: 'POST',
                body: formData, // FormData automatically sets the correct headers
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(`Failed to save property '${prop.name}': ${errorResult.message || 'Unknown error'}`);
            }
        }));

        Alert.alert('Success', 'Properties added successfully!');
        return true;
    } catch (error) {
        console.error('Error adding properties:', error);
        Alert.alert('Error', error.message);
        return false;
    }
};

export const updateProperty = async (propertyId, { name, waarde, formule, eenheid }) => {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}?entity=properties&id=${propertyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, waarde, formule: formule || '', eenheid: eenheid || '' }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(err.message || 'Failed to update property');
        }
        Alert.alert('Success', 'Eigenschap bijgewerkt.');
        return true;
    } catch (error) {
        console.error('Error updating property:', error);
        Alert.alert('Error', error.message);
        return false;
    }
};

export default () => null;
