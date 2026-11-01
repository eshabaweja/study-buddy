import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CourseAnalytics from '../components/analytics/CourseAnalytics';
import StudentAnalytics from '../components/analytics/StudentAnalytics';
import {
  AdminPromoteInstructorForm,
  AdminEnrollStudentForm,
  AdminUnenrollStudentForm,
  AdminCopyCourseForm,
  AdminDeleteCourseForm,
} from '../components/admin/AdminForms';

function AdminPage() {
  const { isInstructor } = useAuth();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const cards = [
    {
      id: 'analytics',
      title: 'Platform analytics',
      description: 'Enrollment and progress across all courses and students',
      icon: '📊',
    },
    {
      id: 'users',
      title: 'User management',
      description: 'Grant instructor access, enroll or unenroll students in courses',
      icon: '👤',
    },
    {
      id: 'courses',
      title: 'Course operations',
      description: 'Duplicate or delete a course offering',
      icon: '📋',
    },
  ];

  return (
    <div className="ba-dashboard">
      <div className="ba-dashboard__header">
        <h2 className="ba-dashboard__title">Admin Dashboard</h2>
        {isInstructor && (
          <Link to="/dashboard?view=instructor" className="bux-button--alt-small">
            Instructor tools →
          </Link>
        )}
      </div>

      <div className="ba-dashboard__cards bux-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-grid__cell--4@lg"
          >
            <div
              className={`ba-card ba-dashboard-card${expandedSection === card.id ? ' ba-dashboard-card--active' : ''}`}
              onClick={() => toggleSection(card.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSection(card.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="ba-card__content">
                <div className="ba-card__heading">
                  <span>
                    {card.icon} {card.title}
                  </span>
                </div>
                <p className="ba-dashboard-card__desc">{card.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {expandedSection === 'analytics' && (
        <div className="ba-dashboard__panel">
          <div className="ba-dashboard__panel-header">
            <h3 className="ba-dashboard__panel-title">Platform analytics</h3>
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={() => toggleSection('analytics')}
            >
              Collapse
            </button>
          </div>
          <CourseAnalytics showInstructor />
          <StudentAnalytics />
        </div>
      )}

      {expandedSection === 'users' && (
        <div className="ba-dashboard__panel">
          <div className="ba-dashboard__panel-header">
            <h3 className="ba-dashboard__panel-title">User management</h3>
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={() => toggleSection('users')}
            >
              Collapse
            </button>
          </div>
          <div className="ba-dashboard__panel-grid bux-grid">
            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-grid__cell--4@lg">
              <div className="ba-quiz-form__section">
                <h4 className="ba-quiz-form__section-title">Grant instructor access</h4>
                <AdminPromoteInstructorForm />
              </div>
            </div>
            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-grid__cell--4@lg">
              <div className="ba-quiz-form__section">
                <h4 className="ba-quiz-form__section-title">Enroll student</h4>
                <AdminEnrollStudentForm />
              </div>
            </div>
            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-grid__cell--4@lg">
              <div className="ba-quiz-form__section">
                <h4 className="ba-quiz-form__section-title">Unenroll student</h4>
                <AdminUnenrollStudentForm />
              </div>
            </div>
          </div>
        </div>
      )}

      {expandedSection === 'courses' && (
        <div className="ba-dashboard__panel">
          <div className="ba-dashboard__panel-header">
            <h3 className="ba-dashboard__panel-title">Course operations</h3>
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={() => toggleSection('courses')}
            >
              Collapse
            </button>
          </div>
          <div className="ba-dashboard__panel-grid bux-grid">
            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md">
              <div className="ba-quiz-form__section">
                <h4 className="ba-quiz-form__section-title">Duplicate course</h4>
                <AdminCopyCourseForm />
              </div>
            </div>
            <div className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md">
              <div className="ba-quiz-form__section">
                <h4 className="ba-quiz-form__section-title">Delete course</h4>
                <AdminDeleteCourseForm />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
