// API configuration
import {
  notifySessionExpired,
  SessionExpiredError,
  SESSION_RELOGIN_MESSAGE,
} from './sessionAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// console.log('API URL:', API_URL); // Debug log

function isAuthEndpoint(endpoint) {
    return typeof endpoint === 'string' && endpoint.startsWith('/auth/');
}

function hasClientSessionWithoutToken() {
    return Boolean(
        localStorage.getItem('userEmail')
        && localStorage.getItem('userName')
        && !localStorage.getItem('token'),
    );
}

function throwIfUnauthorized(endpoint, response) {
    if (isAuthEndpoint(endpoint)) return;
    if (response?.status !== 401) return;
    notifySessionExpired(SESSION_RELOGIN_MESSAGE);
    throw new SessionExpiredError(SESSION_RELOGIN_MESSAGE);
}

function throwIfMissingToken(endpoint) {
    if (isAuthEndpoint(endpoint) || !hasClientSessionWithoutToken()) return;
    notifySessionExpired(SESSION_RELOGIN_MESSAGE);
    throw new SessionExpiredError(SESSION_RELOGIN_MESSAGE);
}

// Helper function to make API calls
const apiCall = async (endpoint, options = {}) => {
    throwIfMissingToken(endpoint);

    const url = `${API_URL}${endpoint}`;
    // console.log('Making request to:', url); // Debug log
    
    // Get user email and token from localStorage for authenticated requests
    const userEmail = localStorage.getItem('userEmail');
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...(userEmail && { 'x-user-email': userEmail }),
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(url, {
        ...options,
        headers,
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        const message = error.message || error.error || 'API call failed';
        throwIfUnauthorized(endpoint, response);
        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
};

// Auth endpoints
export const auth = {
    login: (credentials) => apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }),
    signup: (userData) => apiCall('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(userData),
    }),
};

// Questions endpoints
export const questions = {
    getByCourse: (courseCode) => apiCall(`/questions/${courseCode}`),
    getByCourseId: (courseId) => apiCall(`/questions/by-course-id/${courseId}`),
    getByConcept: (courseCode, conceptId) =>
        apiCall(`/questions/${courseCode}/concept/${conceptId}`),
    create: (questionData) => apiCall('/questions', {
        method: 'POST',
        body: JSON.stringify(questionData),
    }),
    update: (questionId, questionData) => apiCall(`/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(questionData),
    }),
    updatePublishStatus: (questionId, published) => apiCall(`/questions/${questionId}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ published }),
    }),
    reorder: (courseCode, questionIds) => apiCall('/questions/reorder', {
        method: 'PUT',
        body: JSON.stringify({ course_code: courseCode, question_ids: questionIds }),
    }),
    delete: (questionId) => apiCall(`/questions/${questionId}`, { method: 'DELETE' }),
    getFull: (questionId) => apiCall(`/questions/full_question/${questionId}`),
    canEdit: (questionId) => apiCall(`/questions/${questionId}/can-edit`),
    regenerateFigureDescription: (questionId) =>
        apiCall(`/questions/${questionId}/regenerate-figure-description`, {
            method: 'POST',
        }),
};

