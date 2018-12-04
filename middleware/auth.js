const jwt = require('jsonwebtoken');

// validate that the token is attached and valid
module.exports = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if(!authHeader) {
        req.isAuth = false; // User is not authenticated; handle this in the resolver, not here
        return next();
    }

    const token = authHeader.split(' ')[1]; // 'Bearer <token>' <-- token comes after the space
    let decodedToken;
    try {
        // TODO import the secret
        decodedToken = jwt.verify(token, 'secret secret hush hush on the QT')   
    } catch(e) {
        req.isAuth = false; // user not authenticated, let the resolver handle it
        return next();
    }

    if(!decodedToken) {
        req.isAuth = false; // user not authenticated, let the resolver handle it
        return next();
    }

    req.userId = decodedToken.userId;
    req.isAuth = true;
    next();
}