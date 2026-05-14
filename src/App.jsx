import React, { useState } from 'react';
import WarehouseForm from './components/WarehouseForm';
import { warehouseService } from './services/warehouseService';
import { handleOperationError, showSuccessMessage } from './utils/errorHandler';
import './index.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [formKey, setFormKey] = useState(Date.now());

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      await warehouseService.create(payload);
      showSuccessMessage('create', { details: payload.warehouseType });
      setFormKey(Date.now());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      handleOperationError(error, 'create');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1 className="app-shell__title">Warehouse Data Form</h1>
      </header>
      <main className="app-shell__main">
        <WarehouseForm
          key={formKey}
          visible={true}
          onCancel={() => {
            if (window.confirm('Reset the form?')) {
              setFormKey(Date.now());
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </main>
    </div>
  );
}

export default App;
