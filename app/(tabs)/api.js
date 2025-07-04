import { Alert } from 'react-native';
import CONFIG from './config/config'; // <-- Import config

const API_BASE_URL = CONFIG.API_BASE_URL; // <-- Use config

export const fetchAllUsers = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}?entity=users`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch users and counts:', error);
        return null;
    }
};

export const handleLogin = async (username, password) => {
    try {
        const response = await fetch(`${API_BASE_URL}?entity=users&action=login`, {
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
        const response = await fetch(`${API_BASE_URL}?entity=users&action=register`, {
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
        const topLevelResponse = await fetch(`${API_BASE_URL}?entity=objects&filter_user_id=${filterOption}`);
        if (!topLevelResponse.ok) {
            throw new Error(`HTTP error! status: ${topLevelResponse.status} for top-level objects`);
        }
        const topLevelObjects = await topLevelResponse.json();

        const hydrationResults = await Promise.allSettled(topLevelObjects.map(async (obj) => {
            try {
                const fullObjectResponse = await fetch(`${API_BASE_URL}?entity=objects&id=${obj.id}`);
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
        const response = await fetch(`${API_BASE_URL}?entity=templates`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const templatesData = await response.json();

        const formattedTemplates = {};
        await Promise.all(templatesData.map(async (template) => {
            try {
                const propertiesResponse = await fetch(`${API_BASE_URL}?entity=templates&id=${template.id}`);
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
        const apiResponse = await fetch(`${API_BASE_URL}?entity=objects`, {
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

export const addProperties = async (objectId, properties) => {
    try {
        await Promise.all(properties.map(async (prop) => {
            const response = await fetch(`${API_BASE_URL}?entity=properties`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    object_id: objectId,
                    name: prop.name.trim(),
                    waarde: prop.value.trim(),
                }),
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
