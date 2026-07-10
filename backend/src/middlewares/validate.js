const logger = require('../utils/logger');

const validate = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        logger.warn('Validation Failed', { errors: err.errors, body: req.body });
        res.status(400).json({
            error: err.errors[0].message,
            field: err.errors[0].path[0],
            status: 400
        });
    }
};

module.exports = validate;
