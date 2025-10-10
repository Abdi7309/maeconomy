import { Alert, Platform } from 'react-native';
import { supabase } from './config/config';

// Auth functions using Supabase Auth
export const supabaseLogin = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      return { success: false, message: error.message }
    }
    
    // Get the user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()
    
    if (profileError) {
      console.warn('Profile not found, creating one...')
      // Profile will be created automatically by the trigger
    }
    
    return { 
      success: true, 
      user: data.user,
      session: data.session,
      profile: profile || null
    }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

export const supabaseRegister = async (email, password, username) => {
  try {
    console.log('[supabaseRegister] Starting registration for:', email, 'with username:', username);
    
    // Create new user with Supabase Auth (skip username check for now to avoid RLS issues)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
          full_name: ''
        }
      }
    })
    
    console.log('[supabaseRegister] Supabase response:', { data: !!data, error: error?.message });
    
    if (error) {
      console.error('[supabaseRegister] Supabase error:', error);
      return { success: false, message: error.message }
    }
    
    if (!data.user) {
      console.error('[supabaseRegister] No user returned from Supabase');
      return { success: false, message: 'Registration failed - no user created' }
    }
    
    console.log('[supabaseRegister] User created:', data.user.id, 'Email confirmed:', data.user.email_confirmed_at ? 'Yes' : 'No');
    
    // Check if user needs to confirm email
    if (!data.session && !data.user.email_confirmed_at) {
      console.log('[supabaseRegister] Email confirmation required');
      return { 
        success: true, 
        user: data.user,
        needsConfirmation: true,
        message: 'Registration successful! Please check your email to confirm your account before logging in.'
      }
    }
    
    // User is immediately confirmed
    console.log('[supabaseRegister] User registered and confirmed');
    return { 
      success: true, 
      user: data.user,
      session: data.session,
      needsConfirmation: false,
      message: 'Registration successful!'
    }
  } catch (error) {
    console.error('[supabaseRegister] Unexpected error:', error);
    return { success: false, message: error.message || 'An unexpected error occurred during registration' }
  }
}

export const supabaseLogout = async () => {
  try {
    console.log('[supabaseLogout] Starting logout process...');
    
    // Add timeout to prevent hanging
    const logoutPromise = supabase.auth.signOut();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Logout timeout')), 5000)
    );
    
    const { error } = await Promise.race([logoutPromise, timeoutPromise]);
    
    if (error) {
      console.error('[supabaseLogout] Supabase logout error:', error);
      return false;
    }
    
    console.log('[supabaseLogout] Logout completed successfully');
    return true;
  } catch (error) {
    console.error('[supabaseLogout] Logout error or timeout:', error);
    // Even if logout fails, we'll return false but the UI state will already be cleared
    return false;
  }
}

