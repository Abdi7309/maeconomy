import { Alert, Platform } from 'react-native';
import CONFIG, { supabase } from './config/config';

// Helper for timeouts to prevent hanging promises
const withTimeout = (promise, ms = 10000, label = 'operation') => new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
        (res) => { clearTimeout(timeoutId); resolve(res); },
        (err) => { clearTimeout(timeoutId); reject(err); }
    );
});

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

// Helper function to fetch object children recursively (includes linked children via object_links)
const fetchObjectChildren = async (parentId) => {
    try {
        // 1) Direct children
        let directChildren = [];
        let directError = null;

        try {
            ({ data: directChildren, error: directError } = await withTimeout(
                supabase
                    .from('objects')
                    .select(`
                        *,
                        eigenschappen(*,
                            formules(name, formule),
                            property_files(*)
                        )
                    `)
                    .eq('parent_id', parentId)
                    .order('naam'),
                500,
                'fetch-children'
            ));
        } catch (e) {
            console.warn('[fetchObjectChildren] Standard fetch failed, trying REST fallback...');
            if (Platform.OS === 'web') {
                try {
                    let token = null;
                    try {
                        const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                        const stored = localStorage.getItem(key);
                        if (stored) token = JSON.parse(stored).access_token;
                    } catch (_) {}
                    if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                    if (token) {
                        const queryParams = new URLSearchParams({
                            select: '*,eigenschappen(*,formules(name,formule),property_files(*))',
                            parent_id: `eq.${parentId}`,
                            order: 'naam.asc'
                        });
                        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/objects?${queryParams.toString()}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'apikey': CONFIG.SUPABASE_ANON_KEY
                            }
                        });
                        if (res.ok) {
                            directChildren = await res.json();
                            directError = null;
                            console.log('[fetchObjectChildren] REST Fallback success');
                        }
                    }
                } catch (restErr) { console.error('[fetchObjectChildren] REST Fallback failed', restErr); }
            }
            if (!directChildren && !directError) directError = e;
        }

        if (directError) throw directError;

        // 2) Linked children via object_links (best-effort; if table missing, skip)
        let linkedChildren = []
        let linkRows = []
        try {
            // Also wrap this in timeout/fallback if critical, but for now standard timeout is okay as it's secondary
            // We'll just use a short timeout to prevent hanging
            const { data: lr, error: linkErr } = await withTimeout(
                supabase
                    .from('object_links')
                    .select('id, child_id, group_key')
                    .eq('parent_id', parentId),
                500,
                'fetch-links'
            ).catch(() => ({ data: [], error: null })); // If it times out, just skip links for speed

            if (!linkErr && lr && lr.length) {
                linkRows = lr
                const linkedIds = lr.map(r => r.child_id) // allow duplicates (no Set)
                if (linkedIds.length) {
                    // Fetch linked objects - also needs resilience
                    let linkedObjs = [];
                    let linkedFetchErr = null;
                    
                    try {
                        ({ data: linkedObjs, error: linkedFetchErr } = await withTimeout(
                            supabase
                                .from('objects')
                                .select(`
                                    *,
                                    eigenschappen(*,
                                        formules(name, formule),
                                        property_files(*)
                                    )
                                `)
                                .in('id', Array.from(new Set(linkedIds)))
                                .order('naam'),
                            500,
                            'fetch-linked-objects'
                        ));
                    } catch (e) {
                        // REST Fallback for linked objects
                        if (Platform.OS === 'web') {
                            try {
                                let token = null;
                                try {
                                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                                    const stored = localStorage.getItem(key);
                                    if (stored) token = JSON.parse(stored).access_token;
                                } catch (_) {}
                                if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                                if (token) {
                                    // .in() filter format: id=in.(val1,val2,...)
                                    const idsStr = `(${Array.from(new Set(linkedIds)).join(',')})`;
                                    const queryParams = new URLSearchParams({
                                        select: '*,eigenschappen(*,formules(name,formule),property_files(*))',
                                        id: `in.${idsStr}`,
                                        order: 'naam.asc'
                                    });
                                    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/objects?${queryParams.toString()}`, {
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'apikey': CONFIG.SUPABASE_ANON_KEY
                                        }
                                    });
                                    if (res.ok) {
                                        linkedObjs = await res.json();
                                        linkedFetchErr = null;
                                    }
                                }
                            } catch (_) {}
                        }
                    }

                    if (!linkedFetchErr && Array.isArray(linkedObjs)) {
                        // Map id -> object for lookup, then rebuild array preserving duplicates by linkRows order
                        const objMap = new Map(linkedObjs.map(o => [o.id, o]))
                        linkedChildren = lr.map(row => ({ ...objMap.get(row.child_id), __link_group_key: row.group_key || null })).filter(Boolean)
                    }
                }
            }
        } catch (e) {
            // Table may not exist or RLS might block; ignore and proceed with no links
            console.warn('[fetchObjectChildren] object_links not available or inaccessible, skipping links')
        }
        const combined = [];
        (directChildren || []).forEach((o) =>
        combined.push({ ...o, __instanceKey: `dir:${o.id}` })
        );
        (linkedChildren || []).forEach((o, idx) => {
        const linkId = linkRows[idx]?.id || `${parentId}:${o.id}:${idx}`;
        combined.push({
            ...o,
            __instanceKey: `link:${linkId}`,
            group_key: o.__link_group_key ?? o.group_key,
        });
        });

        const userIds = Array.from(new Set(combined.map(obj => obj.user_id).filter(Boolean)));
        
    // Fetch profiles for users
    let profileMap = {};
    if (userIds.length > 0) {
      // Profile fetch is usually fast/cached, but let's wrap it too just in case
      try {
          const { data: profiles } = await withTimeout(
            supabase
                .from('profiles')
                .select('id, username')
                .in('id', userIds),
            5000,
            'fetch-profiles'
          );
          (profiles || []).forEach(profile => {
            profileMap[profile.id] = profile;
          });
      } catch (e) {
          console.warn('[fetchObjectChildren] Profile fetch timed out, trying REST fallback...');
          if (Platform.OS === 'web') {
              try {
                  let token = null;
                  try {
                      const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                      const stored = localStorage.getItem(key);
                      if (stored) token = JSON.parse(stored).access_token;
                  } catch (_) {}
                  if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                  if (token) {
                      const idsStr = `(${userIds.join(',')})`;
                      const queryParams = new URLSearchParams({
                          select: 'id,username',
                          id: `in.${idsStr}`
                      });
                      const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?${queryParams.toString()}`, {
                          headers: {
                              'Authorization': `Bearer ${token}`,
                              'apikey': CONFIG.SUPABASE_ANON_KEY
                          }
                      });
                      if (res.ok) {
                          const profiles = await res.json();
                          (profiles || []).forEach(profile => {
                              profileMap[profile.id] = profile;
                          });
                          console.log('[fetchObjectChildren] Profile REST Fallback success');
                      }
                  }
              } catch (restErr) { console.error('[fetchObjectChildren] Profile REST Fallback failed', restErr); }
          }
      }
    }
    
    const childrenWithGrandchildren = await Promise.all(
    combined.map(async (child) => {
        const grandchildren = await fetchObjectChildren(child.id);
        const profile = profileMap[child.user_id];
        return {
        ...child,
        owner_name: profile?.username || 'Unknown',
        properties: (child.eigenschappen || []).map((prop) => ({
            ...prop,
            files: prop.property_files || [],
        })),
        children: grandchildren,
        };
    })
    );

    return childrenWithGrandchildren
  } catch (error) {
    console.error('Error fetching children:', error)
    return []
  }
}

