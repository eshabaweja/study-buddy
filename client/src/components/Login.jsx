import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../utils/api';
import PasswordInput from './PasswordInput';

function Login() {
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [demoMode, setDemoMode] = useState(false);

    useEffect(() => {
        auth.config().then((c) => setDemoMode(Boolean(c?.demoMode))).catch(() => {});
    }, []);

    const handleDemo = async (role) => {
        setError('');
        try {
            const data = await auth.demoLogin(role);
            login(data.user.email, data.user.full_name, data.user.isInstructor, data.token, data.user.isAdmin);
        } catch (err) {
            setError(err.message || 'Demo login failed');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        try {
            const data = await auth.login(formData);
            login(
              formData.email,
              data.user.full_name,
              data.user.isInstructor,
              data.token,
              data.user.isAdmin,
            );
        } catch (err) {
            setError('Invalid email or password');
        }
    };

    return (
        <div className="sb-form app-login-form">
            <h2 className="sb-ts-md sb-mar-bottom-sp-8">Welcome back!</h2>
            <p className="sb-small sb-mar-bottom-sp-16">Please enter your credentials to login</p>
            
            {error && <div className="sb-alert sb-alert--error sb-mar-bottom-sp-16">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="sb-mar-bottom-sp-8">
                    <label htmlFor="email" className="sb-small app-bold">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email"
                        required
                        className="sb-text-field__input"
                        style={{ width: '100%' }}
                    />
                </div>

                <PasswordInput
                    id="password"
                    name="password"
                    label="Password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                />

                <button type="submit" className="sb-button sb-button--primary">
                    Login
                </button>
            </form>

            {demoMode && (
                <div className="sb-mar-top-sp-16 app-demo-box">
                    <p className="sb-small app-bold sb-mar-bottom-sp-8">Just looking around? Try the demo</p>
                    <button type="button" className="sb-button sb-button--small sb-mar-right-sp-8" onClick={() => handleDemo('student')}>
                        Demo as student
                    </button>
                    <button type="button" className="sb-button sb-button--alternate sb-button--small" onClick={() => handleDemo('instructor')}>
                        Demo as instructor
                    </button>
                </div>
            )}

            <p className="sb-small sb-mar-top-sp-16">
                Don't have an account? <Link to="/signup" className="sb-link">Sign up</Link>
            </p>
        </div>
    );
}

export default Login; 