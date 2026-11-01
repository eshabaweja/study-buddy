function FooterDefault() {
  return <footer className="bux-footer bux-footer--light">
    <div className="bux-container bux-grid bux-grid--footer">
      <div
        className="bux-footer__col bux-footer__col--left bux-grid__cell bux-grid__cell--12 bux-grid__cell--5@md"
      >
        <div className="bux-footer__logo">
          <a href="http://osu.edu" target="_blank">
            <img
              src="/bux-assets/images/osu-logos/horiz/osu-horiz-gray.svg"
              alt="The Ohio State University"
            />
          </a>
        </div>
        <div className="bux-footer__contact bux-footer__contact--address">
          <p className="bux_footer__site-name">
            Department of Electrical & Computer Engineering
          </p>
          <p className="bux_footer__address">205 Dreese Labs</p>
          <p className="bux_footer__address">2015 Neil Ave.</p>
          <p className="bux_footer__address">Columbus, OH 43210</p>
        </div>
{/* 
        <div className="bux-footer__contact bux-footer__contact--email-phone">
          <hr />
          <p className="bux_footer__email">
            <a className="bux-link" href="mailto:email@osu.edu">email@osu.edu</a>
          </p>
          <p className="bux_footer__phone">
            <a className="bux-link" href="tel:614-292-2572">Phone: 614-292-2572</a>
          </p>
          <p className="bux_footer__fax">
            <a className="bux-link" href="tel:614-292-7596">Fax: 614-292-7596</a>
          </p>
        </div> */}
      </div>

      <div
        className="bux-footer__col bux-footer__col--right bux-grid__cell bux-grid__cell--12 bux-grid__cell--7@md"
      >
        <div className="bux-footer__social">
          <ul className="bux-social-links bux-social-links--light">
            <li className="bux-social-links__item bux-social-links__item--Facebook">
              <a
                className="bux-social-links__link"
                href="https://www.facebook.com/osu/"
                target="_blank"
              >
                <span className="visually-hidden">Facebook profile — external</span>
                <span className="icon icon-facebook" aria-hidden="true"></span>
              </a>
            </li>
            <li className="bux-social-links__item bux-social-links__item--Instagram">
              <a
                className="bux-social-links__link"
                href="https://www.instagram.com/theohiostateuniversity/"
                target="_blank"
              >
                <span className="visually-hidden">Instagram profile — external</span>
                <span className="icon icon-instagram" aria-hidden="true"></span>
              </a>
            </li>
            <li className="bux-social-links__item bux-social-links__item--X">
              <a
                className="bux-social-links__link"
                href="https://twitter.com/OhioState"
                target="_blank"
              >
                <span className="visually-hidden">X profile — external</span>
                <span className="icon icon-x" aria-hidden="true"></span>
              </a>
            </li>
            <li className="bux-social-links__item bux-social-links__item--LinkedIn">
              <a
                className="bux-social-links__link"
                href="https://www.linkedin.com/school/the-ohio-state-university/"
                target="_blank"
              >
                <span className="visually-hidden">LinkedIn profile — external</span>
                <span className="icon icon-linkedin" aria-hidden="true"></span>
              </a>
            </li>
            <li className="bux-social-links__item bux-social-links__item--YouTube">
              <a
                className="bux-social-links__link"
                href="https://www.youtube.com/user/ohiostateuniversity"
                target="_blank"
              >
                <span className="visually-hidden">YouTube profile — external</span>
                <span className="icon icon-youtube" aria-hidden="true"></span>
              </a>
            </li>
            <li className="bux-social-links__item bux-social-links__item--TikTok">
              <a
                className="bux-social-links__link"
                href="https://www.tiktok.com/@theohiostateuniversity"
                target="_blank"
              >
                <span className="visually-hidden">TikTok profile — external</span>
                <span className="icon icon-tiktok" aria-hidden="true"></span>
              </a>
            </li>
          </ul>
        </div>

        <div className="bux-footer__fine-print">
          <div className="bux-footer__ada">
            If you have a disability and experience difficulty accessing this
            content, please contact the Digital Accessibility Center for
            assistance at &nbsp;
            <a className="bux-link" href="mailto:accessibility@osu.edu">
              accessibility@osu.edu</a
            >&nbsp;
            or &nbsp;<a className="bux-link" href="tel:614-292-1760">614-292-1760</a>.
          </div>
          <div className="bux-footer__links">
            <ul>
              <li className="bux_footer__link">
                <a className="bux-link" href="https://go.osu.edu/privacy"
                  >Privacy Statement</a
                >
              </li>
              <li className="bux_footer__link">
                <a
                  className="bux-link"
                  href="https://go.osu.edu/nondiscrimination-notice"
                  >Non-discrimination Notice</a
                >
              </li>
              {/* <li className="bux_footer__link">
                <a id="ot-sdk-btn" className="ot-sdk-show-settings bux-link"
                  >Cookie Settings</a
                >
              </li> */}
              <li className="bux_footer__link">
                <a className="bux-link" href="#">Login</a>
              </li>
            </ul>
          </div>
          <div className="bux-footer__copyright">
            © {(new Date()).getFullYear()} The Ohio State University
          </div>
        </div>
      </div>
    </div>
  </footer>
}

export default FooterDefault; 