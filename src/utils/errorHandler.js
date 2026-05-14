import { showToast, destroyAllToasts } from './toast';

/**
 * Centralized error handling — uses lightweight toasts (no UI framework).
 */

export const ERROR_TYPES = {
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  NETWORK: 'network',
  SERVER: 'server',
  UPLOAD: 'upload',
  GENERIC: 'generic'
};

export const parseError = (error) => {
  const errorInfo = {
    type: ERROR_TYPES.GENERIC,
    message: 'An unexpected error occurred',
    details: null,
    issues: [],
    statusCode: null
  };

  if (error.response) {
    const { status, data } = error.response;
    errorInfo.statusCode = status;

    switch (status) {
      case 400:
        errorInfo.type = ERROR_TYPES.VALIDATION;
        errorInfo.message = data.error || 'Validation failed';
        errorInfo.issues = data.issues || [];
        break;

      case 401:
        errorInfo.type = ERROR_TYPES.GENERIC;
        errorInfo.message = data.message || 'Unauthorized — check your Employee ID';
        break;

      case 403:
        errorInfo.type = ERROR_TYPES.GENERIC;
        errorInfo.message = data.message || 'Access forbidden — your scout access may have been revoked';
        break;

      case 404:
        errorInfo.type = ERROR_TYPES.NOT_FOUND;
        errorInfo.message = 'Warehouse not found';
        break;

      case 500:
        errorInfo.type = ERROR_TYPES.SERVER;
        errorInfo.message = 'Internal server error. Please try again later.';
        break;

      default:
        errorInfo.message = data.error || `Server error (${status})`;
    }
  } else if (error.request) {
    errorInfo.type = ERROR_TYPES.NETWORK;
    errorInfo.message = 'Network error - please check your connection and try again';
  } else {
    errorInfo.message = error.message || 'Request configuration error';
  }

  return errorInfo;
};

const toMs = (durationSeconds) => Math.max(2, durationSeconds) * 1000;

export const showErrorMessage = (error, options = {}) => {
  const {
    duration = 6,
    showDetails = false,
    prefix = ''
  } = options;

  const errorInfo = error.type ? error : parseError(error);
  const displayMessage = prefix ? `${prefix}: ${errorInfo.message}` : errorInfo.message;

  if (errorInfo.type === ERROR_TYPES.VALIDATION && errorInfo.issues.length > 0) {
    const issueMessages = errorInfo.issues.map(issue =>
      `${issue.path?.join('.')}: ${issue.message}`
    ).join('\n');

    if (showDetails) {
      showToast(`${displayMessage}\n\n${issueMessages}`, { type: 'error', duration: toMs(duration) });
    } else {
      showToast(displayMessage, { type: 'error', duration: toMs(duration) });
    }
  } else {
    showToast(displayMessage, { type: 'error', duration: toMs(duration) });
  }
};

export const showErrorNotification = (error, options = {}) => {
  const {
    title = 'Error',
    duration = 8,
    showDetails = true
  } = options;

  const errorInfo = error.type ? error : parseError(error);

  let description = errorInfo.message;

  if (errorInfo.type === ERROR_TYPES.VALIDATION && errorInfo.issues.length > 0 && showDetails) {
    const issueList = errorInfo.issues.map((issue, index) =>
      `${index + 1}. ${issue.path?.join('.')}: ${issue.message}`
    ).join('\n');

    description = `${errorInfo.message}\n\nValidation Issues:\n${issueList}`;
  }

  showToast(`${title}\n\n${description}`, { type: 'error', duration: toMs(duration) });
};

export const handleOperationError = (error, operation, options = {}) => {
  const errorInfo = parseError(error);

  const operationMessages = {
    fetch: 'Failed to load warehouses',
    create: 'Failed to create warehouse',
    update: 'Failed to update warehouse',
    delete: 'Failed to delete warehouse',
    upload: 'Failed to upload file'
  };

  const baseMessage = operationMessages[operation] || `Failed to ${operation}`;

  if (errorInfo.type === ERROR_TYPES.VALIDATION) {
    showErrorNotification(errorInfo, {
      title: baseMessage,
      ...options
    });
  } else {
    showErrorMessage(errorInfo, {
      prefix: baseMessage,
      ...options
    });
  }

  return errorInfo;
};

export const handleUploadError = (error, fileName = 'file') => {
  const errorInfo = parseError(error);

  let uploadMessage = errorInfo.message;

  if (error.response) {
    const { status } = error.response;
    switch (status) {
      case 403:
        uploadMessage = 'Upload forbidden - please try again';
        break;
      case 413:
        uploadMessage = 'File too large - please select a smaller file';
        break;
      case 415:
        uploadMessage = 'File type not supported - please select an image file';
        break;
    }
  }

  showErrorMessage({
    ...errorInfo,
    message: uploadMessage
  }, {
    prefix: `Failed to upload ${fileName}`,
    duration: 8
  });

  return errorInfo;
};

export const showSuccessMessage = (operation, options = {}) => {
  const { duration = 3, details = '' } = options;

  const successMessages = {
    create: 'Warehouse created successfully',
    update: 'Warehouse updated successfully',
    delete: 'Warehouse deleted successfully',
    upload: 'File uploaded successfully',
    download: 'Download completed successfully'
  };

  const baseMessage = successMessages[operation] || `${operation} completed successfully`;
  const displayMessage = details ? `${baseMessage} - ${details}` : baseMessage;

  showToast(displayMessage, { type: 'success', duration: toMs(duration) });
};

export const clearErrors = () => {
  destroyAllToasts();
};

export const withRetry = async (operation, options = {}) => {
  const {
    maxRetries = 2,
    delay = 1000,
    onError = null,
    operationType = 'operation'
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        const errorInfo = handleOperationError(error, operationType);
        if (onError) onError(errorInfo);
        throw error;
      }

      const errorInfo = parseError(error);
      if (errorInfo.type === ERROR_TYPES.VALIDATION) {
        handleOperationError(error, operationType);
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }

  throw lastError;
};

export default {
  parseError,
  showErrorMessage,
  showErrorNotification,
  handleOperationError,
  handleUploadError,
  showSuccessMessage,
  clearErrors,
  withRetry,
  ERROR_TYPES
};
