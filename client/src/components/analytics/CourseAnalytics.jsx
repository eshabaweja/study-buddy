import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../../utils/api.js';
import { apiErrorMessage } from '../../utils/sessionAuth';

function CourseAnalytics({ showInstructor = false }) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const data = await analytics.getCourses();
        setCourses(data.courses);
      } catch (err) {
        const message = apiErrorMessage(err, 'Failed to load courses');
        if (message) setError(message);
        console.error('Failed to fetch courses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && course.published) ||
        (statusFilter === 'unpublished' && !course.published);

      if (!query) return matchesStatus;

      const haystack = [
        course.code,
        course.title,
        course.instructor_name,
        course.instructor_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && haystack.includes(query);
    });
  }, [courses, searchQuery, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const handleClear = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setHasSearched(false);
  };

  const handleRowClick = (course) => {
    navigate(`/analytics/courses/${course.id}`);
  };

  if (loading) {
    return (
      <div className="app-analytics">
        <h3 className="app-analytics__title">Course Analytics</h3>
        <p className="app-analytics__hint">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-analytics">
        <h3 className="app-analytics__title">Course Analytics</h3>
        <p className="app-analytics__hint">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="app-analytics">
      <h3 className="app-analytics__title">Course Analytics</h3>

      <form onSubmit={handleSearch} className="app-quiz-form__section app-analytics__search">
        <div className="app-quiz-form__row-2">
          <div className="app-quiz-form__field">
            <label className="sb-label" htmlFor="course-analytics-search">
              Search courses
            </label>
            <input
              id="course-analytics-search"
              type="search"
              className="sb-text-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Code, title, or instructor"
            />
          </div>
          <div className="app-quiz-form__field">
            <label className="sb-label" htmlFor="course-analytics-status">
              Status
            </label>
            <select
              id="course-analytics-status"
              className="sb-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>
        </div>
        <div className="app-quiz-form__actions">
          <button type="submit" className="sb-button">
            Search
          </button>
          <button
            type="button"
            className="sb-button sb-button--secondary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setHasSearched(true);
            }}
          >
            Show all
          </button>
          {hasSearched && (
            <button
              type="button"
              className="sb-button sb-button--secondary"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {!hasSearched && (
        <p className="app-analytics__hint">
          Search by course code, title, or instructor to view analytics.
        </p>
      )}

      {hasSearched && (
        <div className="app-analytics__results">
          {filteredCourses.length === 0 ? (
            <p className="app-analytics__empty">No courses match your search.</p>
          ) : (
            <div className="sb-table-container">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th>Course Name</th>
                    {showInstructor && <th>Instructor</th>}
                    <th>Total Enrollments</th>
                    <th>Total Questions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course) => (
                    <tr key={course.id} onClick={() => handleRowClick(course)}>
                      <td>{course.code ? `${course.code} - ${course.title}` : course.title}</td>
                      {showInstructor && (
                        <td>{course.instructor_name || course.instructor_email || '—'}</td>
                      )}
                      <td>{course.total_enrollments || 0}</td>
                      <td>{course.total_questions || 0}</td>
                      <td>{course.published ? 'Published' : 'Unpublished'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CourseAnalytics;
