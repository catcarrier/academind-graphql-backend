exports.getPosts = (req,res,next) => {
    res.json({message:"hi there, the current time is " + new Date().toISOString()});
}

exports.createPost = (req,res,next) => {
    // TODO connect to the db
    const title = req.body.title;
    const content = req.body.content;
    res.status(201).json({
        message: "Post created OK",
        post : {
           id: new Date(),
           title: title,
           content:content
        }
    })
}