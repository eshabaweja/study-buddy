import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { studentProgress } from '../utils/api';
import { apiErrorMessage, isSessionReloginError } from '../utils/sessionAuth';
import CourseCard from '../components/CourseCard';
import ProgressBar from '../components/ProgressBar';

function StudentPage() {
  const { isAuthenticated } = useAuth();
  const [trackedCourses, setTrackedCourses] = useState([]);
  const [solvedQuestions, setSolvedQuestions] = useState([]);
  const [courseConcepts, setCourseConcepts] = useState({}); // Map of course code to concepts
  const [conceptProgress, setConceptProgress] = useState({}); // Map of concept ID to progress data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudentProgress = async () => {
      if (!isAuthenticated) return;
      
      try {
        const [coursesRes, questionsRes] = await Promise.all([
          studentProgress.getCourses(),
          studentProgress.getSolvedQuestions()
        ]);
        setTrackedCourses(coursesRes.courses);
        setSolvedQuestions(questionsRes.questions);

        // Fetch concepts for each tracked course
        const conceptsPromises = coursesRes.courses.map(async (course) => {
          try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/courses_concepts/${course.code}`);
            if (!response.ok) throw new Error(`Error fetching concepts for ${course.code}`);
            const data = await response.json();
            return { courseCode: course.code, concepts: data.concepts };
          } catch (err) {
            console.error(`Error fetching concepts for ${course.code}:`, err);
            return { courseCode: course.code, concepts: [] };
          }
        });

        const conceptsResults = await Promise.all(conceptsPromises);
        const conceptsMap = conceptsResults.reduce((acc, { courseCode, concepts }) => {
          acc[courseCode] = concepts;
          return acc;
        }, {});
        setCourseConcepts(conceptsMap);

        // Calculate progress for each concept
        const progressMap = {};
        for (const { courseCode, concepts } of conceptsResults) {
          for (const concept of concepts) {
            // Get all questions for this concept
            const conceptQuestionsRes = await fetch(
              `${import.meta.env.VITE_API_URL}/questions/${courseCode}/concept/${concept.id}`
            );
            if (!conceptQuestionsRes.ok) continue;
            const { questions: conceptQuestions } = await conceptQuestionsRes.json();
            
            // Count solved questions for this concept
            const solvedCount = questionsRes.questions.filter(q => 
              conceptQuestions.some(cq => cq.id === q.id)
            ).length;

            progressMap[concept.id] = {
              total: conceptQuestions.length,
              solved: solvedCount,
              percentage: conceptQuestions.length > 0 
                ? Math.round((solvedCount / conceptQuestions.length) * 100)
                : 0
            };
          }
        }
        setConceptProgress(progressMap);
      } catch (err) {
        if (isSessionReloginError(err)) return;
        console.error('Error fetching student progress:', err);
        setError(apiErrorMessage(err, 'Failed to load progress'));
      } finally {
        setLoading(false);
      }
    };

    fetchStudentProgress();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="bux-container">
        <p>Please log in to view your dashboard.</p>
      </div>
    );
  }

  if (loading) return <div className="bux-container">Loading your progress...</div>;
  if (error) return <div className="bux-container">Error: {error}</div>;

  return (
    <div className="ba-dashboard">
      <div className="bux-grid bux-mar-bottom-sp-16">
          <h3 className="bux-grid__cell--12@sm bux-grid__cell--6@md">My Courses</h3>
          <h3 className="bux-grid__cell--6@md mobile-hidden">My Concepts</h3>

          {trackedCourses.length > 0 ? (
            <>
              {trackedCourses.map((course) => (
                <div key={course.id} className="bux-grid bux-grid__cell--12 bux-mar-bottom-sp-16">
                  <div className="bux-grid__cell bux-grid__cell--12@sm bux-grid__cell--6@md">
                    <CourseCard course={course} onDashboard />
                  </div>
                  <div className="bux-grid__cell bux-grid__cell--12@sm bux-grid__cell--6@md">
                    {courseConcepts[course.code]?.length > 0 ? (
                      <div className="bux-grid">
                        {courseConcepts[course.code].map((concept) => {
                          const progress = conceptProgress[concept.id] || { percentage: 0, solved: 0, total: 0 };
                          return (
                            <ProgressBar 
                              key={concept.id}
                              name={`${concept.name} (${progress.solved}/${progress.total})`}
                              progress={progress.percentage}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p>No concepts available for this course yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="bux-mar-top-sp-16">
              You haven't started tracking any courses yet. 
              <Link to="/concepts" className="bux-link bux-mar-left-sp-8">
                Browse available courses
              </Link>
            </p>
          )}
      </div>
    </div>
  );
}

export default StudentPage; 