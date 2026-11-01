import { useState, useEffect, useRef } from "react";
import { toast } from '../utils/toast';
import QuillEditor from "./QuillEditor";
import { getQuillStoredHtml, normalizeQuillHtml } from "../utils/quillHtml";
import { fetchInstructorCoursesSorted } from "../utils/instructorCourses";

function UpdateCourseConcept() {
  const [courses, setCourses] = useState([]);
  const [courseConcepts, setCourseConcepts] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [conceptName, setConceptName] = useState("");
  const [initialConceptDescription, setInitialConceptDescription] = useState("");
  const conceptDescriptionRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch courses on mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setCourses(await fetchInstructorCoursesSorted());
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Fetch course concepts when course is selected
  useEffect(() => {
    const fetchCourseData = async () => {
      if (!selectedCourseCode) {
        setCourseConcepts([]);
        return;
      }

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/courses_concepts/${selectedCourseCode}`);
        if (!response.ok) {
          throw new Error("Failed to fetch course concepts");
        }

        const data = await response.json();
        setCourseConcepts(data.concepts || []);
      } catch (err) {
        setError(err.message);
        setCourseConcepts([]); // Reset concepts on error
      }
    };

    fetchCourseData();
  }, [selectedCourseCode]);

  // Fetch concept description when concept is selected
  useEffect(() => {
    const fetchConceptDescription = async () => {
      if (!selectedCourseCode || !selectedConceptId) {
        setInitialConceptDescription("");
        setConceptName("");
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/courses_concepts/${selectedCourseCode}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch course concepts");
        }

        const data = await response.json();
        const concept = data.concepts.find(
          (c) => String(c.id) === String(selectedConceptId),
        );
        if (!concept) {
          throw new Error("Concept not found");
        }
        
        setConceptName(concept.name || "");
        setInitialConceptDescription(concept.description || "");
      } catch (err) {
        setError(err.message);
        setInitialConceptDescription("");
        setConceptName("");
      }
    };

    fetchConceptDescription();
  }, [selectedCourseCode, selectedConceptId]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedCourseCode || !selectedConceptId) {
      setError("Please select both a course and a concept");
      return;
    }

    const descriptionHtml = normalizeQuillHtml(getQuillStoredHtml(conceptDescriptionRef.current));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/concepts/${selectedConceptId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ name: conceptName, description: descriptionHtml }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update concept");
      }

      setSuccess("Course concept updated successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="sb-mar-top-sp-32">
      <h3>Update Course Concepts</h3>
      
      <form onSubmit={handleSubmit} className="sb-form">
        <div className="sb-mar-bottom-sp-16">
          <label htmlFor="courseCode">Select Course *</label>
          <select
            id="courseCode"
            value={selectedCourseCode}
            onChange={(e) => {
              setSelectedCourseCode(e.target.value);
              setSelectedConceptId("");
            }}
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

        <div className="sb-mar-bottom-sp-16">
          <label htmlFor="conceptId">Select Concept *</label>
          <select
            id="conceptId"
            value={selectedConceptId}
            onChange={(e) => setSelectedConceptId(e.target.value)}
            required
            style={{ display: "block", width: "100%" }}
            disabled={!selectedCourseCode}
          >
            <option value="" disabled>Select a concept</option>
            {courseConcepts.map(concept => (
              <option key={concept.id} value={concept.id}>
                {concept.name}
              </option>
            ))}
          </select>
          {courseConcepts.length === 0 && selectedCourseCode && (
            <p style={{ color: "#666", fontStyle: "italic", marginTop: "8px" }}>
              No concepts associated with this course yet.
            </p>
          )}
        </div>

        <div className="sb-mar-bottom-sp-16">
          <label htmlFor="conceptName">Concept Name</label>
          <input
            type="text"
            id="conceptName"
            value={conceptName}
            onChange={(e) => setConceptName(e.target.value)}
            style={{ 
              display: "block", 
              width: "100%", 
              padding: "8px",
              marginTop: "4px"
            }}
            disabled={!selectedCourseCode || !selectedConceptId}
            placeholder="Enter concept name..."
            required
          />
        </div>

        <div className="sb-mar-bottom-sp-16">
          <label htmlFor="conceptDescription">Concept Description</label>
          <QuillEditor
            key={`conceptDescription-${selectedConceptId}`}
            ref={conceptDescriptionRef}
            defaultValue={initialConceptDescription}
            placeholder="Enter concept description..."
            readOnly={!selectedCourseCode || !selectedConceptId}
          />
        </div>

        <button 
          type="submit" 
          className="sb-button"
          disabled={!selectedCourseCode || !selectedConceptId}
        >
          Update Concept
        </button>
      </form>

    </div>
  );
}

export default UpdateCourseConcept;