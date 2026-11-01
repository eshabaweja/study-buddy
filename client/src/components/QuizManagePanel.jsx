import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '../utils/toast';
import { quizzes as quizzesApi } from '../utils/api';
import { fetchInstructorCoursesSorted } from '../utils/instructorCourses';
import { formatQuizWindow } from '../utils/quizEditorUtils';

export default function QuizManagePanel() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    fetchInstructorCoursesSorted().then(setCourses).catch(() => {
      toast.error('Failed to load courses');
    });
  }, []);

  useEffect(() => {
    if (!courseId) {
      setQuizzes([]);
      return;
    }
    quizzesApi
      .listForCourseInstructor(courseId)
      .then((d) => setQuizzes(d.quizzes || []))
      .catch(() => setQuizzes([]));
  }, [courseId]);

  return (
    <div className="app-card sb-mar-top-sp-16 sb-mar-bottom-sp-16">
      <div className="app-card__content">
        <h3 className="app-card__heading">Quizzes</h3>
        <p className="sb-mar-top-sp-8">
          Create a new quiz or open an existing one to edit, view, or delete it.
        </p>

        <label className="sb-label sb-mar-top-sp-16">Course</label>
        <select
          className="sb-select sb-mar-bottom-sp-16"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Select course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>

        {courseId && (() => {
          const selectedCourse = courses.find((c) => String(c.id) === courseId);
          if (!selectedCourse) return null;
          return (
          <p className="sb-mar-bottom-sp-16">
            <Link
              className="sb-button"
              to={`/instructor/quizzes/new?courseId=${selectedCourse.id}`}
            >
              Create new quiz
            </Link>
          </p>
          );
        })()}

        {courseId && quizzes.length > 0 && (
          <ul className="sb-list-ul app-quiz-manage-list">
            {quizzes.map((q) => (
              <li key={q.id} className="app-quiz-manage-list__item">
                <Link
                  className="sb-link app-quiz-manage-list__title"
                  to={`/instructor/quizzes/${q.id}/edit`}
                >
                  {q.title}
                </Link>
                <span className="app-quiz-manage-list__meta">
                  ({q.status || '—'}) — {formatQuizWindow(q.opens_at, q.closes_at)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {courseId && quizzes.length === 0 && (
          <p>No quizzes for this course yet.</p>
        )}
      </div>
    </div>
  );
}
