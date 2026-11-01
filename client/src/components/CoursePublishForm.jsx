import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { courses } from '../utils/api';
import { toast } from '../utils/toast';

const CoursePublishForm = () => {
  const [courseList, setCourseList] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const { isInstructor } = useAuth();

  // Fetch courses on mount
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await courses.getMine();
        setCourseList(data.courses.sort((a, b) => a.code.localeCompare(b.code)));
      } catch (err) {
        console.error('Error fetching courses:', err);
        setError(`Failed to fetch courses: ${err.message}`);
      }
    };

    fetchCourses();
  }, []);

  const handlePublishToggle = async () => {
    if (!selectedCourseCode) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const selectedCourse = courseList.find(c => c.code === selectedCourseCode);
      const newPublishedStatus = !selectedCourse.published;
      
      await courses.updatePublishStatus(selectedCourseCode, newPublishedStatus);
      
      // Update the local state
      setCourseList(prev => prev.map(course => 
        course.code === selectedCourseCode 
          ? { ...course, published: newPublishedStatus }
          : course
      ));
      
      setSuccess(`Course ${newPublishedStatus ? 'published' : 'unpublished'} successfully!`);
    } catch (err) {
      setError(err.message || 'Failed to update course publish status');
    } finally {
      setLoading(false);
    }
  };

  if (!isInstructor) {
    return <p>Only instructors can publish/unpublish courses.</p>;
  }

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
    <div className="sb-mar-top-sp-32">
      <h3>Publish/Unpublish Course</h3>
      
      <div className="sb-form">
        <div className="sb-mar-bottom-sp-16">
          <label htmlFor="courseCode">Select Course *</label>
          <select
            id="courseCode"
            value={selectedCourseCode}
            onChange={(e) => setSelectedCourseCode(e.target.value)}
            style={{ display: "block", width: "100%" }}
          >
            <option value="" disabled>Select a course</option>
            {courseList.map(course => (
              <option key={course.code} value={course.code}>
                {course.code} - {course.title} {course.published ? '(Published)' : '(Unpublished)'}
              </option>
            ))}
          </select>
        </div>

        <button 
          type="button" 
          className="sb-button"
          disabled={!selectedCourseCode || loading}
          onClick={handlePublishToggle}
        >
          {loading ? 'Updating...' : 
            courseList.find(c => c.code === selectedCourseCode)?.published 
              ? 'Unpublish Course' 
              : 'Publish Course'
          }
        </button>
      </div>
{/* 
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>} */}
    </div>
  );
};

export default CoursePublishForm;
