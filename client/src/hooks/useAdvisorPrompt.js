import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import advisorService from '../services/advisorService';

let nextId = 0;
function messageId() {
  nextId += 1;
  return nextId;
}

// Must match MAX_HISTORY_TURNS in server/routes/advisor.js — capped
// client-side too so a long session never trips the server's array-length
// validation and gets a surprise 400 on an otherwise-fine question.
const MAX_HISTORY_TURNS = 10;

// Flattens prior chat turns into the compact { role, content } shape the
// server forwards to the model as conversation history — never persisted,
// see client/src/services/advisorService.js. Assistant turns are serialized
// as the structured verdict (JSON), not the rendered/translated reply text
// (PromptBar.jsx#replyText), so the model reasons over data, not a locale
// string.
function toHistory(messages) {
  return messages.slice(-MAX_HISTORY_TURNS).map((m) =>
    m.role === 'user'
      ? { role: 'user', content: m.text }
      : {
          role: 'assistant',
          content: JSON.stringify({
            verdict: m.verdict,
            amountAgorot: m.amountAgorot,
            projectedBalanceAfterAgorot: m.projectedBalanceAfterAgorot,
            suggestion: m.suggestion,
            reasoning: m.reasoning,
          }),
        }
  );
}

// Owns the floating prompt bar's conversation state so PromptBar.jsx stays
// presentational — docs/features/AGENTS.md § Agent 1. Read-only: never
// invalidates any query key, since the advisor never writes anything.
export function useAdvisorPrompt() {
  const [messages, setMessages] = useState([]);

  const mutation = useMutation({
    mutationFn: ({ text, history }) => advisorService.ask(text, history),
    onSuccess: (result) => {
      setMessages((prev) => [...prev, { id: messageId(), role: 'assistant', ...result }]);
    },
  });

  const submit = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed || mutation.isPending) return;
      const history = toHistory(messages);
      setMessages((prev) => [...prev, { id: messageId(), role: 'user', text: trimmed }]);
      mutation.mutate({ text: trimmed, history });
    },
    [mutation, messages]
  );

  const reset = useCallback(() => {
    setMessages([]);
    mutation.reset();
  }, [mutation]);

  return { messages, isPending: mutation.isPending, error: mutation.error, submit, reset };
}
