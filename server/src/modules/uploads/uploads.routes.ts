import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { h } from '../../utils/asyncHandler';
import { ok } from '../../utils/response';
import { AppError } from '../../utils/AppError';

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
export const DOC_KEY = /^[0-9a-f-]{36}\.(jpg|jpeg|png|pdf)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename: (_req, f, cb) => cb(null, `${randomUUID()}${path.extname(f.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, f, cb) => cb(null, ['image/jpeg', 'image/png', 'application/pdf'].includes(f.mimetype)),
});

export const uploadsRouter = Router();
uploadsRouter.post('/uploads/documents', authenticate, upload.single('file'), h(async (req, res) => {
  if (!req.file) throw new AppError('VALIDATION_ERROR', 400, 'Upload a JPG, PNG or PDF under 5 MB');
  ok(res, { key: req.file.filename }, 201);
}));
