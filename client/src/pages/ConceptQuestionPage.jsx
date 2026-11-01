import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from '../utils/toast';
import Question from "../components/Question";
import QuestionGrid from "../components/QuestionGrid";
import { QuestionInstructorEditPanel } from "../components/questions/QuestionInstructorControls";
import {
  useQuestionCanEdit,
  useQuestionDelete,
} from "../components/questions/questionInstructorHooks";
import { questions } from "../utils/api";

const ConceptQuestionPage = () => {
  const { courseCode, conceptId } = useParams();
  const [questionIds, setQuestionIds] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({ published: 0, course: 0 });
  const [fullQuestion, setFullQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const activeQuestion = questionIds[currentQuestionIndex];
  const activeQuestionId = activeQuestion?.id;
  const canEdit = useQuestionCanEdit(activeQuestionId);

  const reloadQuestionList = useCallback(async () => {
    const data = await questions.getByConcept(courseCode, conceptId);
    return {
      list: data.questions || [],
      counts: data.counts || { published: 0, course: 0 },
    };
  }, [courseCode, conceptId]);

  const reloadFullQuestion = useCallback(async (qId) => {
    const data = await questions.getFull(qId);
    setFullQuestion(data.question);
  }, []);

  useEffect(() => {
    if (!courseCode || !conceptId) return;
    setLoading(true);
    reloadQuestionList()
      .then(({ list, counts }) => {
        setQuestionIds(list);
        setQuestionCounts(counts);
        setCurrentQuestionIndex(0);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [courseCode, conceptId, listRefreshKey, reloadQuestionList]);

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

  const handlePrevious = () => {
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentQuestionIndex((prev) => Math.min(questionIds.length - 1, prev + 1));
  };

  const handleDeleted = useCallback(async () => {
    const { list, counts } = await reloadQuestionList();
    if (list.length === 0) {
      setQuestionIds([]);
      setFullQuestion(null);
      return;
    }
    const nextIndex = Math.min(currentQuestionIndex, list.length - 1);
    setQuestionIds(list);
    setQuestionCounts(counts);
    setCurrentQuestionIndex(nextIndex);
    setListRefreshKey((k) => k + 1);
  }, [currentQuestionIndex, reloadQuestionList]);

  const handleDelete = useQuestionDelete({
    questionId: activeQuestionId,
    canEdit,
    onDeleted: handleDeleted,
  });

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

  if (loading && !fullQuestion) return <div>Loading question...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!fullQuestion) return <div>No question found.</div>;

  return (
    <div className="bux-container">
      <QuestionGrid
        questions={questionIds}
        currentIndex={currentQuestionIndex}
        onSelect={(idx) => setCurrentQuestionIndex(idx)}
        refreshKey={gridRefreshKey}
        canReorder={canEdit}
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
      <Link to={`/concepts/${courseCode}`} className="bux-link">
        Back to Concepts
      </Link>
    </div>
  );
};

export default ConceptQuestionPage;
