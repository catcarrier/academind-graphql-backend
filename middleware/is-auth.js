const jwt = require('jsonwebtoken');

// validate that the token is attached and valid
module.exports = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if(!authHeader) {
        const error = new Error('Not authenticated');
        error.statusCode = 401;
        throw error;
    }

    const token = authHeader.split(' ')[1]; // 'Bearer <token>' <-- get the token
    let decodedToken;
    try {
        // TODO import the secret
        decodedToken = jwt.verify(token, 'secret secret hush hush on the QT')   
    } catch(e) {
        console.log(e)
        e.statusCode = 500;
        throw e;
    }

    if(!decodedToken) {
        const error = new Error('Not authenticated');
        error.statusCode = 401;
        throw error;
    }

    req.userId = decodedToken.userId;
    next();
}