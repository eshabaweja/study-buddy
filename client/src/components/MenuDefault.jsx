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

    return <div className="sb-menu-wrapper">
        <div className="sb-container sb-grid sb-container__menu">
            <nav
                id="sb-main-menu"
                aria-label="Main Navigation"
                className="disclosure-nav disclosure-nav-orientation-horizontal"
            >
                <ul className="sb-menu">
                    <li className="sb-menu__item">
                        <NavLink to="/"
                            end
                            className={({ isActive }) =>
                                `sb-menu__link ${isActive ? 'sb-menu__link--active' : ''}`
                            }
                            onClick={handleNavClick}
                        >Home </NavLink>
                    </li>
                    <li className="sb-menu__item">
                        <NavLink
                            to="/concepts"
                            end
                            className={({ isActive }) =>
                                `sb-menu__link ${isActive ? 'sb-menu__link--active' : ''}`
                            }
                            onClick={handleNavClick}
                        >Concept Crunch</NavLink>
                    </li>
                    <li className="sb-menu__item">
                        <NavLink to="/dashboard"
                            end
                            className={({ isActive }) =>
                                `sb-menu__link ${isActive ? 'sb-menu__link--active' : ''}`
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