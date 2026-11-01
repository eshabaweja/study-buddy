function FooterDefault() {
  return <footer className="sb-footer sb-footer--light">
    <div className="sb-container sb-grid sb-grid--footer">
      <div
        className="sb-footer__col sb-footer__col--left sb-grid__cell sb-grid__cell--12 sb-grid__cell--5@md"
      >
        <div className="sb-footer__logo">
          <a href="/">
            <img
              src="/brand/logo.svg"
              alt="Study Buddy"
              width="64"
              height="64"
            />
          </a>
        </div>
      </div>

      <div
        className="sb-footer__col sb-footer__col--right sb-grid__cell sb-grid__cell--12 sb-grid__cell--7@md"
      >

        <div className="sb-footer__fine-print">
          <div className="sb-footer__links">
            <ul>
              {/* <li className="sb_footer__link">
                <a id="ot-sdk-btn" className="ot-sdk-show-settings sb-link"
                  >Cookie Settings</a
                >
              </li> */}
              <li className="sb_footer__link">
                <a className="sb-link" href="#">Login</a>
              </li>
            </ul>
          </div>
          <div className="sb-footer__copyright">
            © {(new Date()).getFullYear()} Study Buddy
          </div>
        </div>
      </div>
    </div>
  </footer>
}

export default FooterDefault; 