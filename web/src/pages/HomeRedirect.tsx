import { Navigate } from 'react-router';
import { useInterviews } from '../api/queries.ts';

/** "/" abre a entrevista mais recente, ou o formulário se não houver nenhuma. */
export function HomeRedirect() {
  const interviews = useInterviews();
  if (interviews.isPending) return null;
  const latest = interviews.data?.[0];
  return <Navigate to={latest ? `/entrevistas/${latest.id}` : '/entrevistas/nova'} replace />;
}
