import jwt from "jsonwebtoken";

async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: decoded.id,
            uid: decoded.uid,
            usertype: decoded.usertype,
        };
        req.firebaseUser = { uid: decoded.uid };
        next();
    } catch (err) {
        console.error("Custom JWT Verification Failed:", err.message);
        return res.status(401).json({ success: false, message: "Invalid or expired session token." });
    }
}

export default authenticate;
