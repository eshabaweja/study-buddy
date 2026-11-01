import { useState } from 'react';
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
        <div className="bux-form ba-login-form">
            <h2 className="bux-ts-md bux-mar-bottom-sp-8">Welcome, Buckeye!</h2>
            <p className="bux-small bux-mar-bottom-sp-16">Please enter your credentials to login</p>
            
            {error && <div className="bux-alert bux-alert--error bux-mar-bottom-sp-16">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="bux-mar-bottom-sp-8">
                    <label htmlFor="email" className="bux-small ba-bold">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter your email"
                        required
                        className="bux-text-field__input"
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

                <button type="submit" className="bux-button bux-button--primary">
                    Login
                </button>
            </form>

            <p className="bux-small bux-mar-top-sp-16">
                Don't have an account? <Link to="/signup" className="bux-link">Sign up</Link>
            </p>
        </div>
    );
}

export default Login; 