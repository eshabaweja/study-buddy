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
    <div className="sb-container app-container app-dashboard sb-mar-top-sp-16">
      <p>
        <Link to="/dashboard">← Dashboard</Link>
      </p>
      <h2 className="app-dashboard__title">PDF to text</h2>
      <p className="app-quiz-form__hint">
        Upload a PDF or image (up to 20MB). This tool will transcribe it into copyable text.
        Accepted formats: PDF, JPEG, and PNG.
      </p>

      <div className="app-quiz-form__section app-pdf-upload sb-mar-top-sp-16">
        <form onSubmit={handleConvert} className="sb-form">
          <div className="app-quiz-form__field">
            <label className="sb-label" htmlFor="pdf-file">
              File (PDF, JPEG, or PNG, up to 20MB)
            </label>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
              className="sb-text-field"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setText('');
                setCopied(false);
                setError('');
              }}
            />
          </div>
          {error ? (
            <div className="sb-alert sb-alert--error sb-mar-bottom-sp-16">{error}</div>
          ) : null}
          <div className="app-quiz-form__actions">
            <button type="submit" className="sb-button" disabled={loading || !file}>
              {loading ? 'Converting…' : 'Convert to text'}
            </button>
          </div>
        </form>
      </div>

      {previewUrl ? (
        <div className="app-pdf-compare sb-mar-top-sp-16">
          <div className="app-quiz-form__section">
            <h3 className="app-quiz-form__section-title">Original</h3>
            <div className="app-pdf-compare__preview">
              {isPdf ? (
                <iframe
                  title="Original PDF"
                  src={previewUrl}
                  className="app-pdf-compare__frame"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Original upload"
                  className="app-pdf-compare__image"
                />
              )}
            </div>
          </div>
          <div className="app-quiz-form__section">
            <h3 className="app-quiz-form__section-title">Copyable text</h3>
            {text ? (
              <>
                <div className="app-quiz-form__field">
                  <textarea
                    id="pdf-text"
                    className="sb-text-field app-pdf-compare__text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
                <div className="app-quiz-form__actions">
                  <button type="button" className="sb-button" onClick={handleCopy}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <p className="app-quiz-form__hint">
                {loading ? 'Converting…' : 'Convert the file to see text here.'}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