// Get current user session
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    console.log('[getCurrentUser] Getting profile for user:', user.id, user.email);
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (profileError && profileError.code === 'PGRST116') {
      // Profile doesn't exist, try to create it
      console.log('[getCurrentUser] Profile not found, creating one...');
      
      const username = user.user_metadata?.username || 
                      user.raw_user_meta_data?.username || 
                      user.email?.split('@')[0] || 
                      `user_${user.id.substring(0, 8)}`;
      
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          username: username,
          full_name: user.user_metadata?.full_name || user.raw_user_meta_data?.full_name || ''
        }])
        .select()
        .single();
      
      if (createError) {
        console.error('[getCurrentUser] Failed to create profile:', createError);
        return { user, profile: null };
      }
      
      console.log('[getCurrentUser] Created new profile:', newProfile);
      return { user, profile: newProfile };
    }
    
    if (profileError) {
      console.error('[getCurrentUser] Error fetching profile:', profileError);
      return { user, profile: null };
    }
    
    console.log('[getCurrentUser] Found existing profile:', profile);
    return {
      user,
      profile
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Get current session
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting session:', error)
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

// Legacy function names for compatibility
export const handleLogin = supabaseLogin
export const handleRegister = supabaseRegister

export const fetchAllUsers = async () => {
    try {
        console.log('[fetchAllUsers] Starting to fetch all users...');
        
        // First, get all auth users to see who exists
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.log('[fetchAllUsers] Cannot access auth.admin (expected in client), trying profiles only');
        }
        
        // Get all profiles with their object counts
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username')
        
        if (profilesError) {
            console.error('[fetchAllUsers] Error fetching profiles:', profilesError);
            throw profilesError;
        }
        
        console.log('[fetchAllUsers] Found profiles:', profiles?.length || 0);
        
        // Also get all unique user_ids from objects to find users without profiles
        const { data: objectUsers, error: objectError } = await supabase
            .from('objects')
            .select('user_id')
            .not('user_id', 'is', null);
        
        if (objectError) {
            console.error('[fetchAllUsers] Error fetching object users:', objectError);
        }
        
        // Find unique user IDs from objects
        const uniqueObjectUserIds = [...new Set((objectUsers || []).map(obj => obj.user_id))];
        console.log('[fetchAllUsers] Unique user IDs from objects:', uniqueObjectUserIds);
        
        // Find users who have objects but no profiles
        const profileUserIds = (profiles || []).map(p => p.id);
        const missingProfileUsers = uniqueObjectUserIds.filter(id => !profileUserIds.includes(id));
        
        if (missingProfileUsers.length > 0) {
            console.log('[fetchAllUsers] Found users with objects but no profiles:', missingProfileUsers);
            // Try to create profiles for missing users
            await createMissingProfiles(missingProfileUsers);
        }
        
        // Get object counts for each user
        const usersWithCounts = await Promise.all(
            (profiles || []).map(async (profile) => {
                const { count } = await supabase
                    .from('objects')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', profile.id)
                
                return {
                    id: profile.id,
                    username: profile.username,
                    object_count: count || 0
                }
            })
        )
        
        const totalObjectCount = usersWithCounts.reduce((sum, user) => sum + user.object_count, 0)
        
        console.log('[fetchAllUsers] Final user list:', usersWithCounts);
        
        return {
            users: usersWithCounts,
            totalObjectCount
        }
    } catch (error) {
        console.error('Failed to fetch users and counts:', error);
        return null;
    }
};

// Helper function to create missing profiles
const createMissingProfiles = async (userIds) => {
    try {
        console.log('[createMissingProfiles] Creating profiles for users:', userIds);
        
        for (const userId of userIds) {
            try {
                // Try to create a profile with a default username
                const { data, error } = await supabase
                    .from('profiles')
                    .insert([{
                        id: userId,
                        username: `user_${userId.substring(0, 8)}`, // Use first 8 chars of UUID
                        full_name: ''
                    }])
                    .select();
                
                if (error) {
                    console.error('[createMissingProfiles] Error creating profile for', userId, ':', error);
                } else {
                    console.log('[createMissingProfiles] Created profile for', userId, ':', data);
                }
            } catch (err) {
                console.error('[createMissingProfiles] Exception creating profile for', userId, ':', err);
            }
        }
    } catch (error) {
        console.error('[createMissingProfiles] Error in createMissingProfiles:', error);
    }
};

