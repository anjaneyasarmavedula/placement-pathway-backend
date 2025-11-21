const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Create a transporter
  // For production, you need to provide real SMTP credentials in .env
  // EMAIL_SERVICE, EMAIL_USER, EMAIL_PASS
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail', // e.g., 'gmail'
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Define email options
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@placementpathway.com',
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  // Send email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