// Explicit Data endpoints
export const explicitData = {
    create: (data) => apiCall('/explicit_data', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deleteAll: (questionId) => apiCall(`/explicit_data/${questionId}`, {
        method: 'DELETE',
    }),
};

// Implicit Data endpoints
export const implicitData = {
    create: (data) => apiCall('/implicit_data', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deleteAll: (questionId) => apiCall(`/implicit_data/${questionId}`, {
        method: 'DELETE',
    }),
};

// Solutions endpoints
export const solutions = {
    create: (data) => apiCall('/solutions', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deleteAll: (questionId) => apiCall(`/solutions/${questionId}`, {
        method: 'DELETE',
    }),
};

// Mathematical Solutions endpoints
export const mathematicalSolutions = {
    create: (data) => apiCall('/mathematical_solutions', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    deleteAll: (questionId) => apiCall(`/mathematical_solutions/${questionId}`, {
        method: 'DELETE',
    }),
};

// Concepts endpoints
export const concepts = {
    getAll: () => apiCall('/concepts'),
    create: (conceptData) => apiCall('/concepts', {
        method: 'POST',
        body: JSON.stringify(conceptData),
    }),
};

// Course Concepts endpoints
export const courseConcepts = {
    getByCourse: (courseCode) => apiCall(`/courses_concepts/${courseCode}`),
    create: (associationData) => apiCall('/courses_concepts', {
        method: 'POST',
        body: JSON.stringify(associationData),
    }),
    reorder: (courseCode, conceptIds) => apiCall('/courses_concepts/reorder', {
        method: 'PUT',
        body: JSON.stringify({ course_code: courseCode, concept_ids: conceptIds }),
    }),
};

// Images endpoints
export const images = {
    create: (imageData) => apiCall('/images', {
        method: 'POST',
        body: JSON.stringify(imageData),
    }),
    delete: (imageId) => apiCall(`/images/${imageId}`, {
        method: 'DELETE',
    }),
};

// Questions Concepts endpoints
export const questionConcepts = {
    create: (associationData) => apiCall('/questions_concepts', {
        method: 'POST',
        body: JSON.stringify(associationData),
    }),
    replace: (questionId, conceptIds) => apiCall(`/questions_concepts/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify({ concept_ids: conceptIds }),
    }),
};

// Courses endpoints
export const courses = {
    getAll: (published) => {
        const url = published !== undefined ? `/courses?published=${published}` : '/courses';
        return apiCall(url);
    },
    getMine: () => apiCall('/courses/mine'),
    create: (courseData) => apiCall('/courses', {
        method: 'POST',
        body: JSON.stringify(courseData),
    }),
    getByCode: (courseCode) => apiCall(`/courses/${courseCode}`),
    updatePublishStatus: (courseCode, published) => apiCall(`/courses/${courseCode}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ published }),
    }),
    deleteByCode: (courseCode) => apiCall(`/courses/${courseCode}`, {
        method: 'DELETE',
    }),
};

// Course Images endpoints
export const courseImages = {
    getByCourse: (courseCode) => apiCall(`/course_images/${courseCode}`),
    create: (imageData) => apiCall('/course_images', {
        method: 'POST',
        body: JSON.stringify(imageData),
    }),
    delete: (imageId) => apiCall(`/course_images/${imageId}`, {
        method: 'DELETE',
    }),
};

// Student Progress endpoints
export const studentProgress = {
    getCourses: () => apiCall('/student_progress/courses'),
    addCourse: (courseCode) => apiCall(`/student_progress/courses/${courseCode}`, {
        method: 'POST',
    }),
    removeCourse: (courseCode) => apiCall(`/student_progress/courses/${courseCode}`, {
        method: 'DELETE',
    }),
    addCourseById: (courseId) => apiCall(`/student_progress/courses/id/${courseId}`, {
        method: 'POST',
    }),
    removeCourseById: (courseId) => apiCall(`/student_progress/courses/id/${courseId}`, {
        method: 'DELETE',
    }),
    getSolvedQuestions: () => apiCall('/student_progress/questions'),
    markQuestionSolved: (questionId) => apiCall(`/student_progress/questions/${questionId}`, {
        method: 'POST',
    }),
    markQuestionUnsolved: (questionId) => apiCall(`/student_progress/questions/${questionId}`, {
        method: 'DELETE',
    }),
    isQuestionSolved: (questionId) => apiCall(`/student_progress/questions/${questionId}`),
    getStarredQuestions: () => apiCall('/student_progress/starred_questions'),
    starQuestion: (questionId) => apiCall(`/student_progress/starred_questions/${questionId}`, {
        method: 'POST',
    }),
    unstarQuestion: (questionId) => apiCall(`/student_progress/starred_questions/${questionId}`, {
        method: 'DELETE',
    }),
    isQuestionStarred: (questionId) => apiCall(`/student_progress/starred_questions/${questionId}`),
};

// Quizzes endpoints
export const quizzes = {
    listForCourseInstructor: (courseId) => apiCall(`/quizzes/course/${courseId}`),
    listForCourseStudent: (courseId) => apiCall(`/quizzes/course/${courseId}/student`),
    create: (data) => apiCall('/quizzes', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    get: (quizId) => apiCall(`/quizzes/${quizId}`),
    getPreview: (quizId) => apiCall(`/quizzes/${quizId}/preview`),
    update: (quizId, data) => apiCall(`/quizzes/${quizId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    publishScores: (quizId, scoresPublished) => apiCall(`/quizzes/${quizId}/publish-scores`, {
        method: 'PATCH',
        body: JSON.stringify({ scores_published: scoresPublished }),
    }),
    delete: (quizId) => apiCall(`/quizzes/${quizId}`, { method: 'DELETE' }),
    addItem: (quizId, data) => apiCall(`/quizzes/${quizId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    syncItems: (quizId, items) => apiCall(`/quizzes/${quizId}/items`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
    }),
    deleteItem: (quizId, itemId) => apiCall(`/quizzes/${quizId}/items/${itemId}`, {
        method: 'DELETE',
    }),
    getTake: (quizId) => apiCall(`/quizzes/${quizId}/take`),
    start: (quizId) => apiCall(`/quizzes/${quizId}/start`, { method: 'POST' }),
    saveAnswer: (quizId, itemId, answer_json, fetchOptions) => apiCall(`/quizzes/${quizId}/answers/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify({ answer_json }),
        ...fetchOptions,
    }),
    submit: (quizId) => apiCall(`/quizzes/${quizId}/submit`, { method: 'POST' }),
    getResults: (quizId) => apiCall(`/quizzes/${quizId}/results`),
    listSubmissions: (quizId) => apiCall(`/quizzes/${quizId}/submissions`),
    downloadSubmissionsCsv: async (quizId) => {
        const exportPath = `/quizzes/${quizId}/submissions/export`;
        throwIfMissingToken(exportPath);
        const url = `${API_URL}${exportPath}`;
        const userEmail = localStorage.getItem('userEmail');
        const token = localStorage.getItem('token');
        const response = await fetch(url, {
            headers: {
                ...(userEmail && { 'x-user-email': userEmail }),
                ...(token && { Authorization: `Bearer ${token}` }),
            },
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Download failed' }));
            const message = error.message || error.error || 'Download failed';
            throwIfUnauthorized(`/quizzes/${quizId}/submissions/export`, response);
            throw new Error(message);
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        const filename = match?.[1] || 'quiz-submissions.csv';
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(objectUrl);
    },
    getSubmission: (quizId, studentEmail) =>
        apiCall(`/quizzes/${quizId}/submissions/${encodeURIComponent(studentEmail)}`),
    gradeWithAi: (quizId) => apiCall(`/quizzes/${quizId}/grade-with-ai`, { method: 'POST' }),
    overrideAnswer: (quizId, studentEmail, itemId, data) =>
        apiCall(
            `/quizzes/${quizId}/submissions/${encodeURIComponent(studentEmail)}/answers/${itemId}`,
            {
                method: 'PATCH',
                body: JSON.stringify(data),
            },
        ),
};

// Admin endpoints
export const admin = {
    getCourses: () => apiCall('/admin/courses'),
    setInstructor: (email, is_instructor) =>
        apiCall(`/admin/users/${encodeURIComponent(email)}/instructor`, {
            method: 'PATCH',
            body: JSON.stringify({ is_instructor }),
        }),
    enrollStudent: (data) =>
        apiCall('/admin/enrollments', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    unenrollStudent: (courseId, studentEmail) =>
        apiCall(
            `/admin/courses/${courseId}/enrollments/${encodeURIComponent(studentEmail)}`,
            { method: 'DELETE' },
        ),
    instructorUnenrollStudent: (courseId, studentEmail) =>
        apiCall(
            `/admin/instructor/courses/${courseId}/enrollments/${encodeURIComponent(studentEmail)}`,
            { method: 'DELETE' },
        ),
    copyCourse: (data) =>
        apiCall('/admin/courses/copy', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    deleteCourse: (courseId) =>
        apiCall(`/admin/courses/${courseId}`, { method: 'DELETE' }),
};

// Analytics endpoints
export const analytics = {
    getCourses: () => apiCall('/analytics/courses'),
    getCourseDetails: (courseIdOrCode, days = 30) =>
        apiCall(`/analytics/courses/${courseIdOrCode}?days=${days}`),
    getStudents: () => apiCall('/analytics/students'),
    getStudentDetails: (studentEmail) =>
        apiCall(`/analytics/students/${encodeURIComponent(studentEmail)}`),
};

export const pdfToText = {
    convert: async (file) => {
        throwIfMissingToken('/pdf-to-text');
        const url = `${API_URL}/pdf-to-text`;
        const userEmail = localStorage.getItem('userEmail');
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...(userEmail && { 'x-user-email': userEmail }),
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'An error occurred' }));
            const message = error.message || error.error || 'Could not convert this file';
            throwIfUnauthorized('/pdf-to-text', response);
            throw new Error(message);
        }

        return response.json();
    },
};