// Manual function to fix missing profiles - can be called from app
export const fixMissingProfiles = async () => {
    try {
        console.log('[fixMissingProfiles] Starting profile repair...');
        
        // Get all unique user IDs from objects
        const { data: objectUsers, error: objectError } = await supabase
            .from('objects')
            .select('user_id')
            .not('user_id', 'is', null);
        
        if (objectError) {
            console.error('[fixMissingProfiles] Error fetching object users:', objectError);
            return { success: false, message: objectError.message };
        }
        
        const uniqueUserIds = [...new Set(objectUsers.map(obj => obj.user_id))];
        console.log('[fixMissingProfiles] Found user IDs in objects:', uniqueUserIds);
        
        // Get existing profiles
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .in('id', uniqueUserIds);
        
        if (profileError) {
            console.error('[fixMissingProfiles] Error fetching profiles:', profileError);
            return { success: false, message: profileError.message };
        }
        
        const existingProfileIds = (profiles || []).map(p => p.id);
        const missingProfileIds = uniqueUserIds.filter(id => !existingProfileIds.includes(id));
        
        console.log('[fixMissingProfiles] Missing profile IDs:', missingProfileIds);
        
        if (missingProfileIds.length > 0) {
            await createMissingProfiles(missingProfileIds);
            return { 
                success: true, 
                message: `Created ${missingProfileIds.length} missing profiles`,
                createdProfiles: missingProfileIds.length
            };
        } else {
            return { 
                success: true, 
                message: 'No missing profiles found',
                createdProfiles: 0
            };
        }
    } catch (error) {
        console.error('[fixMissingProfiles] Error:', error);
        return { success: false, message: error.message };
    }
};

// Helper function to fetch object children recursively
const fetchObjectChildren = async (parentId) => {
  try {
    const { data, error } = await supabase
      .from('objects')
      .select(`
        *,
        eigenschappen(*,
          formules(name, formule),
          property_files(*)
        )
      `)
      .eq('parent_id', parentId)
      .order('naam')
    
    if (error) throw error
    
    // Get unique user IDs for this batch of children
    const userIds = [...new Set(data.map(obj => obj.user_id).filter(Boolean))];
    
    // Fetch profiles for users
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      
      (profiles || []).forEach(profile => {
        profileMap[profile.id] = profile;
      });
    }
    
    const childrenWithGrandchildren = await Promise.all(
      data.map(async (child) => {
        const grandchildren = await fetchObjectChildren(child.id)
        const profile = profileMap[child.user_id];
        return {
          ...child,
          owner_name: profile?.username || 'Unknown',
          properties: (child.eigenschappen || []).map(prop => ({
            ...prop,
            files: prop.property_files || []
          })),
          children: grandchildren
        }
      })
    )
    
    return childrenWithGrandchildren
  } catch (error) {
    console.error('Error fetching children:', error)
    return []
  }
}

export const fetchAndSetAllObjects = async (filterOption) => {
    try {
        console.log('[fetchAndSetAllObjects] Fetching objects with filter:', filterOption);
        
        // First get objects without profile join to avoid foreign key issues
        let query = supabase
            .from('objects')
            .select(`
                *,
                eigenschappen(*,
                    formules(name, formule),
                    property_files(*)
                )
            `)
            .is('parent_id', null) // Top level objects only
            .order('naam')
        
        if (filterOption && filterOption !== 'all') {
            query = query.eq('user_id', filterOption)
        }
        
        const { data, error } = await query
        
        if (error) throw error
        
        console.log('[fetchAndSetAllObjects] Found', data?.length || 0, 'objects');
        
        // Get all unique user IDs to fetch profiles
        const userIds = [...new Set(data.map(obj => obj.user_id).filter(Boolean))];
        console.log('[fetchAndSetAllObjects] Fetching profiles for users:', userIds);
        
        // Fetch profiles for all users
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds);
        
        if (profileError) {
            console.error('[fetchAndSetAllObjects] Profile fetch error:', profileError);
        }
        
        // Create a profile lookup map
        const profileMap = {};
        (profiles || []).forEach(profile => {
            profileMap[profile.id] = profile;
        });
        
        // Fetch children recursively for each object
        const objectsWithChildren = await Promise.all(
            data.map(async (obj) => {
                const children = await fetchObjectChildren(obj.id)
                const profile = profileMap[obj.user_id];
                return {
                    ...obj,
                    owner_name: profile?.username || 'Unknown',
                    properties: (obj.eigenschappen || []).map(prop => ({
                        ...prop,
                        files: prop.property_files || []
                    })),
                    children
                }
            })
        )
        
        return objectsWithChildren
    } catch (error) {
        console.error('Error fetching objects:', error)
        Alert.alert('Error', 'Failed to load data.')
        return []
    }
}

