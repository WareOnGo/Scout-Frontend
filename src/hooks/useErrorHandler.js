import {
  parseError,
  ERROR_TYPES,
  showErrorMessage,
  showErrorNotification,
  handleOperationError,
  handleUploadError,
  showSuccessMessage,
  clearErrors,
} from '../utils/errorHandler';

/**
 * Hook that mirrors the old Ant-based API; all messaging goes through custom toasts.
 */
export const useErrorHandler = () => ({
  showErrorMessage,
  showErrorNotification,
  handleOperationError,
  handleUploadError,
  showSuccessMessage,
  clearErrors,
});

export { parseError, ERROR_TYPES };
