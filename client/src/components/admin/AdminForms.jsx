import { useEffect, useMemo, useState } from 'react';
import { toast } from '../../utils/toast';
import { admin } from '../../utils/api';

function useAdminCourses() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    admin.getCourses().then((d) => setCourses(d.courses || [])).catch(() => {
      toast.error('Failed to load courses');
    });
  }, []);

  const courseLabel = (c) =>
    `${c.code} — ${c.title}${c.instructor_name ? ` (${c.instructor_name})` : ''}`;

  return { courses, courseLabel };
}

function CourseSearchPicker({
  id,
  label,
  courses,
  courseLabel,
  value,
  onChange,
}) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const selected = courses.find((c) => String(c.id) === String(value));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return courses.filter((course) => {
      const haystack = [
        course.code,
        course.title,
        course.instructor_name,
        course.instructor_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [courses, query]);

  const handleSelect = (course) => {
    onChange(String(course.id));
    setQuery('');
    setShowResults(false);
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
    setShowResults(false);
  };

  return (
    <div className="ba-quiz-form__field ba-course-search">
      <label className="bux-label" htmlFor={id}>
        {label}
      </label>
      {selected ? (
        <div className="ba-course-search__selected">
          <span>{courseLabel(selected)}</span>
          <button
            type="button"
            className="bux-button bux-button--secondary bux-button--small"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="search"
            className="bux-text-field"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search by code, title, or instructor"
          />
          {showResults && query.trim() && (
            <ul className="ba-course-search__results">
              {filtered.length === 0 ? (
                <li className="ba-course-search__empty">No courses match your search.</li>
              ) : (
                filtered.map((course) => (
                  <li key={course.id} className="ba-course-search__result">
                    <button
                      type="button"
                      className="ba-course-search__result-btn"
                      onClick={() => handleSelect(course)}
                    >
                      {courseLabel(course)}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function AdminPromoteInstructorForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await admin.setInstructor(email.trim(), true);
      toast.success(`${email} is now an instructor`);
      setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bux-form">
      <p className="ba-quiz-form__hint">
        Grant instructor access by email. User must already have an account.
      </p>
      <div className="ba-quiz-form__field">
        <label className="bux-label" htmlFor="promote-email">
          User email
        </label>
        <input
          id="promote-email"
          type="email"
          className="bux-text-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
        />
      </div>
      <div className="ba-quiz-form__actions">
        <button type="submit" className="bux-button" disabled={loading}>
          {loading ? 'Saving…' : 'Grant instructor role'}
        </button>
      </div>
    </form>
  );
}

export function AdminEnrollStudentForm() {
  const { courses, courseLabel } = useAdminCourses();
  const [userEmail, setUserEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!courseId) {
      toast.error('Select a course');
      return;
    }
    setLoading(true);
    try {
      await admin.enrollStudent({
        user_email: userEmail.trim(),
        course_id: Number(courseId),
      });
      toast.success('Student enrolled');
      setUserEmail('');
      setCourseId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enroll student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bux-form">
      <div className="ba-quiz-form__field">
        <label className="bux-label" htmlFor="enroll-email">
          Student email
        </label>
        <input
          id="enroll-email"
          type="email"
          className="bux-text-field"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          required
        />
      </div>
      <CourseSearchPicker
        id="enroll-course"
        label="Course"
        courses={courses}
        courseLabel={courseLabel}
        value={courseId}
        onChange={setCourseId}
      />
      <div className="ba-quiz-form__actions">
        <button type="submit" className="bux-button" disabled={loading || !courseId}>
          {loading ? 'Enrolling…' : 'Enroll student'}
        </button>
      </div>
    </form>
  );
}

export function AdminUnenrollStudentForm() {
  const { courses, courseLabel } = useAdminCourses();
  const [userEmail, setUserEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!courseId) {
      toast.error('Select a course');
      return;
    }
    if (!window.confirm(`Remove ${userEmail.trim()} from this course?`)) return;
    setLoading(true);
    try {
      await admin.unenrollStudent(Number(courseId), userEmail.trim());
      toast.success('Student unenrolled');
      setUserEmail('');
      setCourseId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unenroll student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bux-form">
      <div className="ba-quiz-form__field">
        <label className="bux-label" htmlFor="unenroll-email">
          Student email
        </label>
        <input
          id="unenroll-email"
          type="email"
          className="bux-text-field"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          required
        />
      </div>
      <CourseSearchPicker
        id="unenroll-course"
        label="Course"
        courses={courses}
        courseLabel={courseLabel}
        value={courseId}
        onChange={setCourseId}
      />
      <div className="ba-quiz-form__actions">
        <button type="submit" className="bux-button" disabled={loading || !courseId}>
          {loading ? 'Removing…' : 'Unenroll student'}
        </button>
      </div>
    </form>
  );
}

export function AdminDeleteCourseForm() {
  const { courses, courseLabel } = useAdminCourses();
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedCourse = courses.find((c) => String(c.id) === String(courseId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCourse) {
      toast.error('Select a course');
      return;
    }
    if (
      !window.confirm(
        `Permanently delete ${selectedCourse.code} — ${selectedCourse.title}? This removes enrollments and course content.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await admin.deleteCourse(Number(courseId));
      toast.success('Course deleted');
      setCourseId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bux-form">
      <p className="ba-quiz-form__hint">
        Permanently remove a course and its content. This cannot be undone.
      </p>
      <CourseSearchPicker
        id="delete-course"
        label="Course"
        courses={courses}
        courseLabel={courseLabel}
        value={courseId}
        onChange={setCourseId}
      />
      <div className="ba-quiz-form__actions">
        <button type="submit" className="bux-button" disabled={loading || !courseId}>
          {loading ? 'Deleting…' : 'Delete course'}
        </button>
      </div>
    </form>
  );
}

export function AdminCopyCourseForm() {
  const { courses, courseLabel } = useAdminCourses();
  const [instructors, setInstructors] = useState([]);
  const [sourceCourseId, setSourceCourseId] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [instructorEmail, setInstructorEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emails = [
      ...new Set(courses.map((c) => c.instructor_email).filter(Boolean)),
    ];
    setInstructors(emails);
  }, [courses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourceCourseId) {
      toast.error('Select a source course');
      return;
    }
    setLoading(true);
    try {
      const { course } = await admin.copyCourse({
        source_course_id: Number(sourceCourseId),
        new_code: newCode.trim(),
        new_title: newTitle.trim(),
        instructor_email: instructorEmail,
      });
      toast.success(`Created course ${course.code}`);
      setSourceCourseId('');
      setNewCode('');
      setNewTitle('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bux-form">
      <p className="ba-quiz-form__hint">
        Duplicate a course (concepts, questions, images). Enrollments are not copied.
      </p>
      <CourseSearchPicker
        id="copy-source"
        label="Source course"
        courses={courses}
        courseLabel={courseLabel}
        value={sourceCourseId}
        onChange={setSourceCourseId}
      />
      <div className="ba-quiz-form__row-2">
        <div className="ba-quiz-form__field">
          <label className="bux-label" htmlFor="copy-code">
            New course code
          </label>
          <input
            id="copy-code"
            className="bux-text-field"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            required
          />
        </div>
        <div className="ba-quiz-form__field">
          <label className="bux-label" htmlFor="copy-title">
            New title
          </label>
          <input
            id="copy-title"
            className="bux-text-field"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="ba-quiz-form__field">
        <label className="bux-label" htmlFor="copy-instructor">
          Owner (instructor email)
        </label>
        <input
          id="copy-instructor"
          className="bux-text-field"
          list="instructor-emails"
          value={instructorEmail}
          onChange={(e) => setInstructorEmail(e.target.value)}
          required
        />
        <datalist id="instructor-emails">
          {instructors.map((em) => (
            <option key={em} value={em} />
          ))}
        </datalist>
      </div>
      <div className="ba-quiz-form__actions">
        <button
          type="submit"
          className="bux-button"
          disabled={loading || !sourceCourseId}
        >
          {loading ? 'Copying…' : 'Duplicate course'}
        </button>
      </div>
    </form>
  );
}
