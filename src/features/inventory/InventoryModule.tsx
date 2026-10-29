import { Route, Routes } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';
import InventoryPage from './pages/InventoryPage';

/** Routes under `/inventory/*`. The item detail opens as a drawer over the list. */
export default function InventoryModule() {
  return (
    <Routes>
      <Route index element={<InventoryPage />} />
      <Route path="item/:itemId" element={<InventoryPage />} />
      <Route path="*" element={<ErrorState kind="not-found" title="Page not found" />} />
    </Routes>
  );
}
