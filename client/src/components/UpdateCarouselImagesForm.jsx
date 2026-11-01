import { useState, useEffect } from 'react';
import { fetchInstructorCoursesSorted } from '../utils/instructorCourses';
import { courseImages } from '../utils/api';
import ImageModal from './ImageModal';
import { toast } from '../utils/toast';

const UpdateCarouselImagesForm = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToDelete, setImagesToDelete] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

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

  // Fetch existing images when course is selected
  useEffect(() => {
    const fetchCourseImages = async () => {
      if (!selectedCourseCode) {
        setExistingImages([]);
        setImagesToDelete([]);
        return;
      }

      try {
        const response = await courseImages.getByCourse(selectedCourseCode);
        setExistingImages(response.images || []);
        setImagesToDelete([]);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchCourseImages();
  }, [selectedCourseCode]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewImages(prev => [...prev, {
            file,
            preview: reader.result
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const markImageForDeletion = (imageId) => {
    setImagesToDelete(prev => [...prev, imageId]);
    setExistingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const removeNewImage = (index) => {
    setNewImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedCourseCode) {
      setError('Please select a course');
      return;
    }

    try {
      // First delete any images marked for deletion
      for (const imageId of imagesToDelete) {
        await courseImages.delete(imageId);
      }

      // Then upload new images
      for (const { preview } of newImages) {
        await courseImages.create({
          course_code: selectedCourseCode,
          image_url: preview,
          display_order: existingImages.length + newImages.indexOf({ preview })
        });
      }

      setNewImages([]);
      setImagesToDelete([]);
      const updatedImages = await courseImages.getByCourse(selectedCourseCode);
      setExistingImages(updatedImages.images || []);
      setSuccess('Images updated successfully');
    } catch (err) {
      setError(err.message);
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

  if (loading) return <div>Loading courses...</div>;

  return (
    <div className="bux-mar-top-sp-32">
      <h3>Update/Delete Course Carousel Images</h3>
      <form className="bux-form" onSubmit={handleSubmit}>
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="courseCode">Select Course *</label>
          <select
            id="courseCode"
            value={selectedCourseCode}
            onChange={(e) => setSelectedCourseCode(e.target.value)}
            required
            style={{ display: "block", width: "100%" }}
          >
            <option value="">Select a course</option>
            {courses.map(course => (
              <option key={course.code} value={course.code}>
                {course.code} - {course.title}
              </option>
            ))}
          </select>
        </div>

        {/* Existing Images */}
        {existingImages.length > 0 && (
          <div className="bux-mar-bottom-sp-16">
            <label>Current Carousel Images</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
              {existingImages.map((image, index) => (
                <div key={image.id} style={{ position: "relative" }}>
                  <div 
                    className="ba-interactive ba-thumbnail"
                    onClick={() => setSelectedImage({
                      url: image.image_url,
                      alt: `Course image ${index + 1}`
                    })}
                  >
                    <img 
                      src={image.image_url} 
                      alt={`Course image ${index + 1}`} 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => markImageForDeletion(image.id)}
                    className="ba-remove-image-button"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Images Upload */}
        <div className="bux-mar-bottom-sp-16">
          <label htmlFor="newImages">Add New Images</label>
          <input
            type="file"
            id="newImages"
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="bux-form__input"
          />
          {newImages.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p>New Images to Upload:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {newImages.map((image, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <div 
                      className="ba-image-thumbnail"
                      onClick={() => setSelectedImage({
                        url: image.preview,
                        alt: `New image ${index + 1}`
                      })}
                    >
                      <img 
                        src={image.preview} 
                        alt={`New image ${index + 1}`} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="ba-remove-image-button"
                      aria-label={`Remove new image ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button 
          type="submit" 
          className="bux-button"
          disabled={!selectedCourseCode || (newImages.length === 0 && imagesToDelete.length === 0)}
        >
          Update Images
        </button>
      </form>

      <ImageModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage?.url || ''}
        altText={selectedImage?.alt || ''}
      />
    </div>
  );
};

export default UpdateCarouselImagesForm; 