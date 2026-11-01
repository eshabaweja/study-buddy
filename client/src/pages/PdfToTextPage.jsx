import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { pdfToText } from '../utils/api';
import { toast } from '../utils/toast';

export default function PdfToTextPage() {
  const { isAuthenticated, isInstructor } = useAuth();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!isAuthenticated || !isInstructor) {
    return <Navigate to="/dashboard" replace />;
  }

  const isPdf = file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

  const handleConvert = async (e) => {
    e.preventDefault();
    if (!file) {
      const message = 'Choose a PDF or image to convert';
      setError(message);
      toast.error(message);
      return;
    }
    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      const message = 'File must be 20MB or smaller';
      setError(message);
      toast.error(message);
      return;
    }
    setLoading(true);
    setCopied(false);
    setError('');
    try {
      const result = await pdfToText.convert(file);
      setText(result.text || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not convert this file';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div className="bux-container ba-container ba-dashboard bux-mar-top-sp-16">
      <p>
        <Link to="/dashboard">← Dashboard</Link>
      </p>
      <h2 className="ba-dashboard__title">PDF to text</h2>
      <p className="ba-quiz-form__hint">
        Upload a PDF or image (up to 20MB). This tool will transcribe it into copyable text.
        Accepted formats: PDF, JPEG, and PNG.
      </p>

      <div className="ba-quiz-form__section ba-pdf-upload bux-mar-top-sp-16">
        <form onSubmit={handleConvert} className="bux-form">
          <div className="ba-quiz-form__field">
            <label className="bux-label" htmlFor="pdf-file">
              File (PDF, JPEG, or PNG, up to 20MB)
            </label>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
              className="bux-text-field"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setText('');
                setCopied(false);
                setError('');
              }}
            />
          </div>
          {error ? (
            <div className="bux-alert bux-alert--error bux-mar-bottom-sp-16">{error}</div>
          ) : null}
          <div className="ba-quiz-form__actions">
            <button type="submit" className="bux-button" disabled={loading || !file}>
              {loading ? 'Converting…' : 'Convert to text'}
            </button>
          </div>
        </form>
      </div>

      {previewUrl ? (
        <div className="ba-pdf-compare bux-mar-top-sp-16">
          <div className="ba-quiz-form__section">
            <h3 className="ba-quiz-form__section-title">Original</h3>
            <div className="ba-pdf-compare__preview">
              {isPdf ? (
                <iframe
                  title="Original PDF"
                  src={previewUrl}
                  className="ba-pdf-compare__frame"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Original upload"
                  className="ba-pdf-compare__image"
                />
              )}
            </div>
          </div>
          <div className="ba-quiz-form__section">
            <h3 className="ba-quiz-form__section-title">Copyable text</h3>
            {text ? (
              <>
                <div className="ba-quiz-form__field">
                  <textarea
                    id="pdf-text"
                    className="bux-text-field ba-pdf-compare__text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
                <div className="ba-quiz-form__actions">
                  <button type="button" className="bux-button" onClick={handleCopy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <p className="ba-quiz-form__hint">
                {loading ? 'Converting…' : 'Convert the file to see text here.'}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
