import { useState, useEffect, useRef } from "react";
import { questions, questionConcepts, explicitData, implicitData, solutions, mathematicalSolutions } from "../utils/api";
import { toast } from '../utils/toast';
import QuillEditor from "./QuillEditor";
import {
  getQuillStoredHtml,
  isQuillHtmlEmpty,
  normalizeQuillHtml,
  quillHtmlToDataTexts,
  dataTextsToQuillHtml,
  htmlToPlainText,
} from "../utils/quillHtml";
import { markdownToHtml } from "../utils/markdownToHtml";
import { fetchInstructorCoursesSorted } from "../utils/instructorCourses";
import RichTextContent from "./RichTextContent";

const UpdateQuestionForm = ({
  inlineQuestionId = null,
  inlineCourseCode = null,
  inlineInitialQuestion = null,
  onInlineSaved = null,
  onInlineCancel = null,
}) => {
  const isInline = Boolean(inlineQuestionId);
  const [courses, setCourses] = useState([]);
  const [questionsList, setQuestionsList] = useState([]);
  const [courseConcepts, setCourseConcepts] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState(inlineCourseCode || "");
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    inlineQuestionId ? String(inlineQuestionId) : "",
  );
  const [selectedConcepts, setSelectedConcepts] = useState([]);

  const questionTextRef = useRef(null);
  const goalRef = useRef(null);
  const explicitDataRef = useRef(null);
  const implicitDataRef = useRef(null);
  const solutionRef = useRef(null);
  const mathematicalSolutionRef = useRef(null);

  const [initialRichText, setInitialRichText] = useState({
    questionText: "",
    goal: "",
    explicitData: "",
    implicitData: "",
    solution: "",
    mathematicalSolution: "",
  });
  const [figureDescription, setFigureDescription] = useState("");
  const [regeneratingFigure, setRegeneratingFigure] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!isInline);

  const activeCourseCode = selectedCourseCode || inlineCourseCode || "";

  const applyQuestionToForm = (question, courseCode) => {
    setInitialRichText({
      questionText: question.questionText || "",
      goal: question.goal || "",
      explicitData: dataTextsToQuillHtml(question.explicitData || []),
      implicitData: dataTextsToQuillHtml(question.implicitData || []),
      solution: Array.isArray(question.solution)
        ? (question.solution.length <= 1
          ? (question.solution[0] || "")
          : dataTextsToQuillHtml(question.solution))
        : question.solution || "",
      mathematicalSolution: Array.isArray(question.mathematicalSolution)
        ? (question.mathematicalSolution.length <= 1
          ? (question.mathematicalSolution[0] || "")
          : dataTextsToQuillHtml(question.mathematicalSolution))
        : question.mathematicalSolution || "",
    });
    setFigureDescription(question.figureDescription || "");
    setSelectedConcepts(
      question.concepts?.map((concept) => concept.id) ?? [],
    );
    if (courseCode) {
      setSelectedCourseCode(courseCode);
    }
  };

  useEffect(() => {
    if (inlineQuestionId) {
      setSelectedQuestionId(String(inlineQuestionId));
      if (inlineCourseCode) {
        setSelectedCourseCode(inlineCourseCode);
      }
    }
  }, [inlineQuestionId, inlineCourseCode]);

  useEffect(() => {
    if (isInline && inlineInitialQuestion) {
      applyQuestionToForm(inlineInitialQuestion, inlineCourseCode || selectedCourseCode);
    }
  }, [isInline, inlineInitialQuestion, inlineCourseCode, selectedCourseCode]);

  useEffect(() => {
    if (isInline) {
      setLoading(false);
      return;
    }
    const fetchCourses = async () => {
      try {
        setCourses(await fetchInstructorCoursesSorted());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [isInline]);

  useEffect(() => {
    if (isInline) return;

    const fetchQuestions = async () => {
      if (!selectedCourseCode) {
        setQuestionsList([]);
        setSelectedQuestionId("");
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/questions/${selectedCourseCode}`);
        if (!response.ok) throw new Error("Failed to fetch questions");
        const data = await response.json();
        setQuestionsList(data.questions);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchQuestions();
  }, [selectedCourseCode, isInline]);

  useEffect(() => {
    const fetchQuestionDetails = async () => {
      if (!selectedQuestionId) {
        setInitialRichText({
          questionText: "",
          goal: "",
          explicitData: "",
          implicitData: "",
          solution: "",
          mathematicalSolution: "",
        });
        setFigureDescription("");
        setSelectedConcepts([]);
        return;
      }

      if (isInline && inlineInitialQuestion && String(inlineInitialQuestion.id) === String(selectedQuestionId)) {
        return;
      }

      try {
        const data = await questions.getFull(selectedQuestionId);
        applyQuestionToForm(data.question, selectedCourseCode);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchQuestionDetails();
  }, [selectedQuestionId, selectedCourseCode, isInline, inlineInitialQuestion]);

  useEffect(() => {
    const fetchCourseConcepts = async () => {
      if (!activeCourseCode) {
        setCourseConcepts([]);
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/courses_concepts/${activeCourseCode}`);
        if (!response.ok) throw new Error("Failed to fetch course concepts");
        const data = await response.json();
        setCourseConcepts(
          (data.concepts || []).sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course concepts");
      }
    };

    fetchCourseConcepts();
  }, [activeCourseCode]);

  const handleConceptToggle = (conceptId) => {
    setSelectedConcepts((prev) =>
      prev.includes(conceptId)
        ? prev.filter((id) => id !== conceptId)
        : [...prev, conceptId],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!selectedQuestionId) {
      setError("Please select a question to update");
      return;
    }

    const questionTextHtml = getQuillStoredHtml(questionTextRef.current);
    const goalHtml = getQuillStoredHtml(goalRef.current);
    const explicitHtml = getQuillStoredHtml(explicitDataRef.current);
    const implicitHtml = getQuillStoredHtml(implicitDataRef.current);
    const solutionHtml = getQuillStoredHtml(solutionRef.current);
    const mathSolutionHtml = getQuillStoredHtml(mathematicalSolutionRef.current);

    if (isQuillHtmlEmpty(questionTextHtml)) {
      setError("Question Text is required");
      return;
    }

    try {
      await questions.update(selectedQuestionId, {
        question_text: questionTextHtml,
        goal: normalizeQuillHtml(goalHtml),
        figure_description: figureDescription,
      });

      const postMultiple = async (endpoint, items) => {
        for (const item of items) {
          if (!item) continue;
          switch (endpoint) {
            case 'explicit_data':
              await explicitData.create({ question_id: selectedQuestionId, data_text: item });
              break;
            case 'implicit_data':
              await implicitData.create({ question_id: selectedQuestionId, data_text: item });
              break;
            case 'solutions':
              await solutions.create({ question_id: selectedQuestionId, solution_text: item });
              break;
            case 'mathematical_solutions':
              await mathematicalSolutions.create({ question_id: selectedQuestionId, solution_text: item });
              break;
            default:
              break;
          }
        }
      };

      await explicitData.deleteAll(selectedQuestionId);
      await postMultiple("explicit_data", quillHtmlToDataTexts(explicitHtml));

      await implicitData.deleteAll(selectedQuestionId);
      await postMultiple("implicit_data", quillHtmlToDataTexts(implicitHtml));

      await solutions.deleteAll(selectedQuestionId);
      await postMultiple("solutions", quillHtmlToDataTexts(solutionHtml));

      await mathematicalSolutions.deleteAll(selectedQuestionId);
      await postMultiple("mathematical_solutions", quillHtmlToDataTexts(mathSolutionHtml));

      await questionConcepts.replace(selectedQuestionId, selectedConcepts);

      toast.success('Question updated successfully!');
      if (isInline && onInlineSaved) {
        onInlineSaved();
        return;
      }
      setInitialRichText({
        questionText: "",
        goal: "",
        explicitData: "",
        implicitData: "",
        solution: "",
        mathematicalSolution: "",
      });
      setFigureDescription("");
      setSelectedQuestionId("");
      setSelectedConcepts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update question");
    }
  };

  const handleRegenerateFigureDescription = async () => {
    if (!selectedQuestionId || regeneratingFigure) return;
    setError(null);
    setRegeneratingFigure(true);
    try {
      // Persist current prompt HTML first so regenerate uses the latest figures
      const questionTextHtml = getQuillStoredHtml(questionTextRef.current);
      const goalHtml = getQuillStoredHtml(goalRef.current);
      if (!isQuillHtmlEmpty(questionTextHtml)) {
        await questions.update(selectedQuestionId, {
          question_text: questionTextHtml,
          goal: normalizeQuillHtml(goalHtml),
          figure_description: figureDescription,
        });
      }
      const result = await questions.regenerateFigureDescription(selectedQuestionId);
      setFigureDescription(result.figureDescription || "");
      toast.success(
        result.figureDescription
          ? "Figure description regenerated."
          : "No prompt figures found; description cleared.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate figure description",
      );
    } finally {
      setRegeneratingFigure(false);
    }
  };

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (loading && !isInline) return <div>Loading...</div>;

  return (
    <div className={isInline ? '' : 'bux-mar-top-sp-32'}>
      {!isInline && <h3>Update a Question</h3>}

      <form className="bux-form" onSubmit={handleSubmit}>
        {!isInline && (
          <>
            <div className="bux-mar-bottom-sp-16">
              <label htmlFor="courseCode">Select Course *</label>
              <select
                id="courseCode"
                value={selectedCourseCode}
                onChange={(e) => {
                  setSelectedCourseCode(e.target.value);
                  setSelectedQuestionId("");
                  setSelectedConcepts([]);
                }}
                required
                style={{ display: "block", width: "100%" }}
              >
                <option value="">Select a course</option>
                {courses.map((course) => (
                  <option key={course.code} value={course.code}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="bux-mar-bottom-sp-16">
              <label htmlFor="questionId">Select Question *</label>
              <select
                id="questionId"
                value={selectedQuestionId}
                onChange={(e) => setSelectedQuestionId(e.target.value)}
                required
                style={{ display: "block", width: "100%" }}
                disabled={!selectedCourseCode}
              >
                <option value="">Select a question</option>
                {questionsList.map((question, index) => (
                  <option key={question.id} value={question.id}>
                    {index + 1}: {htmlToPlainText(question.goal) || "No goal specified"}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="bux-mar-bottom-sp-16">
          <div
            className="bux-flex bux-flex--justify-between bux-flex--align-center"
            style={{ marginBottom: "8px", gap: "12px", flexWrap: "wrap" }}
          >
            <label htmlFor="figureDescription" style={{ marginBottom: 0 }}>
              Figure description (for Brutus)
            </label>
            <button
              type="button"
              className="bux-button--alt bux-button--small"
              onClick={handleRegenerateFigureDescription}
              disabled={!selectedQuestionId || regeneratingFigure}
              title="Re-run AI vision on the current prompt figures"
            >
              {regeneratingFigure ? "Regenerating…" : "Regenerate from figures"}
            </button>
          </div>
          <textarea
            id="figureDescription"
            rows={12}
            value={figureDescription}
            onChange={(e) => setFigureDescription(e.target.value)}
            placeholder="Auto-generated from prompt figures. Edit so Brutus accurately sees what students see."
            style={{ display: "block", width: "100%", resize: "vertical" }}
            disabled={!selectedQuestionId}
          />
          {figureDescription.trim() ? (
            <div className="bux-mar-top-sp-16 ba-figure-description">
              <p className="bux-paragraph" style={{ fontSize: "0.875rem", color: "#666", marginBottom: "8px" }}>
                Preview
              </p>
              <RichTextContent
                html={markdownToHtml(figureDescription)}
                normalizePlainText={false}
              />
            </div>
          ) : null}
          <p className="bux-paragraph" style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
            Used by the AI tutor instead of re-sending images each chat. Leave blank if there are no figures.
            Regenerate uses the figures currently in Question Text below (save first if you just changed them).
          </p>
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="questionText">Question Text *</label>
          <QuillEditor
            key={`questionText-${selectedQuestionId}`}
            ref={questionTextRef}
            defaultValue={initialRichText.questionText}
            placeholder="Enter the question text..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="goal">Goal</label>
          <QuillEditor
            key={`goal-${selectedQuestionId}`}
            ref={goalRef}
            defaultValue={initialRichText.goal}
            placeholder="Enter the goal of the question..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="explicitData">Explicit Data</label>
          <QuillEditor
            key={`explicit-${selectedQuestionId}`}
            ref={explicitDataRef}
            defaultValue={initialRichText.explicitData}
            placeholder="Enter explicit data..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="implicitData">Implicit Data</label>
          <QuillEditor
            key={`implicit-${selectedQuestionId}`}
            ref={implicitDataRef}
            defaultValue={initialRichText.implicitData}
            placeholder="Enter implicit data..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="solution">Solution in plain words (English)</label>
          <QuillEditor
            key={`solution-${selectedQuestionId}`}
            ref={solutionRef}
            defaultValue={initialRichText.solution}
            placeholder="Enter solution steps..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="mathematicalSolution">Mathematical Solution</label>
          <QuillEditor
            key={`mathSolution-${selectedQuestionId}`}
            ref={mathematicalSolutionRef}
            defaultValue={initialRichText.mathematicalSolution}
            placeholder="Enter mathematical solution steps..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label>Concepts</label>
          {courseConcepts.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              {activeCourseCode ? "No concepts associated with this course yet." : "Select a course to view its concepts."}
            </p>
          ) : (
            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
              {courseConcepts.map((concept) => (
                <div key={concept.id} style={{ marginBottom: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={selectedConcepts.includes(concept.id)}
                      onChange={() => handleConceptToggle(concept.id)}
                    />
                    <span>{concept.name}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ba-quiz-form__actions bux-mar-top-sp-16">
          <button type="submit" className="bux-button bux-button--primary">
            {isInline ? 'Save changes' : 'Update Question'}
          </button>
          {isInline && onInlineCancel && (
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={onInlineCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UpdateQuestionForm;
