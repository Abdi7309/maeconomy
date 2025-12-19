import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';
import { IMAGEKIT_AUTHENTICATION_ENDPOINT, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY } from '../app/(tabs)/config/imageKit';

/**
 * Uploads a file to ImageKit.io
 * @param {string} uri - Local file URI
 * @param {string} fileName - Name of the file
 * @param {string} fileType - Mime type (e.g. image/jpeg)
 * @returns {Promise<{url: string, fileId: string, ...}>}
 */
export const uploadToImageKit = async (uri, fileName, fileType) => {
  try {
    // 1. Get security parameters (signature, token, expire)
    // You need a backend endpoint that returns { signature, token, expire }
    // See: https://docs.imagekit.io/api-reference/upload-file-api/client-side-file-upload
    
    let signature, token, expire;
    
    if (IMAGEKIT_AUTHENTICATION_ENDPOINT && !IMAGEKIT_AUTHENTICATION_ENDPOINT.includes('YOUR_AUTH_ENDPOINT')) {
        try {
            const authRes = await fetch(IMAGEKIT_AUTHENTICATION_ENDPOINT);
            const authData = await authRes.json();
            signature = authData.signature;
            token = authData.token;
            expire = authData.expire;
        } catch (e) {
            console.error('Failed to fetch ImageKit auth signature:', e);
            throw new Error('Authentication failed');
        }
    } else if (IMAGEKIT_PRIVATE_KEY && !IMAGEKIT_PRIVATE_KEY.includes('YOUR_PRIVATE_KEY')) {
        // Local signature generation (INSECURE for production, okay for testing)
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        token = uuid;
        expire = parseInt(Date.now() / 1000) + 2400; // 40 minutes from now
        const privateKey = IMAGEKIT_PRIVATE_KEY;
        signature = CryptoJS.HmacSHA1(token + expire, privateKey).toString();
    } else {
        console.warn('No Auth Endpoint or Private Key provided. Attempting unsigned upload (must be enabled in ImageKit dashboard).');
    }

    // 2. Prepare FormData
    const formData = new FormData();
    
    if (Platform.OS === 'web') {
        // On Web, fetch the blob from the URI
        const response = await fetch(uri);
        const blob = await response.blob();
        // Ensure blob has the correct type if provided
        const finalBlob = (fileType && blob.type !== fileType) 
            ? new Blob([blob], { type: fileType }) 
            : blob;
        formData.append("file", finalBlob, fileName);
    } else {
        // On Native, use the object format
        formData.append("file", {
            uri: uri,
            name: fileName,
            type: fileType || 'image/jpeg',
        });
    }

    formData.append("fileName", fileName);
    formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
    
    if (signature) formData.append("signature", signature);
    if (expire) formData.append("expire", expire);
    if (token) formData.append("token", token);
    formData.append("useUniqueFileName", "true");
    formData.append("folder", "/properties");

    // 3. Upload
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "ImageKit upload failed");
    }

    return data;
  } catch (error) {
    console.error("ImageKit Upload Error:", error);
    throw error;
  }
};