export const handleAddObject = async (parentPath, newObjectData, userToken) => {
    const parentId = parentPath.length > 0 ? parentPath[parentPath.length - 1] : null;
    const { name } = newObjectData;

    try {
        console.log('[handleAddObject] Creating object:', name, 'for user:', userToken, 'parent:', parentId);
        
        const { data, error } = await supabase
            .from('objects')
            .insert([
                {
                    parent_id: parentId,
                    naam: name,
                    user_id: userToken,
                }
            ])
            .select()
        
        if (error) {
            console.error('[handleAddObject] Database error:', error);
            throw error;
        }
        
        console.log('[handleAddObject] Object created successfully:', data);
        Alert.alert('Success', 'Object created successfully!')
        return true
    } catch (error) {
        console.error('Error adding object:', error)
        Alert.alert('Error', error.message || 'Failed to create object')
        return false
    }
}

export const addProperties = async (objectId, properties) => {
    try {
        console.log('[addProperties] Adding', properties.length, 'properties to object', objectId)
        
        for (const prop of properties) {
            console.log('[addProperties] Processing property:', prop.name, 'files:', prop.files?.length || 0)
            
            // Insert property
            const { data: propertyData, error: propertyError } = await supabase
                .from('eigenschappen')
                .insert([
                    {
                        object_id: objectId,
                        name: prop.name.trim(),
                        waarde: prop.waarde,
                        eenheid: prop.unit || '',
                        formule_id: prop.Formule_id || null
                    }
                ])
                .select()
                .single()
            
            if (propertyError) throw propertyError
            
            console.log('[addProperties] Property created with ID:', propertyData.id)
            
            // Handle file uploads if any
            if (prop.files && prop.files.length > 0) {
                console.log('[addProperties] Uploading', prop.files.length, 'files for property', propertyData.id)
                const uploadResult = await uploadPropertyFiles(propertyData.id, prop.files)
                console.log('[addProperties] File upload result:', uploadResult)
            } else {
                console.log('[addProperties] No files to upload for property', prop.name)
            }
        }
        
        Alert.alert('Success', 'Properties added successfully!')
        return true
    } catch (error) {
        console.error('Error adding properties:', error)
        Alert.alert('Error', error.message)
        return false
    }
}

const uploadPropertyFiles = async (propertyId, files) => {
    try {
        console.log('[uploadPropertyFiles] Starting upload for', files.length, 'files')
        
        // Test if bucket exists
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
        console.log('[uploadPropertyFiles] Available buckets:', buckets?.map(b => b.name))
        
        if (bucketError) {
            console.error('[uploadPropertyFiles] Error listing buckets:', bucketError)
        }
        
        const uploadPromises = files.map(async (file, index) => {
            console.log('[uploadPropertyFiles] Processing file:', file.name, 'size:', file.size)
            
            const fileName = `property_${propertyId}_${Date.now()}_${index}_${file.name}`
            const filePath = `property-files/${fileName}`
            
            let fileToUpload
            if (Platform.OS === 'web') {
                fileToUpload = file._webFile
            } else {
                // For React Native, convert to blob
                const response = await fetch(file.uri)
                fileToUpload = await response.blob()
            }
            
            console.log('[uploadPropertyFiles] Uploading to storage:', filePath)
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('property-files')
                .upload(filePath, fileToUpload, {
                    cacheControl: '3600',
                    upsert: false
                })
            
            if (uploadError) {
                console.error('[uploadPropertyFiles] Storage upload error:', uploadError)
                throw uploadError
            }
            
            console.log('[uploadPropertyFiles] Storage upload successful:', uploadData.path)
            
            // Save file reference to database
            console.log('[uploadPropertyFiles] Saving file reference to database')
            const { error: dbError } = await supabase
                .from('property_files')
                .insert([
                    {
                        property_id: propertyId,
                        file_name: file.name,
                        file_path: uploadData.path,
                        file_type: file.type || file.mimeType,
                        file_size: file.size
                    }
                ])
            
            if (dbError) {
                console.error('[uploadPropertyFiles] Database insert error:', dbError)
                throw dbError
            }
            
            console.log('[uploadPropertyFiles] File reference saved to database')
        })
        
        await Promise.all(uploadPromises)
        console.log('[uploadPropertyFiles] All files uploaded successfully')
        return true
    } catch (error) {
        console.error('[uploadPropertyFiles] Error uploading files:', error)
        Alert.alert('File Upload Error', error.message || 'Failed to upload files')
        return false
    }
}

