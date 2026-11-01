import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import ConceptCrunch from "./pages/ConceptCrunch";
import NotFoundPage from "./pages/NotFoundPage";
import Dashboard from "./pages/Dashboard";
import Help from "./pages/Help";
import ConceptLearn from "./pages/ConceptLearn";
import QuestionPage from "./pages/QuestionPage";
import ConceptQuestionPage from "./pages/ConceptQuestionPage";
import SignUp from "./components/SignUp";
import CourseDetailAnalytics from "./components/analytics/CourseDetailAnalytics";
import StudentDetailAnalytics from "./components/analytics/StudentDetailAnalytics";
import QuizListPage from "./pages/QuizListPage";
import QuizTakePage from "./pages/QuizTakePage";
import QuizResultsPage from "./pages/QuizResultsPage";
import QuizEditPage from "./pages/QuizEditPage";
import QuizPreviewPage from "./pages/QuizPreviewPage";
import QuizSubmissionsPage from "./pages/QuizSubmissionsPage";
import PdfToTextPage from "./pages/PdfToTextPage";

export const BaRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LandingPage/>}/>
            <Route path="/concepts" element={<ConceptCrunch/>}/>
            <Route path="/concepts/:courseCode/:questionId" element={<QuestionPage/>}/>
            <Route path="/concepts/:courseCode/concept/:conceptId" element={<ConceptQuestionPage />} />
            <Route path="/concepts/:courseCode" element={<ConceptLearn/>}/>
            <Route path="/dashboard" element={<Dashboard/>}/>
            <Route path="/quizzes/:courseId" element={<QuizListPage/>}/>
            <Route path="/instructor/quizzes/new" element={<QuizEditPage/>}/>
            <Route path="/instructor/quizzes/:quizId/edit" element={<QuizEditPage/>}/>
            <Route path="/instructor/quizzes/:quizId/preview" element={<QuizPreviewPage/>}/>
            <Route path="/instructor/quizzes/:quizId/submissions/:studentEmail" element={<QuizSubmissionsPage/>}/>
            <Route path="/instructor/quizzes/:quizId/submissions" element={<QuizSubmissionsPage/>}/>
            <Route path="/instructor/pdf-to-text" element={<PdfToTextPage/>}/>
            <Route path="/pdf-to-text" element={<PdfToTextPage/>}/>
            <Route path="/quizzes/:courseId/:quizId/results" element={<QuizResultsPage/>}/>
            <Route path="/quizzes/:courseId/:quizId" element={<QuizTakePage/>}/>
            <Route path="/help" element={<Help/>}/>
            <Route path="/signup" element={<SignUp/>}/>
            <Route path="/analytics/courses/:courseCode" element={<CourseDetailAnalytics/>}/>
            <Route path="/analytics/students/:studentEmail" element={<StudentDetailAnalytics/>}/>
            <Route path="*" element={<NotFoundPage/>}/>
        </Routes>
    )
} 