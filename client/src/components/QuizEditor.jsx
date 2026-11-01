import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from '../utils/toast';
import { quizzes as quizzesApi, questions as questionsApi } from '../utils/api';
import { fetchInstructorCoursesSorted } from '../utils/instructorCourses';
import QuillEditor from './QuillEditor';
import { getQuillStoredHtml, normalizeQuillHtml } from '../utils/quillHtml';
import QuizQuestionList from './quiz/QuizQuestionList';
import {
  apiItemToDraft,
  createEmptyItem,
  createLocalKey,
  draftItemToApiPayload,
  emptyMetadata,
  fromDatetimeLocal,
  isPromptBlank,
  mergeSavedItems,
  metadataFromQuiz,
  snapshotDraft,
} from '../utils/quizEditorUtils';

export default function QuizEditor({
  quizId: initialQuizId = null,
  initialCourseId = '',
  standalone = false,
}) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [metadata, setMetadata] = useState(() => ({
    ...emptyMetadata(),
    courseId: initialCourseId ? String(initialCourseId) : '',
  }));
  const [quizId, setQuizId] = useState(initialQuizId);
  const [items, setItems] = useState([]);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotDraft(
    initialQuizId,
    { ...emptyMetadata(), courseId: initialCourseId ? String(initialCourseId) : '' },
    [],
  ));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [publishingScores, setPublishingScores] = useState(false);
  const [scoresPublished, setScoresPublished] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(Boolean(initialQuizId));
  const [addType, setAddType] = useState('multiple_choice');
  const cardRefs = useRef({});
  const descriptionRef = useRef(null);
  const loadedQuizIdRef = useRef(null);
  const [initialDescription, setInitialDescription] = useState('');

  const isDirty = snapshotDraft(quizId, metadata, items) !== savedSnapshot;

  const updateMetadata = (patch) => {
    setMetadata((prev) => ({ ...prev, ...patch }));
  };

  const flushItemsFromCards = useCallback(() => {
    return items.map((item) => {
      const flushed = cardRefs.current[item.localKey]?.flushDraft?.();
      return flushed || item;
    });
  }, [items]);

  const applyLoadedQuiz = useCallback((data) => {
    const meta = metadataFromQuiz(data.quiz, data.quiz.course_id);
    const draftItems = (data.items || []).map(apiItemToDraft);
    setQuizId(data.quiz.id);
    setMetadata(meta);
    setInitialDescription(data.quiz.description || '');
    setItems(draftItems);
    setScoresPublished(Boolean(data.quiz.scores_published));
    setSavedSnapshot(snapshotDraft(data.quiz.id, meta, draftItems));
  }, []);

  useEffect(() => {
    fetchInstructorCoursesSorted().then(setCourses).catch(() => {
      toast.error('Failed to load courses');
    });
  }, []);

  useEffect(() => {
    if (!initialQuizId || loadedQuizIdRef.current === initialQuizId) return;
    loadedQuizIdRef.current = initialQuizId;
    setLoadingQuiz(true);
    quizzesApi
      .get(initialQuizId)
      .then(applyLoadedQuiz)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load quiz');
      })
      .finally(() => setLoadingQuiz(false));
  }, [initialQuizId, applyLoadedQuiz]);

  useEffect(() => {
    if (!metadata.courseId) {
      setBankQuestions([]);
      return;
    }
    const course = courses.find((c) => String(c.id) === String(metadata.courseId));
    if (course?.code) {
      questionsApi
        .getByCourse(course.code)
        .then((d) => setBankQuestions(d.questions || []))
        .catch(() => setBankQuestions([]));
    }
  }, [metadata.courseId, courses]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const resetDraft = () => {
    const courseId = metadata.courseId;
    if (standalone) {
      const url = courseId
        ? `/instructor/quizzes/new?courseId=${courseId}`
        : '/instructor/quizzes/new';
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setQuizId(null);
    setMetadata({ ...emptyMetadata(), courseId });
    setInitialDescription('');
    setItems([]);
    setSavedSnapshot(snapshotDraft(null, { ...emptyMetadata(), courseId }, []));
  };

  const handleAddQuestion = () => {
    setItems((prev) => [...prev, createEmptyItem(addType)]);
  };

  const handleDuplicateItem = (index) => {
    setItems((prev) => {
      const source = cardRefs.current[prev[index].localKey]?.flushDraft?.() || prev[index];
      const copy = {
        ...source,
        id: undefined,
        localKey: createLocalKey(),
        options: [...(source.options || [])],
      };
      const next = [...prev];
      next[index] = source;
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleDeleteQuiz = async () => {
    if (!quizId) return;
    if (!window.confirm('Delete this quiz permanently? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await quizzesApi.delete(quizId);
      toast.success('Quiz deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete quiz');
    } finally {
      setDeleting(false);
    }
  };

  const handlePublishScores = async () => {
    if (!quizId) return;
    const next = !scoresPublished;
    setPublishingScores(true);
    try {
      const { quiz } = await quizzesApi.publishScores(quizId, next);
      setScoresPublished(Boolean(quiz.scores_published));
      toast.success(next ? 'Scores published for students' : 'Scores hidden from students');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update score visibility');
    } finally {
      setPublishingScores(false);
    }
  };

  const handleSave = async () => {
    const flushedItems = flushItemsFromCards();
    setItems(flushedItems);

    if (!metadata.courseId || !metadata.title || !metadata.opensAt || !metadata.closesAt) {
      toast.error('Course, title, and open/close times are required');
      return;
    }

    for (let i = 0; i < flushedItems.length; i++) {
      const item = flushedItems[i];
      if (item.item_type === 'practice_question' && !item.question_id) {
        toast.error(`Question ${i + 1}: select a practice bank question`);
        return;
      }
      if (
        (item.item_type === 'multiple_choice' || item.item_type === 'typed')
        && isPromptBlank(item.prompt_html)
      ) {
        const label = item.item_type === 'typed' ? 'typed answer' : 'multiple choice';
        toast.error(`Question ${i + 1}: enter a prompt (${label})`);
        return;
      }
    }

    setSaving(true);
    try {
      let activeQuizId = quizId;
      const description = normalizeQuillHtml(getQuillStoredHtml(descriptionRef.current)) || null;
      const payload = {
        title: metadata.title,
        description,
        opens_at: fromDatetimeLocal(metadata.opensAt),
        closes_at: fromDatetimeLocal(metadata.closesAt),
        time_limit_minutes: metadata.hasTimeLimit ? Number(metadata.timeLimitMinutes) : null,
        max_attempts: Number(metadata.maxAttempts) || 1,
      };

      const isNewQuiz = !activeQuizId;
      if (isNewQuiz) {
        const { quiz } = await quizzesApi.create({
          course_id: Number(metadata.courseId),
          ...payload,
        });
        activeQuizId = quiz.id;
        setQuizId(quiz.id);
      } else {
        await quizzesApi.update(activeQuizId, payload);
      }

      const apiItems = flushedItems.map(draftItemToApiPayload);
      const { items: savedItems } = await quizzesApi.syncItems(activeQuizId, apiItems);
      const merged = mergeSavedItems(flushedItems, savedItems);
      const meta = { ...metadata, description };
      setMetadata(meta);
      setInitialDescription(description || '');
      setItems(merged);
      setSavedSnapshot(snapshotDraft(activeQuizId, meta, merged));
      toast.success('Quiz saved');

      if (standalone && isNewQuiz) {
        navigate(`/instructor/quizzes/${activeQuizId}/edit`, { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  if (loadingQuiz) {
    return (
      <div className="app-quiz-editor app-card sb-mar-top-sp-16">
        <div className="app-card__content">Loading quiz…</div>
      </div>
    );
  }

  const previewUrl = quizId ? `/instructor/quizzes/${quizId}/preview` : null;

  return (
    <div className="app-quiz-editor app-card sb-mar-top-sp-16 sb-mar-bottom-sp-16">
      <div className="app-card__content">
        <div className="app-quiz-editor__topbar">
          <div>
            <h3 className="app-card__heading">
              {quizId ? `Edit quiz${metadata.title ? `: ${metadata.title}` : ''}` : 'New quiz'}
            </h3>
            {isDirty && (
              <span className="app-quiz-editor__unsaved">Unsaved changes</span>
            )}
            {!isDirty && quizId && (
              <span className="app-quiz-editor__saved">Saved</span>
            )}
          </div>
          <div className="app-quiz-editor__topbar-actions">
            {quizId && (
              <Link
                to={`/instructor/quizzes/${quizId}/submissions`}
                className="sb-button sb-button--small"
              >
                View submissions
              </Link>
            )}
            <button
              type="button"
              className="sb-button--alt-small"
              onClick={resetDraft}
              disabled={saving || deleting}
            >
              New quiz
            </button>
            {quizId && (
              <button
                type="button"
                className="sb-button--alt-small app-quiz-editor__delete-btn"
                onClick={handleDeleteQuiz}
                disabled={saving || deleting}
              >
                {deleting ? 'Deleting…' : 'Delete quiz'}
              </button>
            )}
          </div>
        </div>

        <div className="sb-form sb-mar-top-sp-16">
          <label className="sb-label">Course</label>
          <select
            className="sb-select sb-mar-bottom-sp-16"
            value={metadata.courseId}
            onChange={(e) => {
              const courseId = e.target.value;
              if (isDirty && !window.confirm('You have unsaved changes. Switch course anyway?')) {
                return;
              }
              setMetadata({ ...emptyMetadata(), courseId });
              setInitialDescription('');
              setQuizId(null);
              setItems([]);
              setSavedSnapshot(snapshotDraft(null, { ...emptyMetadata(), courseId }, []));
            }}
            disabled={Boolean(quizId)}
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>

          <label className="sb-label">Title</label>
          <input
            className="sb-text-field sb-mar-bottom-sp-16"
            value={metadata.title}
            onChange={(e) => updateMetadata({ title: e.target.value })}
          />

          <label className="sb-label sb-mar-bottom-sp-8">Description (optional)</label>
          <div className="app-quiz-editor__description sb-mar-bottom-sp-16">
            <QuillEditor
              key={`quiz-description-${quizId ?? `new-${metadata.courseId}`}`}
              ref={descriptionRef}
              defaultValue={initialDescription}
              placeholder="Optional instructions for students..."
              onTextChange={() => updateMetadata({
                description: normalizeQuillHtml(getQuillStoredHtml(descriptionRef.current)),
              })}
            />
          </div>

          <label className="sb-label">Opens</label>
          <input
            type="datetime-local"
            className="sb-text-field sb-mar-bottom-sp-16"
            value={metadata.opensAt}
            onChange={(e) => updateMetadata({ opensAt: e.target.value })}
          />

          <label className="sb-label">Closes</label>
          <input
            type="datetime-local"
            className="sb-text-field sb-mar-bottom-sp-16"
            value={metadata.closesAt}
            onChange={(e) => updateMetadata({ closesAt: e.target.value })}
          />

          <div className="app-quiz-editor__numeric-row sb-mar-bottom-sp-16">
            <div className="app-quiz-editor__numeric-field">
              <label className="sb-flex sb-flex--align-center app-quiz-editor__numeric-label">
                <input
                  type="checkbox"
                  checked={metadata.hasTimeLimit}
                  onChange={(e) => updateMetadata({ hasTimeLimit: e.target.checked })}
                  className="sb-mar-right-sp-8"
                />
                Time limit (minutes)
              </label>
              {metadata.hasTimeLimit && (
                <input
                  type="number"
                  min={1}
                  className="sb-text-field app-input-narrow"
                  value={metadata.timeLimitMinutes}
                  onChange={(e) => updateMetadata({ timeLimitMinutes: e.target.value })}
                />
              )}
            </div>

            <div className="app-quiz-editor__numeric-field">
              <label className="sb-label app-quiz-editor__numeric-label">Attempts allowed</label>
              <input
                type="number"
                min={1}
                className="sb-text-field app-input-narrow"
                value={metadata.maxAttempts}
                onChange={(e) => updateMetadata({ maxAttempts: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="app-quiz-editor__questions sb-mar-top-sp-24">
          <h4 className="sb-card__heading">Questions</h4>
          {items.length === 0 ? (
            <p className="sb-mar-top-sp-8">No questions yet. Add one below.</p>
          ) : (
            <QuizQuestionList
              items={items}
              bankQuestions={bankQuestions}
              cardRefs={cardRefs}
              onReorder={setItems}
              onChangeItem={(index, next) => {
                setItems((prev) => prev.map((item, i) => (i === index ? next : item)));
              }}
              onDuplicateItem={handleDuplicateItem}
              onDeleteItem={(index) => {
                setItems((prev) => prev.filter((_, i) => i !== index));
              }}
            />
          )}

          <div className="app-quiz-editor__add-question sb-mar-top-sp-16">
            <select
              className="sb-select"
              value={addType}
              onChange={(e) => setAddType(e.target.value)}
              aria-label="New question type"
            >
              <option value="multiple_choice">Multiple choice</option>
              <option value="typed">Typed answer</option>
              <option value="practice_question">From practice bank</option>
            </select>
            <button
              type="button"
              className="sb-button app-quiz-editor__add-btn"
              onClick={handleAddQuestion}
            >
              + Add question
            </button>
          </div>

          <div className="app-quiz-editor__footer-actions sb-mar-top-sp-24">
            {quizId && (
              <button
                type="button"
                className="sb-button--alt-small"
                onClick={handlePublishScores}
                disabled={saving || deleting || publishingScores}
              >
                {publishingScores
                  ? 'Updating…'
                  : (scoresPublished ? 'Unpublish scores' : 'Publish scores')}
              </button>
            )}
            {previewUrl && (
              <Link
                to={previewUrl}
                className="sb-button--alt-small"
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview
              </Link>
            )}
            <button
              type="button"
              className="sb-button"
              onClick={handleSave}
              disabled={saving || deleting || publishingScores}
            >
              {saving ? 'Saving…' : 'Save quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
