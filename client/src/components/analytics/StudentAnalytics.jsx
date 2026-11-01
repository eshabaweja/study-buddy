import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics } from '../../utils/api.js';
import { apiErrorMessage } from '../../utils/sessionAuth';

function StudentAnalytics() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const data = await analytics.getStudents();
        setStudents(data.students);
      } catch (err) {
        const message = apiErrorMessage(err, 'Failed to load students');
        if (message) setError(message);
        console.error('Failed to fetch students:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      const haystack = [student.full_name, student.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [students, searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const handleClear = () => {
    setSearchQuery('');
    setHasSearched(false);
  };

  const handleRowClick = (studentEmail) => {
    navigate(`/analytics/students/${encodeURIComponent(studentEmail)}`);
  };

  if (loading) {
    return (
      <div className="ba-analytics">
        <h3 className="ba-analytics__title">Student Analytics</h3>
        <p className="ba-analytics__hint">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ba-analytics">
        <h3 className="ba-analytics__title">Student Analytics</h3>
        <p className="ba-analytics__hint">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="ba-analytics">
      <h3 className="ba-analytics__title">Student Analytics</h3>

      <form onSubmit={handleSearch} className="ba-quiz-form__section ba-analytics__search">
        <div className="ba-quiz-form__field">
          <label className="bux-label" htmlFor="student-analytics-search">
            Search students
          </label>
          <input
            id="student-analytics-search"
            type="search"
            className="bux-text-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name or email"
          />
        </div>
        <div className="ba-quiz-form__actions">
          <button type="submit" className="bux-button">
            Search
          </button>
          <button
            type="button"
            className="bux-button bux-button--secondary"
            onClick={() => {
              setSearchQuery('');
              setHasSearched(true);
            }}
          >
            Show all
          </button>
          {hasSearched && (
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {!hasSearched && (
        <p className="ba-analytics__hint">
          Search by student name or email to view analytics.
        </p>
      )}

      {hasSearched && (
        <div className="ba-analytics__results">
          {filteredStudents.length === 0 ? (
            <p className="ba-analytics__empty">No students match your search.</p>
          ) : (
            <div className="bux-table-container">
              <table className="bux-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Courses Enrolled</th>
                    <th>Questions Solved</th>
                    <th>Questions Starred</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr key={student.email} onClick={() => handleRowClick(student.email)}>
                      <td>{index + 1}</td>
                      <td>{student.full_name}</td>
                      <td>{student.email}</td>
                      <td>{student.courses_enrolled || 0}</td>
                      <td>{student.questions_solved || 0}</td>
                      <td>{student.questions_starred || 0}</td>
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

export default StudentAnalytics;
