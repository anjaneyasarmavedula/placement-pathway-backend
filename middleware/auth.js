const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;


exports.authenticate = (req, res, next) => {
const header = req.headers.authorization;
if (!header) return res.status(401).json({ message: 'Missing authorization header' });


const token = header.split(' ')[1];
if (!token) return res.status(401).json({ message: 'Invalid authorization header' });


try {
const payload = jwt.verify(token, JWT_SECRET);
req.user = payload; // payload should include id and role
next();
} catch (err) {
return res.status(401).json({ message: 'Invalid token' });
}
};


exports.authorizeRoles = (...allowed) => (req, res, next) => {
const role = req.user && req.user.role;
if (!role) return res.status(403).json({ message: 'Forbidden' });
if (allowed.includes(role)) return next();
return res.status(403).json({ message: 'Insufficient role' });
};


exports.authorizeOwnerOrRoles = (...allowedRoles) => (req, res, next) => {
const role = req.user && req.user.role;
const userId = req.user && req.user.id;
const resourceId = req.params.id;


if (userId && userId.toString() === resourceId.toString()) return next();
if (role && allowedRoles.includes(role)) return next();
return res.status(403).json({ message: 'Forbidden' });
};