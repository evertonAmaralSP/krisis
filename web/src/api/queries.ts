import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { v1 } from '@krisis/contracts';
import { api, ApiError } from './client.ts';

export const keys = {
  me: ['me'] as const,
  interviews: ['interviews'] as const,
  interview: (id: string) => ['interviews', id] as const,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return (await api.me()).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: ({ user }) => qc.setQueryData(keys.me, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useInterviews() {
  return useQuery({ queryKey: keys.interviews, queryFn: async () => (await api.listInterviews()).items });
}

export function useInterview(id: string) {
  return useQuery({ queryKey: keys.interview(id), queryFn: () => api.getInterview(id) });
}

export function useCreateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createInterview,
    onSuccess: (interview) => {
      qc.setQueryData(keys.interview(interview.id), interview);
      void qc.invalidateQueries({ queryKey: keys.interviews, exact: true });
    },
  });
}

/** Acrescenta as duas falas do turno ao cache da entrevista. */
export function appendTurn(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  turn: v1.SendMessageResponse,
) {
  qc.setQueryData<v1.Interview>(keys.interview(id), (old) =>
    old ? { ...old, messages: [...old.messages, turn.candidateMessage, turn.interviewerMessage] } : old,
  );
}

export function useVoices() {
  return useQuery({ queryKey: ['speech', 'voices'], queryFn: api.voices, staleTime: Infinity });
}
