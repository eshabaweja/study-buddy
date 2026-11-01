import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from '../utils/toast';
import { useAuth } from "../contexts/AuthContext";
import ConceptFlashcard from "../components/ConceptFlashcard";
import ConceptSortableGrid from "../components/ConceptSortableGrid";
import ImageCarousel from "../components/ImageCarousel";
import { courseConcepts, questions, quizzes as quizzesApi } from "../utils/api";
import { fetchInstructorCoursesSorted } from "../utils/instructorCourses";

function ConceptLearn() {
  const { courseCode } = useParams();
  const { isInstructor } = useAuth();
  const [concepts, setConcepts] = useState([]);
  const [courseImages, setCourseImages] = useState([]);
  const [practiceHref, setPracticeHref] = useState(null);
  const [canReorder, setCanReorder] = useState(false);
  const [courseQuizzes, setCourseQuizzes] = useState([]);
  const [reordering, setReordering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConcepts = useCallback(async () => {
    const data = await courseConcepts.getByCourse(courseCode);
    setConcepts(data.concepts || []);
  }, [courseCode]);

  useEffect(() => {
    if (!courseCode) return;
    setLoading(true);

    Promise.all([
      courseConcepts.getByCourse(courseCode),
      fetch(`${import.meta.env.VITE_API_URL}/course_images/${courseCode}`),
      questions.getByCourse(courseCode).catch(() => ({ questions: [] })),
    ])
      .then(([conceptsData, imagesRes, questionsData]) => {
        if (!imagesRes.ok) {
          throw new Error(`Error fetching course images. Status: ${imagesRes.status}`);
        }
        return imagesRes.json().then((imagesData) => ({
          conceptsData,
          imagesData,
          questionsData,
        }));
      })
      .then(({ conceptsData, imagesData, questionsData }) => {
        setConcepts(conceptsData.concepts || []);
        setCourseImages(imagesData.images.map((img) => img.image_url));
        const first = questionsData.questions?.[0];
        if (first?.id) {
          setPracticeHref(`/concepts/${courseCode}/${first.id}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [courseCode]);

  useEffect(() => {
    if (!isInstructor || !courseCode) {
      setCanReorder(false);
      return;
    }
    fetchInstructorCoursesSorted()
      .then((courses) => {
        const owned = courses.find((c) => c.code === courseCode);
        setCanReorder(Boolean(owned));
        if (owned?.id) {
          quizzesApi
            .listForCourseInstructor(owned.id)
            .then((data) => setCourseQuizzes(data.quizzes || []))
            .catch(() => setCourseQuizzes([]));
        } else {
          setCourseQuizzes([]);
        }
      })
      .catch(() => {
        setCanReorder(false);
        setCourseQuizzes([]);
      });
  }, [isInstructor, courseCode]);

  const handleReorder = async (reordered) => {
    setConcepts(reordered);
    setReordering(true);
    try {
      const { concepts: saved } = await courseConcepts.reorder(
        courseCode,
        reordered.map((c) => c.id),
      );
      setConcepts(saved);
      toast.success("Concept order updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder concepts");
      await loadConcepts();
    } finally {
      setReordering(false);
    }
  };

  if (loading) return <div>Loading concepts...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="sb-container">
      <h2 className="sb-mar-top-sp-16">Concepts for {courseCode}</h2>
      <p className="sb-mar-top-sp-16">
        After learning, you can practice them here:{" "}
        {practiceHref ? (
          <Link to={practiceHref} className="sb-button--small">
            Concept Crunch
          </Link>
        ) : (
          <span>No published practice questions yet.</span>
        )}
      </p>

      {canReorder && courseQuizzes.length > 0 && (
        <div className="sb-mar-top-sp-16">
          <h3 className="sb-card__heading">Course quizzes</h3>
          <ul className="sb-list-ul app-quiz-manage-list sb-mar-top-sp-8">
            {courseQuizzes.map((quiz) => (
              <li key={quiz.id} className="app-quiz-manage-list__item">
                <Link
                  className="sb-link app-quiz-manage-list__title"
                  to={`/instructor/quizzes/${quiz.id}/edit`}
                >
                  {quiz.title}
                </Link>
                <span className="app-quiz-manage-list__meta">
                  ({quiz.status || "—"})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canReorder && concepts.length > 0 && (
        <p className="sb-mar-top-sp-8 app-concept-sortable-hint">
          Drag concepts by the handle to reorder them for students.
        </p>
      )}

      {courseImages.length > 0 && (
        <div className="sb-mar-top-sp-32">
          <ImageCarousel images={courseImages} />
        </div>
      )}

      <div className="sb-mar-top-sp-32">
        {concepts.length ? (
          canReorder ? (
            <ConceptSortableGrid
              concepts={concepts}
              onReorder={handleReorder}
              disabled={reordering}
            />
          ) : (
            <div className="app-grid-layout">
              {concepts.map((concept) => (
                <ConceptFlashcard key={concept.id} concept={concept} />
              ))}
            </div>
          )
        ) : (
          <p>No concepts available for this course.</p>
        )}
      </div>
    </div>
  );
}

export default ConceptLearn;
