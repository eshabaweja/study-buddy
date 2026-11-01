import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../utils/api';
import PasswordInput from './PasswordInput';

function SignUp() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        full_name: '',
        password: '',
        confirm_password: ''
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

        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match');
            return;
        }
        
        try {
            await auth.signup({
                email: formData.email,
                full_name: formData.full_name,
                password: formData.password
            });
            const data = await auth.login({
                email: formData.email,
                password: formData.password,
            });
            login(
                formData.email,
                data.user.full_name,
                data.user.isInstructor,
                data.token,
                data.user.isAdmin,
            );
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Signup failed. Please try again.');
        }
    };

    return (
        <div className="sb-container">
        <div className="sb-form app-login-form">
            <h2 className="sb-ts-md sb-mar-bottom-sp-8">Create an Account</h2>
            <p className="sb-small sb-mar-bottom-sp-16">Please fill in your details to sign up</p>
            
            {error && <div className="sb-alert sb-alert--error sb-mar-bottom-sp-16">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="sb-mar-bottom-sp-8">
                    <label htmlFor="full_name" className="sb-small app-bold">Full Name</label>
                    <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        placeholder="Enter your full name"
                        required
                        className="sb-text-field__input"
                        style={{ width: '100%' }}
                    />
                </div>

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
                    autoComplete="new-password"
                />

                <PasswordInput
                    id="confirm_password"
                    name="confirm_password"
                    label="Confirm Password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    autoComplete="new-password"
                    containerClassName="sb-mar-bottom-sp-16"
                />

                <button type="submit" className="sb-button sb-button--primary">
                    Sign Up
                </button>
            </form>

            <p className="sb-small sb-mar-top-sp-16">
                Already have an account? <Link to="/" className="sb-link">Login</Link>
            </p>
        </div>
        </div>
    );
}

export default SignUp; 