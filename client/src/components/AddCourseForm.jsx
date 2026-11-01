import { useState, useEffect } from "react";
import { courseImages, courses } from "../utils/api";
import { toast } from '../utils/toast';

const AddCourseForm = () => {
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    courseImages: [],
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Sanitize the course code to only allow alphanumeric characters and convert to uppercase.
  const sanitizeInput = (value) => {
    return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "code" ? sanitizeInput(value) : value,
    }));
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newImages = [...formData.courseImages];
      
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push(reader.result);
          setFormData(prev => ({ ...prev, courseImages: newImages }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Remove a specific image
  const removeImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      courseImages: prev.courseImages.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic validation: both fields are required.
    if (!formData.code || !formData.title) {
      setError("Both fields are required.");
      return;
    }

    try {
      // 1. Create the course
      await courses.create({
        code: formData.code,
        title: formData.title,
      });

      // 2. If images were uploaded, add them
      if (formData.courseImages.length > 0) {
        try {
          for (let i = 0; i < formData.courseImages.length; i++) {
            await courseImages.create({
              course_code: formData.code,
              image_url: formData.courseImages[i],
              display_order: i,
            });
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to upload course images");
          return;
        }
      }

      // If everything succeeded, display success message
      setSuccess("Course added successfully!");
      // Reset the form fields
      setFormData({ code: "", title: "", courseImages: [] });
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
      <h3>Add a New Course</h3>
      <form className="bux-form" onSubmit={handleSubmit}>
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="code">Course Code *</label>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            onFocus={clearMessages}
            placeholder="e.g., ECE5020"
            style={{ display: "block", width: "100%" }}
          />
        </div>
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="title">Course Title *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            onFocus={clearMessages}
            placeholder="e.g., Mixed Signal VLSI"
            style={{ display: "block", width: "100%" }}
          />
        </div>

        {/* Course Images Upload */}
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="courseImages">Course Images (Optional)</label>
          <input
            type="file"
            id="courseImages"
            name="courseImages"
            onChange={handleFileChange}
            onFocus={clearMessages}
            accept="image/*"
            multiple
            className="bux-form__input"
          />
          {/* Display uploaded images with remove buttons */}
          {formData.courseImages.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p>Uploaded Images:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {formData.courseImages.map((image, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <img 
                      src={image} 
                      alt={`Course image ${index + 1}`} 
                      style={{ maxWidth: "200px", maxHeight: "200px" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      style={{
                        position: "absolute",
                        top: "5px",
                        right: "5px",
                        opacity: 0.5,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="bux-button">
          Add Course
        </button>
      </form>

    </div>
  );
};

export default AddCourseForm; 