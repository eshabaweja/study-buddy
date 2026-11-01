import { useState } from "react";
import CourseManagementForms from "./CourseManagementForms";
import CourseAnalytics from "../components/analytics/CourseAnalytics";
import StudentAnalytics from "../components/analytics/StudentAnalytics";

function InstructorPage() {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const cards = [
    {
      id: 'course-analytics',
      title: 'Course Analytics',
      description: 'View enrollment statistics, active students, and completion rates for all courses',
      icon: '📊',
    },
    {
      id: 'student-analytics',
      title: 'Student Analytics',
      description: 'Track student activity, course enrollments, and individual progress across courses',
      icon: '🎓',
    },
    {
      id: 'course-management',
      title: 'Course Management',
      description: 'Create and edit courses, questions, concepts, and manage course content',
      icon: '📝',
    },
    {
      id: 'pdf-to-text',
      title: 'PDF to text',
      description: 'Upload a PDF or image (JPEG, PNG, up to 20MB) and convert it to copyable text',
      icon: '📄',
      href: '/instructor/pdf-to-text',
    },
  ];

  return (
    <div className="ba-dashboard">
      <div className="ba-dashboard__header">
        <h2 className="ba-dashboard__title">Instructor Dashboard</h2>
      </div>

      <div className="ba-dashboard__cards bux-grid">
        {cards.map((card) => (
          <div
            key={card.id}
            className="bux-grid__cell bux-grid__cell--12 bux-grid__cell--6@md bux-grid__cell--3@lg"
          >
            <div
              className={`ba-card ba-dashboard-card${expandedSection === card.id ? ' ba-dashboard-card--active' : ''}`}
              onClick={() => {
                if (card.href) {
                  window.open(card.href, '_blank', 'noopener,noreferrer');
                  return;
                }
                toggleSection(card.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (card.href) {
                    window.open(card.href, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  toggleSection(card.id);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="ba-card__content">
                <div className="ba-card__heading">
                  <span>{card.icon} {card.title}</span>
                </div>
                <p className="ba-dashboard-card__desc">{card.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {expandedSection === 'course-analytics' && (
        <div className="ba-dashboard__panel">
          <div className="ba-dashboard__panel-header">
            <h3 className="ba-dashboard__panel-title">Course Analytics</h3>
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={() => toggleSection('course-analytics')}
            >
              Collapse
            </button>
          </div>
          <CourseAnalytics />
        </div>
      )}

      {expandedSection === 'student-analytics' && (
        <div className="ba-dashboard__panel">
          <div className="ba-dashboard__panel-header">
            <h3 className="ba-dashboard__panel-title">Student Analytics</h3>
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={() => toggleSection('student-analytics')}
            >
              Collapse
            </button>
          </div>
          <StudentAnalytics />
        </div>
      )}

      {expandedSection === 'course-management' && (
        <div className="ba-dashboard__panel">
          <div className="ba-dashboard__panel-header">
            <h3 className="ba-dashboard__panel-title">Course Management</h3>
            <button
              type="button"
              className="bux-button bux-button--secondary"
              onClick={() => toggleSection('course-management')}
            >
              Collapse
            </button>
          </div>
          <CourseManagementForms />
        </div>
      )}
    </div>
  );
}

export default InstructorPage;
