import jwt from "jsonwebtoken"
const isAuth = async (req, res, next) => {

    try {
        let { token } = req.cookies
        console.log("", req.cookies)
        if (!token) {
            return res.status(400).json({ message: "user doesn't have a token" })
        }
        let verifyToken = jwt.verify(token, process.env.JWT_SECRET)
        if (!verifyToken) {
            return res.status(400).json({ message: "user doesn't have a valid token" })
        }
        req.userId = verifyToken.userId
        return next()

    } catch (error) {

        res.status(500).json({ message: `isAuth error ${error}` })
    }
}
export default isAuth



