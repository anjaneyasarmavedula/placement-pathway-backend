const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    opportunityId: { type: String, required: true }, // or ObjectId if you have an Opportunity model
    position: { type: String, required: true },
    resumeUrl: { type: String },
    status: { type: String, default: 'pending' },
    additionalInfo: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Application', ApplicationSchema);
