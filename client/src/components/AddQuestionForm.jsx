import { useState, useEffect, useRef } from "react";
import { questions, questionConcepts, explicitData, implicitData, solutions, mathematicalSolutions } from "../utils/api";
import { fetchInstructorCoursesSorted } from "../utils/instructorCourses";
import { toast } from '../utils/toast';
import QuillEditor from "./QuillEditor";
import { getQuillStoredHtml, isQuillHtmlEmpty, normalizeQuillHtml, quillHtmlToDataTexts } from "../utils/quillHtml";

const AddQuestionForm = () => {
  const [courses, setCourses] = useState([]);
  const [courseConcepts, setCourseConcepts] = useState([]);
  const questionTextRef = useRef(null);
  const goalRef = useRef(null);
  const explicitDataRef = useRef(null);
  const implicitDataRef = useRef(null);
  const solutionRef = useRef(null);
  const mathematicalSolutionRef = useRef(null);
  const [formData, setFormData] = useState({
    courseCode: "",
  });
  const [selectedConcepts, setSelectedConcepts] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  /** Bump to remount Quill editors after a successful submit (clear content). */
  const [editorResetKey, setEditorResetKey] = useState(0);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setCourses(await fetchInstructorCoursesSorted());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load courses");
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const fetchCourseConcepts = async () => {
      if (!formData.courseCode) {
        setCourseConcepts([]);
        setSelectedConcepts([]);
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/courses_concepts/${formData.courseCode}`);
        if (!response.ok) throw new Error("Failed to fetch course concepts");
        const data = await response.json();
        setCourseConcepts(data.concepts.sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedConcepts([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course concepts");
      }
    };

    fetchCourseConcepts();
  }, [formData.courseCode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
    setSuccess(null);

    const questionTextHtml = getQuillStoredHtml(questionTextRef.current);
    const goalHtml = getQuillStoredHtml(goalRef.current);
    const explicitHtml = getQuillStoredHtml(explicitDataRef.current);
    const implicitHtml = getQuillStoredHtml(implicitDataRef.current);
    const solutionHtml = getQuillStoredHtml(solutionRef.current);
    const mathSolutionHtml = getQuillStoredHtml(mathematicalSolutionRef.current);

    if (!formData.courseCode || isQuillHtmlEmpty(questionTextHtml)) {
      setError("Course and Question Text are required");
      return;
    }

    const questionPayload = {
      course_code: formData.courseCode,
      question_text: questionTextHtml,
      goal: normalizeQuillHtml(goalHtml),
    };

    let questionId;
    try {
      const questionData = await questions.create(questionPayload);
      questionId = questionData.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add question");
      return;
    }

    const postMultiple = async (endpoint, items) => {
      for (const item of items) {
        if (!item) continue;
        switch (endpoint) {
          case 'explicit_data':
            await explicitData.create({ question_id: questionId, data_text: item });
            break;
          case 'implicit_data':
            await implicitData.create({ question_id: questionId, data_text: item });
            break;
          case 'solutions':
            await solutions.create({ question_id: questionId, solution_text: item });
            break;
          case 'mathematical_solutions':
            await mathematicalSolutions.create({ question_id: questionId, solution_text: item });
            break;
          default:
            break;
        }
      }
    };

    try {
      await postMultiple("explicit_data", quillHtmlToDataTexts(explicitHtml));
      await postMultiple("implicit_data", quillHtmlToDataTexts(implicitHtml));
      await postMultiple("solutions", quillHtmlToDataTexts(solutionHtml));
      await postMultiple("mathematical_solutions", quillHtmlToDataTexts(mathSolutionHtml));

      if (selectedConcepts.length > 0) {
        await questionConcepts.replace(questionId, selectedConcepts);
      }

      setSuccess("Question added successfully!");
      setEditorResetKey((k) => k + 1);
      setFormData((prev) => ({
        courseCode: prev.courseCode,
      }));
      setSelectedConcepts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add question data");
    }
  };

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);

  return (
    <div className="bux-mar-top-sp-32">
      <h3>Add a New Question</h3>
      <form className="bux-form" onSubmit={handleSubmit}>
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="courseCode">Course *</label>
          <select
            id="courseCode"
            name="courseCode"
            value={formData.courseCode}
            onChange={handleChange}
            required
            style={{ display: "block", width: "100%" }}
            disabled={loadingCourses}
          >
            <option value="" disabled>Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.code}>
                {course.code} - {course.title}
              </option>
            ))}
          </select>
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="questionText">Question Text *</label>
          <QuillEditor
            key={`questionText-${editorResetKey}`}
            ref={questionTextRef}
            placeholder="Enter the question text..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="goal">Goal</label>
          <QuillEditor
            key={`goal-${editorResetKey}`}
            ref={goalRef}
            placeholder="Enter the goal of the question..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="explicitData">Explicit Data</label>
          <QuillEditor
            key={`explicit-${editorResetKey}`}
            ref={explicitDataRef}
            placeholder="Enter explicit data..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="implicitData">Implicit Data</label>
          <QuillEditor
            key={`implicit-${editorResetKey}`}
            ref={implicitDataRef}
            placeholder="Enter implicit data..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="solution">Solution in plain words (English)</label>
          <QuillEditor
            key={`solution-${editorResetKey}`}
            ref={solutionRef}
            placeholder="Enter solution steps..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="mathematicalSolution">Mathematical Solution</label>
          <QuillEditor
            key={`mathSolution-${editorResetKey}`}
            ref={mathematicalSolutionRef}
            placeholder="Enter mathematical solution steps..."
          />
        </div>

        <div className="bux-mar-bottom-sp-16">
          <label>Associate Concepts (Optional)</label>
          {courseConcepts.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>
              {formData.courseCode ? "No concepts associated with this course yet." : "Select a course to view its concepts."}
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

        <button type="submit" className="bux-button">
          Add Question
        </button>
      </form>
    </div>
  );
};

export default AddQuestionForm;
