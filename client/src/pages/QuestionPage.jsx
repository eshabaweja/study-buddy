import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from '../utils/toast';
import Question from "../components/Question";
import QuestionGrid from "../components/QuestionGrid";
import Announcement from "../components/Announcement";
import { QuestionInstructorEditPanel } from "../components/questions/QuestionInstructorControls";
import {
  useQuestionCanEdit,
  useQuestionDelete,
} from "../components/questions/questionInstructorHooks";
import { questions } from "../utils/api";

function resolveQuestionIndex(list, param, navigate, courseCode) {
  const parsed = parseInt(param, 10);
  if (Number.isNaN(parsed) || list.length === 0) return 0;

  const byId = list.findIndex((q) => q.id === parsed);
  if (byId >= 0) return byId;

  // Legacy URLs used 1-based list position instead of database id
  if (parsed >= 1 && parsed <= list.length && !list.some((q) => q.id === parsed)) {
    const legacyIdx = parsed - 1;
    const legacyQuestion = list[legacyIdx];
    if (legacyQuestion) {
      navigate(`/concepts/${courseCode}/${legacyQuestion.id}`, { replace: true });
      return legacyIdx;
    }
  }

  return 0;
}

const QuestionPage = () => {
  const { courseCode, questionId: questionIdParam } = useParams();
  const navigate = useNavigate();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionIds, setQuestionIds] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({ published: 0, course: 0 });
  const [fullQuestion, setFullQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [lastMovedQuestionId, setLastMovedQuestionId] = useState(null);

  const activeQuestion = questionIds[currentQuestionIndex];
  const activeQuestionId = activeQuestion?.id;
  const canEdit = useQuestionCanEdit(activeQuestionId);

  const reloadQuestionList = useCallback(async () => {
    if (!courseCode) return { list: [], counts: { published: 0, course: 0 } };
    const data = await questions.getByCourse(courseCode);
    return {
      list: data.questions || [],
      counts: data.counts || { published: 0, course: 0 },
    };
  }, [courseCode]);

  const reloadFullQuestion = useCallback(async (qId) => {
    const data = await questions.getFull(qId);
    setFullQuestion(data.question);
  }, []);

  useEffect(() => {
    if (!courseCode) return;
    setLoading(true);
    reloadQuestionList()
      .then(({ list, counts }) => {
        setQuestionIds(list);
        setQuestionCounts(counts);
        const initialIndex = resolveQuestionIndex(list, questionIdParam, navigate, courseCode);
        setCurrentQuestionIndex(initialIndex);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [courseCode, questionIdParam, listRefreshKey, reloadQuestionList, navigate]);

  useEffect(() => {
    if (questionIds.length === 0) {
      setFullQuestion(null);
      return;
    }
    const qId = questionIds[currentQuestionIndex].id;
    setLoading(true);
    setIsEditing(false);
    questions
      .getFull(qId)
      .then((data) => {
        setFullQuestion(data.question);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [questionIds, currentQuestionIndex]);

  const navigateToQuestion = (index) => {
    const q = questionIds[index];
    if (!q) return;
    setCurrentQuestionIndex(index);
    navigate(`/concepts/${courseCode}/${q.id}`);
  };

  const handlePrevious = () => {
    navigateToQuestion(Math.max(0, currentQuestionIndex - 1));
  };

  const handleNext = () => {
    navigateToQuestion(Math.min(questionIds.length - 1, currentQuestionIndex + 1));
  };

  const handleDeleted = useCallback(async () => {
    const { list, counts } = await reloadQuestionList();
    if (list.length === 0) {
      navigate(`/concepts/${courseCode}`);
      return;
    }
    const nextIndex = Math.min(currentQuestionIndex, list.length - 1);
    setQuestionIds(list);
    setQuestionCounts(counts);
    setCurrentQuestionIndex(nextIndex);
    setListRefreshKey((k) => k + 1);
    navigate(`/concepts/${courseCode}/${list[nextIndex].id}`);
  }, [courseCode, currentQuestionIndex, navigate, reloadQuestionList]);

  const handleDelete = useQuestionDelete({
    questionId: activeQuestionId,
    canEdit,
    onDeleted: handleDeleted,
  });

  const handleReorder = useCallback(async (reordered, movedQuestionId) => {
    setReordering(true);
    const activeId = activeQuestionId;
    try {
      const { questions: saved, counts } = await questions.reorder(
        courseCode,
        reordered.map((q) => q.id),
      );
      setQuestionIds(saved);
      setQuestionCounts(counts || questionCounts);
      const newIndex = saved.findIndex((q) => q.id === activeId);
      if (newIndex >= 0) {
        setCurrentQuestionIndex(newIndex);
      }
      setLastMovedQuestionId(movedQuestionId);
      toast.success('Question order updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder questions');
      const { list, counts } = await reloadQuestionList();
      setQuestionIds(list);
      setQuestionCounts(counts);
      setLastMovedQuestionId(null);
    } finally {
      setReordering(false);
    }
  }, [activeQuestionId, courseCode, questionCounts, reloadQuestionList]);

  const handlePublishedChange = useCallback(async (published) => {
    setFullQuestion((prev) => (prev ? { ...prev, published } : prev));
    toast.success(published ? 'Question published' : 'Question unpublished');
    const { list, counts } = await reloadQuestionList();
    setQuestionIds(list);
    setQuestionCounts(counts);
    const newIndex = list.findIndex((q) => q.id === activeQuestionId);
    if (newIndex >= 0) {
      setCurrentQuestionIndex(newIndex);
    }
    setGridRefreshKey((k) => k + 1);
  }, [activeQuestionId, reloadQuestionList]);

  if (loading && !fullQuestion) {
    return <div className="bux-container">Loading question...</div>;
  }
  if (error) return <div className="bux-container">Error: {error}</div>;
  if (!fullQuestion) {
    return <div className="bux-container">No question found.</div>;
  }

  return (
    <div className="bux-container">
      <Announcement>
        <p className="ba-announcement__text">
          Feedback on this question? Share your thoughts{" "}
          <a
            href="https://forms.office.com/r/BHqcCJb37C"
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </a>
          . How was your app experience?{" "}
          <a
            href="https://forms.office.com/r/qwxt92jLzP"
            target="_blank"
            rel="noopener noreferrer"
          >
            Let us know
          </a>
          .
        </p>
      </Announcement>
      <QuestionGrid
        questions={questionIds}
        currentIndex={currentQuestionIndex}
        onSelect={navigateToQuestion}
        refreshKey={gridRefreshKey}
        canReorder={canEdit}
        onReorder={handleReorder}
        reordering={reordering}
        lastMovedQuestionId={lastMovedQuestionId}
      />
      {isEditing ? (
        <QuestionInstructorEditPanel
          questionId={activeQuestionId}
          courseCode={courseCode}
          initialQuestion={fullQuestion}
          onSaved={async () => {
            setIsEditing(false);
            await reloadFullQuestion(activeQuestionId);
            setGridRefreshKey((k) => k + 1);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <Question
          question={fullQuestion}
          onPrevious={handlePrevious}
          onNext={handleNext}
          currentIndex={currentQuestionIndex}
          totalQuestions={questionIds.length}
          studentNumber={activeQuestion?.student_number}
          courseNumber={activeQuestion?.course_number}
          publishedCount={questionCounts.published}
          courseCount={questionCounts.course}
          onSolvedChange={() => setGridRefreshKey((k) => k + 1)}
          onStarredChange={() => setGridRefreshKey((k) => k + 1)}
          viewAsStudent
          canEdit={canEdit}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
          onDelete={handleDelete}
          onPublishedChange={handlePublishedChange}
        />
      )}
      <Link to="/concepts" className="bux-link">
        Back to Courses
      </Link>
    </div>
  );
};

export default QuestionPage;
