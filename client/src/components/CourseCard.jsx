import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { studentProgress, questions } from '../utils/api';

function getInstructorBadgeLabel(course) {
  if (course.instructor_name?.trim()) return course.instructor_name.trim();
  if (course.instructor_email) return course.instructor_email;
  return null;
}

const CourseCard = ({ course, onDashboard = false }) => {
  const navigate = useNavigate();
  const { isAuthenticated, isInstructor } = useAuth();
  const [isTracked, setIsTracked] = useState(onDashboard);
  const [isLoading, setIsLoading] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [progressFraction, setProgressFraction] = useState({ solved: 0, total: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Check if course is tracked and calculate progress
  useEffect(() => {
    const checkProgress = async () => {
      if (!isAuthenticated || isInstructor) return;
      try {
        // Get tracked courses
        const { courses } = await studentProgress.getCourses();
        setIsTracked(
          onDashboard ||
            courses.some((c) => Number(c.id) === Number(course.id)),
        );

        // Get solved questions for this course
        const { questions: solvedQuestions } = await studentProgress.getSolvedQuestions();
        const solvedInCourse = solvedQuestions.filter(
          (q) => q.course_id === course.id || q.course_code === course.code,
        );

        // Get total questions for this course offering
        const { questions: allQuestions } = course.id
          ? await questions.getByCourseId(course.id)
          : await questions.getByCourse(course.code);
        
        // Calculate percentage and fraction
        const percentage = allQuestions.length > 0 
          ? Math.round((solvedInCourse.length / allQuestions.length) * 100)
          : 0;
        
        setProgressPercentage(percentage);
        setProgressFraction({
          solved: solvedInCourse.length,
          total: allQuestions.length
        });
      } catch (err) {
        console.error('Error checking course progress:', err);
      }
    };
    checkProgress();
  }, [course.id, course.code, isAuthenticated, isInstructor, onDashboard]);

  const handleTrackToggle = async (e) => {
    e.stopPropagation(); // Prevent card click when clicking button
    if (!isAuthenticated || isInstructor) return;
    
    // If untracking, ask for confirmation first
    if (isTracked) {
      const confirmed = window.confirm(`Are you sure you want to remove ${course.code} from your tracked courses?`);
      if (!confirmed) return;
    }
    
    setIsLoading(true);
    try {
      if (isTracked) {
        await studentProgress.removeCourseById(course.id);
        setIsTracked(false);
      } else {
        await studentProgress.addCourseById(course.id);
        setIsTracked(true);
      }
    } catch (err) {
      console.error('Error toggling course tracking:', err);
      // Revert state if the API call fails
      setIsTracked(!isTracked);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = () => {
    if (course.published) {
      navigate(`/concepts/${course.code}`);
    }
  };

  const instructorLabel = getInstructorBadgeLabel(course);

  return (
    <div 
      className={`ba-card ${!course.published ? 'ba-card--unpublished' : ''}`}
      onClick={handleCardClick}
    >
      {(instructorLabel || !course.published) && (
        <div className="ba-card__badges">
          {!course.published && (
            <span className="ba-card__badge ba-card__badge--unpublished">Unpublished</span>
          )}
          {instructorLabel && (
            <span
              className="ba-card__badge ba-card__badge--instructor"
              title={course.instructor_email || instructorLabel}
            >
              {instructorLabel}
            </span>
          )}
        </div>
      )}
      <div
        className={`ba-card__content${instructorLabel || !course.published ? ' ba-card__content--badged' : ''}`}
      >
        <div className="ba-card__heading">
          <span>
            {!course.code.startsWith('MATH') && `${course.code} - `}{course.title}
          </span>
        </div>
        {isAuthenticated && !isInstructor && course.published && (<>
          <button
            className={`${isTracked ? 'bux-button--small' : 'bux-button--alt-small'} bux-mar-top-sp-8`}
            onClick={handleTrackToggle}
            disabled={isLoading}
          >
            {isLoading ? '...' : isTracked ? '🗑️ Remove' : '📚 Add to Dashboard'}
          </button>
          {(isTracked || onDashboard) && course.id && (
            <>
              <button
                type="button"
                className="bux-button--small bux-mar-left-sp-8"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/quizzes/${course.id}`);
                }}
              >
                Quizzes
              </button>
              <small
                className="bux-mar-left-sp-8 bux-button--alt-small"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                {isHovering
                  ? `${progressFraction.solved}/${progressFraction.total} Solved`
                  : `${progressPercentage}% Done`}
              </small>
            </>
          )}
        </>)}
      </div>
    </div>
  );
};

export default CourseCard; 