import { Route, Routes } from 'react-router-dom';
import TasksPage from './TasksPage';

/** Routes under `/tasks/*`. A task id renders the same page with its detail drawer open. */
export default function TasksModule() {
  return (
    <Routes>
      <Route index element={<TasksPage />} />
      <Route path=":taskId" element={<TasksPage />} />
    </Routes>
  );
}
