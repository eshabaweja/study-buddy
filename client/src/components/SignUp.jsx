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
        <div className="bux-container">
        <div className="bux-form ba-login-form">
            <h2 className="bux-ts-md bux-mar-bottom-sp-8">Create an Account</h2>
            <p className="bux-small bux-mar-bottom-sp-16">Please fill in your details to sign up</p>
            
            {error && <div className="bux-alert bux-alert--error bux-mar-bottom-sp-16">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="bux-mar-bottom-sp-8">
                    <label htmlFor="full_name" className="bux-small ba-bold">Full Name</label>
                    <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                        placeholder="Enter your full name"
                        required
                        className="bux-text-field__input"
                        style={{ width: '100%' }}
                    />
                </div>

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
                    containerClassName="bux-mar-bottom-sp-16"
                />

                <button type="submit" className="bux-button bux-button--primary">
                    Sign Up
                </button>
            </form>

            <p className="bux-small bux-mar-top-sp-16">
                Already have an account? <Link to="/" className="bux-link">Login</Link>
            </p>
        </div>
        </div>
    );
}

export default SignUp; 