export const fetchAndSetAllObjects = async (filterOption) => {
    try {
        console.log('[fetchAndSetAllObjects] Fetching objects with filter:', filterOption);
        
        // First get top-level direct objects (parent_id is null)
        let directTop = [];
        let directError = null;

        try {
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
            
            ({ data: directTop, error: directError } = await withTimeout(query, 500, 'fetch-top-objects'));

        } catch (e) {
            console.warn('[fetchAndSetAllObjects] Standard fetch failed, trying REST fallback...');
            if (Platform.OS === 'web') {
                try {
                    let token = null;
                    try {
                        const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                        const stored = localStorage.getItem(key);
                        if (stored) token = JSON.parse(stored).access_token;
                    } catch (_) {}
                    if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                    if (token) {
                        const params = {
                            select: '*,eigenschappen(*,formules(name,formule),property_files(*))',
                            parent_id: 'is.null',
                            order: 'naam.asc'
                        };
                        if (filterOption && filterOption !== 'all') {
                            params.user_id = `eq.${filterOption}`;
                        }
                        const queryParams = new URLSearchParams(params);
                        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/objects?${queryParams.toString()}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'apikey': CONFIG.SUPABASE_ANON_KEY
                            }
                        });
                        if (res.ok) {
                            directTop = await res.json();
                            directError = null;
                            console.log('[fetchAndSetAllObjects] REST Fallback success');
                        }
                    }
                } catch (restErr) { console.error('[fetchAndSetAllObjects] REST Fallback failed', restErr); }
            }
            if (!directTop && !directError) directError = e;
        }
        
        if (directError) throw directError
        
        console.log('[fetchAndSetAllObjects] Found', directTop?.length || 0, 'direct top-level objects');
        
        // Also get linked top-level objects (parent link at root). Best-effort; if table missing, skip.
        let linkedTop = []
        try {
            const { data: lr, error: linkErr } = await withTimeout(
                supabase
                    .from('object_links')
                    .select('id, child_id, group_key')
                    .is('parent_id', null),
                500,
                'fetch-top-links'
            ).catch(() => ({ data: [], error: null }));

            if (!linkErr && lr && lr.length) {
                const ids = Array.from(new Set(lr.map(r => r.child_id)))
                if (ids.length) {
                    let linkedObjs = [];
                    let linkedFetchErr = null;

                    try {
                        let linkedQuery = supabase
                            .from('objects')
                            .select(`
                                *,
                                eigenschappen(*,
                                    formules(name, formule),
                                    property_files(*)
                                )
                            `)
                            .in('id', ids)
                            .order('naam')
                        
                        // Apply the same filter as direct objects
                        if (filterOption && filterOption !== 'all') {
                            linkedQuery = linkedQuery.eq('user_id', filterOption)
                        }
                        
                        ({ data: linkedObjs, error: linkedFetchErr } = await withTimeout(linkedQuery, 500, 'fetch-top-linked-objs'));
                    } catch (e) {
                        // REST Fallback for top linked objects
                        if (Platform.OS === 'web') {
                            try {
                                let token = null;
                                try {
                                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                                    const stored = localStorage.getItem(key);
                                    if (stored) token = JSON.parse(stored).access_token;
                                } catch (_) {}
                                if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                                if (token) {
                                    const idsStr = `(${ids.join(',')})`;
                                    const params = {
                                        select: '*,eigenschappen(*,formules(name,formule),property_files(*))',
                                        id: `in.${idsStr}`,
                                        order: 'naam.asc'
                                    };
                                    if (filterOption && filterOption !== 'all') {
                                        params.user_id = `eq.${filterOption}`;
                                    }
                                    const queryParams = new URLSearchParams(params);
                                    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/objects?${queryParams.toString()}`, {
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'apikey': CONFIG.SUPABASE_ANON_KEY
                                        }
                                    });
                                    if (res.ok) {
                                        linkedObjs = await res.json();
                                        linkedFetchErr = null;
                                    }
                                }
                            } catch (_) {}
                        }
                    }

                    if (!linkedFetchErr && Array.isArray(linkedObjs)) {
                        const map = new Map(linkedObjs.map(o => [o.id, o]))
                        linkedTop = lr.map(r => ({ ...map.get(r.child_id), __instanceKey: `rootlink:${r.id}`, group_key: r.group_key || map.get(r.child_id)?.group_key || null })).filter(Boolean)
                    }
                }
            }
        } catch (e) {
            console.warn('[fetchAndSetAllObjects] object_links not available or inaccessible at root, skipping links')
        }
        
        // Get all unique user IDs to fetch profiles
        const userIds = [...new Set([...(directTop||[]), ...(linkedTop||[])].map(obj => obj.user_id).filter(Boolean))];
        console.log('[fetchAndSetAllObjects] Fetching profiles for users:', userIds);
        
        // Fetch profiles for all users
        let profiles = [];
        try {
            const { data: p, error: profileError } = await withTimeout(
                supabase
                    .from('profiles')
                    .select('id, username')
                    .in('id', userIds),
                5000,
                'fetch-top-profiles'
            );
            if (profileError) console.error('[fetchAndSetAllObjects] Profile fetch error:', profileError);
            profiles = p || [];
        } catch (e) {
            console.warn('[fetchAndSetAllObjects] Profile fetch timed out, trying REST fallback...');
            if (Platform.OS === 'web') {
                try {
                    let token = null;
                    try {
                        const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                        const stored = localStorage.getItem(key);
                        if (stored) token = JSON.parse(stored).access_token;
                    } catch (_) {}
                    if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                    if (token) {
                        const idsStr = `(${userIds.join(',')})`;
                        const queryParams = new URLSearchParams({
                            select: 'id,username',
                            id: `in.${idsStr}`
                        });
                        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?${queryParams.toString()}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'apikey': CONFIG.SUPABASE_ANON_KEY
                            }
                        });
                        if (res.ok) {
                            profiles = await res.json();
                            console.log('[fetchAndSetAllObjects] Profile REST Fallback success');
                        }
                    }
                } catch (restErr) { console.error('[fetchAndSetAllObjects] Profile REST Fallback failed', restErr); }
            }
        }
        
        // Create a profile lookup map
        const profileMap = {};
        (profiles || []).forEach(profile => {
            profileMap[profile.id] = profile;
        });
        
        // Combine direct and linked, preserving duplicates; tag direct with instance key
        const combinedTop = [
        ...(directTop || []).map((o) => ({ ...o, __instanceKey: `rootdir:${o.id}` })),
        ...(linkedTop || []),
        ];

        // Fetch children recursively for each object
        const objectsWithChildren = await Promise.all(
            combinedTop.map(async (obj) => {
                const children = await fetchObjectChildren(obj.id)
                const profile = profileMap[obj.user_id];
                return {
                ...obj,
                owner_name: profile?.username || 'Unknown',
                properties: (obj.eigenschappen || []).map((prop) => ({
                    ...prop,
                    files: prop.property_files || [],
                })),
                children,
                };
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
    const { name, names, groupKey: externalGroupKey, materialFlowType = 'default' } = newObjectData || {};

    try {
        // Ensure we have an authenticated session before attempting a write
        // Wrap in timeout to prevent hanging on stale connections
        try {
            const { data: sessionData } = await withTimeout(supabase.auth.getSession(), 500, 'auth-check');
            if (!sessionData?.session) {
                // Give auth a brief moment to (re)hydrate on cold start
                await new Promise((r) => setTimeout(r, 250));
            }
            await withTimeout(supabase.auth.getUser(), 500, 'user-check');
        } catch (e) {
            console.warn('[handleAddObject] Auth check timed out, proceeding to try insert (REST fallback will handle auth if needed)');
        }

        // Normalize list of names
        let items = [];
        if (Array.isArray(names) && names.length > 0) {
            items = names
                .map(n => (n || '').trim())
                .filter(Boolean);
        } else if (typeof name === 'string' && name.trim()) {
            items = [name.trim()];
        }

        if (items.length === 0) {
            Alert.alert('Input required', 'Please provide at least one name.');
            return false;
        }

        // Remove duplicates while preserving order
        const seen = new Set();
        const uniqueNames = items.filter(n => (seen.has(n) ? false : (seen.add(n), true)));

        console.log('[handleAddObject] Creating objects:', uniqueNames, 'for user:', userToken, 'parent:', parentId);

        // If external groupKey provided (to join with existing links), use it; else if multiple, generate shared group_key
    const groupKey = externalGroupKey || (uniqueNames.length > 1 ? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}` : null);

        const payload = uniqueNames.map((n) => ({
            parent_id: parentId,
            naam: n,
            user_id: userToken,
            material_flow_type: materialFlowType,
            ...(groupKey ? { group_key: groupKey } : {})
        }));

    let insertRes;
    try {
        insertRes = await withTimeout(
            supabase
                .from('objects')
                .insert(payload)
                .select('id'),
            1000,
            'add-object'
        );
    } catch (e) {
        console.warn('[handleAddObject] Standard insert failed, trying REST fallback...');
        let fallbackSuccess = false;
        if (Platform.OS === 'web') {
            try {
                let token = null;
                try {
                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                    const stored = localStorage.getItem(key);
                    if (stored) token = JSON.parse(stored).access_token;
                } catch (_) {}
                if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                if (token) {
                    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/objects`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'apikey': CONFIG.SUPABASE_ANON_KEY,
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        const json = await res.json();
                        insertRes = { data: json, error: null };
                        fallbackSuccess = true;
                    }
                }
            } catch (restErr) { console.error('[handleAddObject] REST Fallback failed', restErr); }
        }
        if (!fallbackSuccess) throw e;
    }

        if (insertRes.error) {
            // Fallback if group_key column doesn't exist yet
            const msg = insertRes.error.message || '';
            if (insertRes.error.code === '42703' || msg.includes('group_key') || msg.includes('material_flow_type')) {
                console.warn('[handleAddObject] column missing, retrying without it');
                const payloadFallback = payload.map(({ group_key, material_flow_type, ...rest }) => rest);
                insertRes = await withTimeout(
                    supabase
                        .from('objects')
                        .insert(payloadFallback)
                        .select('id')
                );
            }
        }

        if (insertRes.error) {
            console.error('[handleAddObject] Database error:', insertRes.error);
            throw insertRes.error;
        }

        console.log('[handleAddObject] Objects created successfully:', uniqueNames.length);
        const createdIds = Array.isArray(insertRes.data) ? insertRes.data.map(r => r.id) : [];
        Alert.alert('Success', `${uniqueNames.length} object(en) succesvol aangemaakt`);
        return { success: true, ids: createdIds };
    } catch (error) {
        console.error('Error adding object(s):', error);
        Alert.alert('Error', error.message || 'Failed to create object(s)');
        return { success: false, message: error.message || 'Failed to create object(s)' };
    }
}

export const addProperties = async (objectId, properties) => {
    try {
        console.log('[addProperties] Adding', properties.length, 'properties to object', objectId)
        // Ensure authenticated session to avoid RLS surprises on cold start
        try {
            const { data: sessionData } = await withTimeout(supabase.auth.getSession(), 500, 'auth-check');
            if (!sessionData?.session) {
                await new Promise((r) => setTimeout(r, 250));
            }
            await withTimeout(supabase.auth.getUser(), 500, 'user-check');
        } catch (e) {
            console.warn('[addProperties] Auth check timed out, proceeding to try insert');
        }
        
        const isRlsDenied = (err) => {
            if (!err) return false;
            const msg = (err.message || '').toLowerCase();
            return (
                msg.includes('row level security') ||
                msg.includes('rls') ||
                msg.includes('permission denied') ||
                msg.includes('violates row-level security policy')
            );
        };

        for (const prop of properties) {
            console.log('[addProperties] Processing property:', prop.name, 'files:', prop.files?.length || 0)
            
            // Insert property
            let propertyData, propertyError;
            try {
                ({ data: propertyData, error: propertyError } = await withTimeout(
                    supabase
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
                    .single(),
                    1000,
                    'add-property'
                ));
            } catch (e) {
                console.warn('[addProperties] Standard insert failed, trying REST fallback...');
                let fallbackSuccess = false;
                let rest403 = false;

                if (Platform.OS === 'web') {
                    try {
                        let token = null;
                        try {
                            const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                            const stored = localStorage.getItem(key);
                            if (stored) token = JSON.parse(stored).access_token;
                        } catch (_) {}
                        if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                        if (token) {
                            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/eigenschappen`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                                    'Prefer': 'return=representation',
                                    'Accept': 'application/vnd.pgrst.object+json'
                                },
                                body: JSON.stringify({
                                    object_id: objectId,
                                    name: prop.name.trim(),
                                    waarde: prop.waarde,
                                    eenheid: prop.unit || '',
                                    formule_id: prop.Formule_id || null
                                })
                            });
                            if (res.ok) {
                                const json = await res.json();
                                propertyData = json;
                                propertyError = null;
                                fallbackSuccess = true;
                            } else if (res.status === 403) {
                                rest403 = true;
                                console.warn('[addProperties] REST Fallback returned 403 (RLS)');
                            }
                        }
                    } catch (restErr) { console.error('[addProperties] REST Fallback failed', restErr); }
                }
                
                if (fallbackSuccess) {
                    // success
                } else if (rest403) {
                    // Mock RLS error to trigger RPC fallback
                    propertyError = { message: 'row level security policy violated', code: '42501' };
                } else {
                    throw e;
                }
            }

            // Fallback via RPC when RLS prevents inserting into someone else's object
            if (propertyError && isRlsDenied(propertyError)) {
                console.warn('[addProperties] RLS prevented insert. Trying admin RPC fallback...');
                
                let rpcId = null;
                let rpcErr = null;

                try {
                    // Try standard RPC with short timeout
                    const { data, error } = await withTimeout(
                        supabase.rpc('admin_insert_property', {
                            p_object_id: objectId,
                            p_name: prop.name.trim(),
                            p_waarde: prop.waarde,
                            p_eenheid: prop.unit || '',
                            p_formule_id: prop.Formule_id != null ? prop.Formule_id : null,
                        }),
                        1000, // Short timeout to fail fast
                        'admin_insert_property'
                    );
                    if (error) throw error;
                    rpcId = data;
                } catch (e) {
                    console.warn('[addProperties] Standard RPC failed/timed out, trying REST fallback...', e.message);
                    
                    // REST Fallback for RPC
                    let fallbackSuccess = false;
                    if (Platform.OS === 'web') {
                        try {
                            let token = null;
                            try {
                                const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                                const stored = localStorage.getItem(key);
                                if (stored) token = JSON.parse(stored).access_token;
                            } catch (_) {}
                            if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                            if (token) {
                                const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/admin_insert_property`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`,
                                        'apikey': CONFIG.SUPABASE_ANON_KEY
                                    },
                                    body: JSON.stringify({
                                        p_object_id: objectId,
                                        p_name: prop.name.trim(),
                                        p_waarde: prop.waarde,
                                        p_eenheid: prop.unit || '',
                                        p_formule_id: prop.Formule_id != null ? prop.Formule_id : null,
                                    })
                                });
                                if (res.ok) {
                                    const json = await res.json();
                                    rpcId = json;
                                    fallbackSuccess = true;
                                    console.log('[addProperties] RPC REST Fallback success');
                                } else {
                                    console.error('[addProperties] RPC REST Fallback failed status:', res.status);
                                }
                            }
                        } catch (restErr) { console.error('[addProperties] RPC REST Fallback exception', restErr); }
                    }
                    
                    if (!fallbackSuccess) {
                        rpcErr = e;
                    }
                }

                if (rpcErr && !rpcId) {
                    console.error('[addProperties] RPC fallback failed:', rpcErr);
                    throw rpcErr;
                }
                // When returning uuid/bigint from RPC, supabase-js puts it in data.
                // If RPC returns nothing or type mismatch, fall back to lookup by object_id + name.
                if (rpcId) {
                    propertyData = { id: rpcId };
                } else {
                    console.warn('[addProperties] RPC returned no ID, attempting to fetch last matching property');
                    const { data: found, error: findErr } = await withTimeout(
                        supabase
                        .from('eigenschappen')
                        .select('id')
                        .eq('object_id', objectId)
                        .eq('name', prop.name.trim())
                        .order('id', { ascending: false })
                        .limit(1)
                        .maybeSingle(),
                        10000,
                        'post-rpc-fetch'
                    );
                    if (findErr) {
                        console.warn('[addProperties] Post-RPC fetch failed:', findErr);
                    }
                    if (found?.id) {
                        propertyData = { id: found.id };
                    }
                }
            }
            if (propertyError && !propertyData) throw propertyError
            
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
        
        console.log('[addProperties] All properties added successfully');
        Alert.alert('Success', 'Properties added successfully!')
        return true
    } catch (error) {
        console.error('[addProperties] Error adding properties:', error)
        console.error('[addProperties] Error details:', { message: error?.message, code: error?.code, status: error?.status })
        const msg = (error?.message || '').toLowerCase();
        if (msg.includes('function admin_insert_property') || msg.includes('rpc') || msg.includes('procedure') || msg.includes('does not exist')) {
            Alert.alert(
                'Admin RPC ontbreekt',
                'De benodigde functies zijn nog niet geïnstalleerd. Open Supabase > SQL Editor en voer scripts/sql/admin_functions.sql uit. Probeer daarna opnieuw.'
            );
        } else if (msg.includes('row level security') || msg.includes('permission denied') || msg.includes('violates row-level security')) {
            Alert.alert(
                'Permission required',
                'Je hebt momenteel geen rechten om eigenschappen toe te voegen aan objecten van anderen. Zie admin functies in supabase/sql/admin_functions.sql om dit mogelijk te maken (of pas RLS policies aan).'
            );
        } else {
            Alert.alert('Error', error.message)
        }
        return false
    }
}

