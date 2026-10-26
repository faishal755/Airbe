import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
  try {
    let token =
      req.cookies?.token ||
      (req.headers?.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null) ||
      req.headers?.authorization ||
      req.headers?.token ||
      req.headers?.["x-access-token"];

    if (!token) {
      return res.status(401).json({ message: "user doesn't have a token" });
    }

    let verifyToken = jwt.verify(token, process.env.JWT_SECRET);
    if (!verifyToken) {
      return res.status(401).json({ message: "user doesn't have a valid token" });
    }
    req.userId = verifyToken.userId;
    return next();
  } catch (error) {
    return res.status(401).json({ message: `Authentication error: ${error.message}` });
  }
};

export default isAuth;



