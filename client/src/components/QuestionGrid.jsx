import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "../contexts/AuthContext";
import { studentProgress } from "../utils/api";

function gridLabel(q, isInstructor) {
  if (isInstructor) {
    return q.course_number ?? "?";
  }
  return q.student_number ?? "?";
}

function gridTitle(q, isInstructor) {
  const base = isInstructor
    ? `Course #${q.course_number ?? "?"}`
    : `Question ${q.student_number ?? "?"}`;
  const unpublished = q.published === false ? " (unpublished)" : "";
  const studentHint = isInstructor && q.student_number != null
    ? ` — Student #${q.student_number}`
    : "";
  return `${base}${studentHint}${unpublished}`;
}

function getCellClasses({ q, idx, currentIndex, solvedIds, starredIds, canReorder, lastMovedQuestionId }) {
  const id = q.id;
  const isSolved = solvedIds.has(id);
  const isStarred = starredIds.has(id);
  const isUnpublished = q.published === false;
  const isLastMoved = lastMovedQuestionId != null && id === lastMovedQuestionId;
  return [
    "app-question-grid__item",
    isSolved ? "app-question-grid__item--solved" : "",
    isStarred ? "app-question-grid__item--starred" : "",
    isUnpublished ? "app-question-grid__item--unpublished" : "",
    idx === currentIndex ? "app-question-grid__item--current" : "",
    canReorder ? "app-question-grid__item--draggable" : "",
    isLastMoved ? "app-question-grid__item--last-moved" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function QuestionGridCell({
  q,
  idx,
  currentIndex,
  onSelect,
  showInstructorNumbers,
  solvedIds,
  starredIds,
  canReorder,
  lastMovedQuestionId,
}) {
  const classes = getCellClasses({
    q, idx, currentIndex, solvedIds, starredIds, canReorder, lastMovedQuestionId,
  });

  return (
    <div className="app-question-grid__cell">
      <button
        className={classes}
        onClick={() => onSelect && onSelect(idx)}
        aria-label={gridTitle(q, showInstructorNumbers)}
        title={gridTitle(q, showInstructorNumbers)}
        type="button"
      >
        <span className="app-question-grid__number">
          {gridLabel(q, showInstructorNumbers)}
        </span>
      </button>
    </div>
  );
}

function SortableQuestionGridCell({
  q,
  idx,
  currentIndex,
  onSelect,
  showInstructorNumbers,
  solvedIds,
  starredIds,
  canReorder,
  lastMovedQuestionId,
}) {
  const id = q.id;
  const classes = getCellClasses({
    q, idx, currentIndex, solvedIds, starredIds, canReorder, lastMovedQuestionId,
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "app-question-grid__cell",
        isDragging ? "app-question-grid__cell--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        className={classes}
        onClick={() => onSelect && onSelect(idx)}
        aria-label={gridTitle(q, showInstructorNumbers)}
        title={
          lastMovedQuestionId === q.id
            ? `${gridTitle(q, showInstructorNumbers)} — last moved`
            : `${gridTitle(q, showInstructorNumbers)} — drag to reorder`
        }
        type="button"
        {...attributes}
        {...listeners}
      >
        <span className="app-question-grid__number">
          {gridLabel(q, showInstructorNumbers)}
        </span>
      </button>
    </div>
  );
}

function QuestionGrid({
  questions,
  currentIndex,
  onSelect,
  refreshKey = 0,
  solvedIds: providedSolvedIds,
  starredIds: providedStarredIds,
  canReorder = false,
  onReorder,
  reordering = false,
  lastMovedQuestionId = null,
}) {
  const { isAuthenticated, isInstructor } = useAuth();
  const [solvedIds, setSolvedIds] = useState(new Set());
  const [starredIds, setStarredIds] = useState(new Set());
  const showInstructorNumbers = canReorder || isInstructor;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (providedSolvedIds && providedStarredIds) {
      setSolvedIds(providedSolvedIds);
      setStarredIds(providedStarredIds);
      return;
    }

    let isMounted = true;
    if (!isAuthenticated || isInstructor) {
      setSolvedIds(new Set());
      setStarredIds(new Set());
      return () => { isMounted = false; };
    }

    Promise.all([
      studentProgress.getSolvedQuestions(),
      studentProgress.getStarredQuestions(),
    ])
      .then(([solvedRes, starredRes]) => {
        if (!isMounted) return;
        const solved = new Set((solvedRes?.questions || []).map((q) => q.id));
        const starred = new Set((starredRes?.questions || []).map((q) => q.id));
        setSolvedIds(solved);
        setStarredIds(starred);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, isInstructor, refreshKey, providedSolvedIds, providedStarredIds]);

  const safeQuestions = useMemo(() => {
    return (questions || []).map((q) => (typeof q === "object" ? q : { id: q }));
  }, [questions]);

  const handleDragEnd = (event) => {
    if (reordering || !onReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = safeQuestions.findIndex((q) => q.id === active.id);
    const newIndex = safeQuestions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(safeQuestions, oldIndex, newIndex), active.id);
  };

  const cellProps = (q, idx) => ({
    q,
    idx,
    currentIndex,
    onSelect,
    showInstructorNumbers,
    solvedIds,
    starredIds,
    canReorder,
    lastMovedQuestionId,
  });

  const grid = canReorder ? (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={safeQuestions.map((q) => q.id)}
        strategy={rectSortingStrategy}
      >
        <div className="app-question-grid__grid" title="Navigate between questions">
          {safeQuestions.map((q, idx) => (
            <SortableQuestionGridCell key={q.id} {...cellProps(q, idx)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  ) : (
    <div className="app-question-grid__grid" title="Navigate between questions">
      {safeQuestions.map((q, idx) => (
        <QuestionGridCell key={q.id} {...cellProps(q, idx)} />
      ))}
    </div>
  );

  return (
    <div className="app-question-grid sb-mar-top-sp-16 sb-mar-bottom-sp-16">
      <div className="app-question-grid__scroller">
        <h6 className="sb-mar-all-sp-8">Navigate between questions</h6>
        {canReorder && (
          <p className="app-question-grid__reorder-hint sb-mar-left-sp-8 sb-mar-right-sp-8">
            Drag numbers to reorder questions for students.
          </p>
        )}
        {grid}
      </div>
    </div>
  );
}

export default QuestionGrid;
