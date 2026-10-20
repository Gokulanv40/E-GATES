const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_BASE = path.resolve(__dirname, '../../uploads');

// Ensure upload subdirectories exist
const subdirs = ['proofs', 'news', 'voting', 'documents', 'logos', 'audio', 'profiles'];
subdirs.forEach((dir) => {
  const fullPath = path.join(UPLOADS_BASE, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Allowed MIME types
const DOC_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/webm', // Browsers often record audio in webm container
];

const ALL_ALLOWED_MIMES = [...DOC_IMAGE_MIMES, ...AUDIO_MIMES];

// Storage generator for a target subdirectory
const createDiskStorage = (defaultSubdir = 'documents') => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      let targetSubdir = defaultSubdir;
      if (file.fieldname === 'eb_bill_proof' || file.fieldname === 'property_tax_receipt') {
        targetSubdir = 'proofs';
      } else if (file.fieldname === 'profile_photo' || file.fieldname === 'avatar') {
        targetSubdir = 'profiles';
      } else if (file.fieldname === 'voice_message' || file.mimetype.startsWith('audio/')) {
        targetSubdir = 'audio';
      } else if (file.fieldname === 'logo') {
        targetSubdir = 'logos';
      } else if (file.fieldname === 'document' && req.baseUrl && req.baseUrl.includes('voting')) {
        targetSubdir = 'voting';
      } else if (file.fieldname === 'document' || file.fieldname === 'file') {
        targetSubdir = 'documents';
      } else if (file.fieldname === 'image' || file.fieldname === 'attachment') {
        if (req.baseUrl && req.baseUrl.includes('news')) {
          targetSubdir = 'news';
        } else if (req.baseUrl && req.baseUrl.includes('complaints')) {
          targetSubdir = 'documents';
        }
      }

      const uploadPath = path.join(UPLOADS_BASE, targetSubdir);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${Date.now()}-${uuidv4()}${ext}`;
      cb(null, uniqueName);
    },
  });
};

// Common file filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'voice_message') {
    if (AUDIO_MIMES.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Allowed: MP3, WAV, WEBM'), false);
    }
  } else if (ALL_ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file format for "${file.fieldname}". Allowed formats: PDF, JPG, JPEG, PNG, MP3, WAV, WEBM`
      ),
      false
    );
  }
};

// Base uploaders with size limits: 5MB docs/images, 10MB audio
const uploadProof = multer({
  storage: createDiskStorage('proofs'),
  fileFilter: (req, file, cb) => {
    if (DOC_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Proof documents must be PDF, JPG, or PNG files (max 5MB)'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).fields([
  { name: 'eb_bill_proof', maxCount: 1 },
  { name: 'property_tax_receipt', maxCount: 1 },
]);

const uploadNews = multer({
  storage: createDiskStorage('news'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max overall (audio up to 10MB, docs/images checked)
  },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'attachment', maxCount: 1 },
  { name: 'voice_message', maxCount: 1 },
]);

const uploadVotingVendor = multer({
  storage: createDiskStorage('voting'),
  fileFilter: (req, file, cb) => {
    if (DOC_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Vendor quotation document must be PDF, JPG, or PNG (max 5MB)'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('document');

const uploadDocument = multer({
  storage: createDiskStorage('documents'),
  fileFilter: (req, file, cb) => {
    if (DOC_IMAGE_MIMES.includes(file.mimetype) || file.mimetype.startsWith('application/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Document must be PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, or Image (max 25MB)'), false);
    }
  },
  limits: { fileSize: 25 * 1024 * 1024 },
}).fields([
  { name: 'document', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

const uploadLogo = multer({
  storage: createDiskStorage('logos'),
  fileFilter: (req, file, cb) => {
    const imageMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (imageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Logo must be JPG or PNG image (max 5MB)'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('logo');

const uploadComplaint = multer({
  storage: createDiskStorage('documents'),
  fileFilter: (req, file, cb) => {
    if (DOC_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Complaint attachment must be PDF, JPG, or PNG (max 5MB)'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('attachment');

const uploadGeneric = (subdir = 'documents', maxBytes = 5 * 1024 * 1024) => {
  return multer({
    storage: createDiskStorage(subdir),
    fileFilter,
    limits: { fileSize: maxBytes },
  });
};

const proofUploadInstance = uploadGeneric('proofs', 5 * 1024 * 1024);
const newsUploadInstance = uploadGeneric('news', 10 * 1024 * 1024);
const votingUploadInstance = uploadGeneric('voting', 5 * 1024 * 1024);
const documentUploadInstance = uploadGeneric('documents', 25 * 1024 * 1024);
const logoUploadInstance = uploadGeneric('logos', 5 * 1024 * 1024);
const audioUploadInstance = uploadGeneric('audio', 10 * 1024 * 1024);

module.exports = {
  UPLOADS_BASE,
  uploadProof,
  uploadNews,
  uploadVotingVendor,
  uploadDocument,
  uploadLogo,
  uploadComplaint,
  uploadGeneric,
  // Multer instances as requested in architectural interface
  proofUpload: proofUploadInstance,
  newsUpload: newsUploadInstance,
  votingUpload: votingUploadInstance,
  documentUpload: documentUploadInstance,
  logoUpload: logoUploadInstance,
  audioUpload: audioUploadInstance,
};
