import UpdateQuestionForm from '../UpdateQuestionForm';

export function QuestionInstructorEditPanel({
  questionId,
  courseCode,
  initialQuestion,
  onSaved,
  onCancel,
}) {
  return (
    <div className="app-question-instructor app-question-instructor--editing sb-mar-top-sp-16">
      <UpdateQuestionForm
        inlineQuestionId={String(questionId)}
        inlineCourseCode={courseCode}
        inlineInitialQuestion={initialQuestion}
        onInlineSaved={onSaved}
        onInlineCancel={onCancel}
      />
    </div>
  );
}

export { useQuestionCanEdit, useQuestionDelete } from './questionInstructorHooks';
