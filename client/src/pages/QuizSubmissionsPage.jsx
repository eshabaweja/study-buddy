import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../utils/toast';
import { quizzes as quizzesApi } from '../utils/api';
import QuizSubmissionReview from '../components/QuizSubmissionReview';
import {
  getScoreTier,
  scoreTierBoxClassName,
} from '../utils/quizScoreTier';

function formatSubmittedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function QuizSubmissionsPage() {
  const { quizId, studentEmail: selectedEmailParam } = useParams();
  const navigate = useNavigate();
  const [listData, setListData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [publishingScores, setPublishingScores] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [error, setError] = useState(null);

  const selectedEmail = selectedEmailParam
    ? decodeURIComponent(selectedEmailParam)
    : null;

  const loadList = useCallback(async () => {
    const data = await quizzesApi.listSubmissions(quizId);
    setListData(data);
    return data;
  }, [quizId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadList();
        if (!cancelled) setListData(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load submissions');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedEmail) {
      setDetailData(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const data = await quizzesApi.getSubmission(quizId, selectedEmail);
        if (!cancelled) setDetailData(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load submission');
          navigate(`/instructor/quizzes/${quizId}/submissions`);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, selectedEmail, navigate]);

  const handleGradeWithAi = async () => {
    setGrading(true);
    try {
      const result = await quizzesApi.gradeWithAi(quizId);
      const refreshed = await loadList();
      setListData(refreshed);
      if (selectedEmail) {
        const detail = await quizzesApi.getSubmission(quizId, selectedEmail);
        setDetailData(detail);
      }
      if (result.graded_count > 0) {
        toast.success(`Graded ${result.graded_count} typed answer${result.graded_count === 1 ? '' : 's'} with AI`);
        if (!result.scores_published) {
          toast.info('Scores are unpublished — use Publish scores when students should see updated marks.');
        }
      } else {
        toast.info('No pending typed answers to grade');
      }
      if (result.errors?.length) {
        toast.warn(`${result.errors.length} answer(s) could not be graded`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI grading failed');
    } finally {
      setGrading(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      await quizzesApi.downloadSubmissionsCsv(quizId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'CSV download failed');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handlePublishScores = async () => {
    if (!listData?.quiz) return;
    setPublishingScores(true);
    try {
      const next = !listData.quiz.scores_published;
      await quizzesApi.publishScores(quizId, next);
      const refreshed = await loadList();
      setListData(refreshed);
      toast.success(next ? 'Scores published' : 'Scores unpublished');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update scores');
    } finally {
      setPublishingScores(false);
    }
  };

  if (loading) return <div className="bux-container">Loading submissions...</div>;
  if (error) {
    return (
      <div className="bux-container">
        <p>Error: {error}</p>
        <Link to={`/instructor/quizzes/${quizId}/edit`}>Back to editor</Link>
      </div>
    );
  }

  const pendingTypedCount = listData?.pending_typed_count ?? 0;
  const hasResubmitPending = (listData?.students || []).some(
    (student) =>
      (student.submission?.ungraded_typed_count ?? 0) > 0
      && (student.submission?.attempt_number ?? 1) > 1,
  );
  const scoresPublished = Boolean(listData?.quiz?.scores_published);

  return (
    <div className="bux-container bux-mar-top-sp-16 bux-mar-bottom-sp-32">
      <p>
        <Link to={`/instructor/quizzes/${quizId}/edit`}>← Back to editor</Link>
      </p>

      <div className="ba-quiz-submissions__topbar bux-mar-top-sp-16">
        <div>
          <h2>Submissions: {listData?.quiz?.title}</h2>
          <p className="bux-mar-top-sp-8">
            Review student answers, grade typed responses with AI, then publish scores.
          </p>
        </div>
        <div className="ba-quiz-submissions__actions">
          <button
            type="button"
            className="bux-button--alt-small"
            onClick={handleDownloadCsv}
            disabled={grading || publishingScores || downloadingCsv}
          >
            {downloadingCsv ? 'Downloading…' : 'Download CSV'}
          </button>
          <button
            type="button"
            className="bux-button"
            onClick={handleGradeWithAi}
            disabled={grading || publishingScores || pendingTypedCount === 0}
          >
            {grading ? 'Grading…' : 'Grade with AI'}
          </button>
          <button
            type="button"
            className="bux-button--alt-small"
            onClick={handlePublishScores}
            disabled={grading || publishingScores}
          >
            {publishingScores
              ? 'Updating…'
              : (scoresPublished ? 'Unpublish scores' : 'Publish scores')}
          </button>
        </div>
      </div>

      {!scoresPublished && pendingTypedCount === 0 && (
        <p className="ba-quiz-submissions__pending-note bux-mar-top-sp-8">
          Grading is up to date. Publish scores when students should see their marks.
        </p>
      )}

      {pendingTypedCount > 0 && (
        <p className="ba-quiz-submissions__pending-note bux-mar-top-sp-8">
          {hasResubmitPending
            ? `A student has resubmitted — ${pendingTypedCount} typed answer${pendingTypedCount === 1 ? '' : 's'} need AI grading.`
            : `${pendingTypedCount} typed answer${pendingTypedCount === 1 ? '' : 's'} awaiting AI grading.`}
        </p>
      )}

      <div className="ba-quiz-submissions__layout bux-mar-top-sp-24">
        <div className="ba-quiz-submissions__list">
          <h3 className="bux-card__heading">Students</h3>
          <table className="ba-quiz-submissions-table bux-mar-top-sp-8">
            <thead>
              <tr>
                <th>Student</th>
                <th>Submitted</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {(listData?.students || []).map((student) => {
                const submission = student.submission;
                const submitted = Boolean(submission?.submitted_at);
                const earned = submission?.points_earned;
                const possible = submission?.points_possible;
                const pendingTyped = submission?.ungraded_typed_count ?? 0;
                const tier =
                  submitted && pendingTyped === 0 && earned != null && possible != null
                    ? getScoreTier(earned, possible)
                    : 'neutral';
                const isSelected = selectedEmail === student.email;

                return (
                  <tr
                    key={student.email}
                    className={isSelected ? 'ba-quiz-submissions-table__row--selected' : ''}
                  >
                    <td>
                      <button
                        type="button"
                        className="ba-quiz-submissions-table__student-btn"
                        onClick={() => {
                          if (!submitted) return;
                          navigate(
                            `/instructor/quizzes/${quizId}/submissions/${encodeURIComponent(student.email)}`,
                          );
                        }}
                        disabled={!submitted}
                      >
                        <span className="ba-quiz-submissions-table__name">
                          {student.name || student.email}
                        </span>
                        {student.name && (
                          <span className="ba-quiz-submissions-table__email">
                            {student.email}
                          </span>
                        )}
                      </button>
                    </td>
                    <td>{submitted ? formatSubmittedAt(submission.submitted_at) : 'Not submitted'}</td>
                    <td>
                      {!submitted && '—'}
                      {submitted && pendingTyped > 0 && (
                        <span className="ba-quiz-submissions-badge ba-quiz-submissions-badge--pending">
                          Pending grading
                        </span>
                      )}
                      {submitted && pendingTyped === 0 && earned != null && possible != null && (
                        <span className={scoreTierBoxClassName(tier)}>
                          {earned} / {possible}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="ba-quiz-submissions__detail">
          {!selectedEmail && (
            <p>Select a submitted student to review their answers.</p>
          )}
          {selectedEmail && detailLoading && <p>Loading answers...</p>}
          {selectedEmail && !detailLoading && detailData && (
            <>
              <h3 className="bux-card__heading">{selectedEmail}</h3>
              {detailData.score && (
                <p className="bux-mar-top-sp-8">
                  <strong>
                    Total: {detailData.score.points_earned} / {detailData.score.points_possible} points
                  </strong>
                  {(detailData.score.pending_typed_count ?? 0) > 0 && (
                    <span className="ba-quiz-submissions-badge ba-quiz-submissions-badge--pending bux-mar-left-sp-8">
                      {detailData.score.pending_typed_count} typed answer
                      {detailData.score.pending_typed_count === 1 ? '' : 's'} pending AI grading
                    </span>
                  )}
                </p>
              )}
              <QuizSubmissionReview
                quiz={detailData.quiz}
                items={detailData.items}
                showGrading
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
