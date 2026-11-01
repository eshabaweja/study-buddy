import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { quizzes as quizzesApi } from '../utils/api';
import QuizSubmissionReview from '../components/QuizSubmissionReview';
import { getScoreTier, scoreTierClassName, scoreTierLabel } from '../utils/quizScoreTier';

export default function QuizResultsPage() {
  const { courseId, quizId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await quizzesApi.getResults(quizId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load results');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  if (loading) return <div className="bux-container">Loading results...</div>;
  if (error) {
    return (
      <div className="bux-container">
        <p>Error: {error}</p>
        <Link to={`/quizzes/${courseId}`}>Back to quizzes</Link>
      </div>
    );
  }

  const { quiz, items = [], score, scores_published: scoresPublished } = data || {};
  const showScores = Boolean(scoresPublished);
  const pendingTyped = score?.pending_typed_count ?? 0;
  const totalTier =
    showScores && score && pendingTyped === 0
      ? getScoreTier(score.points_earned, score.points_possible)
      : 'neutral';

  return (
    <div className="bux-container bux-mar-top-sp-16 bux-mar-bottom-sp-32">
      <p>
        <Link to={`/quizzes/${courseId}`}>← Quizzes</Link>
      </p>
      <h2 className="bux-mar-top-sp-16">Results: {quiz?.title}</h2>
      <p className="bux-mar-top-sp-8">Submitted — review your answers below.</p>
      {!showScores && (
        <p className="bux-mar-top-sp-8 ba-quiz-results__pending">
          Your instructor has not published scores yet. You can review your responses,
          but correct answers, points, and feedback will appear once scores are released.
        </p>
      )}
      {showScores && score && (
        <p className={`bux-mar-top-sp-8 ${scoreTierClassName(totalTier)}`}>
          <strong>
            Score: {score.points_earned} / {score.points_possible} points
          </strong>
          {pendingTyped > 0 ? (
            <span className="bux-mar-left-sp-8">(typed answers pending AI grading)</span>
          ) : (
            scoreTierLabel(totalTier) && (
              <span className="bux-mar-left-sp-8">({scoreTierLabel(totalTier)})</span>
            )
          )}
        </p>
      )}

      <QuizSubmissionReview
        quiz={quiz}
        items={items}
        showGrading={showScores}
      />
    </div>
  );
}
