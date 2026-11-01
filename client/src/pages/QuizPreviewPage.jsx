import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { quizzes as quizzesApi } from '../utils/api';
import QuizMcqItem from '../components/QuizMcqItem';
import QuizTypedItem from '../components/QuizTypedItem';
import QuizFigureContent from '../components/QuizFigureContent';

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

export default function QuizPreviewPage() {
  const { quizId: quizIdParam } = useParams();
  const quizId = Number(quizIdParam);
  const { isAuthenticated } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || Number.isNaN(quizId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await quizzesApi.getPreview(quizId);
        if (!cancelled) {
          setQuiz(data.quiz);
          setItems(data.items || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, quizId]);

  if (!isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  if (Number.isNaN(quizId)) {
    return (
      <div className="bux-container bux-mar-top-sp-16">
        <p>Invalid quiz id.</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }

  if (loading) return <div className="bux-container">Loading preview...</div>;
  if (error) {
    return (
      <div className="bux-container bux-mar-top-sp-16">
        <p>Error: {error}</p>
        <Link to={`/instructor/quizzes/${quizId}/edit`}>Back to editor</Link>
      </div>
    );
  }

  return (
    <div className="bux-container bux-mar-top-sp-16 bux-mar-bottom-sp-32">
      <p>
        <Link to={`/instructor/quizzes/${quizId}/edit`}>← Back to editor</Link>
      </p>
      <p className="ba-quiz-preview-banner bux-mar-top-sp-16">
        Instructor preview — this is how students see the quiz (answers are not saved here).
      </p>
      <h2 className="bux-mar-top-sp-16">{quiz?.title}</h2>
      {quiz?.description && (
        <div className="bux-mar-top-sp-8">
          <QuizFigureContent html={quiz.description} />
        </div>
      )}
      {quiz?.time_limit_minutes && (
        <p className="bux-mar-top-sp-8">
          Time limit: {quiz.time_limit_minutes} minutes
        </p>
      )}

      {items.map((item, index) => {
        const opts = normalizeOptions(item.options);

        if (item.item_type === 'multiple_choice') {
          return (
            <div key={item.id}>
              <p className="bux-mar-top-sp-16 bux-mar-bottom-sp-8">
                <strong>Question {index + 1}</strong> (multiple choice)
              </p>
              <QuizMcqItem
                promptHtml={item.prompt_html}
                options={opts}
                selectedIndex={undefined}
                onChange={() => {}}
                disabled
              />
            </div>
          );
        }

        if (item.item_type === 'typed' || item.item_type === 'practice_question') {
          return (
            <div key={item.id}>
              <p className="bux-mar-top-sp-16 bux-mar-bottom-sp-8">
                <strong>Question {index + 1}</strong> (typed answer)
              </p>
              <QuizTypedItem
                promptHtml={item.prompt_html}
                value=""
                onChange={() => {}}
                disabled
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
