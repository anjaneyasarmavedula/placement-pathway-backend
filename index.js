require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const cloudinary = require('./cloudinary');
// Import Student model
const Student = require('./models/student.js');
const Company = require('./models/company.js');
const Application = require('./models/application');
const TPO = require('./models/tpo');
const Opportunity = require('./models/opportunity');
const app = express();

/* ---------- MIDDLEWARE ---------- */
app.use(cors());
app.use(express.json());

/* ---------- ENV ---------- */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in .env");
  process.exit(1);
}

/* ---------- CONNECT MONGO ---------- */
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => {
    console.error("Mongo Error:", err);
    process.exit(1);
  });

/* ---------- REGISTER ENDPOINT ---------- */
app.post("/register", async (req, res) => {
  try {
    const { name, email, password, type } = req.body;

    // ---- Basic validation ----
    if (!name || !email || !password || !type) {
      return res.status(400).json({ message: "name, email, password, type are required" });
    }

    // ---- Encrypt password ----
    const hashedPassword = await bcrypt.hash(password, 10);

    // ---- COMPANY REGISTRATION ----
    if (type === "recruiter" || type === "company") {
      const existing = await Company.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const company = new Company({
        name,
        email,
        password: hashedPassword,
      });

      await company.save();

      return res.status(201).json({
        message: "Company registered successfully",
        company,
      });
    }

    // ---- STUDENT REGISTRATION ----
    if (type === "student") {
      const existing = await Student.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const student = new Student({
        name,
        email,
        password: hashedPassword,
      });

      await student.save();

      return res.status(201).json({
        message: "Student registered successfully",
        student,
      });
    }



    // ---- INVALID TYPE ----
    return res.status(400).json({ message: "Invalid type. Must be 'student' or 'company'" });

  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { email, password, type } = req.body;

    if (!email || !password || !type) {
      return res.status(400).json({ message: 'email, password and type are required' });
    }

    // Choose model based on type
    let user = null;
    let role = null;

    if (type === 'student') {
      user = await Student.findOne({ email }).lean();
      role = 'student';
    } else if (type === 'recruiter' || type === 'company') {
      user = await Company.findOne({ email }).lean();
      role = 'recruiter';
    } else {
      return res.status(400).json({ message: "Invalid type. Must be 'student' or 'recruiter'." });
    }

    if (!user) {
      // avoid leaking which types exist — generic message
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // user.password is stored hashed
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // remove password before sending user back
    const { password: _pw, ...userSafe } = user;

    // create JWT
    const payload = {
      id: user._id || user.id,
      role,
      email: user.email,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({ token, user: userSafe });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload expected to contain { id, role, email } from your login token
    req.user = payload;
    return next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * GET /api/student/profile
 * Returns profile for authenticated student
 */
app.get('/student/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const student = await Student.findById(userId).lean();
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // remove sensitive fields
    if (student.password) delete student.password;

    return res.json({ student });
  } catch (err) {
    console.error('GET /api/student/profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/student/profile
 * Save/update profile for authenticated student.
 * Accepts JSON body matching frontend:
 * {
 *   fullName, phone, department, rollNumber, semester,
 *   gpa, tenthPercent, twelfthPercent, activeBacklogs,
 *   skills[], preferredRoles[], preferredLocations[],
 *   projects[], certifications[], resumeUrl, resumeFileName
 * }
 */
app.post('/student/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Extract allowed fields from body
    const {
      fullName,
      phone,
      department,
      rollNumber,
      semester,
      gpa,
      tenthPercent,
      twelfthPercent,
      activeBacklogs,
      skills,
      preferredRoles,
      preferredLocations,
      projects,
      certifications,
      resumeUrl,
      resumeFileName,
    } = req.body;

    // Build update object only with provided fields
    const update = {}
    if (typeof fullName === 'string' && fullName.trim() !== '') update.name = fullName.trim();
    if (phone !== undefined) update.phone = phone;
    if (department !== undefined) update.department = department;
    if (rollNumber !== undefined) update.rollNumber = rollNumber;
    if (semester !== undefined) update.semester = semester;
    if (gpa !== undefined) update.gpa = gpa;
    if (tenthPercent !== undefined) update.tenthPercent = tenthPercent;
    if (twelfthPercent !== undefined) update.twelfthPercent = twelfthPercent;
    if (activeBacklogs !== undefined) update.activeBacklogs = activeBacklogs;

    // Accept and coerce skills / preferences if present in request (including empty arrays or strings)
    if (skills !== undefined) {
      update.skills = Array.isArray(skills)
        ? skills
        : typeof skills === 'string' && skills.trim() !== ''
        ? [skills.trim()]
        : [];
    }
    if (preferredRoles !== undefined) {
      update.preferredRoles = Array.isArray(preferredRoles)
        ? preferredRoles
        : typeof preferredRoles === 'string' && preferredRoles.trim() !== ''
        ? [preferredRoles.trim()]
        : [];
    }
    if (preferredLocations !== undefined) {
      update.preferredLocations = Array.isArray(preferredLocations)
        ? preferredLocations
        : typeof preferredLocations === 'string' && preferredLocations.trim() !== ''
        ? [preferredLocations.trim()]
        : [];
    }

    // Accept and validate projects / certifications if present
    if (projects !== undefined) {
      update.projects = Array.isArray(projects) ? projects : [];
    }
    if (certifications !== undefined) {
      update.certifications = Array.isArray(certifications) ? certifications : [];
    }

    if (resumeUrl) update.resumeUrl = resumeUrl;
    if (resumeFileName) update.resumeFileName = resumeFileName;

    update.updatedAt = Date.now();

    const student = await Student.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const result = student.toObject();
    if (result.password) delete result.password;

    return res.json({ message: 'Profile saved', student: result });
  } catch (err) {
    console.error('POST /api/student/profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


/**
 * POST /student/profile/upload
 * Upload resume file to Cloudinary and save URL/filename to student profile
 */
app.post('/student/profile/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'placement-resumes',
      resource_type: 'auto',
    });

    // Save to student profile
    await Student.findByIdAndUpdate(userId, {
      resumeUrl: result.secure_url,
      resumeFileName: req.file.originalname,
    });

    res.json({ url: result.secure_url, fileName: req.file.originalname });
  } catch (err) {
    console.error('Resume upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

/**
 * GET /student/applications
 * Returns job applications for the authenticated student
 */
app.get('/student/applications', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    // Fetch real applications for this student
    const applications = await Application.find({ student: userId })
      .populate({ path: 'company', select: 'name' })
      .populate({ path: 'opportunityId', select: 'title role package' });
    res.json({ applications });
  } catch (err) {
    console.error('GET /student/applications error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /student/apply
 * Student applies to an opportunity. Stores application in DB.
 * Body: { opportunityId, companyId, position, additionalInfo }
 */
app.post('/student/apply', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { opportunityId, companyId, position, additionalInfo } = req.body;
    if (!opportunityId || !companyId || !position) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    // Check constraints
    const opp = await Opportunity.findById(opportunityId);
    const student = await Student.findById(userId);
    if (!opp || !student) return res.status(404).json({ message: 'Not found' });
    // REMOVE ALL CONSTRAINTS: allow any student to apply
    // Optionally, check if already applied
    const existing = await Application.findOne({ student: userId, opportunityId });
    if (existing) {
      return res.status(409).json({ message: 'Already applied to this opportunity' });
    }
    const resumeUrl = student?.resumeUrl || '';
    const appDoc = new Application({
      student: userId,
      company: companyId,
      opportunityId,
      position,
      resumeUrl,
      additionalInfo,
    });
    await appDoc.save();
    res.status(201).json({ message: 'Application submitted', application: appDoc });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /company/applications
 * Company can view applications for their opportunities only
 * Requires authentication as company
 */
app.get('/company/applications', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Forbidden' });
    const companyId = req.user.id;
    const applications = await Application.find({ company: companyId }).populate('student');
    res.json({ applications });
  } catch (err) {
    console.error('GET /company/applications error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// TPO Registration (for initial setup, or use MongoDB shell to create TPO)
app.post('/tpo/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, password are required' });
    }
    const existing = await TPO.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const tpo = new TPO({ name, email, password: hashedPassword });
    await tpo.save();
    res.status(201).json({ message: 'TPO registered', tpo: tpo.toJSON() });
  } catch (err) {
    console.error('TPO register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// TPO Login
app.post('/tpo/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    const tpo = await TPO.findOne({ email });
    if (!tpo) return res.status(401).json({ message: 'Invalid credentials' });
    const passwordMatch = await bcrypt.compare(password, tpo.password);
    if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const payload = { id: tpo._id, role: 'tpo', email: tpo.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, tpo: tpo.toJSON() });
  } catch (err) {
    console.error('TPO login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// TPO: Get all students
app.get('/tpo/students', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Forbidden' });
    const students = await Student.find();
    res.json({ students });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// TPO: Get all companies
app.get('/tpo/companies', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Forbidden' });
    const companies = await Company.find();
    res.json({ companies });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// TPO: Get all opportunities
app.get('/tpo/opportunities', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Forbidden' });
    const opportunities = await Opportunity.find();
    res.json({ opportunities });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// TPO verifies a student
app.post('/tpo/verify-student/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'tpo') return res.status(403).json({ message: 'Forbidden' });
    const studentId = req.params.id;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    student.isverified = true;
    await student.save();
    res.json({ message: 'Student verified', student: student.toJSON() });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Company creates a new job posting
// app.post('/company/opportunities', authenticate,
// Company gets their own job postings
app.get('/company/opportunities', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Forbidden' });
    const opportunities = await Opportunity.find({ company: req.user.id });
    res.json({ opportunities });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Company edits a job posting
app.put('/company/opportunities/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Forbidden' });
    const { role, package: jobPackage, ...rest } = req.body;
    const opp = await Opportunity.findOneAndUpdate(
      { _id: req.params.id, company: req.user.id },
      { ...rest, role, package: jobPackage },
      { new: true }
    );
    if (!opp) return res.status(404).json({ message: 'Opportunity not found' });
    res.json({ message: 'Opportunity updated', opportunity: opp });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Company deletes a job posting
app.delete('/company/opportunities/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ message: 'Forbidden' });
    const opp = await Opportunity.findOneAndDelete({ _id: req.params.id, company: req.user.id });
    if (!opp) return res.status(404).json({ message: 'Opportunity not found' });
    res.json({ message: 'Opportunity deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all opportunities (for students)
app.get('/opportunities', async (req, res) => {
  try {
    const opportunities = await Opportunity.find().populate('company', 'name');
    res.json({ opportunities });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all verified students
app.get('/students/verified', async (req, res) => {
  try {
    const students = await Student.find({ verified: true });
    res.json({ students });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all eligible opportunities for the logged-in student
app.get('/student/opportunities', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ message: 'Forbidden' });
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const allOpportunities = await Opportunity.find().populate('company', 'name');
    // Filter by eligibility
    const eligible = allOpportunities.filter(opp => {
      if (opp.minGpa && Number(student.gpa) < opp.minGpa) return false;
      if (opp.department && opp.department !== 'any' && opp.department !== student.department) return false;
      if (opp.skills && opp.skills.length > 0) {
        const hasSkill = opp.skills.some(skill => student.skills.includes(skill));
        if (!hasSkill) return false;
      }
      return true;
    });
    res.json({ opportunities: eligible });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ---------- START SERVER ---------- */
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
