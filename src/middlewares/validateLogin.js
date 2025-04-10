const { check, validationResult } = require('express-validator');

exports.validateLogin = [
  check('email')
    .isEmail()
    .withMessage('Email không hợp lệ'),
  check('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('login', {
        title: 'Đăng nhập',
        errors: errors.array(),
        old: req.body,
      });
    }
    next();
  },
];
