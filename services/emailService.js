import nodemailer from 'nodemailer';

/**
 * Send an email using Nodemailer
 * @param {Object} options - Email options (email, subject, message, html)
 */
const sendEmail = async (options) => {
  // Create reusable transporter object
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Define email options
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"CS Department GPGC Lakki Marwat" <no-reply@gpgclakki.edu.pk>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  // Send the email
  await transporter.sendMail(mailOptions);
};

export default sendEmail;
