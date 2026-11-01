import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../utils/toast';
import { useAuth } from '../../contexts/AuthContext';
import { questions } from '../../utils/api';

export function useQuestionCanEdit(questionId) {
  const { isInstructor } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    if (!isInstructor || !questionId) {
      setCanEdit(false);
      return;
    }
    questions
      .canEdit(questionId)
      .then(() => setCanEdit(true))
      .catch(() => setCanEdit(false));
  }, [isInstructor, questionId]);

  return canEdit;
}

export function useQuestionDelete({ questionId, canEdit, onDeleted }) {
  return useCallback(async () => {
    if (!canEdit || !questionId) return false;
    if (
      !window.confirm(
        'Delete this question permanently? This removes student progress tied to it.',
      )
    ) {
      return false;
    }
    try {
      await questions.delete(questionId);
      toast.success('Question deleted');
      onDeleted?.();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete question');
      return false;
    }
  }, [canEdit, questionId, onDeleted]);
}