export const updateProperty = async (propertyId, { name, waarde, Formule_id, eenheid }) => {
    try {
        console.log('[updateProperty] Updating property ID:', propertyId);
        console.log('[updateProperty] Data:', { name, waarde, Formule_id, eenheid });
        
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[updateProperty] Current user:', user?.id || 'Not authenticated');
        
        // First, let's check if the property exists and get its current data
        const { data: existingProperty, error: fetchError } = await supabase
            .from('eigenschappen')
            .select('*, objects!inner(user_id)')
            .eq('id', propertyId)
            .single();
        
        if (fetchError) {
            console.error('[updateProperty] Error fetching existing property:', fetchError);
            throw new Error('Property not found or access denied');
        }
        
        console.log('[updateProperty] Existing property:', existingProperty);
        console.log('[updateProperty] Property owner:', existingProperty.objects?.user_id);
        console.log('[updateProperty] Current user can edit:', existingProperty.objects?.user_id === user?.id);
        
        const { data, error } = await supabase
            .from('eigenschappen')
            .update({
                name,
                waarde,
                eenheid: eenheid || '',
                formule_id: Formule_id || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', propertyId)
            .select()
        
        if (error) {
            console.error('[updateProperty] Database error:', error);
            throw error;
        }
        
        console.log('[updateProperty] Property updated successfully:', data);
        Alert.alert('Success', 'Property updated successfully!')
        return true
    } catch (error) {
        console.error('[updateProperty] Error updating property:', error);
        Alert.alert('Error', error.message || 'Failed to update property')
        return false
    }
}

export const deleteProperty = async (propertyId) => {
    try {
        const { error } = await supabase
            .from('eigenschappen')
            .delete()
            .eq('id', propertyId)
        
        if (error) throw error
        
        Alert.alert('Success', 'Property deleted successfully!')
        return true
    } catch (error) {
        console.error('Error deleting property:', error)
        Alert.alert('Error', error.message)
        return false
    }
}

// Formulas functions
export const fetchFormules = async () => {
    try {
        const { data, error } = await supabase
            .from('formules')
            .select('*')
            .order('name')
        
        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error fetching formulas:', error)
        return []
    }
}

export const createFormule = async (name, formule) => {
    try {
        console.log('[createFormule] Creating formula:', name, 'with formula:', formule);
        
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[createFormule] Current user:', user?.id || 'Not authenticated');
        
        const { data, error } = await supabase
            .from('formules')
            .insert([{ name, formule }])
            .select()
        
        if (error) {
            console.error('[createFormule] Database error:', error);
            throw error;
        }
        
        console.log('[createFormule] Formula created successfully:', data);
        return { success: true, id: data[0].id }
    } catch (error) {
        console.error('[createFormule] Error creating formula:', error);
        return { success: false, message: error.message || 'Failed to create formula' }
    }
}

export const updateFormule = async (id, name, formule) => {
    try {
        console.log('[updateFormule] Updating formula ID:', id, 'with name:', name, 'formula:', formule);
        
        const { data, error } = await supabase
            .from('formules')
            .update({ name, formule, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
        
        if (error) {
            console.error('[updateFormule] Database error:', error);
            throw error;
        }
        
        console.log('[updateFormule] Formula updated successfully:', data);
        
        // For now, return success without recalculation
        // You can add recalculation logic later if needed
        return { 
            success: true,
            affected_properties: 0,
            recalculated: 0,
            failed: 0
        }
    } catch (error) {
        console.error('[updateFormule] Error updating formula:', error);
        return { success: false, message: error.message || 'Failed to update formula' }
    }
}

export const deleteFormule = async (id) => {
    try {
        console.log('[deleteFormule] Starting delete for ID:', id)
        
        const { error } = await supabase
            .from('formules')
            .delete()
            .eq('id', id)
        
        if (error) throw error
        
        console.log('[deleteFormule] Delete successful')
        return { success: true }
    } catch (error) {
        console.error('Error deleting formula:', error)
        return { success: false, message: error.message }
    }
}

// Templates functions
export const fetchTemplates = async () => {
    try {
        const { data, error } = await supabase
            .from('templates')
            .select(`
                *,
                template_properties(*)
            `)
            .order('name')
        
        if (error) throw error
        
        const formattedTemplates = {}
        data.forEach(template => {
            formattedTemplates[template.id] = {
                name: template.name,
                properties: (template.template_properties || []).map(prop => ({
                    ...prop,
                    name: prop.property_name,
                    value: prop.property_value || ''
                }))
            }
        })
        
        return formattedTemplates
    } catch (error) {
        console.error('Error fetching templates:', error)
        return {}
    }
}

// Test function to verify storage setup
export const testStorageSetup = async () => {
    try {
        console.log('[testStorageSetup] Testing storage connection...')
        
        // List all buckets
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
        if (bucketError) {
            console.error('[testStorageSetup] Error listing buckets:', bucketError)
            return { success: false, error: bucketError.message }
        }
        
        console.log('[testStorageSetup] Available buckets:', buckets?.map(b => b.name))
        
        // Check if property-files bucket exists
        const propertyFilesBucket = buckets?.find(b => b.name === 'property-files')
        if (!propertyFilesBucket) {
            console.error('[testStorageSetup] property-files bucket not found')
            return { 
                success: false, 
                error: 'Storage bucket "property-files" not found. Please create it in Supabase Dashboard > Storage.',
                availableBuckets: buckets?.map(b => b.name) || []
            }
        }
        
        console.log('[testStorageSetup] property-files bucket found:', propertyFilesBucket)
        
        // Try to list files in the bucket (should work even if empty)
        const { data: files, error: listError } = await supabase.storage
            .from('property-files')
            .list()
        
        if (listError) {
            console.error('[testStorageSetup] Error accessing property-files bucket:', listError)
            return { success: false, error: listError.message }
        }
        
        console.log('[testStorageSetup] property-files bucket is accessible, contains', files?.length || 0, 'files')
        
        return { 
            success: true, 
            bucketExists: true,
            filesCount: files?.length || 0,
            message: 'Storage setup is working correctly'
        }
        
    } catch (error) {
        console.error('[testStorageSetup] Unexpected error:', error)
        return { success: false, error: error.message }
    }
}

export const createTemplate = async (templateName, properties, userId = null) => {
    try {
        console.log('[createTemplate] Creating template:', templateName, 'with', properties.length, 'properties')
        
        // Create the template
        const { data: templateData, error: templateError } = await supabase
            .from('templates')
            .insert([
                {
                    name: templateName,
                    user_id: userId // Can be null for shared templates
                }
            ])
            .select()
            .single()
        
        if (templateError) throw templateError
        
        console.log('[createTemplate] Template created with ID:', templateData.id)
        
        // Create template properties
        if (properties.length > 0) {
            const templateProperties = properties.map(prop => ({
                template_id: templateData.id,
                property_name: prop.property_name,
                property_value: prop.property_value || ''
            }))
            
            const { error: propertiesError } = await supabase
                .from('template_properties')
                .insert(templateProperties)
            
            if (propertiesError) throw propertiesError
            
            console.log('[createTemplate] Template properties created')
        }
        
        return { 
            success: true, 
            templateId: templateData.id,
            message: 'Template successfully created'
        }
        
    } catch (error) {
        console.error('[createTemplate] Error creating template:', error)
        return { 
            success: false, 
            message: error.message || 'Failed to create template'
        }
    }
}

export default () => null;
