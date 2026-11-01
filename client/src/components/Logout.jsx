import { useAuth } from '../contexts/AuthContext';

function Logout() {
    const { userName, logout } = useAuth();

    return (
        <div className="bux-form">
            <h2 className="bux-ts-md bux-mar-bottom-sp-8">Welcome, {userName}!</h2>
            <p className="bux-small bux-mar-bottom-sp-16">You are currently logged in</p>
            
            <div className="bux-mar-bottom-sp-16">
                <button 
                    onClick={logout}
                    className="bux-button bux-button--secondary"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

export default Logout; 