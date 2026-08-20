import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import advisorService from '../services/advisorService';

let nextId = 0;
function messageId() {
  nextId += 1;
  return nextId;
}

// Owns the floating prompt bar's conversation state so PromptBar.jsx stays
// presentational — docs/features/AGENTS.md § Agent 1. Read-only: never
// invalidates any query key, since the advisor never writes anything.
export function useAdvisorPrompt() {
  const [messages, setMessages] = useState([]);

  const mutation = useMutation({
    mutationFn: (text) => advisorService.ask(text),
    onSuccess: (result) => {
      setMessages((prev) => [...prev, { id: messageId(), role: 'assistant', ...result }]);
    },
  });

  const submit = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed || mutation.isPending) return;
      setMessages((prev) => [...prev, { id: messageId(), role: 'user', text: trimmed }]);
      mutation.mutate(trimmed);
    },
    [mutation]
  );

  const reset = useCallback(() => {
    setMessages([]);
    mutation.reset();
  }, [mutation]);

  return { messages, isPending: mutation.isPending, error: mutation.error, submit, reset };
}