const uploadPropertyFiles = async (propertyId, files) => {
    try {
        console.log('[uploadPropertyFiles] Starting upload for', files.length, 'files')
        const withTimeout = (promiseLike, ms = 20000, label = 'upload') => new Promise((resolve, reject) => {
            const to = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
            Promise.resolve(promiseLike).then(
                (val) => { clearTimeout(to); resolve(val); },
                (err) => { clearTimeout(to); reject(err); }
            );
        });
        
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
            let uploadData, uploadError;
            try {
                ({ data: uploadData, error: uploadError } = await withTimeout(
                    supabase.storage
                    .from('property-files')
                    .upload(filePath, fileToUpload, {
                        cacheControl: '3600',
                        upsert: false
                    }),
                    30000,
                    'storage-upload'
                ));
            } catch (e) {
                // Storage upload fallback? 
                // Storage REST API is complex (multipart/form-data), usually standard client is robust enough or we can't easily replicate it here without FormData polyfills.
                // But if it's a timeout, we should probably just fail or try again.
                // For now, let's assume storage upload is less likely to be blocked by RLS in the same way (usually public/authenticated buckets).
                // If RLS blocks it, it returns 403 immediately.
                throw e;
            }
            
            if (uploadError) {
                console.error('[uploadPropertyFiles] Storage upload error:', uploadError)
                throw uploadError
            }
            
            console.log('[uploadPropertyFiles] Storage upload successful:', uploadData.path)
            
            // Save file reference to database
            console.log('[uploadPropertyFiles] Saving file reference to database')
            
            let dbError;
            try {
                const { error } = await withTimeout(
                    supabase
                    .from('property_files')
                    .insert([
                        {
                            property_id: propertyId,
                            file_name: file.name,
                            file_path: uploadData.path,
                            file_type: file.type || file.mimeType,
                            file_size: file.size
                        }
                    ]),
                    15000,
                    'property_files-insert'
                );
                dbError = error;
            } catch (e) {
                console.warn('[uploadPropertyFiles] Standard insert failed, trying REST fallback...');
                let fallbackSuccess = false;
                let rest403 = false;

                if (Platform.OS === 'web') {
                    try {
                        let token = null;
                        try {
                            const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                            const stored = localStorage.getItem(key);
                            if (stored) token = JSON.parse(stored).access_token;
                        } catch (_) {}
                        if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                        if (token) {
                            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/property_files`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'apikey': CONFIG.SUPABASE_ANON_KEY
                                },
                                body: JSON.stringify({
                                    property_id: propertyId,
                                    file_name: file.name,
                                    file_path: uploadData.path,
                                    file_type: file.type || file.mimeType,
                                    file_size: file.size
                                })
                            });
                            if (res.ok) {
                                fallbackSuccess = true;
                            } else if (res.status === 403) {
                                rest403 = true;
                            }
                        }
                    } catch (restErr) { console.error('[uploadPropertyFiles] REST Fallback failed', restErr); }
                }

                if (fallbackSuccess) {
                    dbError = null;
                } else if (rest403) {
                    dbError = { message: 'row level security policy violated', code: '42501' };
                } else {
                    throw e;
                }
            }

            if (dbError) {
                const msg = (dbError.message || '').toLowerCase();
                if (msg.includes('row level security') || msg.includes('permission denied') || msg.includes('violates row-level security')) {
                    console.warn('[uploadPropertyFiles] RLS prevented property_files insert. Trying admin RPC fallback...')
                    
                    let rpcErr = null;
                    let fallbackSuccess = false;

                    try {
                        const { error } = await withTimeout(
                            supabase.rpc('admin_insert_property_file', {
                                p_property_id: propertyId,
                                p_file_name: file.name,
                                p_file_path: uploadData.path,
                                p_file_type: file.type || file.mimeType,
                                p_file_size: file.size
                            }),
                            1000, // Short timeout
                            'admin_insert_property_file'
                        );
                        if (error) throw error;
                    } catch (e) {
                        console.warn('[uploadPropertyFiles] Standard RPC failed/timed out, trying REST fallback...', e.message);
                        
                        if (Platform.OS === 'web') {
                            try {
                                let token = null;
                                try {
                                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                                    const stored = localStorage.getItem(key);
                                    if (stored) token = JSON.parse(stored).access_token;
                                } catch (_) {}
                                if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                                if (token) {
                                    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/admin_insert_property_file`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                            'apikey': CONFIG.SUPABASE_ANON_KEY
                                        },
                                        body: JSON.stringify({
                                            p_property_id: propertyId,
                                            p_file_name: file.name,
                                            p_file_path: uploadData.path,
                                            p_file_type: file.type || file.mimeType,
                                            p_file_size: file.size
                                        })
                                    });
                                    if (res.ok) {
                                        fallbackSuccess = true;
                                        console.log('[uploadPropertyFiles] RPC REST Fallback success');
                                    } else {
                                        console.error('[uploadPropertyFiles] RPC REST Fallback failed status:', res.status);
                                    }
                                }
                            } catch (restErr) { console.error('[uploadPropertyFiles] RPC REST Fallback exception', restErr); }
                        }
                        
                        if (!fallbackSuccess) {
                            rpcErr = e;
                        }
                    }

                    if (rpcErr) {
                        console.error('[uploadPropertyFiles] RPC fallback failed:', rpcErr)
                        throw rpcErr
                    }
                } else {
                    console.error('[uploadPropertyFiles] Database insert error:', dbError)
                    throw dbError
                }
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
    console.log('===== [updateProperty] START =====');
    console.log('[updateProperty] Payload:', propertyId, { name, waarde, eenheid, Formule_id });

    // Helper for timeouts
    const withTimeout = (promise, ms = 5000, label = 'operation') => new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
        promise.then(
            (res) => { clearTimeout(timeoutId); resolve(res); },
            (err) => { clearTimeout(timeoutId); reject(err); }
        );
    });

    try {
        // 1. Check session (with short timeout to avoid hanging on tab switch/backgrounding)
        try {
            const { data: { session }, error: sessionError } = await withTimeout(
                supabase.auth.getSession(),
                500,
                'auth-check'
            );
            if (sessionError || !session) {
                console.warn('[updateProperty] No active session found (or check failed), update might fail.');
            }
        } catch (e) {
            console.warn('[updateProperty] Session check timed out or failed, proceeding anyway:', e.message);
        }

        const normalized = {
            name,
            waarde,
            formule_id: Formule_id ?? null,
            eenheid: eenheid || '',
            updated_at: new Date().toISOString(),
        };

        console.log('[updateProperty] Normalized data:', normalized);

        // 3. Perform update with retry logic
        // We try the standard client ONCE with a short timeout. 
        // If it hangs (due to tab sleep), we fail fast and switch to REST.
        let attempts = 0;
        const maxAttempts = 1; 
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[updateProperty] Attempt ${attempts}/${maxAttempts} (Standard Client)...`);
                const { data, error } = await withTimeout(
                    supabase
                        .from('eigenschappen')
                        .update(normalized)
                        .eq('id', propertyId)
                        .select()
                        .single(),
                    500, // Ultra-short 500ms timeout to fail fast if connection is stale
                    `db-update-attempt-${attempts}`
                );

                if (error) throw error;

                console.log('[updateProperty] Updated row:', data);
                console.log('===== [updateProperty] END (success) =====');
                return true;

            } catch (err) {
                console.warn(`[updateProperty] Attempt ${attempts} failed:`, err.message || err);
                lastError = err;
                if (attempts < maxAttempts) {
                    // Wait 1s before retry to allow network stack to wake up
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }

        console.error('[updateProperty] All attempts failed. Last error:', lastError);
        
        // Fallback: Try Raw REST API (bypassing Supabase Client)
        console.log('[updateProperty] Attempting Raw REST Fallback...');
        try {
            // Try to get token from storage directly if possible (Web only hack)
            let token = null;
            if (Platform.OS === 'web') {
                try {
                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        token = parsed.access_token;
                    }
                } catch (e) { console.warn('Could not read local token:', e); }
            }
            
            // If no local token, try one last fast getSession
            if (!token) {
                const { data } = await supabase.auth.getSession();
                token = data?.session?.access_token;
            }

            if (token) {
                const url = `${CONFIG.SUPABASE_URL}/rest/v1/eigenschappen?id=eq.${propertyId}`;
                const res = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': CONFIG.SUPABASE_ANON_KEY,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(normalized)
                });
                
                if (res.ok) {
                    const json = await res.json();
                    console.log('[updateProperty] Raw REST Fallback SUCCESS:', json);
                    console.log('===== [updateProperty] END (success-fallback) =====');
                    return true;
                } else {
                    console.error('[updateProperty] Raw REST Fallback Failed:', res.status, res.statusText);
                }
            } else {
                console.warn('[updateProperty] No token available for Raw REST Fallback');
            }
        } catch (fallbackErr) {
            console.error('[updateProperty] Raw REST Fallback Exception:', fallbackErr);
        }

        console.log('===== [updateProperty] END (error) =====');
        return false;

    } catch (err) {
        console.error('[updateProperty] FAILED (exception):', err);
        console.log('===== [updateProperty] END (exception) =====');
        return false;
    }
};

export const deleteProperty = async (propertyId) => {
    console.log('[deleteProperty] Starting delete for property ID:', propertyId);
    
    // Helper for timeouts
    const withTimeout = (promise, ms = 5000, label = 'operation') => new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
        promise.then(
            (res) => { clearTimeout(timeoutId); resolve(res); },
            (err) => { clearTimeout(timeoutId); reject(err); }
        );
    });

    try {
        // 1. Check session (fail fast if auth is gone)
        try {
            const { data: { session }, error: sessionError } = await withTimeout(
                supabase.auth.getSession(),
                500,
                'auth-check'
            );
            if (sessionError || !session) {
                console.warn('[deleteProperty] No active session found, delete might fail.');
            }
        } catch (e) {
            console.warn('[deleteProperty] Session check timed out, proceeding anyway.');
        }

        // 2. Attempt standard delete with timeout
        let attempts = 0;
        const maxAttempts = 1;
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[deleteProperty] Attempt ${attempts}/${maxAttempts} (Standard Client)...`);
                const { error } = await withTimeout(
                    supabase
                        .from('eigenschappen')
                        .delete()
                        .eq('id', propertyId),
                    1000, // Short timeout for fail-fast
                    `db-delete-attempt-${attempts}`
                );

                if (error) throw error;

                console.log('[deleteProperty] Delete successful (Standard Client)');
                Alert.alert('Success', 'Eigenschap verwijderd!');
                return true;

            } catch (err) {
                console.warn(`[deleteProperty] Attempt ${attempts} failed:`, err.message || err);
                lastError = err;
                if (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }

        // 3. Fallback: REST API
        console.log('[deleteProperty] Attempting Raw REST Fallback...');
        try {
            let token = null;
            if (Platform.OS === 'web') {
                try {
                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        token = parsed.access_token;
                    }
                } catch (e) { console.warn('Could not read local token:', e); }
            }
            
            if (!token) {
                const { data } = await supabase.auth.getSession();
                token = data?.session?.access_token;
            }

            if (token) {
                const url = `${CONFIG.SUPABASE_URL}/rest/v1/eigenschappen?id=eq.${propertyId}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'apikey': CONFIG.SUPABASE_ANON_KEY,
                        'Prefer': 'return=representation'
                    }
                });
                
                if (res.ok) {
                    console.log('[deleteProperty] Raw REST Fallback SUCCESS');
                    Alert.alert('Success', 'Eigenschap verwijderd!');
                    return true;
                } else {
                    console.error('[deleteProperty] Raw REST Fallback Failed:', res.status, res.statusText);
                }
            }
        } catch (fallbackErr) {
            console.error('[deleteProperty] Raw REST Fallback Exception:', fallbackErr);
        }

        // If we get here, everything failed
        console.error('[deleteProperty] All attempts failed. Last error:', lastError);
        Alert.alert('Error', lastError?.message || 'Kon eigenschap niet verwijderen.');
        return false;

    } catch (error) {
        console.error('[deleteProperty] Unexpected error:', error);
        Alert.alert('Error', error.message);
        return false;
    }
}

// Formulas functions
export const fetchFormules = async () => {
    try {
        const { data, error } = await withTimeout(
            supabase
                .from('formules')
                .select('*')
                .order('name'),
            500,
            'fetch-formules-all'
        );
        
        if (error) throw error
        return data || []
    } catch (error) {
        console.warn('[fetchFormules] Standard fetch failed/timed out, trying REST fallback...');
        if (Platform.OS === 'web') {
            try {
                let token = null;
                try {
                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                    const stored = localStorage.getItem(key);
                    if (stored) token = JSON.parse(stored).access_token;
                } catch (_) {}
                
                if (!token) {
                     const { data } = await supabase.auth.getSession();
                     token = data?.session?.access_token;
                }

                if (token) {
                    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/formules?select=*&order=name.asc`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'apikey': CONFIG.SUPABASE_ANON_KEY
                        }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        console.log('[fetchFormules] REST Fallback success');
                        return json;
                    }
                }
            } catch (e) { console.error('[fetchFormules] REST Fallback failed', e); }
        }
        console.error('Error fetching formulas:', error)
        return []
    }
}

