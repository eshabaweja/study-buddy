import { useEffect, useState } from "react";
import { courses } from "../utils/api";
import { toast } from '../utils/toast';

const CourseDeleteForm = () => {
  const [courseList, setCourseList] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await courses.getMine();
        setCourseList(data.courses.sort((a, b) => a.code.localeCompare(b.code)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch courses");
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);

  const handleDelete = async () => {
    if (!selectedCourseCode) return;
    const selectedCourse = courseList.find((c) => c.code === selectedCourseCode);
    const confirmed = window.confirm(
      `Delete ${selectedCourseCode}${selectedCourse ? ` - ${selectedCourse.title}` : ""}? This removes its questions/concepts associations and cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await courses.deleteByCode(selectedCourseCode);
      setCourseList((prev) => prev.filter((c) => c.code !== selectedCourseCode));
      setSuccess("Course deleted successfully.");
      setSelectedCourseCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bux-mar-top-sp-32">
      <h3>Delete Course</h3>
      <div className="bux-form">
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="deleteCourseCode">Select Course *</label>
          <select
            id="deleteCourseCode"
            value={selectedCourseCode}
            onChange={(e) => setSelectedCourseCode(e.target.value)}
            style={{ display: "block", width: "100%" }}
          >
            <option value="" disabled>
              Select a course
            </option>
            {courseList.map((course) => (
              <option key={course.code} value={course.code}>
                {course.code} - {course.title}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="bux-button--alt"
          disabled={!selectedCourseCode || loading}
          onClick={handleDelete}
        >
          {loading ? "Deleting..." : "Delete Course"}
        </button>
      </div>
    </div>
  );
};

export default CourseDeleteForm;
