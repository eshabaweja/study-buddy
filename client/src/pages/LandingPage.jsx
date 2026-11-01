import { useAuth } from "../contexts/AuthContext";
import Login from "../components/Login";
import Logout from "../components/Logout";
import { useState } from "react";
import ImageModal from "../components/ImageModal";
import workflowImage from "../assets/images/buckademy_workflow.png";

function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="main-content">
        <div className="bux-container bux-mar-top-sp-16 bux-mar-bottom-sp-16">
          <div className="bux-grid ba-landing-grid">
            <div className="bux-grid__cell--12 bux-grid__cell--6@md">
              <div className="bux-paragraph">
                Let us establish a process that we will use whenever we encounter a
                problem. To solve a problem, we will extract two types of
                information from the question:
                <ul className="bux-list-ul bux-mar-top-sp-8 bux-mar-bottom-sp-8">
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
                  className="bux-image bux-pad-all-sp-16 bux-pad-all-sp-32@md ba-interactive ba-landing-image"
                  src={workflowImage}
                  alt="An image depicting 2 type of input and multiple concepts flowing into the problem solving process, and an outward flowing arrow representing the goal."
                  onClick={() => setIsModalOpen(true)}
                />
              </div>
              <div className="bux-paragraph">
                This information acts as input to the system built on concepts
                related to the problem. Using this data, we can solve the problem
                and achieve the goal. We can think of the first part as information
                extraction and parsing, and the second part access prior information
                (concepts). You can master the art of problem solving if you follow
                this process.
              </div>
            </div>

            <div className="bux-grid__cell--12 bux-grid__cell--6@md bux-pad-left-sp-32 ba-pad-left-sp-0">
              {isAuthenticated ? <Logout /> : <Login />}
              <div className="ba-video-responsive">
                <iframe
                  src="https://www.youtube.com/embed/uTL4-Asy1mA"
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
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