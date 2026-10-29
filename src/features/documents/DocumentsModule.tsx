import { Route, Routes } from 'react-router-dom';
import DocumentsPage from './DocumentsPage';

/** Routes under `/documents/*`: the list, with a record's detail drawer at `/documents/:documentId`. */
export default function DocumentsModule() {
  return (
    <Routes>
      <Route index element={<DocumentsPage />} />
      <Route path=":documentId" element={<DocumentsPage />} />
    </Routes>
  );
}
