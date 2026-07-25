import { api } from "@wryte/backend/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export function useSupportTab() {
  const submitTicket = useMutation(api.support.tickets.submitFromDashboard);
  const tickets = useQuery(api.support.tickets.listByUser);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSending(true);
    try {
      await submitTicket({
        subject: subject.trim(),
        message: message.trim(),
      });
      toast.success("Support ticket submitted");
      setSubject("");
      setMessage("");
    } catch {
      toast.error("Failed to submit ticket");
    } finally {
      setIsSending(false);
    }
  }, [canSubmit, subject, message, submitTicket]);

  return {
    tickets,
    subject,
    setSubject,
    message,
    setMessage,
    isSending,
    canSubmit,
    handleSubmit,
  };
}
