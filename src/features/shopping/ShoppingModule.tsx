import { Route, Routes } from 'react-router-dom';
import ShoppingListsPage from './pages/ShoppingListsPage';
import ShoppingListPage from './pages/ShoppingListPage';
import PurchaseHistoryPage from './pages/PurchaseHistoryPage';

/** Routes under `/shopping/*`. */
export default function ShoppingModule() {
  return (
    <Routes>
      <Route index element={<ShoppingListsPage />} />
      <Route path="history" element={<PurchaseHistoryPage />} />
      <Route path=":listId" element={<ShoppingListPage />} />
    </Routes>
  );
}
