import { useState, useEffect } from "react";
import CourseCard from "../components/CourseCard";
import { concepts as conceptsApi } from "../utils/api";

function ConceptCrunch() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/courses`);
        if (!response.ok) throw new Error(`Error: ${response.status}`);
        const data = await response.json();
        // Sort courses alphabetically by code
        const sortedCourses = [...data.courses].sort((a, b) =>
          a.code.localeCompare(b.code)
        );
        setCourses(sortedCourses);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="sb-container">
      <div className="app-card-collection sb-mar-bottom-sp-32">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}

export default ConceptCrunch; 