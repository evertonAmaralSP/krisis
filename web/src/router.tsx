import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout.tsx';
import { HomeRedirect } from './pages/HomeRedirect.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ChatPage } from './pages/ChatPage.tsx';
import { FeedbackPage } from './pages/FeedbackPage.tsx';
import { NewInterviewPage } from './pages/NewInterviewPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

export const router = createBrowserRouter([
  { path: '/entrar', element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'entrevistas/nova', element: <NewInterviewPage /> },
      { path: 'entrevistas/:id', element: <ChatPage /> },
      { path: 'entrevistas/:id/feedback', element: <FeedbackPage /> },
      { path: 'configuracoes', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
