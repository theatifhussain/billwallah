// Fix MongoDB Atlas SRV DNS resolution
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });


// =========================
// MIDDLEWARE
// =========================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// =========================
// DATABASE SCHEMA
// =========================

const submissionSchema = new mongoose.Schema({
  submissionId: {
    type: String,
    unique: true,
    index: true
  },

  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  instagramScreenshot: {
    type: String,
    required: true
  },

  youtubeScreenshot: {
    type: String,
    required: true
  },

  founderInstagramScreenshot: {
    type: String,
    required: true
  },

  submittedAt: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },

  rejectionReason: {
    type: String,
    default: ''
  },

  approvalTimestamp: Date,

  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },

  paymentReference: {
    type: String,
    default: ''
  },

  paymentTimestamp: Date,

  adminNotes: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

const Submission = mongoose.model('Submission', submissionSchema);


// =========================
// MULTER UPLOAD CONFIG
// =========================

const storage = multer.diskStorage({

  destination: (_, __, cb) => {
    cb(null, uploadDir);
  },

  filename: (_, file, cb) => {

    const safe = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    cb(
      null,
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}-${safe}`
    );
  }

});

const upload = multer({

  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3
  },

  fileFilter: (_, file, cb) => {

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG and WEBP images are allowed.'));
    }

  }

});


// =========================
// RATE LIMITER
// =========================

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false
});


// =========================
// ADMIN AUTH
// =========================

function adminAuth(req, res, next) {

  try {

    const token = req.cookies.admin_token;

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    req.admin = jwt.verify(
      token,
      JWT_SECRET
    );

    next();

  } catch {

    return res.status(401).json({
      error: 'Unauthorized'
    });

  }

}


// =========================
// HELPER FUNCTIONS
// =========================

function makeId() {

  return `BW-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

}

function validMobile(v) {

  return /^[6-9]\d{9}$/.test(v);

}


// =========================
// USER SUBMISSION
// =========================

app.post(
  '/api/submissions',
  submitLimiter,

  upload.fields([
    {
      name: 'instagramScreenshot',
      maxCount: 1
    },

    {
      name: 'youtubeScreenshot',
      maxCount: 1
    },

    {
      name: 'founderInstagramScreenshot',
      maxCount: 1
    }
  ]),

  async (req, res) => {

    try {

      const {
        mobileNumber,
        confirm
      } = req.body;


      // Validate mobile number
      if (!validMobile(mobileNumber)) {

        return res.status(400).json({
          error:
            'Enter a valid 10-digit Indian mobile number.'
        });

      }


      // Validate confirmation
      if (confirm !== 'on') {

        return res.status(400).json({
          error:
            'Please confirm that you completed all 3 steps.'
        });

      }


      const files = req.files || {};


      // Check all screenshots
      if (
        !files.instagramScreenshot?.[0] ||
        !files.youtubeScreenshot?.[0] ||
        !files.founderInstagramScreenshot?.[0]
      ) {

        return res.status(400).json({
          error:
            'All three screenshots are required.'
        });

      }


      // Prevent duplicate mobile submissions
      const existing = await Submission.findOne({
        mobileNumber
      });

      if (existing) {

        return res.status(409).json({
          error:
            'A submission already exists for this mobile number.',
          submissionId: existing.submissionId
        });

      }


      // Create submission
      const submission = await Submission.create({

        submissionId: makeId(),

        mobileNumber,

        instagramScreenshot:
          files.instagramScreenshot[0].filename,

        youtubeScreenshot:
          files.youtubeScreenshot[0].filename,

        founderInstagramScreenshot:
          files.founderInstagramScreenshot[0].filename

      });


      res.json({
        submissionId:
          submission.submissionId
      });


    } catch (e) {

      console.error(e);

      res.status(500).json({
        error:
          'Could not submit right now.'
      });

    }

  }
);


// =========================
// CHECK SUBMISSION STATUS
// =========================

app.get('/api/status', async (req, res) => {

  try {

    const {
      submissionId,
      mobileNumber
    } = req.query;


    if (
      !submissionId ||
      !validMobile(mobileNumber)
    ) {

      return res.status(400).json({
        error:
          'Submission ID and valid mobile number are required.'
      });

    }


    const s = await Submission
      .findOne({
        submissionId,
        mobileNumber
      })
      .select(
        'submissionId status paymentStatus submittedAt rejectionReason'
      );


    if (!s) {

      return res.status(404).json({
        error:
          'Submission not found.'
      });

    }


    res.json(s);

  } catch {

    res.status(500).json({
      error:
        'Could not check status.'
    });

  }

});


// =========================
// ADMIN LOGIN
// =========================

app.post(
  '/api/admin/login',
  submitLimiter,

  async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');

      const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
      const adminPassword = String(process.env.ADMIN_PASSWORD || '');

      if (!adminEmail || !adminPassword) {
        console.error('Admin login is not configured. Check ADMIN_EMAIL and ADMIN_PASSWORD in .env');
        return res.status(500).json({
          error: 'Admin login is not configured on the server.'
        });
      }

      if (email !== adminEmail || password !== adminPassword) {
        return res.status(401).json({
          error: 'Invalid email or password.'
        });
      }

      const token = jwt.sign(
        {
          email: adminEmail,
          role: 'admin'
        },
        JWT_SECRET,
        {
          expiresIn: '8h'
        }
      );

      res.cookie('admin_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({
        ok: true,
        email: adminEmail
      });

    } catch (err) {
      console.error('Admin login error:', err);
      return res.status(500).json({
        error: 'Could not log in right now.'
      });
    }
  }
);


