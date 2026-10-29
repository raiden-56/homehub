import { Route, Routes } from 'react-router-dom';
import CalendarPage from './CalendarPage';

/** Routes under `/calendar/*`. The event route renders the same page with its detail drawer open. */
export default function CalendarModule() {
  return (
    <Routes>
      <Route index element={<CalendarPage />} />
      <Route path="event/:eventId" element={<CalendarPage />} />
      <Route path="*" element={<CalendarPage />} />
    </Routes>
  );
}