// Safer structured variant used by picker with error propagation
export const fetchFormulesSafe = async () => {
    try {
        const { data, error } = await withTimeout(
            supabase
                .from('formules')
                .select('id, name, formule, updated_at')
                .order('name'),
            500,
            'fetch-formules'
        );
        if (error) return { success: false, error: error.message || 'Onbekende fout', data: [] };
        return { success: true, data: data || [] };
    } catch (e) {
        console.warn('[fetchFormulesSafe] Standard fetch failed/timed out, trying REST fallback...');
        if (Platform.OS === 'web') {
            try {
                let token = null;
                try {
                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                    const stored = localStorage.getItem(key);
                    if (stored) token = JSON.parse(stored).access_token;
                } catch (_) {}
                
                if (!token) {
                     const { data } = await supabase.auth.getSession();
                     token = data?.session?.access_token;
                }

                if (token) {
                    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/formules?select=id,name,formule,updated_at&order=name.asc`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'apikey': CONFIG.SUPABASE_ANON_KEY
                        }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        console.log('[fetchFormulesSafe] REST Fallback success');
                        return { success: true, data: json };
                    }
                }
            } catch (restErr) { console.error('[fetchFormulesSafe] REST Fallback failed', restErr); }
        }
        return { success: false, error: e.message || 'Onbekende fout', data: [] };
    }
};

// Targeted single-formula lookup by normalized expression (replaces x/× with *)
export const fetchFormuleByExpression = async (expression) => {
    if (!expression) return null;
    const normalized = String(expression).replace(/[x×]/g, '*').trim();
    const normalizedLC = normalized.toLowerCase();
    try {
        // Try exact equality first
        let { data, error } = await withTimeout(
            supabase
                .from('formules')
                .select('id, name, formule')
                .eq('formule', normalized)
                .limit(5),
            5000,
            'fetch-formule-expr-exact'
        );
        if (error) {
            console.warn('[fetchFormuleByExpression] eq lookup failed, falling back to client filter:', error.message);
        }
        let candidate = (data || []).find(f => String(f.formule).replace(/[x×]/g,'*').trim().toLowerCase() === normalizedLC);
        if (candidate) return candidate;
        // Fallback: ilike/like for case-insensitive partials, then client-side exact (case-insensitive)
        const { data: likeData, error: likeErr } = await withTimeout(
            supabase
                .from('formules')
                .select('id, name, formule')
                .ilike('formule', `%${normalized}%`)
                .limit(20),
            8000,
            'fetch-formule-expr-fallback'
        );
        if (likeErr) {
            console.warn('[fetchFormuleByExpression] ilike fallback failed:', likeErr.message);
            return null;
        }
        candidate = (likeData || []).find(f => String(f.formule).replace(/[x×]/g,'*').trim().toLowerCase() === normalizedLC) || null;
        return candidate;
    } catch (err) {
        console.error('[fetchFormuleByExpression] Unexpected error:', err);
        return null;
    }
};

export const createFormule = async (name, formule) => {
    try {
        console.log('[createFormule] Creating formula:', name, 'with formula:', formule);

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[createFormule] Current user:', user?.id || 'Not authenticated');

        const normalizedExpr = String(formule).replace(/[x×]/g, '*').trim();
        const attemptInsert = async (nm) => {
            try {
                return await withTimeout(
                    supabase
                        .from('formules')
                        .insert([{ name: nm, formule: normalizedExpr }])
                        .select(),
                    1000,
                    'create-formule'
                );
            } catch (e) {
                console.warn('[createFormule] Standard insert failed, trying REST fallback...');
                if (Platform.OS === 'web') {
                    try {
                        let token = null;
                        try {
                            const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                            const stored = localStorage.getItem(key);
                            if (stored) token = JSON.parse(stored).access_token;
                        } catch (_) {}
                        if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                        if (token) {
                            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/formules`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                                    'Prefer': 'return=representation'
                                },
                                body: JSON.stringify({ name: nm, formule: normalizedExpr })
                            });
                            if (res.ok) {
                                const json = await res.json();
                                return { data: json, error: null };
                            }
                        }
                    } catch (restErr) { console.error('[createFormule] REST Fallback failed', restErr); }
                }
                throw e;
            }
        };

        // Try original name; if unique constraint blocks, retry with invisible suffix to allow same visible names
        let data, error;
        ({ data, error } = await attemptInsert(name));
        if (error) {
            const msg = (error.message || '').toLowerCase();
            const isUnique = error.code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint');
            if (isUnique) {
                console.warn('[createFormule] Name unique constraint triggered; retrying with invisible suffix');
                const ZERO_WIDTH_SPACE = '\u200B';
                let retries = 0;
                let finalData = null;
                let lastErr = error;
                while (retries < 3 && !finalData) {
                    const nm = name + ZERO_WIDTH_SPACE.repeat(retries + 1);
                    const res = await attemptInsert(nm);
                    if (res.error) {
                        lastErr = res.error;
                        const againUnique = (res.error.code === '23505') || ((res.error.message || '').toLowerCase().includes('duplicate key')) || ((res.error.message || '').toLowerCase().includes('unique constraint'));
                        if (!againUnique) break;
                        retries += 1;
                        continue;
                    }
                    finalData = res.data;
                }
                if (!finalData) {
                    console.error('[createFormule] Failed after suffix retries:', lastErr);
                    throw lastErr;
                }
                data = finalData;
                error = null;
            } else {
                console.error('[createFormule] Database error:', error);
                throw error;
            }
        }

        console.log('[createFormule] Formula created successfully:', data);
        return { success: true, id: data[0].id, record: data[0] };
    } catch (error) {
        console.error('[createFormule] Error creating formula:', error);
        return { success: false, message: error.message || 'Failed to create formula' };
    }
};