// =========================
// ADMIN LOGOUT
// =========================

app.post(
  '/api/admin/logout',
  (req, res) => {

    res.clearCookie('admin_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    res.json({
      ok: true
    });

  }
);


// =========================
// ADMIN CURRENT USER
// =========================

app.get(
  '/api/admin/me',
  adminAuth,

  (req, res) => {

    res.json({
      email: req.admin.email
    });

  }
);


// =========================
// GET ALL SUBMISSIONS
// =========================

app.get(
  '/api/admin/submissions',
  adminAuth,

  async (req, res) => {

    const list = await Submission
      .find()
      .sort({
        submittedAt: -1
      })
      .lean();

    res.json(list);

  }
);


// =========================
// GET SINGLE SUBMISSION
// =========================

app.get(
  '/api/admin/submissions/:id',
  adminAuth,

  async (req, res) => {

    const s = await Submission
      .findOne({
        submissionId: req.params.id
      })
      .lean();


    if (!s) {

      return res.status(404).json({
        error: 'Not found'
      });

    }


    res.json(s);

  }
);


// =========================
// UPDATE SUBMISSION
// =========================

app.patch(
  '/api/admin/submissions/:id',
  adminAuth,

  async (req, res) => {

    const {
      status,
      rejectionReason,
      paymentStatus,
      paymentReference,
      adminNotes
    } = req.body;


    const update = {};


    if (
      ['Approved', 'Rejected', 'Pending']
        .includes(status)
    ) {

      update.status = status;

      if (status === 'Approved') {
        update.approvalTimestamp =
          new Date();
      }

    }


    if (
      typeof rejectionReason === 'string'
    ) {

      update.rejectionReason =
        rejectionReason;

    }


    if (
      ['Paid', 'Pending'].includes(paymentStatus)
    ) {
      const current = await Submission.findOne({
        submissionId: req.params.id
      }).select('status').lean();

      if (!current) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (paymentStatus === 'Paid' && current.status !== 'Approved') {
        return res.status(400).json({
          error: 'Only an approved submission can be marked as Paid.'
        });
      }

      update.paymentStatus = paymentStatus;

      if (paymentStatus === 'Paid') {
        update.paymentTimestamp = new Date();
      }
    }


    if (
      typeof paymentReference === 'string'
    ) {

      update.paymentReference =
        paymentReference;

    }


    if (
      typeof adminNotes === 'string'
    ) {

      update.adminNotes =
        adminNotes;

    }


    const s =
      await Submission.findOneAndUpdate(
        {
          submissionId:
            req.params.id
        },

        update,

        {
          new: true
        }
      ).lean();


    if (!s) {

      return res.status(404).json({
        error: 'Not found'
      });

    }


    res.json(s);

  }
);


// =========================
// ADMIN PROOF IMAGE
// =========================

app.get(
  '/api/admin/proof/:filename',
  adminAuth,

  (req, res) => {

    const safe =
      path.basename(
        req.params.filename
      );

    const p =
      path.join(
        uploadDir,
        safe
      );


    if (!fs.existsSync(p)) {
      return res.sendStatus(404);
    }


    res.sendFile(p);

  }
);


// =========================
// ADMIN PAGE
// =========================

app.get(
  '/admin',
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        'public',
        'admin.html'
      )
    );

  }
);


// =========================
// MAIN WEBSITE
// =========================

app.get(
  '*',
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );

  }
);


// =========================
// MONGODB CONNECTION
// =========================

console.log('Connecting to MongoDB...');

mongoose
  .connect(
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/billwallah'
  )

  .then(() => {

    console.log('MongoDB connected successfully.');

    app.listen(
      PORT,

      () => {

        console.log(
          `Bill Wallah running on http://localhost:${PORT}`
        );

      }

    );

  })

  .catch(err => {

    console.error(
      'MongoDB connection failed:',
      err.message
    );

    process.exit(1);

  });