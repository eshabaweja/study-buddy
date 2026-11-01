import { useState } from 'react';

function PasswordInput({
    id,
    name,
    label,
    value,
    onChange,
    placeholder,
    required,
    autoComplete,
    containerClassName = 'sb-mar-bottom-sp-8',
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className={containerClassName}>
            <label htmlFor={id} className="sb-small app-bold">
                {label}
            </label>
            <div className="sb-text-field app-password-field">
                <input
                    type={visible ? 'text' : 'password'}
                    id={id}
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    autoComplete={autoComplete}
                    className="sb-text-field__input sb-text-field__input--password"
                    style={{ width: '100%', paddingRight: 48 }}
                />
                <button
                    type="button"
                    className={`sb-text-field__password-icon sb-text-field__password-icon--${visible ? 'hide' : 'view'} sb-tooltip__button`}
                    title={visible ? 'Hide password' : 'Show password'}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                    onClick={() => setVisible((v) => !v)}
                />
            </div>
        </div>
    );
}

export default PasswordInput;
