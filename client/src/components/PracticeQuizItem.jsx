import { useEffect, useState } from 'react';
import { questions } from '../utils/api';
import Question from './Question';

export default function PracticeQuizItem({ questionId }) {
  const [question, setQuestion] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await questions.getFull(questionId);
        if (!cancelled) setQuestion(data.question);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Load failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  if (error) return <p className="bux-mar-bottom-sp-16">Error: {error}</p>;
  if (!question) return <p className="bux-mar-bottom-sp-16">Loading question...</p>;

  return (
    <div className="bux-mar-bottom-sp-16">
      <Question
        mode="quiz"
        question={question}
        currentIndex={0}
        totalQuestions={1}
        onPrevious={() => {}}
        onNext={() => {}}
      />
    </div>
  );
}
