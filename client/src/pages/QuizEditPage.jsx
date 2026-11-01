import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import QuizEditor from '../components/QuizEditor';

export default function QuizEditPage() {
  const { quizId: quizIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isInstructor } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  if (!isInstructor) {
    return <Navigate to="/dashboard" replace />;
  }

  const isNew = !quizIdParam || quizIdParam === 'new';
  const quizId = isNew ? null : Number(quizIdParam);
  const initialCourseId = searchParams.get('courseId') || '';

  if (!isNew && Number.isNaN(quizId)) {
    return (
      <div className="bux-container bux-mar-top-sp-16">
        <p>Invalid quiz id.</p>
        <Link to="/dashboard">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="bux-container ba-container bux-mar-top-sp-16 bux-mar-bottom-sp-32">
      <p>
        <Link to="/dashboard">← Dashboard</Link>
      </p>
      <QuizEditor
        quizId={quizId}
        initialCourseId={initialCourseId}
        standalone
      />
    </div>
  );
}
