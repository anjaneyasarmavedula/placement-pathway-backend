const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema(
  {
    id: String,
    title: String,
    description: String,
    link: String,
  },
  { _id: false }
);

const CertificationSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    issuer: String,
    date: String,
  },
  { _id: false }
);

const StudentSchema = new mongoose.Schema(
  {
    // AUTH FIELDS
    name: { type: String, required: true },       // Full Name
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isverified: { type: Boolean, default: false },
    // PERSONAL DETAILS
    phone: { type: String, default: "" },
    department: { type: String, default: "" },
    rollNumber: { type: String, default: "" },
    semester: { type: String, default: "" },

    // ACADEMIC DETAILS
    gpa: { type: String, default: "" },           // can be Number too
    tenthPercent: { type: String, default: "" },
    twelfthPercent: { type: String, default: "" },
    activeBacklogs: { type: String, default: "" },

    // SKILLS & PREFERENCES
    skills: { type: [String], default: [] },
    preferredRoles: { type: [String], default: [] },
    preferredLocations: { type: [String], default: [] },

    // PROJECTS & CERTIFICATIONS
    projects: { type: [ProjectSchema], default: [] },
    certifications: { type: [CertificationSchema], default: [] },

    // RESUME FILE STORAGE
    resumeUrl: { type: String, default: "" },         // For Cloudinary/S3 URL
    resumeFileName: { type: String, default: "" },

  },
  { timestamps: true }
);

// Remove password from all JSON responses
StudentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Student', StudentSchema);
