import axios from 'axios';
import { apiClient } from './apiClient.js';

export const warehouseService = {
  /**
   * Get all warehouses
   * @returns {Promise} Array of warehouse objects with nested WarehouseData
   */
  getAll: async () => {
    return apiClient.get('/warehouses');
  },

  /**
   * Create a new warehouse
   * @param {Object} warehouseData - Warehouse data with nested warehouseData
   * @returns {Promise} Created warehouse object
   */
  create: async (warehouseData) => {
    return apiClient.post('/warehouses/scout', warehouseData);
  },

  /**
   * Update an existing warehouse
   * @param {number} id - Warehouse ID
   * @param {Object} warehouseData - Updated warehouse data with nested warehouseData
   * @returns {Promise} Updated warehouse object
   */
  update: async (id, warehouseData) => {
    return apiClient.put(`/warehouses/${id}`, warehouseData);
  },

  /**
   * Delete a warehouse
   * @param {number} id - Warehouse ID
   * @returns {Promise} No content (204 status)
   */
  delete: async (id) => {
    // Use the underlying axios instance for delete to get full response
    const axiosInstance = apiClient.getAxiosInstance();
    const response = await axiosInstance.delete(`/warehouses/${id}`);
    return response;
  },

  /**
   * Get contact number for a specific warehouse (triggers audit log)
   * @param {number} warehouseId - Warehouse ID
   * @returns {Promise} Object containing contactNumber and contactPerson
   */
  getContactNumber: async (warehouseId) => {
    return apiClient.get(`/warehouses/${warehouseId}/contact-number`);
  },

  /**
   * Get presigned URL for file upload
   * @param {string} contentType - MIME type of the file to upload
   * @returns {Promise} Object containing uploadUrl and imageUrl
   */
  getPresignedUrl: async (contentType, uploadedBy = '') => {
    return apiClient.post('/warehouses/scout/presigned-url', {
      contentType,
      uploadedBy // Pass uploadedBy so middleware can authenticate via body
    });
  },

  /**
   * Upload file directly to R2 storage using presigned URL
   * @param {string} uploadUrl - Presigned URL for upload
   * @param {File} file - File object to upload
   * @returns {Promise} Upload response
   */
  uploadFileToR2: async (uploadUrl, file) => {
    try {
      // Create a separate axios instance for R2 upload to avoid interceptors
      const response = await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        // Don't include default headers that might interfere with R2
        transformRequest: [(data) => data],
      });
      return response;
    } catch (error) {
      // Handle R2-specific upload errors
      if (error.response) {
        const { status } = error.response;
        switch (status) {
          case 403:
            error.message = 'Upload forbidden - invalid or expired presigned URL';
            break;
          case 413:
            error.message = 'File too large for upload';
            break;
          default:
            error.message = 'File upload failed';
        }
      } else if (error.request) {
        error.message = 'Network error during file upload';
      } else {
        error.message = 'File upload configuration error';
      }
      throw error;
    }
  },
};