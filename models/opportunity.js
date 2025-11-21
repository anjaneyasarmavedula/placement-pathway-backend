const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, // Optional now
  companyName: { type: String }, // For TPO created jobs
  postedBy: { type: String, enum: ['company', 'tpo'], default: 'company' },
  creatorId: { type: mongoose.Schema.Types.ObjectId }, // ID of TPO or Company
  title: { type: String, required: true },
  role: { type: String },
  package: { type: String },
  description: { type: String },
  location: { type: String },
  deadline: { type: Date },
  minGpa: { type: Number, default: 0 },
  department: { type: String }, // e.g., CSE, ECE, etc.
  skills: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Opportunity', OpportunitySchema);
