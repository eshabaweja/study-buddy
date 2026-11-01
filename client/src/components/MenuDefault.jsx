import { NavLink } from "react-router-dom";

function MenuDefault() {

    const closeMobileMenu = () => {
        const navButton = document.querySelector(".disclosure-nav-toggle");
        
        if (navButton && navButton.getAttribute("aria-expanded") === "true") {
            navButton.click();
        }
    };

    const handleNavClick = (event) => {
        closeMobileMenu();
        if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.blur();
        }
    };

    return <div className="bux-menu-wrapper">
        <div className="bux-container bux-grid bux-container__menu">
            <nav
                id="bux-main-menu"
                aria-label="Main Navigation"
                className="disclosure-nav disclosure-nav-orientation-horizontal"
            >
                <ul className="bux-menu">
                    <li className="bux-menu__item">
                        <NavLink to="/"
                            end
                            className={({ isActive }) =>
                                `bux-menu__link ${isActive ? 'bux-menu__link--active' : ''}`
                            }
                            onClick={handleNavClick}
                        >Home </NavLink>
                    </li>
                    <li className="bux-menu__item">
                        <NavLink
                            to="/concepts"
                            end
                            className={({ isActive }) =>
                                `bux-menu__link ${isActive ? 'bux-menu__link--active' : ''}`
                            }
                            onClick={handleNavClick}
                        >Concept Crunch</NavLink>
                    </li>
                    <li className="bux-menu__item">
                        <NavLink to="/dashboard"
                            end
                            className={({ isActive }) =>
                                `bux-menu__link ${isActive ? 'bux-menu__link--active' : ''}`
                            }
                            onClick={handleNavClick}
                        >Dashboard</NavLink>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
}

export default MenuDefault; 