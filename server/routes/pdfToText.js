import express from 'express';
import multer from 'multer';
import { requireInstructor } from '../middleware/auth.js';
import {
  maxBytesForMime,
  MAX_UPLOAD_BYTES,
  mimeFromUpload,
  sizeLimitMessage,
  transcribeFileBuffer,
} from '../services/pdfToText.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!mimeFromUpload(file)) {
      cb(new Error('Use a PDF, JPEG, or PNG'));
      return;
    }
    cb(null, true);
  },
});

function handleMulter(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File must be 20MB or smaller',
      });
    }
    return res.status(400).json({ error: err.message || 'Could not upload that file' });
  });
}

router.post('/', requireInstructor, handleMulter, async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'Choose a PDF, JPEG, or PNG to convert' });
  }

  const mimeType = mimeFromUpload(req.file);
  if (!mimeType) {
    return res.status(400).json({ error: 'Use a PDF, JPEG, or PNG' });
  }

  const maxBytes = maxBytesForMime(mimeType);
  if (req.file.size > maxBytes) {
    return res.status(400).json({ error: sizeLimitMessage(mimeType) });
  }

  try {
    const text = await transcribeFileBuffer(
      req.file.buffer,
      req.file.originalname,
      mimeType,
    );
    res.json({ text });
  } catch (err) {
    console.error('File transcription error:', err);
    res.status(500).json({
      error: err.message || 'Could not convert this file. Try a smaller PDF or a JPEG/PNG.',
    });
  }
});

export default router;
