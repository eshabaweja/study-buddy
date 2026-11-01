import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { analytics } from '../../utils/api';
import QuestionGrid from '../QuestionGrid';

function StudentDetailAnalytics() {
  const { studentEmail } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    analytics.getStudentDetails(studentEmail)
      .then((data) => {
        setStudentData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [studentEmail]);

  if (loading) {
    return (
      <div className="bux-mar-top-sp-16">
        <button 
          onClick={() => navigate('/dashboard')}
          className="bux-button bux-button--secondary bux-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>
        <div>Loading student data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bux-mar-top-sp-16">
        <button 
          onClick={() => navigate('/dashboard')}
          className="bux-button bux-button--secondary bux-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>
        <div>Error loading student data: {error}</div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="bux-mar-top-sp-16">
        <button 
          onClick={() => navigate('/dashboard')}
          className="bux-button bux-button--secondary bux-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>
        <div>Student not found</div>
      </div>
    );
  }

  const activeCourse = studentData.courses && studentData.courses.length > 0 
    ? studentData.courses[activeTab] 
    : null;
  
  // Build solved and starred ID sets for QuestionGrid
  const solvedIds = new Set(
    (activeCourse?.questions || [])
      .filter(q => q.is_solved)
      .map(q => q.id)
  );
  const starredIds = new Set(
    (activeCourse?.questions || [])
      .filter(q => q.is_starred)
      .map(q => q.id)
  );

  return (
    <div className="bux-container">
      <div className="bux-mar-top-sp-16">
        <button 
          onClick={() => navigate('/dashboard')}
          className="bux-button bux-button--secondary bux-mar-bottom-sp-16"
        >
          ← Back to Dashboard
        </button>
        
        <h2>{studentData.student.name}</h2>
        <small className="bux-text-sm bux-text-muted">{studentData.student.email}</small>

        {!studentData.courses || studentData.courses.length === 0 ? (
          <div className="bux-mar-top-sp-16">
            <p>No courses found for this student</p>
          </div>
        ) : (
          <>
            {/* Course Tabs */}
            <div className="bux-mar-top-sp-16">
              {studentData.courses.map((course, index) => (
                <h4
                  key={course.code}
                  onClick={() => setActiveTab(index)}
                >
                  {course.code ? `${course.code} - ` : ''}{course.title}
                </h4>
              ))}
            </div>

            {/* Active Course Stats */}
            {activeCourse && (
              <>
                <div className="bux-grid bux-grid--no-gutters bux-mar-top-sp-16">
                  <div className="bux-grid__cell--12 bux-grid__cell--4@md">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Progress</div>
                      <div style={{ fontSize: '2rem', color: '#B12635' }}>{activeCourse.progress_percentage}%</div>
                    </div>
                  </div>
                  <div className="bux-grid__cell--12 bux-grid__cell--4@md">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Solved Questions</div>
                      <div style={{ fontSize: '2rem', color: '#B12635' }}>{activeCourse.solved_count}</div>
                    </div>
                  </div>
                  <div className="bux-grid__cell--12 bux-grid__cell--4@md">
                    <div>
                      <div style={{ fontWeight: 'bold' }}>Starred Questions</div>
                      <div style={{ fontSize: '2rem', color: '#B12635' }}>{activeCourse.starred_count}</div>
                    </div>
                  </div>
                </div>

                {/* Question Grid */}
                {activeCourse.questions && activeCourse.questions.length > 0 && (
                  <div className="bux-mar-top-sp-24">
                    <h4>Questions Overview</h4>
                    <p className="bux-text-sm bux-text-muted">
                      Green = Solved, Yellow = Starred for Review
                    </p>
                    <QuestionGrid
                      questions={activeCourse.questions.map((q, idx) => ({
                        ...q,
                        student_number: q.student_number ?? idx + 1,
                        course_number: q.course_number ?? idx + 1,
                      }))}
                      currentIndex={null}
                      onSelect={(idx) => {
                        const question = activeCourse.questions[idx];
                        navigate(`/concepts/${activeCourse.code}/${question.id}`);
                      }}
                      solvedIds={solvedIds}
                      starredIds={starredIds}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StudentDetailAnalytics;
