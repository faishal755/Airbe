import User from "../model/user.model.js"
export const getCurrentUser = async (req, res) => {
    try {
        let user = await User.findById(req.userId).select
            ("-password").populate("listing", "title image1 image2 image3 description rent category city landmark isBooked host rating")
            .populate("booking", "title image1 image2 image3 description rent category city landmark isBooked host rating")
        if (!user) {
            res.status(400).json({ message: "user doesn't found" })
        }
        res.status(200).json(user)
    } catch (error) {
        res.status(500).json({ message: `getCurrentUser error ${error}` })
    }
}