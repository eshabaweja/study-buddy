import { useSearchParams } from 'react-router-dom';
import Login from "../components/Login";
import Logout from "../components/Logout";
import { useAuth } from "../contexts/AuthContext";
import InstructorPage from "./InstructorPage";
import StudentPage from "./StudentPage";
import AdminPage from "./AdminPage";
import Announcement from "../components/Announcement";

function Dashboard() {
  const { isAuthenticated, isInstructor, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const instructorView = searchParams.get('view') === 'instructor';

  if (!isAuthenticated) {
    return (
      <div className="sb-container app-container">
        <div className="sb-grid">
          <div className="sb-grid__cell--12 sb-grid__cell--6@md sb-pad-left-sp-32 app-pad-left-sp-0">
            <Login />
          </div>
        </div>
      </div>
    );
  }

  const renderMain = () => {
    if (isAdmin && !instructorView) {
      return <AdminPage />;
    }
    if (isInstructor) {
      return <InstructorPage />;
    }
    return <StudentPage />;
  };

  return (
    <div className="sb-container app-container">
      <Announcement>
        <div className="app-announcement__text">
          How was your app experience?{' '}
          <a
            href="https://forms.office.com/r/qwxt92jLzP"
            target="_blank"
            rel="noopener noreferrer"
          >
            Let us know
          </a>
          .
        </div>
      </Announcement>
      <Logout />
      {renderMain()}
    </div>
  );
}

export default Dashboard;
