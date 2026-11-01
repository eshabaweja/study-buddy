import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../utils/toast';
import { analytics, admin } from '../../utils/api.js';
import { useAuth } from '../../contexts/AuthContext';

function CourseDetailAnalytics() {
  const { courseCode: courseIdOrCode } = useParams();
  const navigate = useNavigate();
  const { isInstructor, userEmail } = useAuth();
  const [activeDays, setActiveDays] = useState(30);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unenrolling, setUnenrolling] = useState(null);

  const fetchCourseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analytics.getCourseDetails(courseIdOrCode, activeDays);
      setCourseData(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch course details:', err);
    } finally {
      setLoading(false);
    }
  }, [courseIdOrCode, activeDays]);

  useEffect(() => {
    if (courseIdOrCode) {
      fetchCourseData();
    }
  }, [courseIdOrCode, fetchCourseData]);

  const canUnenroll =
    isInstructor &&
    courseData?.course?.instructor_email === userEmail;

  const handleUnenroll = async (e, studentEmail) => {
    e.stopPropagation();
    if (!courseData?.course?.id) return;
    if (!window.confirm(`Remove ${studentEmail} from this course?`)) return;

    setUnenrolling(studentEmail);
    try {
      await admin.instructorUnenrollStudent(courseData.course.id, studentEmail);
      toast.success('Student unenrolled');
      await fetchCourseData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unenroll student');
    } finally {
      setUnenrolling(null);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleRowClick = (studentEmail) => {
    navigate(`/analytics/students/${encodeURIComponent(studentEmail)}`);
  };

  const sortedStudents = [...(courseData?.students || [])].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    const fieldMap = {
      name: 'name',
      isActive: 'is_active',
      starredCount: 'starred_count',
      solvedCount: 'solved_count',
      unsolvedCount: 'unsolved_count',
      progressPercentage: 'progress_percentage',
    };

    const actualKey = fieldMap[sortConfig.key] || sortConfig.key;
    aValue = a[actualKey];
    bValue = b[actualKey];

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortConfig.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  if (loading) {
    return (
      <div className="sb-mar-top-sp-16">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="sb-button sb-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !courseData) {
    return (
      <div className="sb-mar-top-sp-16">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="sb-button sb-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>
        <div>{error || 'Course not found'}</div>
      </div>
    );
  }

  const SortableHeader = ({ sortKey, children }) => (
    <th onClick={() => handleSort(sortKey)} style={{ cursor: 'pointer' }}>
      {children}
      {sortConfig.key === sortKey && (
        <span className="sb-mar-left-sp-4">
          {sortConfig.direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  );

  return (
    <div className="sb-container">
      <div className="sb-mar-top-sp-16">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="sb-button sb-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>

        <h2>
          {courseData.course.code} - {courseData.course.title}
        </h2>

        <div className="sb-grid sb-grid--no-gutters sb-mar-top-sp-16">
          <div className="sb-grid__cell--3">
            <div>
              <div style={{ fontWeight: 'bold' }}>Total Enrolled</div>
              <div style={{ fontSize: '2rem', color: '#B12635' }}>
                {courseData.total_enrollments}
              </div>
            </div>
          </div>
          <div className="sb-grid__cell--3">
            <div>
              <div style={{ fontWeight: 'bold' }}>Total Questions</div>
              <div style={{ fontSize: '2rem', color: '#B12635' }}>
                {courseData.total_questions}
              </div>
            </div>
          </div>
        </div>

        <div className="sb-mar-top-sp-16">
          <h3>Student Progress</h3>
          <div className="sb-mar-top-sp-16" style={{ overflowX: 'auto' }}>
            <table className="sb-table">
              <thead>
                <tr>
                  <SortableHeader sortKey="name">Student Name</SortableHeader>
                  <SortableHeader sortKey="starredCount">Starred</SortableHeader>
                  <SortableHeader sortKey="solvedCount">Solved</SortableHeader>
                  <SortableHeader sortKey="unsolvedCount">Unsolved</SortableHeader>
                  <SortableHeader sortKey="progressPercentage">Progress</SortableHeader>
                  {canUnenroll && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student) => (
                  <tr
                    key={student.email}
                    onClick={() => handleRowClick(student.email)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{student.name}</td>
                    <td>{student.starred_count}</td>
                    <td>{student.solved_count}</td>
                    <td>{student.unsolved_count}</td>
                    <td>
                      <div style={{ fontWeight: 'bold' }}>{student.progress_percentage}%</div>
                      <div
                        className="sb-mar-top-sp-4"
                        style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#e0e0e0',
                          borderRadius: '4px',
                        }}
                      >
                        <div
                          style={{
                            width: `${student.progress_percentage}%`,
                            height: '100%',
                            backgroundColor: '#B12635',
                            borderRadius: '4px',
                          }}
                        />
                      </div>
                    </td>
                    {canUnenroll && (
                      <td>
                        <button
                          type="button"
                          className="sb-button sb-button--secondary sb-button--small"
                          disabled={unenrolling === student.email}
                          onClick={(e) => handleUnenroll(e, student.email)}
                        >
                          {unenrolling === student.email ? 'Removing…' : 'Unenroll'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CourseDetailAnalytics;
