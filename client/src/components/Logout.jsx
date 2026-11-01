import { useAuth } from '../contexts/AuthContext';

function Logout() {
    const { userName, logout } = useAuth();

    return (
        <div className="sb-form">
            <h2 className="sb-ts-md sb-mar-bottom-sp-8">Welcome, {userName}!</h2>
            <p className="sb-small sb-mar-bottom-sp-16">You are currently logged in</p>
            
            <div className="sb-mar-bottom-sp-16">
                <button 
                    onClick={logout}
                    className="sb-button sb-button--secondary"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}

export default Logout; 