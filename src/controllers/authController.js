const bcrypt = require('bcrypt');
const User = require('../models/User');

const login = async (req, res) => {
  const { email, password } = req.body;
  const errors = [];

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      errors.push({ msg: 'Tài khoản chưa được đăng ký' });
      req.session.errors = errors;
      req.session.save();

      return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      errors.push({ msg: 'Email hoặc mật khẩu không đúng' });
      req.session.errors = errors;
      req.session.save();

      return res.redirect('/login');
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.username
    };

    req.session.save();

    return res.redirect('/translate');
  } catch (err) {
    errors.push({ msg: 'Đã xảy ra lỗi máy chủ, vui lòng thử lại sau.' });
    req.session.errors = errors;
    req.session.save();

    return res.redirect('/login');
  }
};

const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

module.exports = {
  login,
  logout
};