export const updateFormule = async (id, name, formule) => {
    try {
        console.log('[updateFormule] Updating formula ID:', id, 'with name:', name, 'formula:', formule);

        const normalizedExpr = String(formule).replace(/[x×]/g, '*').trim();
        const attemptUpdate = async (nm) => {
            try {
                return await withTimeout(
                    supabase
                        .from('formules')
                        .update({ name: nm, formule: normalizedExpr, updated_at: new Date().toISOString() })
                        .eq('id', id)
                        .select(),
                    1000,
                    'update-formule'
                );
            } catch (e) {
                console.warn('[updateFormule] Standard update failed, trying REST fallback...');
                if (Platform.OS === 'web') {
                    try {
                        let token = null;
                        try {
                            const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                            const stored = localStorage.getItem(key);
                            if (stored) token = JSON.parse(stored).access_token;
                        } catch (_) {}
                        if (!token) { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token; }

                        if (token) {
                            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/formules?id=eq.${id}`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                                    'Prefer': 'return=representation'
                                },
                                body: JSON.stringify({ name: nm, formule: normalizedExpr, updated_at: new Date().toISOString() })
                            });
                            if (res.ok) {
                                const json = await res.json();
                                return { data: json, error: null };
                            }
                        }
                    } catch (restErr) { console.error('[updateFormule] REST Fallback failed', restErr); }
                }
                throw e;
            }
        };

        let { data, error } = await attemptUpdate(name);
        if (error) {
            const msg = (error.message || '').toLowerCase();
            const isUnique = error.code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint');
            if (isUnique) {
                console.warn('[updateFormule] Name unique constraint; retrying with invisible suffix');
                const ZERO_WIDTH_SPACE = '\u200B';
                let retries = 0;
                let finalData = null;
                let lastErr = error;
                while (retries < 3 && !finalData) {
                    const nm = name + ZERO_WIDTH_SPACE.repeat(retries + 1);
                    const res = await attemptUpdate(nm);
                    if (res.error) {
                        lastErr = res.error;
                        const againUnique = (res.error.code === '23505') || ((res.error.message || '').toLowerCase().includes('duplicate key')) || ((res.error.message || '').toLowerCase().includes('unique constraint'));
                        if (!againUnique) break;
                        retries += 1;
                        continue;
                    }
                    finalData = res.data;
                }
                if (!finalData) {
                    console.error('[updateFormule] Failed after suffix retries:', lastErr);
                    throw lastErr;
                }
                data = finalData;
                error = null;
            } else {
                console.error('[updateFormule] Database error:', error);
                throw error;
            }
        }

        console.log('[updateFormule] Formula updated successfully:', data);

        // For now, return success without recalculation
        // You can add recalculation logic later if needed
        return {
            success: true,
            affected_properties: 0,
            recalculated: 0,
            failed: 0
        };
    } catch (error) {
        console.error('[updateFormule] Error updating formula:', error);
        return { success: false, message: error.message || 'Failed to update formula' };
    }
};

export const deleteFormule = async (id) => {
    console.log('[deleteFormule] Starting delete for ID:', id);

    // Helper for timeouts
    const withTimeout = (promise, ms = 5000, label = 'operation') => new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
        promise.then(
            (res) => { clearTimeout(timeoutId); resolve(res); },
            (err) => { clearTimeout(timeoutId); reject(err); }
        );
    });

    try {
        // 1. Check session
        try {
            const { data: { session }, error: sessionError } = await withTimeout(
                supabase.auth.getSession(),
                500,
                'auth-check'
            );
            if (sessionError || !session) {
                console.warn('[deleteFormule] No active session found, delete might fail.');
            }
        } catch (e) {
            console.warn('[deleteFormule] Session check timed out, proceeding anyway.');
        }

        // 2. Attempt standard delete
        let attempts = 0;
        const maxAttempts = 1;
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                console.log(`[deleteFormule] Attempt ${attempts}/${maxAttempts} (Standard Client)...`);
                const { error } = await withTimeout(
                    supabase
                        .from('formules')
                        .delete()
                        .eq('id', id),
                    1000,
                    `db-delete-formule-attempt-${attempts}`
                );

                if (error) throw error;

                console.log('[deleteFormule] Delete successful (Standard Client)');
                return { success: true };

            } catch (err) {
                console.warn(`[deleteFormule] Attempt ${attempts} failed:`, err.message || err);
                lastError = err;
                if (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }

        // 3. Fallback: REST API
        console.log('[deleteFormule] Attempting Raw REST Fallback...');
        try {
            let token = null;
            if (Platform.OS === 'web') {
                try {
                    const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                    const stored = localStorage.getItem(key);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        token = parsed.access_token;
                    }
                } catch (e) { console.warn('Could not read local token:', e); }
            }
            
            if (!token) {
                const { data } = await supabase.auth.getSession();
                token = data?.session?.access_token;
            }

            if (token) {
                const url = `${CONFIG.SUPABASE_URL}/rest/v1/formules?id=eq.${id}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'apikey': CONFIG.SUPABASE_ANON_KEY,
                        'Prefer': 'return=representation'
                    }
                });
                
                if (res.ok) {
                    console.log('[deleteFormule] Raw REST Fallback SUCCESS');
                    return { success: true };
                } else {
                    console.error('[deleteFormule] Raw REST Fallback Failed:', res.status, res.statusText);
                }
            }
        } catch (fallbackErr) {
            console.error('[deleteFormule] Raw REST Fallback Exception:', fallbackErr);
        }

        console.error('[deleteFormule] All attempts failed. Last error:', lastError);
        return { success: false, message: lastError?.message || 'Kon formule niet verwijderen.' };

    } catch (error) {
        console.error('[deleteFormule] Unexpected error:', error);
        return { success: false, message: error.message };
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

// ---------------- Materials APIs ----------------
// Expected tables (create these in Supabase SQL editor):
//
// create table if not exists public.materials (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   unit text not null default 'kg',
//   total_quantity numeric not null default 0,
//   user_id uuid references auth.users(id),
//   created_at timestamp with time zone default now()
// );
//
// create table if not exists public.material_allocations (
//   id uuid primary key default gen_random_uuid(),
//   material_id uuid not null references public.materials(id) on delete cascade,
//   object_id uuid not null references public.objects(id) on delete cascade,
//   quantity numeric not null check (quantity >= 0),
//   created_at timestamp with time zone default now()
// );
//
// -- Enable RLS and basic policies similar to other tables.

export const fetchMaterials = async () => {
    try {
        // Fetch materials with allocated sum
        const { data: materials, error } = await supabase
            .from('materials')
            .select('*')
            .order('name');
        if (error) throw error;

        // Get allocations grouped by material
        const { data: grouped, error: allocErr } = await supabase
            .from('material_allocations')
            .select('material_id, quantity, is_budget');
        if (allocErr && allocErr.code !== 'PGRST116') throw allocErr; // ignore no rows
        const allocatedByMaterial = (grouped || []).reduce((acc, row) => {
            // Only count non-budget allocations as consumption
            if (!row.is_budget) {
                acc[row.material_id] = (acc[row.material_id] || 0) + Number(row.quantity || 0);
            }
            return acc;
        }, {});

        return (materials || []).map(m => {
        const allocated = allocatedByMaterial[m.id] || 0;
        const available = Number(m.total_quantity || 0) - allocated;
        return { ...m, allocated, available };
        });
    } catch (e) {
        console.error('[fetchMaterials] error', e);
        return [];
    }
};

export const createMaterial = async ({ name, unit = 'kg', total_quantity = 0, user_id = null }) => {
    try {
        const payload = { name: name.trim(), unit, total_quantity, user_id };
        const { data, error } = await supabase.from('materials').insert([payload]).select().single();
        if (error) throw error;
        return { success: true, material: data };
    } catch (e) {
        console.error('[createMaterial] error', e);
        return { success: false, message: e.message };
    }
};

export const allocateMaterial = async ({ material_id, object_id, quantity, is_budget = false }) => {
    try {
        const { data, error } = await supabase
            .from('material_allocations')
            .insert([{ material_id, object_id, quantity, is_budget }])
            .select()
            .single();
        if (error) throw error;
        return { success: true, allocation: data };
    } catch (e) {
        console.error('[allocateMaterial] error', e);
        return { success: false, message: e.message };
    }
};

export const fetchAllocationsForMaterial = async (material_id) => {
    try {
        const { data, error } = await supabase
            .from('material_allocations')
            .select('id, quantity, object_id')
            .eq('material_id', material_id);
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('[fetchAllocationsForMaterial] error', e);
        return [];
    }
};

// Flatten objects tree to a simple list for pickers
export const flattenObjects = (nodes) => {
    const out = [];
    const walk = (items, prefix = []) => {
        (items || []).forEach((n) => {
            const path = [...prefix, n.naam];
            const hasChildren = Array.isArray(n.children) && n.children.length > 0;
            out.push({ id: n.id, name: n.naam, pathLabel: path.join(' / '), hasChildren });
            if (Array.isArray(n.children) && n.children.length) {
                walk(n.children, path);
            }
        });
    };
    walk(nodes, []);
    return out;
};

// Create parent-child links without duplication
export const linkObjects = async ({ parentId, childIds, groupKey = null }) => {
    try {
        console.log('[linkObjects] start', { parentId, childIds });
        if (!Array.isArray(childIds) || childIds.length === 0) {
            console.warn('[linkObjects] missing children');
            return { success: false, message: 'Missing children' };
        }
                // Allow parentId to be null for root-level links
        const rows = Array.from(new Set(childIds))
        .filter((id) => id && (parentId == null ? true : id !== parentId))
        .map((id) => ({
            parent_id: parentId ?? null,
            child_id: id,
            ...(groupKey ? { group_key: groupKey } : {}),
        }));

        if (rows.length === 0) {
            console.warn('[linkObjects] nothing to link after filtering');
            return { success: true };
        }

        // Helper for timeouts
        const withTimeout = (promise, ms = 5000, label = 'operation') => new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
            promise.then(
                (res) => { clearTimeout(timeoutId); resolve(res); },
                (err) => { clearTimeout(timeoutId); reject(err); }
            );
        });

        let data, error;

        try {
            // Upsert to avoid duplicate errors if link already exists
            const res = await withTimeout(
                supabase
                    .from('object_links')
                    .upsert(rows, { onConflict: 'parent_id,child_id', ignoreDuplicates: true })
                    .select(),
                1000,
                'link-objects'
            );
            data = res.data;
            error = res.error;
        } catch (e) {
            console.warn('[linkObjects] Standard upsert failed, trying REST fallback...');
            let fallbackSuccess = false;
            
            if (Platform.OS === 'web') {
                try {
                    let token = null;
                    // 1. Try localStorage first (fastest, no network)
                    try {
                        const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                        const stored = localStorage.getItem(key);
                        if (stored) token = JSON.parse(stored).access_token;
                    } catch (_) {}
                    
                    // 2. If no token, try getSession with a strict timeout to prevent hanging
                    if (!token) { 
                        try {
                            const { data } = await Promise.race([
                                supabase.auth.getSession(),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 500))
                            ]);
                            token = data?.session?.access_token;
                        } catch (err) { console.warn('[linkObjects] getSession timed out/failed during fallback', err); }
                    }

                    if (token) {
                        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/object_links`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                                'apikey': CONFIG.SUPABASE_ANON_KEY,
                                'Prefer': 'resolution=ignore-duplicates,return=representation'
                            },
                            body: JSON.stringify(rows)
                        });
                        
                        if (res.ok) {
                            const json = await res.json();
                            data = json;
                            error = null;
                            fallbackSuccess = true;
                            console.log('[linkObjects] REST Fallback success');
                        } else if (res.status === 409) {
                            // 409 Conflict means it already exists, which is fine for us
                            console.log('[linkObjects] REST Fallback: 409 Conflict (already linked), treating as success');
                            data = [];
                            error = null;
                            fallbackSuccess = true;
                        } else {
                            // Check for missing column error (400 Bad Request)
                            if (res.status === 400) {
                                const errText = await res.text();
                                if (errText.includes('group_key')) {
                                    console.warn('[linkObjects] REST fallback: group_key missing, retrying without it');
                                    const rowsNoGroup = rows.map(({ group_key, ...rest }) => rest);
                                    const retryRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/object_links`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                            'apikey': CONFIG.SUPABASE_ANON_KEY,
                                            'Prefer': 'resolution=ignore-duplicates,return=representation'
                                        },
                                        body: JSON.stringify(rowsNoGroup)
                                    });
                                    if (retryRes.ok) {
                                        const json = await retryRes.json();
                                        data = json;
                                        error = null;
                                        fallbackSuccess = true;
                                        console.log('[linkObjects] REST Fallback retry success');
                                    } else if (retryRes.status === 409) {
                                        console.log('[linkObjects] REST Fallback retry: 409 Conflict, treating as success');
                                        data = [];
                                        error = null;
                                        fallbackSuccess = true;
                                    }
                                }
                            }
                        }
                    } else {
                        console.warn('[linkObjects] REST Fallback failed: No auth token available');
                    }
                } catch (restErr) { console.error('[linkObjects] REST Fallback failed', restErr); }
            }
            
            if (!fallbackSuccess) throw e;
        }

        // If group_key column missing (Standard Client), retry without it
        if (error && (error.code === '42703' || (error.message || '').includes('group_key'))) {
            console.warn('[linkObjects] group_key column missing in object_links, retrying without group key');
            const rowsNoGroup = rows.map(({ group_key, ...rest }) => rest);
            
            try {
                const retry = await withTimeout(
                    supabase
                        .from('object_links')
                        .upsert(rowsNoGroup, { onConflict: 'parent_id,child_id', ignoreDuplicates: true })
                        .select(),
                    1000,
                    'link-objects-retry'
                );
                data = retry.data;
                error = retry.error;
            } catch (e) {
                console.warn('[linkObjects] Standard retry failed, trying REST fallback...');
                let fallbackSuccess = false;
                if (Platform.OS === 'web') {
                    try {
                        let token = null;
                        try {
                            const key = `sb-${new URL(CONFIG.SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
                            const stored = localStorage.getItem(key);
                            if (stored) token = JSON.parse(stored).access_token;
                        } catch (_) {}
                        
                        if (!token) { 
                            try {
                                const { data } = await Promise.race([
                                    supabase.auth.getSession(),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 500))
                                ]);
                                token = data?.session?.access_token;
                            } catch (_) {}
                        }

                        if (token) {
                            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/object_links`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`,
                                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                                    'Prefer': 'resolution=ignore-duplicates,return=representation'
                                },
                                body: JSON.stringify(rowsNoGroup)
                            });
                            if (res.ok) {
                                const json = await res.json();
                                data = json;
                                error = null;
                                fallbackSuccess = true;
                                console.log('[linkObjects] REST Fallback retry success');
                            } else if (res.status === 409) {
                                console.log('[linkObjects] REST Fallback retry: 409 Conflict, treating as success');
                                data = [];
                                error = null;
                                fallbackSuccess = true;
                            }
                        }
                    } catch (restErr) { console.error('[linkObjects] REST Fallback retry failed', restErr); }
                }
                if (!fallbackSuccess) throw e;
            }
        }
        console.log('[linkObjects] upsert result', { error: error?.message, inserted: data?.length });
        if (error) throw error;
        return { success: true };
    } catch (e) {
        // If table missing, return a specific hint
        if ((e.code === '42P01') || /object_links/i.test(e.message || '')) {
            console.warn('[linkObjects] table missing or inaccessible', e);
            return { success: false, message: 'object_links_missing' };
        }
        // Unique violation => treat as success (already linked)
        if (e.code === '23505') {
            console.warn('[linkObjects] unique violation treated as success');
            return { success: true };
        }
        console.error('[linkObjects] error', e);
        return { success: false, message: e.message || 'Linking failed' };
    }
};

// ---------------- Object clone (deep) ----------------
// Duplicate an object with its properties and entire subtree under a new parent
export const duplicateObjectWithSubtree = async ({ objectId, newParentId }) => {
    try {
        const { data: srcObj, error: objErr } = await supabase
            .from('objects')
            .select('id, naam, user_id, group_key')
            .eq('id', objectId)
            .single();
        if (objErr) throw objErr;

        // Create the new object row
        const baseInsert = { parent_id: newParentId, naam: srcObj.naam, user_id: srcObj.user_id };
        const insertPayload = srcObj.group_key ? { ...baseInsert, group_key: srcObj.group_key } : baseInsert;

        let { data: newObj, error: insErr } = await supabase
            .from('objects')
            .insert([insertPayload])
            .select('id')
            .single();
        if (insErr && (insErr.code === '42703' || (insErr.message || '').includes('group_key'))) {
            // Retry without group_key column if not present
            const retry = await supabase.from('objects').insert([baseInsert]).select('id').single();
            insErr = retry.error || null;
            newObj = retry.data;
        }
        if (insErr) throw insErr;

        const newObjectId = newObj.id;

        // Clone properties
        const { data: props, error: propsErr } = await supabase
            .from('eigenschappen')
            .select('id, name, waarde, eenheid, formule_id')
            .eq('object_id', objectId);
        if (propsErr && propsErr.code !== 'PGRST116') throw propsErr;

        const propIdMap = {}; // oldPropId -> newPropId
        if (props && props.length) {
            // Insert all properties
            const toInsert = props.map((p) => ({
                object_id: newObjectId,
                name: p.name,
                waarde: p.waarde,
                eenheid: p.eenheid || '',
                formule_id: p.formule_id || null,
            }));
            const { data: newProps, error: insPropsErr } = await supabase
                .from('eigenschappen')
                .insert(toInsert)
                .select('id');
            if (insPropsErr) throw insPropsErr;
            // Map in order (assume same order returned)
            props.forEach((oldP, idx) => {
                propIdMap[oldP.id] = newProps[idx]?.id;
            });
            // Clone property files for each property
            for (const oldP of props) {
                const newPid = propIdMap[oldP.id];
                if (!newPid) continue;
                const { data: files, error: filesErr } = await supabase
                    .from('property_files')
                    .select('file_name, file_path, file_type, file_size')
                    .eq('property_id', oldP.id);
                if (filesErr && filesErr.code !== 'PGRST116') throw filesErr;
                if (files && files.length) {
                    const fileRows = files.map((f) => ({
                        property_id: newPid,
                        file_name: f.file_name,
                        file_path: f.file_path,
                        file_type: f.file_type,
                        file_size: f.file_size,
                    }));
                    const { error: fileInsErr } = await supabase
                        .from('property_files')
                        .insert(fileRows);
                    if (fileInsErr) throw fileInsErr;
                }
            }
        }

        // Fetch direct children and recursively clone
        const { data: children, error: childErr } = await supabase
            .from('objects')
            .select('id')
            .eq('parent_id', objectId);
        if (childErr && childErr.code !== 'PGRST116') throw childErr;
        if (children && children.length) {
            for (const ch of children) {
                const res = await duplicateObjectWithSubtree({ objectId: ch.id, newParentId: newObjectId });
                if (!res.success) throw new Error(res.message || 'Child clone failed');
            }
        }

        return { success: true, newObjectId };
    } catch (e) {
        console.error('[duplicateObjectWithSubtree] error', e);
        return { success: false, message: e.message };
    }
};
