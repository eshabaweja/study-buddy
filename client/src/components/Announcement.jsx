function Announcement({children}) {
    return (
        <div className="ba-announcement__container" aria-live="polite">
           ⓘ Help us improve! {children}
        </div>
    );
}

export default Announcement;