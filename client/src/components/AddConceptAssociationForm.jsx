import { useState, useEffect, useRef } from "react";
import { concepts as conceptsApi, courseConcepts } from "../utils/api";
import { toast } from '../utils/toast';
import QuillEditor from "./QuillEditor";
import { getQuillStoredHtml, isQuillHtmlEmpty, normalizeQuillHtml } from "../utils/quillHtml";
import { fetchInstructorCoursesSorted } from "../utils/instructorCourses";

const AddConceptAssociationForm = () => {
  const [courses, setCourses] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const newConceptDescriptionRef = useRef(null);

  // State for "Add New Concept"
  const [newConceptName, setNewConceptName] = useState("");
  const [newConceptCourseCode, setNewConceptCourseCode] = useState("");

  // State for "Associate Existing Concept"
  const [assocCourseCode, setAssocCourseCode] = useState("");
  const [assocConceptId, setAssocConceptId] = useState("");

  // Fetch courses and concepts on mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setCourses(await fetchInstructorCoursesSorted());
      } catch (err) {
        setError("Failed to load courses");
      }
    };

    const fetchConcepts = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/concepts`);
        const data = await response.json();
        // Sort concepts alphabetically by name
        const sortedConcepts = [...data.concepts].sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        setConcepts(sortedConcepts);
      } catch (err) {
        setError("Failed to load concepts");
      }
    };

    fetchCourses();
    fetchConcepts();
  }, []);

  // Handler for adding a new concept and associating it with a course
  const handleNewConceptSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const descriptionHtml = normalizeQuillHtml(getQuillStoredHtml(newConceptDescriptionRef.current));
    if (!newConceptName || isQuillHtmlEmpty(descriptionHtml)) {
      setError("Concept name and description are required.");
      return;
    }

    try {
      const conceptData = await conceptsApi.create({ 
        name: newConceptName, 
        description: descriptionHtml 
      });
      const newConceptId = conceptData.id;

      // Associate the new concept with the selected course
      await courseConcepts.create({ 
        course_code: newConceptCourseCode, 
        concept_id: newConceptId 
      });

      setSuccess("New concept created and associated with course successfully!");
      setNewConceptName("");
      if (newConceptDescriptionRef.current?.setText) newConceptDescriptionRef.current.setText("");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    }
  };

  // Handler for associating an existing concept to a course
  const handleExistingAssocSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const resAssoc = await fetch(`${import.meta.env.VITE_API_URL}/courses_concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_code: assocCourseCode, concept_id: assocConceptId }),
      });
      if (!resAssoc.ok) {
        const errData = await resAssoc.json();
        throw new Error(errData.error || "Failed to associate existing concept");
      }
      setSuccess("Existing concept associated with course successfully!");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    }
  };
    // Toast for error
    useEffect(() => {
      if (error) {
        toast.error(error);
      }
    }, [error]);
  
    // Toast for success
    useEffect(() => {
      if (success) {
        toast.success(success);
      }
    }, [success]);  

  return (
    <div className="bux-mar-top-sp-32">
      {/* Section: Add a New Concept */}
      <div className="bux-mar-bottom-sp-32">
        <h4>Add Concept to a Course</h4>
        <form className="bux-form" onSubmit={handleNewConceptSubmit}>
          <div className="bux-mar-bottom-sp-16">
            <label htmlFor="newConceptCourse">Select Associated Course *</label>
            <select
              id="newConceptCourse"
              name="newConceptCourse"
              value={newConceptCourseCode}
              onChange={(e) => setNewConceptCourseCode(e.target.value)}
              required
              style={{ display: "block", width: "100%" }}
            >
              <option value="" disabled>Select a course</option>
              {courses.map(course => (
                <option key={course.code} value={course.code}>
                  {course.code} - {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="bux-mar-bottom-sp-16">
            <label htmlFor="newConceptName">Concept Name *</label>
            <input
              type="text"
              id="newConceptName"
              name="newConceptName"
              value={newConceptName}
              onChange={(e) => setNewConceptName(e.target.value)}
              placeholder="e.g., Ohm's Law"
              style={{ display: "block", width: "100%" }}
              required
            />
          </div>
          <div className="bux-mar-bottom-sp-16">
            <label htmlFor="newConceptDescription">Concept Description *</label>
            <QuillEditor
              ref={newConceptDescriptionRef}
              placeholder="Description of the concept..."
            />
          </div>
          <button type="submit" className="bux-button">
            Add New Concept and Associate
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddConceptAssociationForm; 