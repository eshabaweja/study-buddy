import { useAuth } from "../contexts/AuthContext";
import Login from "../components/Login";
import Logout from "../components/Logout";
import { useState } from "react";
import ImageModal from "../components/ImageModal";
import workflowImage from "../assets/images/study_buddy_workflow.png";

function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="main-content">
        <div className="sb-container sb-mar-top-sp-16 sb-mar-bottom-sp-16">
          <div className="sb-grid app-landing-grid">
            <div className="sb-grid__cell--12 sb-grid__cell--6@md">
              <div className="sb-paragraph">
                Let us establish a process that we will use whenever we encounter a
                problem. To solve a problem, we will extract two types of
                information from the question:
                <ul className="sb-list-ul sb-mar-top-sp-8 sb-mar-bottom-sp-8">
                  <li>
                    <b>Explicit information:</b> all the information that is clearly
                    given to us.
                  </li>
                  <li>
                    <b>Implicit information:</b> the data that is embedded or hidden
                    in the problem at hand.
                  </li>
                </ul>
                <img
                  className="sb-image sb-pad-all-sp-16 sb-pad-all-sp-32@md app-interactive app-landing-image"
                  src={workflowImage}
                  alt="An image depicting 2 type of input and multiple concepts flowing into the problem solving process, and an outward flowing arrow representing the goal."
                  onClick={() => setIsModalOpen(true)}
                />
              </div>
              <div className="sb-paragraph">
                This information acts as input to the system built on concepts
                related to the problem. Using this data, we can solve the problem
                and achieve the goal. We can think of the first part as information
                extraction and parsing, and the second part access prior information
                (concepts). You can master the art of problem solving if you follow
                this process.
              </div>
            </div>

            <div className="sb-grid__cell--12 sb-grid__cell--6@md sb-pad-left-sp-32 app-pad-left-sp-0">
              {isAuthenticated ? <Logout /> : <Login />}
            </div>
          </div>
        </div>
      </div>

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageUrl={workflowImage}
        altText="An image depicting 2 type of input and multiple concepts flowing into the problem solving process, and an outward flowing arrow representing the goal."
      />
    </>
  );
}

export default LandingPage; 