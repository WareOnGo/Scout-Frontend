import { useState } from 'react';
import WarehouseForm from './components/WarehouseForm';
import SuccessPage from './components/SuccessPage';
import { warehouseService } from './services/warehouseService';
import { handleOperationError } from './utils/errorHandler';
import './index.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [formKey, setFormKey] = useState(() => Date.now());
  const [createdWarehouse, setCreatedWarehouse] = useState(null);

  const handleSubmit = async (payload) => {
    setLoading(true);
    try {
      const created = await warehouseService.create(payload);
      setCreatedWarehouse(created);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      handleOperationError(error, 'create');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setCreatedWarehouse(null);
    setFormKey(Date.now());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <h1 className="app-shell__title">Warehouse Data Form</h1>
      </header>
      <main className="app-shell__main">
        {createdWarehouse ? (
          <SuccessPage
            warehouseId={createdWarehouse.warehouseId}
            submissionId={createdWarehouse.submissionId ?? createdWarehouse.id}
            onStartOver={handleStartOver}
          />
        ) : (
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
        )}
      </main>
    </div>
  );
}

export default App;
