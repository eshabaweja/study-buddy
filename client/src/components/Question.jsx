import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { studentProgress, questions as questionsApi } from "../utils/api";
import ImageModal from "./ImageModal";
import Chatbot from "./Chatbot";
import RichTextContent from "./RichTextContent";
import { dataTextsToQuillHtml } from "../utils/quillHtml";
import { markdownToHtml } from "../utils/markdownToHtml";

function Question({
  question,
  onPrevious,
  onNext,
  currentIndex,
  totalQuestions,
  studentNumber,
  courseNumber,
  publishedCount,
  courseCount,
  onSolvedChange,
  onStarredChange,
  mode = 'practice',
  viewAsStudent = true,
  canEdit = false,
  isEditing = false,
  onEdit,
  onDelete,
  onPublishedChange,
}) {
  const { isAuthenticated, isInstructor } = useAuth();
  const isQuizMode = mode === 'quiz';
  const asStudent = !isInstructor || viewAsStudent;
  // Star / mark-as-solved: enrolled students only (hidden for instructor preview for now)
  const showStudentProgressUi = isAuthenticated && !isInstructor && !isQuizMode;
  const [explicitIsBlurred, setExplicitIsBlurred] = useState(true);
  const [implicitIsBlurred, setImplicitIsBlurred] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSolved, setIsSolved] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarLoading, setIsStarLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const solutionRef = useRef(null);

  const openImageModal = (url, alt) => {
    if (url) setSelectedImage({ url, alt: alt || "" });
  };

  useEffect(() => {
    if (showSolution && solutionRef.current) {
      window.scrollTo({
        top: solutionRef.current.offsetTop,
        behavior: "smooth",
      });
    }
  }, [showSolution]);

  // Reset reveal toggles when navigating between questions (component is reused).
  useEffect(() => {
    setExplicitIsBlurred(true);
    setImplicitIsBlurred(true);
    setShowSolution(false);
    setSelectedImage(null);
  }, [question.id]);

  useEffect(() => {
    const checkIfSolved = async () => {
      if (!showStudentProgressUi) return;
      try {
        const { isSolved } = await studentProgress.isQuestionSolved(question.id);
        setIsSolved(isSolved);
      } catch (err) {
        console.error('Error checking if question is solved:', err);
      }
    };
    checkIfSolved();
  }, [question.id, showStudentProgressUi]);

  useEffect(() => {
    const checkIfStarred = async () => {
      if (!showStudentProgressUi) return;
      try {
        const { isStarred } = await studentProgress.isQuestionStarred(question.id);
        setIsStarred(isStarred);
      } catch (err) {
        console.error('Error checking if question is starred:', err);
      }
    };
    checkIfStarred();
  }, [question.id, showStudentProgressUi]);

  const toggleSolution = () => setShowSolution(!showSolution);

  const handleSolveQuestion = async () => {
    if (!showStudentProgressUi) return;
    
    setIsLoading(true);
    try {
      if (isSolved) {
        await studentProgress.markQuestionUnsolved(question.id);
        setIsSolved(false);
      } else {
        await studentProgress.markQuestionSolved(question.id);
        setIsSolved(true);
      }
    } catch (err) {
      console.error('Error toggling question solved status:', err);
      // Revert state if the API call fails
      setIsSolved(!isSolved);
    } finally {
      setIsLoading(false);
      if (typeof onSolvedChange === 'function') {
        onSolvedChange();
      }
    }
  };

  const handleStarQuestion = async () => {
    if (!showStudentProgressUi) return;
    
    setIsStarLoading(true);
    try {
      if (isStarred) {
        await studentProgress.unstarQuestion(question.id);
        setIsStarred(false);
      } else {
        await studentProgress.starQuestion(question.id);
        setIsStarred(true);
      }
    } catch (err) {
      console.error('Error toggling question star status:', err);
      // Revert state if the API call fails
      setIsStarred(!isStarred);
    } finally {
      setIsStarLoading(false);
      if (typeof onStarredChange === 'function') {
        onStarredChange();
      }
    }
  };

  // Format solution/math content: support single HTML string (from Quill) or legacy array of plain text steps
  function formatSolutionContent(content) {
    if (content == null) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content) && content.length === 0) return '';
    if (Array.isArray(content) && content.length === 1) return content[0];
    if (Array.isArray(content)) {
      return content.map((step) => `<p>${escapeHtml(step)}</p>`).join('');
    }
    return '';
  }
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Filter images based on their type
  const displayStudentNumber = studentNumber ?? (currentIndex + 1);
  const displayPublishedCount = publishedCount ?? totalQuestions;
  const displayCourseNumber = courseNumber ?? (currentIndex + 1);
  const displayCourseCount = courseCount ?? totalQuestions;

  const questionTitle = canEdit ? (
    <>
      {question.published !== false && displayStudentNumber != null ? (
        <>
          Question {displayStudentNumber}/{displayPublishedCount}
          <span className="ba-question-meta"> (student)</span>
          {' · '}
        </>
      ) : (
        <>
          <span className="ba-question-meta">Unpublished · </span>
        </>
      )}
      #{displayCourseNumber}/{displayCourseCount}
      <span className="ba-question-meta"> (course)</span>
    </>
  ) : (
    <>Question {displayStudentNumber}/{displayPublishedCount}</>
  );

  return (
    <div className="bux-mar-top-sp-32 bux-mar-bottom-sp-32">
      <div className="bux-grid">
        <div className="ba-card bux-grid__cell bux-grid__cell--12">
          <div className="bux-grid" title="Question">
            <div className="bux-grid__cell bux-grid__cell--12 bux-flex bux-flex--align-center">
              <div className="bux-card__heading ba-limit-width ba-question-header-tools">
                {questionTitle}
                {showStudentProgressUi && (
                  <button
                    className={`ba_star ${isStarred ? 'ba_star--empty' : 'ba_star--filled'}`}
                    onClick={handleStarQuestion}
                    disabled={isStarLoading}
                    title={isStarred ? 'Unstar question' : 'Star question'}
                  >
                    {isStarLoading ? '...' : isStarred ? '★' : '☆'}
                  </button>
                )}
                {canEdit && !isEditing && (
                  <>
                    <button
                      type="button"
                      className={`ba-question-instructor__btn${question.published === false ? ' ba-question-instructor__btn--unpublished' : ''}`}
                      disabled={publishLoading}
                      onClick={async () => {
                        const nextPublished = question.published === false;
                        setPublishLoading(true);
                        try {
                          await questionsApi.updatePublishStatus(question.id, nextPublished);
                          onPublishedChange?.(nextPublished);
                        } catch {
                          // parent may show toast
                        } finally {
                          setPublishLoading(false);
                        }
                      }}
                      title={question.published === false ? 'Publish question' : 'Unpublish question'}
                    >
                      {publishLoading
                        ? '…'
                        : (question.published === false ? 'Publish' : 'Unpublish')}
                    </button>
                    <button
                      type="button"
                      className="ba-question-instructor__btn"
                      onClick={onEdit}
                      title="Edit question"
                      aria-label="Edit question"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="ba-question-instructor__btn ba-question-instructor__btn--danger"
                      onClick={onDelete}
                      title="Delete question"
                      aria-label="Delete question"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bux-grid__cell bux-grid__cell--12 bux-paragraph bux-mar-bottom-sp-16">
              <RichTextContent
                html={question.questionText}
                className="bux-mar-bottom-sp-16 ba-question-figures"
                onImageClick={({ url, alt }) => openImageModal(url, alt)}
              />
            </div>

            {canEdit && !isEditing && (
              <div className="bux-grid__cell bux-grid__cell--12 bux-mar-bottom-sp-16">
                <h3 className="bux-card__heading">Figure description (for Brutus)</h3>
                {question.figureDescription?.trim() ? (
                  <div className="bux-paragraph ba-figure-description">
                    <RichTextContent
                      html={markdownToHtml(question.figureDescription)}
                      normalizePlainText={false}
                    />
                  </div>
                ) : (
                  <div className="bux-paragraph">
                    <span style={{ color: "#666", fontStyle: "italic" }}>
                      None yet. Click edit to add one or regenerate from figures.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--8@md  bux-mar-top-sp-16">
              <button
                id="ba-btn-prev"
                className="bux-button--alt bux-mar-right-sp-8"
                onClick={onPrevious}
                disabled={currentIndex === 0}
              >
                Previous
              </button>
              <button 
                id="ba-btn-next" 
                className="bux-button"
                onClick={onNext}
                disabled={currentIndex === totalQuestions - 1}
              >
                Next
              </button>
            </div>
            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--4@md  bux-mar-top-sp-16">
            {showStudentProgressUi && (
                <div className="bux-flex bux-flex--direction-column bux-flex--gap-sp-8">
                  <button
                    className={`${isSolved ? 'ba-button ba-button__solved' : 'ba-button ba-button__unsolved'} ba-nowrap`}
                    onClick={handleSolveQuestion}
                    disabled={isLoading}
                  >
                    {isLoading ? '...' : isSolved ? '✓ Solved!' : '🎯 Mark as Solved'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {!isQuizMode && asStudent && <Chatbot key={question.id} question={question} />}
        {!isQuizMode && (
        <div className="bux-grid__cell bux-grid__cell--12 bux-mar-top-sp-16">
          <h3 className="bux-card__heading">Goal</h3>
          <div className="bux-paragraph">
            <RichTextContent
              html={question.goal}
              className="ba-question-figures"
              onImageClick={({ url, alt }) => openImageModal(url, alt)}
            />
          </div>
        </div>
        )}

        {!isQuizMode && (
        <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-mar-top-sp-16">
          <h3 className="bux-card__heading">Explicit Data</h3>
          <div
            className={`bux-paragraph ba-interactive ${explicitIsBlurred ? "ba-blur" : ""}`}
            onClick={() => setExplicitIsBlurred(!explicitIsBlurred)}
          >
            <RichTextContent
              html={dataTextsToQuillHtml(question.explicitData || [])}
              className="ba-question-figures"
              onImageClick={({ url, alt }) => openImageModal(url, alt)}
            />
          </div>
        </div>
        )}

        {!isQuizMode && (
        <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-mar-top-sp-16">
          <h3 className="bux-card__heading">Implicit Data</h3>
          <div
            className={`bux-paragraph ba-interactive ${implicitIsBlurred ? "ba-blur" : ""}`}
            onClick={() => setImplicitIsBlurred(!implicitIsBlurred)}
          >
            <RichTextContent
              html={dataTextsToQuillHtml(question.implicitData || [])}
              className="ba-question-figures"
              onImageClick={({ url, alt }) => openImageModal(url, alt)}
            />
          </div>
        </div>
        )}

        {!isQuizMode && (
        <div className="bux-grid__cell bux-grid__cell--12 bux-mar-top-sp-16">
          <button
            id="ba-btn-sol"
            className="bux-button--alt"
            onClick={toggleSolution}
          >
            {showSolution ? "Hide Solution" : "Show Solution"}
          </button>

          {showSolution && (
            <>
              <div id="ba-solution" className="bux-mar-top-sp-16" ref={solutionRef}>
                <h3 className="bux-card__heading">Solution in plain words (English)</h3>
                <div className="bux-paragraph">
                  <RichTextContent
                    html={formatSolutionContent(question.solution)}
                    className="ba-question-figures"
                    onImageClick={({ url, alt }) => openImageModal(url, alt)}
                  />
                </div>
              </div>

              <div className="bux-mar-top-sp-16">
                <h3 className="bux-card__heading">Mathematical Solution</h3>
                <div className="bux-paragraph">
                  <RichTextContent
                    html={formatSolutionContent(question.mathematicalSolution)}
                    className="ba-question-figures"
                    onImageClick={({ url, alt }) => openImageModal(url, alt)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || ''}
        altText={selectedImage?.alt || ''}
      />

      <div className="bux-grid__cell--12 bux-mar-top-sp-16">
                <div className="bux-paragraph">
                  <div className="ba-concept-tags-container">
                    {question.concepts && question.concepts.length > 0 ? (
                      question.concepts.map(concept => (
                        <span key={concept.id} className="ba-concept-tag">
                          {concept.name}
                        </span>
                      ))
                    ) : null}
                  </div>
                </div>
              </div>

    </div>
  );
}

export default Question; 