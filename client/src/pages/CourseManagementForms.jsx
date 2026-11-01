import CourseCreateForm from "../components/forms/CourseCreateForm";
import ConceptCreateAssociateForm from "../components/forms/ConceptCreateAssociateForm";
import CourseCarouselImagesUpdateForm from "../components/forms/CourseCarouselImagesUpdateForm";
import CourseConceptUpdateForm from "../components/forms/CourseConceptUpdateForm";
import CoursePublishToggleForm from "../components/forms/CoursePublishToggleForm";
import CourseDeleteForm from "../components/forms/CourseDeleteForm";
import AddQuestionForm from "../components/AddQuestionForm";
import QuizManagePanel from "../components/QuizManagePanel";

function CourseManagementForms() {
  return (
    <>
      <CourseCreateForm />
      <ConceptCreateAssociateForm />
      <AddQuestionForm />
      <QuizManagePanel />
      <CoursePublishToggleForm />
      <CourseDeleteForm />
      <CourseCarouselImagesUpdateForm />
      <CourseConceptUpdateForm />
    </>
  );
}

export default CourseManagementForms;