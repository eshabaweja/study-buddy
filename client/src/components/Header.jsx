function Header() {
    return <><div id="masthead" className="sb-header">
        <div className="sb-container sb-grid">
            <div
                className="sb-header__col sb-header__col--left sb-grid__cell sb-grid__cell--12 sb-grid__cell--8@md sb-grid__cell--9@xl"
            >
                <div className="sb-header__site-name-container">
                    <div className="sb-header__site-name">
                        <a href="/" className="app-header-brand">
                            <img src="/brand/logo.svg" alt="" width="40" height="40" />
                            <span>Study Buddy</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </>
}

export default Header; 