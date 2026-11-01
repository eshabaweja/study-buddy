import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../utils/toast';
import { quizzes as quizzesApi } from '../utils/api';
import QuizMcqItem from '../components/QuizMcqItem';
import QuizTypedItem from '../components/QuizTypedItem';
import QuizFigureContent from '../components/QuizFigureContent';

const WARNING_THRESHOLDS_MS = [5 * 60 * 1000, 60 * 1000];
const TYPED_SAVE_DEBOUNCE_MS = 600;

function normalizeOptions(options) {
  if (!options) return [];
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch {
      return [];
    }
  }
  return options;
}

function formatCountdown(ms) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function QuizTakePage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [items, setItems] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const warnedRef = useRef(new Set());
  const autoSubmittedRef = useRef(false);
  const typedSaveTimersRef = useRef({});
  const pendingTypedAnswersRef = useRef({});
  const saveAbortRef = useRef({});
  const isSubmittedRef = useRef(false);
  const isExpiredRef = useRef(false);
  const answersRef = useRef({});
  const itemsRef = useRef([]);

  const isSubmitted = Boolean(submission?.submitted_at);

  useEffect(() => {
    isSubmittedRef.current = isSubmitted;
  }, [isSubmitted]);

  const attemptEndsAtMs = useMemo(() => {
    if (!quiz?.time_limit_minutes || !submission?.started_at || isSubmitted) return null;
    return new Date(submission.started_at).getTime() + quiz.time_limit_minutes * 60 * 1000;
  }, [quiz?.time_limit_minutes, submission?.started_at, isSubmitted]);

  const msRemaining = useMemo(() => {
    if (attemptEndsAtMs == null) return null;
    return attemptEndsAtMs - now;
  }, [attemptEndsAtMs, now]);

  const isExpired = msRemaining != null && msRemaining <= 0;

  useEffect(() => {
    isExpiredRef.current = isExpired;
  }, [isExpired]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleSaveError = useCallback((err) => {
    if (err?.name === 'AbortError') return;
    const message = err instanceof Error ? err.message : 'Failed to save answer';
    if (message === 'Time limit exceeded') {
      toast.info('Time is up — quiz submitted automatically.');
      navigate(`/quizzes/${courseId}/${quizId}/results`);
      return;
    }
    toast.error(message);
  }, [courseId, quizId, navigate]);

  const persistAnswer = useCallback(async (
    itemId,
    answer_json,
    { abortPrevious = true, allowExpired = false, ignoreErrors = false } = {},
  ) => {
    if (isSubmittedRef.current) return;
    if (!allowExpired && isExpiredRef.current) return;

    if (abortPrevious && saveAbortRef.current[itemId]) {
      saveAbortRef.current[itemId].abort();
    }

    const controller = new AbortController();
    saveAbortRef.current[itemId] = controller;

    try {
      await quizzesApi.saveAnswer(quizId, itemId, answer_json, { signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted || err?.name === 'AbortError') return;
      if (ignoreErrors) return;
      handleSaveError(err);
    } finally {
      if (saveAbortRef.current[itemId] === controller) {
        delete saveAbortRef.current[itemId];
      }
    }
  }, [quizId, handleSaveError]);

  const flushPendingTypedSaves = useCallback(async () => {
    for (const timerId of Object.values(typedSaveTimersRef.current)) {
      clearTimeout(timerId);
    }
    typedSaveTimersRef.current = {};

    const pending = { ...pendingTypedAnswersRef.current };
    pendingTypedAnswersRef.current = {};

    for (const item of itemsRef.current) {
      if (item.item_type !== 'typed' && item.item_type !== 'practice_question') continue;
      const text = answersRef.current[item.id]?.text;
      if (text != null) {
        pending[item.id] = { text };
      }
    }

    await Promise.all(
      Object.entries(pending).map(([itemId, answer_json]) =>
        persistAnswer(Number(itemId), answer_json, {
          abortPrevious: false,
          allowExpired: true,
          ignoreErrors: true,
        }),
      ),
    );
  }, [persistAnswer]);

  useEffect(() => () => {
    for (const timerId of Object.values(typedSaveTimersRef.current)) {
      clearTimeout(timerId);
    }
    for (const controller of Object.values(saveAbortRef.current)) {
      controller.abort();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await quizzesApi.getTake(quizId);
        if (cancelled) return;
        if (data.auto_submitted) {
          toast.info('Time is up — quiz submitted automatically.');
          navigate(`/quizzes/${courseId}/${quizId}/results`);
          return;
        }
        let take = data;
        if (!take.submission) {
          await quizzesApi.start(quizId);
          if (cancelled) return;
          take = await quizzesApi.getTake(quizId);
          if (cancelled) return;
          if (take.auto_submitted) {
            toast.info('Time is up — quiz submitted automatically.');
            navigate(`/quizzes/${courseId}/${quizId}/results`);
            return;
          }
        }
        setQuiz(take.quiz);
        setItems(take.items || []);
        setSubmission(take.submission);
        setAnswers(take.answers || {});
        warnedRef.current = new Set();
        autoSubmittedRef.current = false;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load quiz');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, courseId, navigate]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting || isSubmitted) return;
    if (!auto && !window.confirm('Submit quiz? You cannot change answers after submitting.')) {
      return;
    }
    setSubmitting(true);
    try {
      await flushPendingTypedSaves();
      await quizzesApi.submit(quizId);
      if (auto) {
        toast.info('Time is up — quiz submitted automatically.');
      } else {
        toast.success('Quiz submitted');
      }
      navigate(`/quizzes/${courseId}/${quizId}/results`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, isSubmitted, quizId, courseId, navigate, flushPendingTypedSaves]);

  useEffect(() => {
    if (attemptEndsAtMs == null || isSubmitted) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [attemptEndsAtMs, isSubmitted]);

  useEffect(() => {
    if (msRemaining == null || isSubmitted || autoSubmittedRef.current) return;

    for (const threshold of WARNING_THRESHOLDS_MS) {
      const key = String(threshold);
      if (msRemaining <= threshold && msRemaining > threshold - 1000 && !warnedRef.current.has(key)) {
        warnedRef.current.add(key);
        const mins = threshold / 60000;
        toast.warning(
          mins >= 1
            ? `${mins} minute${mins > 1 ? 's' : ''} remaining on this quiz`
            : '1 minute remaining on this quiz',
          { autoClose: 8000 },
        );
      }
    }

    if (msRemaining <= 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmit(true);
    }
  }, [msRemaining, isSubmitted, handleSubmit]);

  const saveMcqAnswer = useCallback((itemId, answer_json) => {
    if (isSubmittedRef.current || isExpiredRef.current) return;
    setAnswers((prev) => ({ ...prev, [itemId]: answer_json }));
    persistAnswer(itemId, answer_json);
  }, [persistAnswer]);

  const saveTypedAnswer = useCallback((itemId, text) => {
    if (isSubmittedRef.current || isExpiredRef.current) return;
    const answer_json = { text };
    setAnswers((prev) => ({ ...prev, [itemId]: answer_json }));
    pendingTypedAnswersRef.current[itemId] = answer_json;

    if (typedSaveTimersRef.current[itemId]) {
      clearTimeout(typedSaveTimersRef.current[itemId]);
    }

    typedSaveTimersRef.current[itemId] = setTimeout(() => {
      delete typedSaveTimersRef.current[itemId];
      const pending = pendingTypedAnswersRef.current[itemId];
      if (!pending) return;
      delete pendingTypedAnswersRef.current[itemId];
      persistAnswer(itemId, pending);
    }, TYPED_SAVE_DEBOUNCE_MS);
  }, [persistAnswer]);

  const totalPoints = items.reduce((sum, item) => sum + (item.points ?? 1), 0);

  if (loading) return <div className="sb-container">Loading quiz...</div>;
  if (error) {
    return (
      <div className="sb-container">
        <p>Error: {error}</p>
        <Link to={`/quizzes/${courseId}`}>Back to quizzes</Link>
      </div>
    );
  }

  return (
    <div className="sb-container sb-mar-top-sp-16 sb-mar-bottom-sp-32">
      <p>
        <Link to={`/quizzes/${courseId}`}>← Quizzes</Link>
      </p>
      <h2 className="sb-mar-top-sp-16">{quiz?.title}</h2>
      {quiz?.description && (
        <div className="sb-mar-top-sp-8">
          <QuizFigureContent html={quiz.description} />
        </div>
      )}
      {totalPoints > 0 && (
        <p className="sb-mar-top-sp-8">Total points: {totalPoints}</p>
      )}
      {quiz?.time_limit_minutes && !isSubmitted && (
        <p
          className={`sb-mar-top-sp-8 app-quiz-timer${msRemaining != null && msRemaining <= 60000 ? ' app-quiz-timer--warning' : ''}`}
        >
          Time remaining: {formatCountdown(msRemaining ?? 0)}
          {isExpired && ' (submitting…)'}
        </p>
      )}

      {items.map((item, index) => {
        const saved = answers[item.id] || {};
        const opts = normalizeOptions(item.options);
        const pointsLabel = (item.points ?? 1) !== 1 ? ` — ${item.points} pt${item.points === 1 ? '' : 's'}` : '';

        if (item.item_type === 'multiple_choice') {
          return (
            <div key={item.id}>
              <p className="sb-mar-top-sp-16 sb-mar-bottom-sp-8">
                <strong>Question {index + 1}</strong> (multiple choice){pointsLabel}
              </p>
              <QuizMcqItem
                promptHtml={item.prompt_html}
                options={opts}
                selectedIndex={saved.selectedIndex}
                onChange={(selectedIndex) => saveMcqAnswer(item.id, { selectedIndex })}
                disabled={isSubmitted || isExpired}
              />
            </div>
          );
        }

        if (item.item_type === 'typed' || item.item_type === 'practice_question') {
          return (
            <div key={item.id}>
              <p className="sb-mar-top-sp-16 sb-mar-bottom-sp-8">
                <strong>Question {index + 1}</strong> (typed answer){pointsLabel}
              </p>
              <QuizTypedItem
                promptHtml={item.prompt_html}
                value={saved.text || ''}
                onChange={(text) => saveTypedAnswer(item.id, text)}
                disabled={isSubmitted || isExpired}
                answerKey={item.id}
              />
            </div>
          );
        }

        return null;
      })}

      {!isSubmitted && (
        <button
          type="button"
          className="sb-button sb-mar-top-sp-24"
          onClick={() => handleSubmit(false)}
          disabled={submitting || isExpired}
        >
          {submitting ? 'Submitting...' : 'Submit quiz'}
        </button>
      )}
    </div>
  );
}
