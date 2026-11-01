import { useState } from 'react';

function OsuNavbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

return <nav id="osu-navbar" className="bux-osu-nav" aria-label="Ohio State links">
        <div 
            className="bux-osu-nav__overlay" 
            style={{ display: isMenuOpen ? 'block' : 'none' }}
            onClick={closeMenu}
        ></div>
        <div className="bux-osu-nav__wrapper">
            <div className="bux-container">
                <div id="osu-navname-block">
                    <a className="bux-osu-nav__osu-logo-link" href="https://osu.edu">
                        <img
                            className="bux-osu-nav__osu-logo-img"
                            src="/bux-assets/images/osu-logos/navbar/osu-navbar.svg"
                            alt="The Ohio State University Homepage"
                        />
                    </a>
                </div>
                <div id="osu-navlinks-block">
                    <button
                        type="button"
                        id="osu-nav-trigger"
                        aria-controls="osu-navlinks"
                        aria-expanded={isMenuOpen}
                        onClick={toggleMenu}
                    >
                        <span className="visually-hidden">Show Links</span>
                    </button>
                    <ul
                        id="osu-navlinks"
                        aria-labelledby="osu-nav-trigger"
                        className="bux-osu-nav__links"
                    >
                        <li className="bux-osu-nav__link">
                            <a href="https://maps.osu.edu/">Map</a>
                        </li>
                        <li className="bux-osu-nav__link">
                            <a href="http://buckeyelink.osu.edu/">Buckeye Link</a>
                        </li>
                        <li className="bux-osu-nav__link">
                            <a href="https://email.osu.edu/">Webmail</a>
                        </li>
                        <li className="bux-osu-nav__link">
                            <a href="https://www.osu.edu/search/">Search Ohio State</a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </nav>
}

export default OsuNavbar; 